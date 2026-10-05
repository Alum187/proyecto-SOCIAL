const fs = require("node:fs");
const path = require("node:path");
const { artifacts, ethers } = require("hardhat");

async function main() {
  if (!process.env.PRIVATE_KEY) {
    throw new Error("Set PRIVATE_KEY in the root .env before deploying.");
  }

  const network = await ethers.provider.getNetwork();
  if (network.chainId !== 11155111n) {
    throw new Error(`Refusing to deploy to chain ${network.chainId}; Sepolia is required.`);
  }

  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  console.log(`Deploying with ${deployerAddress}`);

  const Token = await ethers.getContractFactory("GovernanceToken", deployer);
  const token = await Token.deploy(deployerAddress);
  await token.waitForDeployment();

  const DAO = await ethers.getContractFactory("SimpleDAO", deployer);
  const dao = await DAO.deploy(await token.getAddress());
  await dao.waitForDeployment();

  const [tokenArtifact, daoArtifact] = await Promise.all([
    artifacts.readArtifact("GovernanceToken"),
    artifacts.readArtifact("SimpleDAO"),
  ]);
  const deployment = {
    network: "sepolia",
    chainId: Number(network.chainId),
    tokenAddress: await token.getAddress(),
    daoAddress: await dao.getAddress(),
    tokenAbi: tokenArtifact.abi,
    daoAbi: daoArtifact.abi,
  };
  const outputPath = path.resolve(__dirname, "../../frontend/src/contracts/deployed.json");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(deployment, null, 2)}\n`);

  console.log(`Governance Token: ${deployment.tokenAddress}`);
  console.log(`DAO: ${deployment.daoAddress}`);
  console.log(`Frontend deployment config: ${path.relative(process.cwd(), outputPath)}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});