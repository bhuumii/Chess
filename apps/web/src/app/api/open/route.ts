import { getPresenceUserIds } from "@/lib/pusher";
import { db } from "db/src/index";
import { games as gamesTable } from "db/src/schema";
import { and, eq, isNotNull, isNull } from "drizzle-orm";

export async function GET() {
  try {
    const openGames = await db.query.games.findMany({
      where: and(
        eq(gamesTable.status, "waiting"),
        eq(gamesTable.gameType, "public"),
        isNotNull(gamesTable.whitePlayerId),
        isNull(gamesTable.blackPlayerId),
      ),
      with: { whitePlayer: { columns: { id: true, name: true, image: true } } },
      orderBy: (games, { desc }) => [desc(games.createdAt)],
      limit: 50,
    });

    const liveOpenGames = [];
    for (const game of openGames) {
      const presenceUserIds = await getPresenceUserIds(game.id);
      if (game.whitePlayerId && presenceUserIds.has(game.whitePlayerId)) {
        liveOpenGames.push(game);
      }
    }

    return Response.json(liveOpenGames);
  } catch (error) {
    console.error("Failed to fetch open games:", error);
    return Response.json({ error: "Failed to fetch open games" }, { status: 500 });
  }
}
