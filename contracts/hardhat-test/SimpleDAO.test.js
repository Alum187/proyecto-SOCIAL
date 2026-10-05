const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("SimpleDAO", function () {
  let owner;
  let voter;
  let secondVoter;
  let recipient;
  let token;
  let dao;

  const votingDuration = 60;
  const amount = ethers.parseEther("0.05");

  async function createProposal() {
    await dao.createProposal(
      "Buy a server",
      "Host the DAO services",
      recipient.address,
      amount,
      votingDuration,
    );
    return dao.proposalCount();
  }

  async function endVoting() {
    await time.increase(votingDuration + 1);
  }

  beforeEach(async function () {
    [owner, voter, secondVoter, recipient] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("GovernanceToken");
    token = await Token.deploy(owner.address);

    const DAO = await ethers.getContractFactory("SimpleDAO");
    dao = await DAO.deploy(await token.getAddress());

    await token.distribute(voter.address, ethers.parseEther("100"));
    await token.distribute(secondVoter.address, ethers.parseEther("30"));
  });

  it("deploys the SDT token and gives the initial supply to the owner", async function () {
    expect(await token.name()).to.equal("Simple DAO Token");
    expect(await token.symbol()).to.equal("SDT");
    expect(await token.balanceOf(owner.address)).to.equal(ethers.parseEther("1000000"));
    expect(await dao.governanceToken()).to.equal(await token.getAddress());
  });

  it("creates and stores a proposal", async function () {
    const proposalId = await createProposal();
    const proposal = await dao.getProposal(proposalId);

    expect(proposal.title).to.equal("Buy a server");
    expect(proposal.description).to.equal("Host the DAO services");
    expect(proposal.target).to.equal(recipient.address);
    expect(proposal.amount).to.equal(amount);
    expect(proposal.deadline).to.be.greaterThan(proposal.createdAt);
    expect(await dao.getProposalState(proposalId)).to.equal(0);
  });

  it("counts votes in favor using the voter's SDT balance", async function () {
    const proposalId = await createProposal();
    await dao.connect(voter).vote(proposalId, true);

    expect((await dao.getProposal(proposalId)).votesFor).to.equal(ethers.parseEther("100"));
    expect(await dao.hasVoted(proposalId, voter.address)).to.equal(true);
  });

  it("counts votes against", async function () {
    const proposalId = await createProposal();
    await dao.connect(voter).vote(proposalId, false);

    expect((await dao.getProposal(proposalId)).votesAgainst).to.equal(ethers.parseEther("100"));
  });

  it("uses voting power from the proposal snapshot so transferred SDT cannot be counted twice", async function () {
    const proposalId = await createProposal();
    await dao.connect(voter).vote(proposalId, true);
    await token.connect(voter).transfer(secondVoter.address, ethers.parseEther("100"));
    await dao.connect(secondVoter).vote(proposalId, false);

    const proposal = await dao.getProposal(proposalId);
    expect(proposal.votesFor).to.equal(ethers.parseEther("100"));
    expect(proposal.votesAgainst).to.equal(ethers.parseEther("30"));
  });

  it("automatically delegates tokens received through a regular ERC20 transfer", async function () {
    const [, , , , newVoter] = await ethers.getSigners();
    await token.connect(voter).transfer(newVoter.address, ethers.parseEther("5"));
    const proposalId = await createProposal();

    expect(await token.delegates(newVoter.address)).to.equal(newVoter.address);
    await dao.connect(newVoter).vote(proposalId, true);
    expect((await dao.getProposal(proposalId)).votesFor).to.equal(ethers.parseEther("5"));
  });

  it("prevents an address from voting twice", async function () {
    const proposalId = await createProposal();
    await dao.connect(voter).vote(proposalId, true);

    await expect(dao.connect(voter).vote(proposalId, false)).to.be.revertedWith("Already voted");
  });

  it("rejects votes from accounts without SDT", async function () {
    const [, , , , unprivileged] = await ethers.getSigners();
    const proposalId = await createProposal();

    await expect(dao.connect(unprivileged).vote(proposalId, true)).to.be.revertedWith(
      "No governance tokens",
    );
  });

  it("does not accept votes after the deadline", async function () {
    const proposalId = await createProposal();
    await endVoting();

    await expect(dao.connect(voter).vote(proposalId, true)).to.be.revertedWith("Voting has ended");
  });

  it("marks a proposal approved when votes in favor win", async function () {
    const proposalId = await createProposal();
    await dao.connect(voter).vote(proposalId, true);
    await dao.connect(secondVoter).vote(proposalId, false);
    await endVoting();

    expect(await dao.getProposalState(proposalId)).to.equal(1);
  });

  it("marks a proposal rejected when votes against win", async function () {
    const proposalId = await createProposal();
    await dao.connect(voter).vote(proposalId, false);
    await dao.connect(secondVoter).vote(proposalId, true);
    await endVoting();

    expect(await dao.getProposalState(proposalId)).to.equal(2);
    await expect(dao.executeProposal(proposalId)).to.be.revertedWith("Proposal was not approved");
  });

  it("receives ETH and executes an approved proposal only once", async function () {
    const treasuryDeposit = ethers.parseEther("1");
    await owner.sendTransaction({ to: await dao.getAddress(), value: treasuryDeposit });
    const proposalId = await createProposal();
    await dao.connect(voter).vote(proposalId, true);
    await endVoting();

    const recipientBalanceBefore = await ethers.provider.getBalance(recipient.address);
    await dao.executeProposal(proposalId);

    expect(await ethers.provider.getBalance(recipient.address)).to.equal(
      recipientBalanceBefore + amount,
    );
    expect(await ethers.provider.getBalance(await dao.getAddress())).to.equal(
      treasuryDeposit - amount,
    );
    expect(await dao.getProposalState(proposalId)).to.equal(3);
    await expect(dao.executeProposal(proposalId)).to.be.revertedWith("Proposal already executed");
  });
});