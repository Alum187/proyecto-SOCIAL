// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IVotes} from "@openzeppelin/contracts/governance/utils/IVotes.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract SimpleDAO is ReentrancyGuard {
    enum ProposalState {
        Active,
        Approved,
        Rejected,
        Executed
    }

    struct Proposal {
        uint256 id;
        string title;
        string description;
        address payable target;
        uint256 amount;
        uint256 createdAt;
        uint256 snapshotBlock;
        uint256 deadline;
        uint256 votesFor;
        uint256 votesAgainst;
        bool executed;
    }

    uint256 public constant MIN_VOTING_DURATION = 1 minutes;
    uint256 public constant MAX_VOTING_DURATION = 30 days;

    IVotes public immutable governanceToken;
    uint256 public proposalCount;

    mapping(uint256 proposalId => Proposal proposal) private proposals;
    mapping(uint256 proposalId => mapping(address voter => bool)) public hasVoted;

    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed creator,
        string title,
        address target,
        uint256 amount,
        uint256 deadline
    );
    event VoteCast(uint256 indexed proposalId, address indexed voter, bool support, uint256 weight);
    event ProposalExecuted(uint256 indexed proposalId, address indexed target, uint256 amount);

    constructor(address tokenAddress) {
        require(tokenAddress != address(0), "Token cannot be zero address");
        governanceToken = IVotes(tokenAddress);
    }

    receive() external payable {}

    function createProposal(
        string calldata title,
        string calldata description,
        address payable target,
        uint256 amount,
        uint256 votingDuration
    ) external returns (uint256 proposalId) {
        require(bytes(title).length > 0, "Title is required");
        require(bytes(description).length > 0, "Description is required");
        require(target != address(0), "Target cannot be zero address");
        require(amount > 0, "Amount must be greater than zero");
        require(
            votingDuration >= MIN_VOTING_DURATION && votingDuration <= MAX_VOTING_DURATION,
            "Invalid voting duration"
        );

        proposalId = ++proposalCount;
        uint256 deadline = block.timestamp + votingDuration;
        proposals[proposalId] = Proposal({
            id: proposalId,
            title: title,
            description: description,
            target: target,
            amount: amount,
            createdAt: block.timestamp,
            snapshotBlock: block.number - 1,
            deadline: deadline,
            votesFor: 0,
            votesAgainst: 0,
            executed: false
        });

        emit ProposalCreated(proposalId, msg.sender, title, target, amount, deadline);
    }

    function vote(uint256 proposalId, bool support) external {
        Proposal storage proposal = _getProposal(proposalId);
        require(block.timestamp < proposal.deadline, "Voting has ended");
        require(!hasVoted[proposalId][msg.sender], "Already voted");

        uint256 weight = governanceToken.getPastVotes(msg.sender, proposal.snapshotBlock);
        require(weight > 0, "No governance tokens");

        hasVoted[proposalId][msg.sender] = true;
        if (support) {
            proposal.votesFor += weight;
        } else {
            proposal.votesAgainst += weight;
        }

        emit VoteCast(proposalId, msg.sender, support, weight);
    }

    function executeProposal(uint256 proposalId) external nonReentrant {
        Proposal storage proposal = _getProposal(proposalId);
        require(block.timestamp >= proposal.deadline, "Voting is still active");
        require(!proposal.executed, "Proposal already executed");
        require(proposal.votesFor > proposal.votesAgainst, "Proposal was not approved");
        require(address(this).balance >= proposal.amount, "Insufficient treasury balance");

        proposal.executed = true;
        (bool success,) = proposal.target.call{value: proposal.amount}("");
        require(success, "ETH transfer failed");

        emit ProposalExecuted(proposalId, proposal.target, proposal.amount);
    }

    function getProposal(uint256 proposalId) external view returns (Proposal memory) {
        return _getProposal(proposalId);
    }

    function getProposalState(uint256 proposalId) external view returns (ProposalState) {
        Proposal storage proposal = _getProposal(proposalId);
        if (proposal.executed) return ProposalState.Executed;
        if (block.timestamp < proposal.deadline) return ProposalState.Active;
        if (proposal.votesFor > proposal.votesAgainst) return ProposalState.Approved;
        return ProposalState.Rejected;
    }

    function _getProposal(uint256 proposalId) private view returns (Proposal storage) {
        require(proposalId > 0 && proposalId <= proposalCount, "Proposal does not exist");
        return proposals[proposalId];
    }
}