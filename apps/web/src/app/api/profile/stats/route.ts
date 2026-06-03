import { and, eq, or } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "db/src/index";
import { games } from "db/src/schema";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const completedGames = await db.query.games.findMany({
    where: and(
      eq(games.status, "completed"),
      or(eq(games.whitePlayerId, userId), eq(games.blackPlayerId, userId)),
    ),
  });

  let won = 0;
  let lost = 0;
  let draw = 0;

  for (const game of completedGames) {
    if (game.winner === "draw") {
      draw += 1;
      continue;
    }

    const userColor = game.whitePlayerId === userId ? "white" : "black";
    if (game.winner === userColor) won += 1;
    else if (game.winner === "white" || game.winner === "black") lost += 1;
  }

  return Response.json({ played: completedGames.length, won, lost, draw });
}
