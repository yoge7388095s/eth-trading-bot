"use strict";
const fs = require("fs");
const path = require("path");
const solc = require("solc");
const { DIR } = require("./env");
const { log, C } = require("./ui");

function findImports(importPath) {
  const candidates = [path.join(DIR, importPath), path.join(DIR, "node_modules", importPath)];
  for (const f of candidates) {
    if (fs.existsSync(f)) return { contents: fs.readFileSync(f, "utf8") };
  }
  return { error: `Import not found: ${importPath}` };
}

const IMPORT_RE = /^(\s*import\s+(?:[^'";]*?\bfrom\s+)?)(["'])([^"']+)\2/gm;

function isUrl(p) {
  return /^https?:\/\//i.test(p) || /^github\.com\//i.test(p);
}

function normalizeUrl(u) {
  if (/^github\.com\//i.test(u)) u = "https://" + u;
  const m = u.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/(?:blob|raw)\/(.+)$/i);
  if (m) return `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[3]}`;
  return u;
}

function resolveImport(imp, fromKey) {
  if (isUrl(imp)) return normalizeUrl(imp);
  if (imp.startsWith("./") || imp.startsWith("../")) {
    if (isUrl(fromKey)) return new URL(imp, fromKey).href;
    return path.posix.normalize(path.posix.join(path.posix.dirname(fromKey), imp));
  }
  if (fs.existsSync(path.join(DIR, imp))) return imp;
  if (fs.existsSync(path.join(DIR, "node_modules", imp))) return "node_modules/" + imp;
  return "https://cdn.jsdelivr.net/npm/" + imp;
}

const downloadCache = new Map();

async function readSource(key) {
  if (isUrl(key)) {
    if (downloadCache.has(key)) return downloadCache.get(key);
    log.info(`${C.dim}downloading ${key}${C.reset}`);
    const res = await fetch(key);
    if (!res.ok) throw new Error(`Failed to download import ${key} (HTTP ${res.status})`);
    const text = await res.text();
    downloadCache.set(key, text);
    return text;
  }
  const file = path.join(DIR, key);
  if (!fs.existsSync(file)) throw new Error(`Import file not found: ${key}`);
  return fs.readFileSync(file, "utf8");
}

async function collectSources(fileName) {
  const sources = {};
  const queue = [fileName];
  while (queue.length) {
    const key = queue.shift();
    if (sources[key]) continue;
    const raw = await readSource(key);
    const content = raw.replace(IMPORT_RE, (all, pre, q, imp) => {
      const resolved = resolveImport(imp, key);
      if (!sources[resolved] && !queue.includes(resolved)) queue.push(resolved);
      return `${pre}${q}${resolved}${q}`;
    });
    sources[key] = { content };
  }
  return sources;
}

async function compile(fileName) {
  const sources = await collectSources(fileName);
  const input = {
    language: "Solidity",
    sources,
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
    },
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));

  let failed = false;
  for (const e of output.errors || []) {
    if (e.severity === "error") { failed = true; log.err(e.formattedMessage); }
    else log.warn(e.formattedMessage.split("\n")[0]);
  }
  if (failed) throw new Error("Compilation failed - fix errors in the .sol file");

  return Object.entries(output.contracts[fileName] || {})
    .filter(([, v]) => v.evm.bytecode.object.length > 0)
    .map(([name, v]) => ({ name, abi: v.abi, bytecode: "0x" + v.evm.bytecode.object }));
}

module.exports = { compile };