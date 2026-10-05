
<div align="center">

# 🛠️ Arbitrage Contract Deployer

**Interactive deployment and management of Solidity contracts straight from your terminal**

[![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A518-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Solidity](https://img.shields.io/badge/Solidity-%5E0.8.28-363636?style=for-the-badge&logo=solidity&logoColor=white)](https://soliditylang.org/)
[![Ethereum](https://img.shields.io/badge/Ethereum-Mainnet-3C3C3D?style=for-the-badge&logo=ethereum&logoColor=white)](https://ethereum.org/)
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](./LICENSE)

</div>

---

## ⚡ Quick Start — 4 Steps

> Everything you need to run the project. Just copy the commands in order.

**1️⃣ Clone the project**

```bash
git clone https://github.com/<your-username>/<your-repo>.git
cd <your-repo>
```

**2️⃣ Install packages** *(required)*

```bash
npm install
```

**3️⃣ Create `.env` and fill in your keys**

```env
PRIVATE_KEY=0xYourPrivateKey
RPC_URL=https://ethereum-rpc.publicnode.com
```

**4️⃣ Run**

```bash
node start
```

| Step | What it does | Required |
|:---:|---|:---:|
| 1️⃣ | Clones the repository from GitHub | ✅ |
| 2️⃣ | Installs `ethers` and `solc` into `node_modules/` | ✅ |
| 3️⃣ | Connects your wallet to Ethereum Mainnet | ✅ |
| 4️⃣ | Opens the interactive menu for deployment and calls | ✅ |

> ⚠️ **Without `npm install` the script will not run** — `ethers` and `solc` are not part of the standard Node.js distribution.
>
> ⚠️ **The script works only with Ethereum Mainnet.** Transactions cost real ETH.

---

## 📖 About the Project

**Ethereum Contract Deployer** is a set of Node.js scripts for convenient work with Solidity contracts on **Ethereum Mainnet**:

- 🚀 compiles `.sol` out of the box (no Remix, no Hardhat);
- 📦 automatically resolves imports from GitHub, npm, and local files;
- 🌐 deploys to **Ethereum Mainnet**;
- 🧭 provides an interactive menu for calling contract functions;
- ⛽️ estimates gas in real time and shows the cost in ETH and USD;
- 🛰️ runs a mempool stream with beautiful transaction output.

The whole interface is colorful, with boxes, an arrow-key menu, and clear statuses.

> ⚠️ **Warning:** the script works **only with Ethereum Mainnet**. Every transaction costs **real money**. Make sure you understand what you are doing before running it.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🧩 **On-the-fly compilation** | `solc` builds the contract by file name, no external bundlers |
| 🔗 **Smart imports** | GitHub, `node_modules`, local paths, npm CDN — all resolved automatically |
| 💾 **Deployment storage** | Addresses, ABIs, and dates are saved to `deployments.json` |
| 🎛️ **Interactive menu** | Arrow keys `↑↓`, `Enter`, `OK/Cancel` — just like in Remix |
| ⛽️ **Gas preview** | Gas estimate, `base fee`, `priority fee`, maximum and current cost |
| 💵 **ETH/USD rate** | Via Chainlink oracle to estimate fees in dollars |
| 📡 **Mempool stream** | Separate process streaming "deals" to the console |
| 🎨 **Beautiful output** | Boxes, colors, highlights, clear statuses |
| 🔐 **Private key in `.env`** | Never stored in code |

---

## 📂 Project Structure

```
Script-Contract/
├── start.js                # Entry point (node start)
├── deploy.js               # Deployment core and menu
├── mempool.js              # Mempool stream (separate process)
├── erc20.json              # Token list (Sequence Token Directory)
├── deployments.json        # Saved deployments (created automatically)
├── .env                    # Private key and RPC (not in git)
├── lib/
│   ├── ui.js               # Colors, log, boxes, menu
│   ├── env.js              # .env, deployments.json, explorer
│   ├── compile.js          # Import resolution and compilation
│   ├── chain.js            # Gas, transaction receipt, ETH price
│   └── contract.js         # Deploy, function calls, stream launch
└── *.sol                   # Your contracts
```

---

## 🚀 Detailed Setup

### 1. Clone the project

```bash
git clone https://github.com/<your-username>/<your-repo>.git
cd <your-repo>
```

Or download the ZIP archive from GitHub and unpack it into a convenient folder.

### 2. 📦 Install packages (required)

> ⚠️ **This step is mandatory.** Without installing the packages, the script will not run: `ethers` and `solc` are not part of the standard Node.js distribution.

Open a terminal in the project folder and run:

```bash
npm install
```

The command downloads the dependencies listed in `package.json`:

| Package | Purpose |
|---|---|
| `ethers` | Ethereum interaction: wallet, provider, transactions, ABI |
| `solc` | Solidity compiler embedded in Node.js |

After a successful install, a `node_modules/` directory will appear. If it does not — the install failed, check the output of `npm install`.

### 3. Configure `.env`

Create a `.env` file in the root and fill it in:

```env
PRIVATE_KEY=0xYourPrivateKey
RPC_URL=https://ethereum-rpc.publicnode.com
```

Examples of Mainnet RPC endpoints:

| Provider | URL |
|---|---|
| PublicNode | `https://ethereum-rpc.publicnode.com` |
| LlamaRPC | `https://eth.llamarpc.com` |
| Cloudflare | `https://cloudflare-eth.com` |
| Infura | `https://mainnet.infura.io/v3/<KEY>` |
| Alchemy | `https://eth-mainnet.g.alchemy.com/v2/<KEY>` |

> ⚠️ **Never** commit `.env` to a public repository. It must be in `.gitignore`.

### 4. Run

```bash
node start
```

Or through npm (if a `start` script is defined in `package.json`):

```bash
npm start
```

---

## 🖥️ What It Looks Like

### Main menu

```
=== Ethereum Contract Deployer ===

i Network: mainnet (chainId 1)
i Wallet:  0x8c27...66CdC
i Balance: 0.5 ETH
! THIS IS MAINNET - transactions cost real money!

Main menu
> Deploy Arbitrage.sol
  Open deployed Arbitrage (0x2d7A..., 2025-01-15)
  Exit
up/down - select, Enter - ok, Ctrl+C - exit
```

### Gas preview

```
────────────────────────────────────────────────────────
i Estimating current gas...
  Gas (estimate):       564195 units
  Gas limit (+10%):     620614
  Base fee (block 21000000): 8.4321 gwei
  Priority fee:         1.5000 gwei
  Max fee per gas:      18.3642 gwei

  Fee now (expected):  0.005603 ETH (~$17.93)
  Fee maximum:         0.011397 ETH (~$36.47)
  Your balance:        0.5 ETH (~$1600.00)
```

### Status boxes

```
┌──────────────────────────────────────────────┐
│ CONTRACT DEPLOYED                            │
├──────────────────────────────────────────────┤
│ Name:    Arbitrage                           │
│ Address: 0x2d7A3BdCcA8E2B32bFA77c94175Ab3A41│
│ View:    https://etherscan.io/address/0x2d...│
└──────────────────────────────────────────────┘
```

### Mempool stream

```
┌──────────────────────────────────────────────┐
│ MEMPOOL STREAM STARTED                       │
├──────────────────────────────────────────────┤
│ Value from start(): 0 ETH                    │
│ Contract balance:   0.010000 ETH             │
│                                              │
│ Ctrl+C - stop the stream.                    │
└──────────────────────────────────────────────┘

i Looking for profitable deals...

────────────────────────────────────────────────────────
 [DEAL #   1]  11:54:21
────────────────────────────────────────────────────────
  Buyer    : 0x6043727c...7fd64
  Router   : 0xd9e1cE17...8B9F
  Amount   : 1.8803 ETH  (~$6016.96)
  Token    : WETH  (Wrapped Ether)  0xC02aaA...756Cc2
  Method   : swapExactETHForTokens
  TXID     : 0xa1f70a8f...4fd03d

  > Front-running with our tx...
  > Our buy
    Amount : 0.002862 ETH  (~$9.16)
    ...

┌───────────────────────────────────┐
│ PROFIT                            │
├───────────────────────────────────┤
│ +0.000229 ETH  (~$0.73)  (+7.88%) │
└───────────────────────────────────┘
```

---

## 🧭 Menu and Functions

| Item | Meaning |
|---|---|
| `Deploy <file>.sol` | Compile and deploy a contract |
| `Open deployed <name>` | Open a previously saved contract from `deployments.json` |
| `[read]` | `view` / `pure` function — read-only |
| `[write]` | Regular transaction that changes state |
| `[payable]` | Function that accepts ETH |
| `[info] Contract balance` | Show the contract balance |
| `[stop] Stop mempool stream` | Appears **only** if the stream is running |
| `<- Back to main menu` | Return to the main menu |

---

## 🌐 Network

The script works **only with Ethereum Mainnet** (chainId `1`).

| Parameter | Value |
|---|---|
| Network | Ethereum Mainnet |
| chainId | `1` |
| Explorer | [etherscan.io](https://etherscan.io) |
| Currency | ETH |

If `RPC_URL` points to another network, the script will refuse to run and print an error.

---

## 📦 Tokens for the Stream

The `erc20.json` file is a token list in **Uniswap Token List Schema** format from [Sequence Token Directory](https://github.com/0xsequence/token-directory).

The `loadTokens()` loader:

- supports **two** formats — a bare array and `{ tokens: [...] }`;
- filters out invalid addresses;
- drops the zero address (`0x0000...0000`);
- keeps only tokens with `chainId = 1`;
- extracts `address`, `symbol`, and `name`.

If the file is missing, the stream falls back to random addresses and warns about it.

---

## 🔐 Security

- 🔒 `.env` is **not committed**, it contains only `PRIVATE_KEY` and `RPC_URL`.
- ⚠️ The script works **only with Mainnet** — every transaction costs real ETH.
- 🧪 Before real use, **carefully review** the contract and addresses.
- ✅ All `[write]`/`[payable]` operations go through a **gas preview** and an `OK` button.
- 🚫 No transaction is sent without your confirmation.

---

## ⛽️ How Gas Is Calculated

1. `estimateGas` provides an accurate estimate.
2. `gasLimit` = estimate + 10% (buffer, like MetaMask).
3. `maxFeePerGas` = `2 × baseFee + priorityFee` (buffer for base fee growth).
4. The **expected** fee (current block) and the **maximum** fee (`gasLimit × maxFee`) are shown.
5. The ETH/USD rate is fetched from the Chainlink oracle.

---

## 🧩 Imports in `.sol`

The compiler can resolve imports from:

| Type | Example |
|---|---|
| GitHub | `import "https://github.com/Uniswap/v3-core/..."` |
| npm via CDN | `import "@openzeppelin/contracts/token/ERC20/ERC20.sol"` |
| `node_modules` | `import "@openzeppelin/contracts/..."` (if installed locally) |
| Local | `import "./MyLib.sol"` |

GitHub links of the form `github.com/owner/repo/blob/branch/path` are automatically converted to `raw.githubusercontent.com`.

---

## 📋 Requirements

| Component | Version |
|---|---|
| Node.js | ≥ 18 (needs `fetch`) |
| npm | ≥ 9 |
| Solidity | any (`solc` is pulled via npm) |

**Dependencies** (in `package.json`):

```json
{
  "dependencies": {
    "ethers": "^6.13.0",
    "solc": "^0.8.28"
  }
}
```

---

## 🛠️ Useful Commands

```bash
# 📦 Install all dependencies (required after cloning)
npm install

# Run
node start

# Run via npm (if a start script is defined in package.json)
npm start

# Run the mempool stream manually
node mempool.js

# Check the solc version
node -e "console.log(require('solc').version())"

# Verify that dependencies are installed
ls node_modules | head
```

---

## 🗺️ Roadmap

- [x] Compilation and deployment
- [x] Interactive menu
- [x] Gas preview and ETH price
- [x] Mempool stream (separate process)
- [ ] Multisig support
- [ ] ABI export to TypeScript types
- [ ] Tenderly integration for transaction simulation

---

## 🤝 Contributing

PRs and issues are welcome. Before opening a PR:

1. Make sure `.env` **did not end up** in the commit.
2. Make sure `deployments.json` contains only local test data.
3. Describe the change briefly — what and why.

---

## 📜 License

The project is distributed under the **MIT** license. See [LICENSE](./LICENSE) for details.

---

<div align="center">

**Made with ❤️ for those who love the terminal**

⭐ Star the repo if you find it useful

</div>