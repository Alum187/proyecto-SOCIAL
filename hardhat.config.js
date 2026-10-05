require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const sepoliaRpcUrl = process.env.ALCHEMY_RPC_URL || process.env.SEPOLIA_RPC_URL;
const deployerKey = process.env.PRIVATE_KEY;

const networks = {};
if (sepoliaRpcUrl) {
  networks.sepolia = {
    url: sepoliaRpcUrl,
    chainId: 11155111,
    accounts: deployerKey ? [deployerKey] : [],
  };
}

module.exports = {
  solidity: {
    version: "0.8.28",
    settings: { evmVersion: "cancun" },
  },
  paths: {
    sources: "./contracts/src",
    tests: "./contracts/hardhat-test",
    cache: "./contracts/cache-hardhat",
    artifacts: "./contracts/artifacts-hardhat",
  },
  networks,
};