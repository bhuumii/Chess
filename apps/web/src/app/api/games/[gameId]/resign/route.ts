import { auth } from "@/auth";
import { PUSHER_EVENTS, triggerGameEvent } from "@/lib/pusher";
import { db } from "db/src/index";
import { games as gamesTable } from "db/src/schema";
import { eq } from "drizzle-orm";

type ResignBody = {
  color?: "white" | "black";
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
  const body = (await request.json().catch(() => ({}))) as ResignBody;
  if (body.color !== "white" && body.color !== "black") {
    return Response.json({ error: "Invalid color" }, { status: 400 });
  }

  const winner = body.color === "white" ? "black" : "white";
  await db
    .update(gamesTable)
    .set({ status: "completed", winner })
    .where(eq(gamesTable.id, gameId));

  await triggerGameEvent(gameId, PUSHER_EVENTS.GAME_OVER, {
    reason: "resignation",
    winner,
  });

  return Response.json({ ok: true });
}
