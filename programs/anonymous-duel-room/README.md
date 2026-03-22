# anonymous-duel-room

Tiny Solana room program for Anonymous Duel Chat.

## Purpose

This program keeps exactly one bounded room account per duel:

- max 2 participants
- max 40 recent messages
- max 20 payment events
- no profiles
- no long-term app database

The account is designed to be delegated to MagicBlock ER for low-latency chat updates while native SOL transfers still happen on the Solana base layer.

## Instruction tags

- `0` `create_room`
- `1` `join_room`
- `2` `leave_room`
- `3` `send_message`
- `4` `push_payment_event`
- `5` `close_room`

## PDA

Room PDA seeds:

```text
["room", ROOM_CODE_ASCII_6]
```

## Account size

`9895` bytes

## Frontend contract

The matching frontend helpers live in:

- [src/lib/room-program.ts](/C:/Users/egste/Documents/XuanZhi9/anonymous-duel-chat/src/lib/room-program.ts)
- [src/lib/room-account.ts](/C:/Users/egste/Documents/XuanZhi9/anonymous-duel-chat/src/lib/room-account.ts)

## Suggested deploy flow

1. Build and deploy this program on Solana devnet.
2. Put the deployed program id into `NEXT_PUBLIC_ROOM_PROGRAM_ID`.
3. Set `NEXT_PUBLIC_ROOM_TRANSPORT=magicblock`.
4. Delegate the room PDA to MagicBlock ER.
5. Run the frontend and test two-wallet room flow.
