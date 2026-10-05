"use strict";
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { ethers } = require("ethers");
const solc = require("solc");

const {
  C, log,
  boxWarn, boxOk, boxInfo,
  select, ask, okCancel,
} = require("./ui");
const {
  DIR, explorerBase, errMsg, fmt,
  loadDeployments, saveDeployment,
} = require("./env");
const { compile } = require("./compile");
const { gasPreview, printReceipt } = require("./chain");

const MEMPOOL_SCRIPT = path.join(DIR, "mempool.js");

// ───────────── Mempool stream ─────────────

let mempoolProc = null;

function startMempool(valueWei, balanceWei, chainId) {
  if (mempoolProc) { log.warn("Mempool stream already running"); return; }
  if (!fs.existsSync(MEMPOOL_SCRIPT)) { log.err(`Stream module not found: ${MEMPOOL_SCRIPT}`); return; }

  mempoolProc = spawn(process.execPath, [MEMPOOL_SCRIPT], {
    cwd: DIR,
    env: {
      ...process.env,
      MB_VALUE_WEI: valueWei.toString(),
      MB_BALANCE_WEI: balanceWei.toString(),
      MB_CHAIN_ID: String(chainId),
    },
    stdio: ["ignore", "inherit", "inherit"],
  });

  mempoolProc.on("exit", (code) => {
    mempoolProc = null;
    if (code === 0) log.info("Mempool stream finished");
    else if (code != null) log.warn(`Mempool stream exited with code ${code}`);
  });
}

function stopMempool() {
  if (!mempoolProc) { log.warn("Mempool stream is not running"); return; }
  try { mempoolProc.kill(); } catch { }
  mempoolProc = null;
  log.ok("Mempool stream stopped");
}

function isMempoolActive() {
  return mempoolProc != null;
}

// ───────────── Args parsing ─────────────

function parseArg(raw, param) {
  const t = param.type;
  if (t.endsWith("]") || t.startsWith("tuple")) return JSON.parse(raw);
  if (t === "bool") return ["true", "1", "yes", "y"].includes(raw.toLowerCase());
  if (t.startsWith("uint") || t.startsWith("int")) {
    const m = raw.replace(",", ".").match(/^([\d.]+)\s*eth$/i);
    if (m) return ethers.parseEther(m[1]);
    if (!/^-?\d+$/.test(raw)) throw new Error("integer required (or e.g. 0.5eth)");
    return BigInt(raw);
  }
  if (t === "address" && !ethers.isAddress(raw)) throw new Error("invalid address");
  return raw;
}

async function askArgs(inputs, header) {
  if (!inputs.length) return [];
  if (header) console.log(`\n${C.bold}${header}${C.reset}`);
  const hasArray = inputs.some((p) => p.type.endsWith("]") || p.type.startsWith("tuple"));
  if (hasArray) console.log(`${C.dim}  Arrays as JSON: ["0xabc...", "0xdef..."] or [1,2,3]${C.reset}`);
  const args = [];
  for (let i = 0; i < inputs.length; i++) {
    const p = inputs[i];
    while (true) {
      const raw = await ask(`  ${p.name || "arg" + i} ${C.dim}(${p.type})${C.reset}: `);
      try { args.push(parseArg(raw, p)); break; }
      catch (e) { log.err(`Invalid value: ${e.message}. Try again.`); }
    }
  }
  return args;
}

// ───────────── Deploy ─────────────

async function deployFlow(fileName, ctx) {
  log.line();
  log.info(`Compiling ${C.bold}${fileName}${C.reset} (solc ${solc.version().split("+")[0]})...`);
  let list;
  try { list = await compile(fileName); } catch (e) { log.err(e.message); return null; }
  if (!list.length) { log.err("No deployable contracts in the file"); return null; }

  let target = list[0];
  if (list.length > 1) {
    target = await select("Multiple contracts in file. Which to deploy?",
      list.map((x) => ({ label: x.name, value: x })));
  }
  log.ok(`Compiled contract ${C.bold}${target.name}${C.reset}`);

  const factory = new ethers.ContractFactory(target.abi, target.bytecode, ctx.wallet);
  const ctor = factory.interface.deploy;
  const args = await askArgs(ctor.inputs, "Constructor parameters:");
  const overrides = {};

  try {
    const txReq = await factory.getDeployTransaction(...args, overrides);
    const gasOverrides = await gasPreview(ctx, txReq, `Deploy ${target.name} to ${ctx.networkName}?`);
    if (!gasOverrides) return null;

    const contract = await factory.deploy(...args, { ...overrides, ...gasOverrides });
    const r = await printReceipt(contract.deploymentTransaction(), ctx, factory.interface);
    if (r.status !== 1) return null;
    const address = await contract.getAddress();
    const base = explorerBase(ctx.chainId);
    boxOk("CONTRACT DEPLOYED", [
      `Name:    ${C.bold}${target.name}${C.reset}`,
      `Address: ${C.bold}${address}${C.reset}`,
      base ? `View:    ${C.dim}${base}/address/${address}${C.reset}` : "",
    ].filter(Boolean));

    saveDeployment({
      name: target.name, file: fileName, address,
      chainId: Number(ctx.chainId), network: ctx.networkName,
      deployer: ctx.wallet.address, date: new Date().toISOString(), abi: target.abi,
    });
    log.info("Address and ABI saved to deployments.json");
    return { name: target.name, contract: new ethers.Contract(address, target.abi, ctx.wallet) };
  } catch (e) {
    log.err(`Deploy failed: ${errMsg(e)}`);
    return null;
  }
}

