"use strict";
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const { C, log, select } = require("./lib/ui");
const { DIR, loadEnv, loadDeployments, errMsg } = require("./lib/env");
const { deployFlow, interact, stopMempool } = require("./lib/contract");

const DEFAULT_RPC = "https://sepolia.infura.io/v3/";

async function main() {
  console.log(`\n${C.bold}${C.cyan}=== Ethereum Contract Deployer ===${C.reset}\n`);

  if (!loadEnv()) log.warn(".env file not found next to the script");

  let pk = (process.env.PRIVATE_KEY || "").trim();
  if (!pk) {
    log.err("PRIVATE_KEY is not set in .env. Open .env and fill in the private key.");
    process.exit(1);
  }
  if (!pk.startsWith("0x")) pk = "0x" + pk;

  const rpc = process.env.RPC_URL || DEFAULT_RPC;
  const provider = new ethers.JsonRpcProvider(rpc);
  let wallet;
  try { wallet = new ethers.Wallet(pk, provider); }
  catch { log.err("PRIVATE_KEY in .env has invalid format"); process.exit(1); }

  let network;
  try { network = await provider.getNetwork(); }
  catch (e) { log.err(`Cannot connect to RPC (${rpc}): ${errMsg(e)}`); process.exit(1); }

  const ctx = {
    provider, wallet, chainId: network.chainId,
    networkName: network.name === "unknown" ? `chainId ${network.chainId}` : network.name,
  };

  const balance = await provider.getBalance(wallet.address);
  log.info(`Network: ${C.bold}${ctx.networkName}${C.reset} (chainId ${ctx.chainId})`);
  log.info(`Wallet:  ${wallet.address}`);
  log.info(`Balance: ${ethers.formatEther(balance)} ETH`);
  if (Number(ctx.chainId) === 1) log.warn(`${C.bold}THIS IS MAINNET - transactions cost real money!${C.reset}`);
  if (balance === 0n) log.warn("Balance is zero - deploy will fail. Fund the wallet.");

  while (true) {
    const solFiles = fs.readdirSync(DIR).filter((f) => f.toLowerCase().endsWith(".sol"));
    const saved = loadDeployments().filter((d) => d.chainId === Number(ctx.chainId));

    const items = solFiles.map((f) => ({ label: `Deploy ${C.bold}${f}${C.reset}`, value: { type: "deploy", file: f } }));
    saved.slice(-5).reverse().forEach((d) => items.push({
      label: `Open deployed ${d.name} ${C.dim}(${d.address.slice(0, 10)}..., ${d.date.slice(0, 10)})${C.reset}`,
      value: { type: "open", d },
    }));
    items.push({ label: "Exit", value: { type: "exit" } });

    if (!solFiles.length) log.warn("No .sol files in the script folder");

    const choice = await select("Main menu", items);
    if (choice.type === "exit") break;

    if (choice.type === "deploy") {
      const res = await deployFlow(choice.file, ctx);
      if (res) await interact(res.name, res.contract, ctx);
    } else if (choice.type === "open") {
      const { d } = choice;
      await interact(d.name, new ethers.Contract(d.address, d.abi, wallet), ctx);
    }
  }

  stopMempool();
  console.log("Bye!");
  process.exit(0);
}

main().catch((e) => {
  log.err(errMsg(e));
  process.exit(1);
});