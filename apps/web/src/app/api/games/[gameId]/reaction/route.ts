import { auth } from "@/auth";
import { PUSHER_EVENTS, triggerGameEvent } from "@/lib/pusher";
import { db } from "db/src/index";
import { games as gamesTable } from "db/src/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

const ALLOWED_REACTIONS = new Set(["heart", "clap", "laugh", "thumbs-up", "thumbs-down"]);

type ReactionBody = {
  reaction?: unknown;
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
  if (game.gameType !== "public") {
    return Response.json({ error: "Reactions are only available in public games." }, { status: 403 });
  }

  const isPlayer =
    game.whitePlayerId === session.user.id || game.blackPlayerId === session.user.id;
  if (!isPlayer) return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as ReactionBody;
  const reaction = String(body.reaction ?? "");

  if (!ALLOWED_REACTIONS.has(reaction)) {
    return Response.json({ error: "Invalid reaction." }, { status: 400 });
  }

  await triggerGameEvent(gameId, PUSHER_EVENTS.REACTION, {
    id: nanoid(10),
    userId: session.user.id,
    reaction,
    createdAt: Date.now(),
  });

  return Response.json({ ok: true });
}
