# Deploy Runbook

This runbook gets `Anonymous Duel Chat` from the current repo state to a real devnet demo with:

- deployed Solana room program
- frontend pointed at that program
- MagicBlock transport enabled
- two-wallet smoke test

## 1. Install toolchain

This workspace is on Windows. Solana's current quick-install docs explicitly recommend the standard install flow on Windows and show a one-command setup for Rust, Solana CLI, and Anchor. Source:

- [Solana quick installation](https://solana.com/docs/intro/installation)

Recommended path: use **WSL Ubuntu** for the program build.

Inside WSL:

```bash
curl --proto '=https' --tlsv1.2 -sSfL https://solana-install.solana.workers.dev | bash
source ~/.cargo/env
rustc --version
solana --version
anchor --version
```

If the combined installer fails, use the dependency-by-dependency Solana install guide:

- [Solana dependency install guide](https://solana.com/docs/intro/installation/dependencies)

## 2. Configure Solana devnet

Solana's program deploy docs show the standard sequence: create wallet, set cluster, airdrop funds, then `cargo build-sbf` and `solana program deploy`. Source:

- [Solana program deployment docs](https://solana.com/fr/docs/programs/deploying)

Commands:

```bash
solana-keygen new
solana config set --url devnet
solana airdrop 2
solana balance
solana config get
```

## 3. Build the room program

From the repo root:

```bash
cd programs/anonymous-duel-room
cargo build-sbf
```

Expected artifact paths:

```text
programs/anonymous-duel-room/target/deploy/anonymous_duel_room.so
programs/anonymous-duel-room/target/deploy/anonymous_duel_room-keypair.json
```

If Cargo generates a different deploy folder in your setup, use the actual output path from the build logs.

## 4. Deploy the room program

Still in `programs/anonymous-duel-room`:

```bash
solana program deploy ./target/deploy/anonymous_duel_room.so
```

Save the resulting program id. You can re-check it with:

```bash
solana program show <PROGRAM_ID>
```

## 5. Point the frontend at devnet + MagicBlock

In the repo root, create `.env.local` from [.env.example](/C:/Users/egste/Documents/XuanZhi9/anonymous-duel-chat/.env.example):

```bash
cp .env.example .env.local
```

Set:

```dotenv
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_ROOM_TRANSPORT=magicblock
NEXT_PUBLIC_MAGICBLOCK_ROUTER_HTTP_URL=https://devnet-router.magicblock.app
NEXT_PUBLIC_MAGICBLOCK_ROUTER_WS_URL=wss://devnet-router.magicblock.app
NEXT_PUBLIC_ROOM_PROGRAM_ID=<PROGRAM_ID>
```

MagicBlock's docs list the public devnet router endpoint as `https://devnet-router.magicblock.app` and explain that the frontend can route transactions through the Magic Router. Source:

- [MagicBlock quickstart](https://docs.magicblock.gg/pages/get-started/how-integrate-your-program/quickstart)

## 6. Delegation hooks in the Rust program

The repo now includes MagicBlock-oriented room instructions in [programs/anonymous-duel-room/src/lib.rs](/C:/Users/egste/Documents/XuanZhi9/anonymous-duel-chat/programs/anonymous-duel-room/src/lib.rs):

- `delegate_room`
- `commit_room`
- `commit_and_undelegate_room`
- undelegate callback handling

These hooks were added to match MagicBlock's official quickstart pattern, but they were **not compiled locally in this workspace** because Rust tooling is not installed here.

MagicBlock's official guidance is:

- add the `ephemeral_rollups_sdk` crate
- call `delegate_account(...)` for the PDA you want delegated
- later call `commit_and_undelegate_accounts(...)` to commit and return ownership

Source:

- [MagicBlock quickstart: delegation and undelegation hooks](https://docs.magicblock.gg/pages/get-started/how-integrate-your-program/quickstart)

The docs show:

- `cargo add ephemeral_rollups_sdk`
- `delegate_account(...)`
- `commit_and_undelegate_accounts(...)`

Practical recommendation for this repo:

1. Build the program in WSL or another Rust-enabled environment.
2. Fix any SDK signature drift if the crate API changed since the docs snapshot.
3. Delegate the room PDA after `create_room`.
4. Trigger `commit_and_undelegate_room` when ending the room.
5. Keep `send_message` and `push_payment_event` as the hot path that runs against the delegated room account.

Useful devnet validator ids listed in MagicBlock docs:

- US devnet validator: `MUS3hc9TCw4cGC12vHNoYcCGzJG1txjgQLZWVoeNHNd`
- EU devnet validator: `MEUGGrYPxKk17hCr7wpT6s8dtNokZj5U2L57vjYMS8e`
- Asia devnet validator: `MAS1Dt9qreoRMQ14YQuhg8UTZMMzDdKhmkZMECCzk57`

## 7. Run the frontend

From the repo root:

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

## 8. Smoke test

Use two wallets in two separate browser contexts.

### Wallet A

1. Connect Phantom.
2. Create room.
3. Copy the room URL.

### Wallet B

1. Open the room URL.
2. Connect Phantom.
3. Verify the room changes from `waiting` to `active`.

### Chat test

1. Send a message from A.
2. Send a message from B.
3. Verify both render immediately.

### Payment test

1. Send `0.01 SOL` from A to B.
2. Confirm Phantom approval opens.
3. Confirm the payment event shows up in the room.

## 9. What is already wired in the repo

- Room PDA derivation and instruction builders:
  - [src/lib/room-program.ts](/C:/Users/egste/Documents/XuanZhi9/anonymous-duel-chat/src/lib/room-program.ts)
- MagicBlock-aware transport:
  - [src/lib/room-client.magicblock.ts](/C:/Users/egste/Documents/XuanZhi9/anonymous-duel-chat/src/lib/room-client.magicblock.ts)
- Onchain room program:
  - [programs/anonymous-duel-room/src/lib.rs](/C:/Users/egste/Documents/XuanZhi9/anonymous-duel-chat/programs/anonymous-duel-room/src/lib.rs)
- Account decoder for real room state:
  - [src/lib/room-account.ts](/C:/Users/egste/Documents/XuanZhi9/anonymous-duel-chat/src/lib/room-account.ts)

## 10. Current blocker to full ER mode

The remaining blocker is no longer missing hooks in source code. The blocker is **runtime validation**:

- compile the Rust program with the MagicBlock SDK dependency present
- confirm the exact SDK function signatures against the currently published crate
- derive and pass the delegation metadata accounts from the frontend or a helper SDK

Without that final validation, the frontend can target the program id, but the ER delegation path is still not production-confirmed.

## 11. Recommended next commit

Make the next engineering step:

1. compile [programs/anonymous-duel-room/src/lib.rs](/C:/Users/egste/Documents/XuanZhi9/anonymous-duel-chat/programs/anonymous-duel-room/src/lib.rs) in WSL
2. confirm the `ephemeral-rollups-sdk` API against the installed crate version
3. add frontend-side derivation or lookup for delegation buffer/record/metadata accounts

That is the shortest path from "devnet room program" to "true MagicBlock ER chat".
