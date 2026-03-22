export const magicBlockArchitecture = {
  roomState:
    "Delegate a single room account to MagicBlock ER and keep a bounded message buffer there.",
  messageFlow:
    "Client submits sendMessage transactions through the router so delegated writes resolve on ER for instant chat updates.",
  payments:
    "Native SOL transfers stay on Solana base layer and use standard wallet signatures.",
  cleanup:
    "When both participants leave, clear the room buffer and close or undelegate the room account.",
};

export function getMagicBlockReadiness() {
  return {
    status: "frontend-mvp",
    note: "This repo ships a local ephemeral room adapter so UI can be built fast. Swap the adapter to a delegated room program for full MagicBlock ER messaging.",
  } as const;
}