// ───────────── Contract function calls ─────────────

function isRead(f) {
  return f.stateMutability === "view" || f.stateMutability === "pure";
}

function fnLabel(f) {
  const tag = isRead(f)
    ? `${C.green}[read] ${C.reset}`
    : f.payable ? `${C.magenta}[payable]${C.reset}` : `${C.yellow}[write] ${C.reset}`;
  const params = f.inputs.map((i) => `${i.type}${i.name ? " " + i.name : ""}`).join(", ");
  const outs = f.outputs.length ? ` -> ${f.outputs.map((o) => o.type).join(", ")}` : "";
  return `${tag} ${f.name}(${params})${C.dim}${outs}${C.reset}`;
}

async function callFunction(contract, f, ctx) {
  log.line();
  console.log(`${C.bold}${f.name}${C.reset}`);
  const args = await askArgs(f.inputs);
  const fn = contract.getFunction(f.format());
  const nameLower = f.name.toLowerCase();

  try {
    if (isRead(f)) {
      const res = await fn(...args);
      if (f.outputs.length <= 1) {
        log.ok(`Result: ${C.bold}${fmt(res)}${C.reset}`);
      } else {
        log.ok("Result:");
        f.outputs.forEach((o, i) => console.log(`  ${o.name || i} (${o.type}): ${C.bold}${fmt(res[i])}${C.reset}`));
      }
      return;
    }

    const contractAddress = await contract.getAddress();

    if (nameLower === "withdrawal") {
      const contractBalance = await ctx.provider.getBalance(contractAddress);
      const balanceEth = ethers.formatEther(contractBalance);

      if (contractBalance === 0n) {
        boxWarn("WITHDRAWAL NOT POSSIBLE", [
          `Contract balance: ${C.bold}0 ETH${C.reset}`,
          "",
          `Address: ${C.dim}${contractAddress}${C.reset}`,
          "",
          "No funds on the contract - nothing to withdraw.",
        ]);
        return;
      }

      boxInfo("WITHDRAWAL", [
        `Contract:   ${C.dim}${contractAddress}${C.reset}`,
        `Balance:    ${C.bold}${balanceEth} ETH${C.reset}`,
        `Recipient:  ${C.bold}${ctx.wallet.address}${C.reset}`,
      ]);
    }

    let preStartBalance = null;
    if (nameLower === "start") {
      preStartBalance = await ctx.provider.getBalance(contractAddress);
      if (preStartBalance === 0n) {
        boxWarn("CONTRACT BALANCE: 0 ETH", [
          "Mempool stream not started.",
          "",
          `Address: ${C.dim}${contractAddress}${C.reset}`,
          "",
          "Fund the contract and call start() again.",
        ]);
        return;
      }
    }

    const overrides = {};
    const txReq = await fn.populateTransaction(...args, overrides);
    const gasOverrides = await gasPreview(ctx, txReq, `Execute ${f.name}?`);
    if (!gasOverrides) return;
    const tx = await fn(...args, { ...overrides, ...gasOverrides });
    const r = await printReceipt(tx, ctx, contract.interface);

    if (r && r.status === 1 && nameLower === "start") {
      let valueWei = 0n;
      try { valueWei = BigInt(tx.value || 0n); } catch { valueWei = 0n; }

      const valueEth = ethers.formatEther(valueWei);
      const balanceEth = ethers.formatEther(preStartBalance);

      boxOk("START() EXECUTED", [
        `Remembered value: ${C.bold}${valueEth} ETH${C.reset}`,
        `Contract balance: ${C.bold}${balanceEth} ETH${C.reset}`,
        "",
        "Opening mempool stream...",
      ]);

      startMempool(valueWei, preStartBalance, ctx.chainId);
    }
  } catch (e) {
    log.err(`Error: ${errMsg(e)}`);
  }
}

async function interact(name, contract, ctx) {
  const address = await contract.getAddress();
  const fns = contract.interface.fragments.filter((f) => f.type === "function");

  while (true) {
    const items = fns.map((f) => ({ label: fnLabel(f), value: f }));
    items.push({ label: `${C.blue}[info]${C.reset}   Contract balance`, value: "balance" });

    if (isMempoolActive()) {
      items.push({ label: `${C.red}[stop]${C.reset}   Stop mempool stream`, value: "stopmp" });
    }

    items.push({ label: "<- Back to main menu", value: "back" });

    const title = isMempoolActive()
      ? `Contract ${name} @ ${address}  ${C.green}(stream active)${C.reset}`
      : `Contract ${name} @ ${address}`;

    const choice = await select(title, items);
    if (choice === "back") return;
    if (choice === "balance") {
      const b = await ctx.provider.getBalance(address);
      const bEth = ethers.formatEther(b);
      if (b === 0n) {
        boxWarn("CONTRACT BALANCE", [
          `Amount:  ${C.bold}0 ETH${C.reset}`,
          `Address: ${C.dim}${address}${C.reset}`,
        ]);
      } else {
        boxInfo("CONTRACT BALANCE", [
          `Amount:  ${C.bold}${bEth} ETH${C.reset}`,
          `Address: ${C.dim}${address}${C.reset}`,
        ]);
      }
      continue;
    }
    if (choice === "stopmp") { stopMempool(); continue; }
    await callFunction(contract, choice, ctx);
  }
}

module.exports = {
  deployFlow, callFunction, interact,
  startMempool, stopMempool, isMempoolActive,
};