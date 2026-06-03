import { auth } from "@/auth";
import { PUSHER_EVENTS, triggerGameEvent } from "@/lib/pusher";
import { db } from "db/src/index";
import { games as gamesTable } from "db/src/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

type ChatBody = {
  message?: unknown;
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
  const game = await db.query.games.findFirst({
    where: eq(gamesTable.id, gameId),
  });

  if (!game) return Response.json({ error: "Game not found" }, { status: 404 });
  if (game.gameType !== "private") {
    return Response.json({ error: "Chat is only available in private games." }, { status: 403 });
  }

  const isPlayer =
    game.whitePlayerId === session.user.id || game.blackPlayerId === session.user.id;
  if (!isPlayer) return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as ChatBody;
  const message = String(body.message ?? "").trim();

  if (message.length < 1 || message.length > 300) {
    return Response.json({ error: "Message must be 1 to 300 characters." }, { status: 400 });
  }

  await triggerGameEvent(gameId, PUSHER_EVENTS.CHAT_MESSAGE, {
    id: nanoid(10),
    userId: session.user.id,
    image: session.user.image ?? null,
    message,
    createdAt: Date.now(),
  });

  return Response.json({ ok: true });
}
