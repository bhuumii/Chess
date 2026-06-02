import { auth } from "@/auth";
import { PUSHER_EVENTS, triggerGameEvent } from "@/lib/pusher";
import { Chess } from "chess.js";
import { db } from "db/src/index";
import { games as gamesTable } from "db/src/schema";
import { eq } from "drizzle-orm";

type MoveBody = {
  fen?: string;
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
  const body = (await request.json().catch(() => ({}))) as MoveBody;
  if (!body.fen) {
    return Response.json({ error: "Missing FEN" }, { status: 400 });
  }

  const game = await db.query.games.findFirst({
    where: eq(gamesTable.id, gameId),
  });
  if (!game) return Response.json({ error: "Game not found" }, { status: 404 });

  const isPlayer =
    game.whitePlayerId === session.user.id || game.blackPlayerId === session.user.id;
  if (!isPlayer) return Response.json({ error: "Forbidden" }, { status: 403 });

  await db
    .update(gamesTable)
    .set({ fen: body.fen })
    .where(eq(gamesTable.id, gameId));

  const chess = new Chess(body.fen);
  const status = (chess.turn() === "w" ? "White" : "Black") + "'s turn";

  await triggerGameEvent(gameId, PUSHER_EVENTS.GAME_UPDATE, { fen: body.fen });
  await triggerGameEvent(gameId, PUSHER_EVENTS.GAME_STATUS, { status });

  return Response.json({ ok: true });
}
