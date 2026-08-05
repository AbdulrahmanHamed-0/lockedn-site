import LobbyClient from "@/components/lobby/LobbyClient";

interface Props {
  params: Promise<{ roomId: string }>;
}

export default async function RoomPage({ params }: Props) {
  const { roomId } = await params;
  return <LobbyClient roomId={roomId} />;
}
