"use strict";
const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "..");
const DEPLOYMENTS_FILE = path.join(DIR, "deployments.json");

function loadEnv() {
  const file = path.join(DIR, ".env");
  if (!fs.existsSync(file)) return false;
  for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i === -1) continue;
    const key = line.slice(0, i).trim();
    const val = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    if (!(key in process.env)) process.env[key] = val;
  }
  return true;
}

function loadDeployments() {
  try { return JSON.parse(fs.readFileSync(DEPLOYMENTS_FILE, "utf8")); } catch { return []; }
}

function saveDeployment(d) {
  const all = loadDeployments();
  all.push(d);
  fs.writeFileSync(DEPLOYMENTS_FILE, JSON.stringify(all, null, 2));
}

function explorerBase(chainId) {
  return {
    1: "https://etherscan.io",
    11155111: "https://sepolia.etherscan.io",
    17000: "https://holesky.etherscan.io",
    560048: "https://hoodi.etherscan.io",
  }[Number(chainId)];
}

function errMsg(e) {
  return e?.reason || e?.shortMessage || e?.info?.error?.message || e?.message || String(e);
}

function fmt(v) {
  if (typeof v === "bigint") return v.toString();
  if (Array.isArray(v)) return "[" + Array.from(v).map(fmt).join(", ") + "]";
  return String(v);
}

module.exports = {
  DIR, DEPLOYMENTS_FILE,
  loadEnv, loadDeployments, saveDeployment,
  explorerBase, errMsg, fmt,
};