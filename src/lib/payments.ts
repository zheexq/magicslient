"use client";

import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import type { useAppWallet } from "@/components/AppProviders";

export async function sendSolPayment({
  amountSol,
  recipient,
  wallet,
}: {
  amountSol: number;
  recipient: string;
  wallet: ReturnType<typeof useAppWallet>;
}) {
  if (!wallet.publicKey) {
    throw new Error("Connect a wallet first.");
  }

  if (!Number.isFinite(amountSol) || amountSol <= 0) {
    throw new Error("Enter a valid SOL amount.");
  }

  const recipientKey = new PublicKey(recipient);
  if (recipientKey.equals(wallet.publicKey)) {
    throw new Error("You cannot send SOL to your own wallet.");
  }

  const lamports = Math.round(amountSol * 1_000_000_000);
  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: recipientKey,
      lamports,
    }),
  );

  return wallet.sendTransaction(transaction);
}
