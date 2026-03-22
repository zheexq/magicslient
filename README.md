# MagicSlient

MagicSlient is a minimal anonymous 1v1 room on Solana.

Two wallets enter a temporary room, exchange real-time messages through MagicBlock, and send native SOL to each other. No profiles, no feeds, no social graph, no long-term history.

## What It Does

- Creates a temporary 1v1 room with a short code or link
- Keeps both participants anonymous at the product layer as `You` and `Peer`
- Sends chat messages in real time through a MagicBlock-ready room program
- Sends real native SOL wallet-to-wallet on Solana devnet
- Keeps the experience intentionally minimal and ephemeral

## Why It Exists

Most onchain apps feel heavy before two people can simply interact. MagicSlient strips the experience down to one thing: an anonymous duel between two wallets in a live room with instant chat and direct payment.

## Stack

- Next.js
- TypeScript
- Tailwind CSS
- Solana Web3.js
- MagicBlock Ephemeral Rollups SDK
- Solana devnet

## Architecture

- Frontend: Next.js app hosted on Vercel
- Real-time room state: Solana room program integrated with MagicBlock SDK
- Payments: native `SystemProgram.transfer`
- Identity: wallet-only, no profiles or usernames
- Persistence: no database, no long-term app-side chat history

## Project Structure

```text
src/
  app/
  components/
  hooks/
  lib/
  types/

programs/
  anonymous-duel-room/
```

Important files:

- Frontend entry: [src/app/page.tsx](/C:/Users/egste/Documents/XuanZhi9/anonymous-duel-chat/src/app/page.tsx)
- Lobby: [src/app/room/page.tsx](/C:/Users/egste/Documents/XuanZhi9/anonymous-duel-chat/src/app/room/page.tsx)
- Room UI: [src/components/RoomShell.tsx](/C:/Users/egste/Documents/XuanZhi9/anonymous-duel-chat/src/components/RoomShell.tsx)
- Room hook: [src/hooks/useRoom.ts](/C:/Users/egste/Documents/XuanZhi9/anonymous-duel-chat/src/hooks/useRoom.ts)
- MagicBlock transport: [src/lib/room-client.magicblock.ts](/C:/Users/egste/Documents/XuanZhi9/anonymous-duel-chat/src/lib/room-client.magicblock.ts)
- Solana payment flow: [src/lib/payments.ts](/C:/Users/egste/Documents/XuanZhi9/anonymous-duel-chat/src/lib/payments.ts)
- Room program: [programs/anonymous-duel-room/src/lib.rs](/C:/Users/egste/Documents/XuanZhi9/anonymous-duel-chat/programs/anonymous-duel-room/src/lib.rs)

## Environment

Create `.env.local` from [.env.example](/C:/Users/egste/Documents/XuanZhi9/anonymous-duel-chat/.env.example).

Example:

```env
NEXT_PUBLIC_ROOM_TRANSPORT=magicblock
NEXT_PUBLIC_ROOM_PROGRAM_ID=J93ukQhDEBNx9uwYHTUxiCVv4SkA7eZbSJm95VecW986
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_MAGICBLOCK_ROUTER_HTTP_URL=https://devnet-router.magicblock.app
NEXT_PUBLIC_MAGICBLOCK_ROUTER_WS_URL=wss://devnet-router.magicblock.app
NEXT_PUBLIC_MAGICBLOCK_VALIDATOR=MUS3hc9TCw4cGC12vHNoYcCGzJG1txjgQLZWVoeNHNd
NEXT_PUBLIC_MAGICBLOCK_DELEGATION_PROGRAM_ID=DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh
```

## Run Locally

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

## Hackathon Demo Flow

1. Connect wallet A
2. Create a room
3. Open the room link in a second browser or wallet context
4. Connect wallet B
5. Exchange messages
6. Send SOL from one wallet to the other

## Program Deploy

The room program is already wired for GitHub Actions deploy.

- Workflow: [.github/workflows/deploy-room-program.yml](/C:/Users/egste/Documents/XuanZhi9/anonymous-duel-chat/.github/workflows/deploy-room-program.yml)
- Detailed notes: [DEPLOY_RUNBOOK.md](/C:/Users/egste/Documents/XuanZhi9/anonymous-duel-chat/DEPLOY_RUNBOOK.md)

Current devnet room program id:

```text
J93ukQhDEBNx9uwYHTUxiCVv4SkA7eZbSJm95VecW986
```

## Notes

- This project is designed for hackathon speed, not production custody.
- SOL transfers are real.
- The app keeps identity anonymous at the UX layer, but wallet signatures still secure actions.
- The browser fallback exists only as a local preview path; the intended demo path is MagicBlock.

## Submission Pitch

MagicSlient is a minimal anonymous 1v1 room on Solana where two wallets can instantly chat through MagicBlock and send native SOL to each other without profiles, feeds, or long-term history.
