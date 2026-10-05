"use strict";
const { ethers } = require("ethers");
const { C, log, okCancel } = require("./ui");
const { explorerBase, errMsg, fmt } = require("./env");

// Chainlink ETH/USD oracle addresses per chainId
const ETH_USD_FEEDS = {
  1: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",        // Ethereum Mainnet
  11155111: "0x694AA1769357215DE4FAC081bf1f309aDC325306", // Sepolia
};

async function ethUsdPrice(ctx) {
  const feedAddr = ETH_USD_FEEDS[Number(ctx.chainId)];
  if (!feedAddr) return null;
  try {
    const feed = new ethers.Contract(feedAddr,
      ["function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)"], ctx.provider);
    const r = await feed.latestRoundData();
    return Number(r[1]) / 1e8;
  } catch { return null; }
}

async function gasPreview(ctx, txReq, title) {
  log.line();
  log.info("Estimating current gas...");

  let gasEstimate;
  try {
    gasEstimate = await ctx.provider.estimateGas({ ...txReq, from: ctx.wallet.address });
  } catch (e) {
    log.err(`Transaction would fail (gas estimation error): ${errMsg(e)}`);
    return null;
  }

  const [block, feeData, balance, usd] = await Promise.all([
    ctx.provider.getBlock("latest"),
    ctx.provider.getFeeData(),
    ctx.provider.getBalance(ctx.wallet.address),
    ethUsdPrice(ctx),
  ]);

  const gasLimit = (gasEstimate * 110n) / 100n;
  const value = txReq.value ? BigInt(txReq.value) : 0n;
  const gwei = (w) => `${Number(ethers.formatUnits(w, "gwei")).toFixed(4)} gwei`;
  const eth = (w) => `${C.bold}${ethers.formatEther(w)} ETH${C.reset}` +
    (usd ? ` ${C.dim}(~$${(Number(ethers.formatEther(w)) * usd).toFixed(2)})${C.reset}` : "");

  let overrides, expected, maxCost;
  if (block.baseFeePerGas != null) {
    const baseFee = block.baseFeePerGas;
    let priority;
    try { priority = BigInt(await ctx.provider.send("eth_maxPriorityFeePerGas", [])); }
    catch { priority = feeData.maxPriorityFeePerGas ?? ethers.parseUnits("1", "gwei"); }
    const maxFee = baseFee * 2n + priority;
    expected = gasEstimate * (baseFee + priority);
    maxCost = gasLimit * maxFee;
    overrides = { gasLimit, maxFeePerGas: maxFee, maxPriorityFeePerGas: priority };

    console.log(`  Gas (estimate):       ${C.bold}${gasEstimate}${C.reset} units`);
    console.log(`  Gas limit (+10%):     ${gasLimit}`);
    console.log(`  Base fee (block ${block.number}): ${gwei(baseFee)}`);
    console.log(`  Priority fee:         ${gwei(priority)}`);
    console.log(`  Max fee per gas:      ${gwei(maxFee)}`);
  } else {
    const gasPrice = feeData.gasPrice ?? 0n;
    expected = gasEstimate * gasPrice;
    maxCost = gasLimit * gasPrice;
    overrides = { gasLimit, gasPrice };
    console.log(`  Gas (estimate):       ${C.bold}${gasEstimate}${C.reset} units`);
    console.log(`  Gas limit (+10%):     ${gasLimit}`);
    console.log(`  Gas price:            ${gwei(gasPrice)}`);
  }

  console.log("");
  console.log(`  ${C.green}Fee now (expected):${C.reset}  ${eth(expected)}`);
  console.log(`  ${C.yellow}Fee maximum:${C.reset}         ${eth(maxCost)}`);
  if (value > 0n) {
    console.log(`  ETH to send:                ${eth(value)}`);
    console.log(`  Total maximum:              ${eth(maxCost + value)}`);
  }
  console.log(`  Your balance:               ${eth(balance)}`);
  if (usd) console.log(`  ${C.dim}ETH price: $${usd.toFixed(2)} (Chainlink)${C.reset}`);
  console.log(`  ${C.dim}Only actual gas used is charged - usually close to the "expected" amount.${C.reset}`);

  if (balance < maxCost + value) {
    log.warn("Balance may be insufficient for the maximum fee - the transaction may be rejected.");
  }

  const ok = await okCancel(title);
  if (!ok) { log.info("Cancelled"); return null; }
  return overrides;
}

async function printReceipt(tx, ctx, iface) {
  const base = explorerBase(ctx.chainId);
  log.info(`Transaction: ${tx.hash}`);
  if (base) log.info(`View: ${base}/tx/${tx.hash}`);
  log.info("Waiting for confirmation...");
  const r = await tx.wait();
  if (r.status === 1) log.ok(`Success, block ${r.blockNumber}`);
  else log.err("Transaction reverted");
  log.info(`Gas: ${r.gasUsed}  |  Fee: ${ethers.formatEther(r.fee)} ETH`);

  for (const l of r.logs) {
    try {
      const ev = iface.parseLog(l);
      if (!ev) continue;
      const args = ev.fragment.inputs.map((inp, i) => `${inp.name || i}=${fmt(ev.args[i])}`).join(", ");
      console.log(`  ${C.magenta}event${C.reset} ${ev.name}(${args})`);
    } catch { }
  }
  return r;
}

module.exports = { ethUsdPrice, gasPreview, printReceipt };