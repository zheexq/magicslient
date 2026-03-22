import { RoomShell } from "@/components/RoomShell";

export default function RoomPage({
  params,
}: {
  params: {
    code: string;
  };
}) {
  return <RoomShell code={params.code.toUpperCase()} />;
}
