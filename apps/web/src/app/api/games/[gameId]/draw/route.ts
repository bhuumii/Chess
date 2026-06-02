import { auth } from "@/auth";
import { PUSHER_EVENTS, triggerGameEvent } from "@/lib/pusher";
import { db } from "db/src/index";
import { games as gamesTable } from "db/src/schema";
import { eq } from "drizzle-orm";

type DrawBody = {
  action?: "offer" | "accept";
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
  const body = (await request.json().catch(() => ({}))) as DrawBody;

  if (body.action === "offer") {
    await triggerGameEvent(gameId, PUSHER_EVENTS.DRAW_OFFERED, {
      fromUserId: session.user.id,
    });
    return Response.json({ ok: true });
  }

  if (body.action === "accept") {
    await db
      .update(gamesTable)
      .set({ status: "completed", winner: "draw" })
      .where(eq(gamesTable.id, gameId));

    await triggerGameEvent(gameId, PUSHER_EVENTS.GAME_OVER, {
      reason: "draw",
      winner: "draw",
    });
    return Response.json({ ok: true });
  }

  return Response.json({ error: "Invalid draw action" }, { status: 400 });
}
