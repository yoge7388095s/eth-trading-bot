"use strict";
const readline = require("readline");

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

const boxWarn = (title, lines = []) => box(C.yellow, title, lines);
const boxErr = (title, lines = []) => box(C.red, title, lines);
const boxOk = (title, lines = []) => box(C.green, title, lines);
const boxInfo = (title, lines = []) => box(C.cyan, title, lines);

function select(title, items) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    readline.emitKeypressEvents(stdin);
    if (stdin.isTTY) stdin.setRawMode(true);
    stdin.resume();

    let idx = 0;
    let drawn = 0;
    const render = () => {
      if (drawn) {
        readline.moveCursor(process.stdout, 0, -drawn);
        readline.clearScreenDown(process.stdout);
      }
      const out = ["", `${C.bold}${title}${C.reset}`];
      items.forEach((it, i) => {
        out.push(i === idx ? `${C.cyan}${C.bold}> ${it.label}${C.reset}` : `  ${it.label}`);
      });
      out.push(`${C.dim}up/down - select, Enter - ok, Ctrl+C - exit${C.reset}`);
      process.stdout.write(out.join("\n") + "\n");
      drawn = out.length;
    };
    const cleanup = () => {
      stdin.removeListener("keypress", onKey);
      if (stdin.isTTY) stdin.setRawMode(false);
      stdin.pause();
    };
    const onKey = (str, key = {}) => {
      if (key.ctrl && key.name === "c") { cleanup(); console.log("\nExit."); process.exit(0); }
      if (key.name === "up") idx = (idx - 1 + items.length) % items.length;
      else if (key.name === "down") idx = (idx + 1) % items.length;
      else if (key.name === "return" || key.name === "enter") {
        cleanup();
        resolve(items[idx].value);
        return;
      } else return;
      render();
    };
    stdin.on("keypress", onKey);
    render();
  });
}

function ask(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => { rl.close(); resolve(answer.trim()); });
  });
}

function buttons(title, items) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    readline.emitKeypressEvents(stdin);
    if (stdin.isTTY) stdin.setRawMode(true);
    stdin.resume();

    let idx = 0;
    let drawn = false;
    const render = () => {
      if (drawn) { readline.moveCursor(process.stdout, 0, -1); readline.clearLine(process.stdout, 0); }
      const row = items.map((it, i) => (i === idx
        ? `${C.bold}${it.color}\x1b[7m  ${it.label}  ${C.reset}`
        : `${C.dim}[ ${it.label} ]${C.reset}`)).join("   ");
      process.stdout.write(`${row}   ${C.dim}left/right - select, Enter - ok${C.reset}\n`);
      drawn = true;
    };
    const cleanup = () => {
      stdin.removeListener("keypress", onKey);
      if (stdin.isTTY) stdin.setRawMode(false);
      stdin.pause();
    };
    const onKey = (str, key = {}) => {
      if (key.ctrl && key.name === "c") { cleanup(); console.log("\nExit."); process.exit(0); }
      if (["left", "up"].includes(key.name)) idx = (idx - 1 + items.length) % items.length;
      else if (["right", "down", "tab"].includes(key.name)) idx = (idx + 1) % items.length;
      else if (key.name === "escape") { cleanup(); resolve(items[items.length - 1].value); return; }
      else if (key.name === "return" || key.name === "enter") { cleanup(); resolve(items[idx].value); return; }
      else return;
      render();
    };
    console.log(`\n${C.bold}${title}${C.reset}`);
    stdin.on("keypress", onKey);
    render();
  });
}

function okCancel(title) {
  return buttons(title, [
    { label: "OK", value: true, color: C.green },
    { label: "Cancel", value: false, color: C.red },
  ]);
}

module.exports = {
  C, log,
  stripAnsi, box, boxWarn, boxErr, boxOk, boxInfo,
  select, ask, buttons, okCancel,
};