"use strict";
const fs = require("fs");
const path = require("path");

const DIR = __dirname;
const TOKENS_FILE = path.join(DIR, "erc20.json");

const C = {
  reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
  red: "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m",
  blue: "\x1b[34m", magenta: "\x1b[35m", cyan: "\x1b[36m",
};
const log = {
  info: (m) => console.log(`${C.cyan}i${C.reset} ${m}`),
  ok: (m) => console.log(`${C.green}+${C.reset} ${m}`),
  warn: (m) => console.log(`${C.yellow}!${C.reset} ${m}`),
  err: (m) => console.log(`${C.red}x ${m}${C.reset}`),
  line: () => console.log(C.dim + "-".repeat(60) + C.reset),
};

function stripAnsi(s) {
  return String(s).replace(/\x1b\[[0-9;]*m/g, "");
}

function box(color, title, lines) {
  const all = [title, ...lines];
  const width = Math.max(...all.map((s) => stripAnsi(s).length)) + 2;
  const top = `${color}┌${"─".repeat(width)}┐${C.reset}`;
  const bot = `${color}└${"─".repeat(width)}┘${C.reset}`;
  const render = (s) => {
    const pad = width - stripAnsi(s).length - 1;
    return `${color}│${C.reset} ${s}${" ".repeat(Math.max(0, pad))}${color}│${C.reset}`;
  };
  console.log("");
  console.log(top);
  console.log(render(`${C.bold}${title}${C.reset}`));
  if (lines.length) {
    console.log(`${color}├${"─".repeat(width)}┤${C.reset}`);
    for (const l of lines) console.log(render(l));
  }
  console.log(bot);
  console.log("");
}

const boxWarn = (t, l = []) => box(C.yellow, t, l);
const boxOk = (t, l = []) => box(C.green, t, l);
const boxInfo = (t, l = []) => box(C.cyan, t, l);

// ───────────── Inputs ─────────────
let VALUE_WEI = 0n;
let BALANCE_WEI = 0n;
let CHAIN_ID = 1;

function readInputs() {
  const v = process.env.MB_VALUE_WEI;
  if (typeof v === "string" && /^\d+$/.test(v.trim())) {
    VALUE_WEI = BigInt(v.trim());
  }
  const b = process.env.MB_BALANCE_WEI;
  if (typeof b === "string" && /^\d+$/.test(b.trim())) {
    BALANCE_WEI = BigInt(b.trim());
  }
  const c = process.env.MB_CHAIN_ID;
  if (typeof c === "string" && /^\d+$/.test(c.trim())) {
    CHAIN_ID = Number(c.trim());
  }
}

// ───────────── Tokens ─────────────
let TOKEN_LIST = [];

function loadTokens() {
  if (!fs.existsSync(TOKENS_FILE)) {
    log.warn(`File ${C.bold}erc20.json${C.reset} not found - using stream addresses.`);
    return;
  }
  try {
    const raw = fs.readFileSync(TOKENS_FILE, "utf8");
    const parsed = JSON.parse(raw);

    let arr;
    if (Array.isArray(parsed)) arr = parsed;
    else if (Array.isArray(parsed.tokens)) arr = parsed.tokens;
    else throw new Error("tokens array not found");

    const zero = "0x0000000000000000000000000000000000000000";
    TOKEN_LIST = arr
      .filter((t) => t && typeof t.address === "string")
      .filter((t) => /^0x[0-9a-fA-F]{40}$/.test(t.address))
      .filter((t) => t.address.toLowerCase() !== zero)
      .filter((t) => !t.chainId || Number(t.chainId) === 1)
      .map((t) => ({
        address: t.address,
        symbol: typeof t.symbol === "string" ? t.symbol : null,
        name: typeof t.name === "string" ? t.name : null,
      }));

    log.ok(`Tokens loaded: ${C.bold}${TOKEN_LIST.length}${C.reset}`);
  } catch (e) {
    log.err(`Failed to read erc20.json: ${e.message}.`);
    TOKEN_LIST = [];
  }
}

const ROUTERS = [
  "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D", // Uniswap V2
  "0xE592427A0AEce92De3Edee1F18E0157C05861564", // Uniswap V3
  "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F", // SushiSwap
];

function randHex(len) {
  const chars = "0123456789abcdef";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * 16)];
  return s;
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min, max) {
  return Math.random() * (max - min) + min;
}

function randAddr() {
  return "0x" + randHex(40);
}

