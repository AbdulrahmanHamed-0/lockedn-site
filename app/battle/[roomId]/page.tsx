//DEV NOTE : dis shi just imports whats written in components/battle/BattleClient.tsx

import BattleClient from "@/components/battle/BattleClient";

interface Props {
  params: Promise<{ roomId: string }>;
}

export default async function BattlePage({ params }: Props) {
  const { roomId } = await params;
  return <BattleClient roomId={roomId} />;
}
