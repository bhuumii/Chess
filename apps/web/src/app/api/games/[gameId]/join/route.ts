import { auth } from "@/auth";
import { colorForUser, getFullGameState } from "@/lib/game-server";
import {
  getPresenceUserIds,
  PUSHER_EVENTS,
  triggerGameEvent,
} from "@/lib/pusher";
import { db } from "db/src/index";
import { games as gamesTable } from "db/src/schema";
import { eq } from "drizzle-orm";

type JoinBody = {
  gameType?: "public" | "private";
};

export async function POST(
  request: Request,
  context: { params: Promise<{ gameId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { gameId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as JoinBody;
  const gameType = body.gameType === "private" ? "private" : "public";

  await db
    .insert(gamesTable)
    .values({ id: gameId, gameType })
    .onConflictDoNothing();

  const gameState = await db.query.games.findFirst({
    where: eq(gamesTable.id, gameId),
  });
  if (!gameState) {
    return Response.json({ error: "Game not found" }, { status: 404 });
  }

  const isStalePublicWaitingGame =
    gameState.gameType === "public" &&
    gameState.status === "waiting" &&
    gameState.whitePlayerId &&
    !gameState.blackPlayerId &&
    gameState.whitePlayerId !== session.user.id;

  if (isStalePublicWaitingGame) {
    const waitingWhitePlayerId = gameState.whitePlayerId;
    const presenceUserIds = await getPresenceUserIds(gameId);
    if (!waitingWhitePlayerId || !presenceUserIds.has(waitingWhitePlayerId)) {
      return Response.json(
        { message: "This public game is no longer available." },
        { status: 409 },
      );
    }
  }

  const isPlayerInGame =
    gameState.whitePlayerId === session.user.id ||
    gameState.blackPlayerId === session.user.id;

  if (!isPlayerInGame) {
    if (!gameState.whitePlayerId) {
      await db
        .update(gamesTable)
        .set({ whitePlayerId: session.user.id })
        .where(eq(gamesTable.id, gameId));
    } else if (!gameState.blackPlayerId) {
      await db
        .update(gamesTable)
        .set({ blackPlayerId: session.user.id, status: "in_progress" })
        .where(eq(gamesTable.id, gameId));
    }
  }

  const fullState = await getFullGameState(gameId);
  if (!fullState) {
    return Response.json({ error: "Game not found" }, { status: 404 });
  }

  const color = colorForUser(fullState.game, session.user.id);
  await triggerGameEvent(gameId, PUSHER_EVENTS.GAME_STATE_UPDATE, fullState);

  return Response.json({ fullState, color });
}
