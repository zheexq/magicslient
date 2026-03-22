export function createRoomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export function shortWallet(address?: string | null) {
  if (!address) {
    return "Peer";
  }

  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export function peerLabel(address?: string | null) {
  if (!address) {
    return "Peer";
  }

  return `Peer (${shortWallet(address)})`;
}