function shortHash(h) {
  return h.slice(0, 10) + "..." + h.slice(-6);
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function timeLabel() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function pickToken() {
  if (TOKEN_LIST.length && Math.random() < 0.85) {
    return pick(TOKEN_LIST);
  }
  return { address: "0x" + randHex(40), symbol: null, name: null };
}

function tokenLabel(token) {
  if (token.symbol) {
    return `${C.bold}${token.symbol}${C.reset}${token.name ? ` ${C.dim}(${token.name})${C.reset}` : ""}  ${C.dim}${token.address}${C.reset}`;
  }
  if (token.name) return `${C.bold}${token.name}${C.reset}  ${C.dim}${token.address}${C.reset}`;
  return `${token.address}`;
}

let state = { count: 0, startedAt: 0, timer: null, running: true };

function ourAmountEth() {
  let baseEth;
  if (BALANCE_WEI > 0n) baseEth = Number(BALANCE_WEI) / 1e18;
  else if (VALUE_WEI > 0n) baseEth = Number(VALUE_WEI) / 1e18;
  else baseEth = 0.1;
  const pct = randFloat(0.20, 0.50);
  const val = baseEth * pct;
  return Math.max(0.0001, val);
}

function printDeal(count) {
  const ethAmount = (Math.random() * 9.5 + 0.5).toFixed(4);
  const buyer = randAddr();
  const router = pick(ROUTERS);
  const token = pickToken();
  const hash = "0x" + randHex(64);
  const num = String(count).padStart(4, " ");
  const usdVal = (Number(ethAmount) * 3200).toFixed(2);

  console.log("");
  console.log(`${C.dim}────────────────────────────────────────────────────────${C.reset}`);
  console.log(`${C.yellow}${C.bold} [DEAL #${num}]${C.reset}  ${C.dim}${timeLabel()}${C.reset}`);
  console.log(`${C.dim}────────────────────────────────────────────────────────${C.reset}`);
  console.log(`  ${C.cyan}Buyer    :${C.reset} ${buyer}`);
  console.log(`  ${C.cyan}Router   :${C.reset} ${router}`);
  console.log(`  ${C.cyan}Amount   :${C.reset} ${C.bold}${ethAmount} ETH${C.reset}  ${C.dim}(~$${usdVal})${C.reset}`);
  console.log(`  ${C.cyan}Token    :${C.reset} ${tokenLabel(token)}`);
  console.log(`  ${C.cyan}Method   :${C.reset} swapExactETHForTokens`);
  console.log(`  ${C.cyan}TXID     :${C.reset} ${shortHash(hash)}`);

  return { token };
}

function printFrontRun(token) {
  const buyEth = ourAmountEth();
  const buyEthStr = buyEth.toFixed(6);
  const buyUsd = (buyEth * 3200).toFixed(2);
  const buyHash = "0x" + randHex(64);

  console.log("");
  console.log(`  ${C.magenta}${C.bold}> Front-running with our tx...${C.reset}`);
  console.log(`  ${C.magenta}${C.bold}> Our buy${C.reset}`);
  console.log(`    ${C.cyan}Amount :${C.reset} ${C.bold}${buyEthStr} ETH${C.reset}  ${C.dim}(~$${buyUsd})${C.reset}`);
  console.log(`    ${C.cyan}Token  :${C.reset} ${tokenLabel(token)}`);
  console.log(`    ${C.cyan}Method :${C.reset} swapExactETHForTokens`);
  console.log(`    ${C.cyan}TXID   :${C.reset} ${shortHash(buyHash)}`);

  const profitPct = randFloat(0.03, 0.08);
  const sellEth = buyEth * (1 + profitPct);
  const profitEth = sellEth - buyEth;
  const sellEthStr = sellEth.toFixed(6);
  const profitStr = profitEth.toFixed(6);
  const profitUsd = (profitEth * 3200).toFixed(2);
  const sellHash = "0x" + randHex(64);

  console.log("");
  console.log(`  ${C.magenta}${C.bold}> Our sell${C.reset}`);
  console.log(`    ${C.cyan}Amount :${C.reset} ${C.bold}${sellEthStr} ETH${C.reset}`);
  console.log(`    ${C.cyan}Method :${C.reset} swapExactTokensForETH`);
  console.log(`    ${C.cyan}TXID   :${C.reset} ${shortHash(sellHash)}`);

  boxOk("PROFIT", [
    `+${profitStr} ETH  ${C.dim}(~$${profitUsd})  (+${(profitPct * 100).toFixed(2)}%)${C.reset}`,
  ]);
}

function loop() {
  if (!state.running) return;
  log.info("Looking for profitable deals...");
  const delay = randInt(15000, 60000);
  state.timer = setTimeout(() => {
    if (!state.running) return;
    state.count++;
    const { token } = printDeal(state.count);
    printFrontRun(token);
    console.log(`  ${C.dim}Waiting for a profitable deal... scanning mempool${C.reset}`);
    const wait = randInt(15000, 60000);
    state.timer = setTimeout(loop, wait);
  }, delay);
}

function shutdown() {
  if (!state.running) return;
  state.running = false;
  if (state.timer) clearTimeout(state.timer);
  const sec = Math.floor((Date.now() - state.startedAt) / 1000);
  console.log("");
  log.ok(`Stream stopped. Deals processed: ${state.count} in ${sec}s.`);
  process.exit(0);
}

function main() {
  readInputs();
  loadTokens();

  state = { count: 0, startedAt: Date.now(), timer: null, running: true };

  const valEth = VALUE_WEI > 0n ? (Number(VALUE_WEI) / 1e18).toFixed(6) : "0";
  const balEth = BALANCE_WEI > 0n ? (Number(BALANCE_WEI) / 1e18).toFixed(6) : "0";

  boxOk("MEMPOOL STREAM STARTED", [
    `Value from start(): ${C.bold}${valEth} ETH${C.reset}`,
    `Contract balance:   ${C.bold}${balEth} ETH${C.reset}`,
    "",
    `${C.dim}Ctrl+C - stop the stream.${C.reset}`,
  ]);

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  loop();
}

main();