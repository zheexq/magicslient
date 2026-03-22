"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { clusterApiUrl, Connection, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";

type InjectedSolanaProvider = {
  isPhantom?: boolean;
  isOkxWallet?: boolean;
  isMagicEden?: boolean;
  isMetaMask?: boolean;
  publicKey?: PublicKey;
  connect: () => Promise<{ publicKey: PublicKey }>;
  disconnect?: () => Promise<void>;
  on?: (event: "accountChanged" | "connect" | "disconnect", handler: (...args: unknown[]) => void) => void;
  off?: (event: "accountChanged" | "connect" | "disconnect", handler: (...args: unknown[]) => void) => void;
  signAndSendTransaction?: (
    transaction: Transaction | VersionedTransaction,
  ) => Promise<{ signature: string }>;
};

type WalletKind = "phantom" | "okx" | "magiceden";

type WalletOption = {
  id: WalletKind;
  label: string;
  installUrl: string;
  installed: boolean;
};

type WalletContextValue = {
  connected: boolean;
  connecting: boolean;
  publicKey: PublicKey | null;
  walletAddress: string | null;
  walletKind: WalletKind | null;
  walletLabel: string | null;
  availableWallets: WalletOption[];
  connection: Connection;
  connect: (walletKind?: WalletKind) => Promise<void>;
  disconnect: () => Promise<void>;
  sendTransaction: (transaction: Transaction) => Promise<string>;
};

type WalletRegistryEntry = {
  installUrl: string;
  label: string;
  provider: InjectedSolanaProvider | null;
};

const WalletContext = createContext<WalletContextValue | null>(null);

function getWalletRegistry(): Record<WalletKind, WalletRegistryEntry> {
  if (typeof window === "undefined") {
    return {
      phantom: { installUrl: "https://phantom.app/", label: "Phantom", provider: null },
      okx: { installUrl: "https://web3.okx.com/", label: "OKX", provider: null },
      magiceden: { installUrl: "https://wallet.magiceden.io/", label: "Magic Eden", provider: null },
    };
  }

  const scopedWindow = window as Window & {
    solana?: InjectedSolanaProvider;
    phantom?: { solana?: InjectedSolanaProvider };
    okxwallet?: InjectedSolanaProvider & { solana?: InjectedSolanaProvider };
    magicEden?: { solana?: InjectedSolanaProvider };
    ethereum?: { isMetaMask?: boolean };
  };

  const phantomProvider =
    scopedWindow.phantom?.solana ??
    (scopedWindow.solana?.isPhantom ? scopedWindow.solana : null) ??
    null;
  const okxProvider =
    scopedWindow.okxwallet?.solana ??
    (scopedWindow.okxwallet?.isOkxWallet ? scopedWindow.okxwallet : null) ??
    null;
  const magicEdenProvider =
    scopedWindow.magicEden?.solana ??
    (scopedWindow.solana?.isMagicEden ? scopedWindow.solana : null) ??
    null;
  return {
    phantom: { installUrl: "https://phantom.app/", label: "Phantom", provider: phantomProvider },
    okx: { installUrl: "https://web3.okx.com/", label: "OKX", provider: okxProvider },
    magiceden: { installUrl: "https://wallet.magiceden.io/", label: "Magic Eden", provider: magicEdenProvider },
  };
}

function getProvider(walletKind: WalletKind | null) {
  if (!walletKind) {
    return null;
  }

  return getWalletRegistry()[walletKind].provider;
}

function getWalletOptions() {
  const registry = getWalletRegistry();
  return (Object.entries(registry) as [WalletKind, WalletRegistryEntry][]).map(([id, entry]) => ({
    id,
    label: entry.label,
    installUrl: entry.installUrl,
    installed: Boolean(entry.provider),
  }));
}

function detectConnectedWallet() {
  const registry = getWalletRegistry();
  const entries = Object.entries(registry) as [WalletKind, WalletRegistryEntry][];
  const connected = entries.find(([, entry]) => entry.provider?.publicKey);
  if (!connected) {
    return { publicKey: null, walletKind: null as WalletKind | null };
  }

  return {
    publicKey: connected[1].provider?.publicKey ?? null,
    walletKind: connected[0],
  };
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  const endpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? clusterApiUrl("devnet");
  const connection = useMemo(() => new Connection(endpoint, "confirmed"), [endpoint]);
  const [publicKey, setPublicKey] = useState<PublicKey | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [walletKind, setWalletKind] = useState<WalletKind | null>(null);

  const availableWallets = useMemo(() => getWalletOptions(), []);

  useEffect(() => {
    const detected = detectConnectedWallet();
    if (detected.publicKey) {
      setPublicKey(detected.publicKey);
      setWalletKind(detected.walletKind);
    }
  }, []);

  useEffect(() => {
    const provider = getProvider(walletKind);
    if (!provider?.on) {
      return;
    }

    const handleAccountChanged = (nextPublicKey?: PublicKey | null) => {
      setPublicKey(nextPublicKey ?? null);
      if (!nextPublicKey) {
        setWalletKind(null);
      }
    };
    const handleDisconnect = () => {
      setPublicKey(null);
      setWalletKind(null);
    };

    provider.on("accountChanged", handleAccountChanged);
    provider.on("disconnect", handleDisconnect);

    return () => {
      provider.off?.("accountChanged", handleAccountChanged);
      provider.off?.("disconnect", handleDisconnect);
    };
  }, [walletKind]);

  const value = useMemo<WalletContextValue>(
    () => ({
      connected: Boolean(publicKey),
      connecting,
      publicKey,
      walletAddress: publicKey?.toBase58() ?? null,
      walletKind,
      walletLabel: walletKind ? getWalletRegistry()[walletKind].label : null,
      availableWallets,
      connection,
      connect: async (preferredWalletKind) => {
        const nextWalletKind = preferredWalletKind ?? availableWallets.find((wallet) => wallet.installed)?.id ?? null;
        const provider = getProvider(nextWalletKind);
        if (!provider?.connect || !nextWalletKind) {
          throw new Error("No supported wallet found. Install Phantom, OKX, or Magic Eden.");
        }

        setConnecting(true);
        try {
          const response = await provider.connect();
          setPublicKey(response.publicKey);
          setWalletKind(nextWalletKind);
        } finally {
          setConnecting(false);
        }
      },
      disconnect: async () => {
        const provider = getProvider(walletKind);
        await provider?.disconnect?.();
        setPublicKey(null);
        setWalletKind(null);
      },
      sendTransaction: async (transaction: Transaction) => {
        const provider = getProvider(walletKind);
        if (!provider?.signAndSendTransaction || !publicKey || !walletKind) {
          throw new Error("Connect a supported wallet to send transactions.");
        }

        if (!provider.publicKey || provider.publicKey.toBase58() !== publicKey.toBase58()) {
          throw new Error("Wallet account changed. Reconnect your wallet and try again.");
        }

        const latestBlockhash = await connection.getLatestBlockhash("confirmed");
        transaction.feePayer = publicKey;
        transaction.recentBlockhash = latestBlockhash.blockhash;

        const response = await provider.signAndSendTransaction(transaction);
        await connection.confirmTransaction(
          {
            blockhash: latestBlockhash.blockhash,
            lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
            signature: response.signature,
          },
          "confirmed",
        );

        return response.signature;
      },
    }),
    [availableWallets, connecting, connection, publicKey, walletKind],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useAppWallet() {
  const value = useContext(WalletContext);
  if (!value) {
    throw new Error("Wallet context missing.");
  }

  return value;
}
