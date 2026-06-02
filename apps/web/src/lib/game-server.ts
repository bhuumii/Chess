import { db } from "db/src/index";
import { games as gamesTable, users as usersTable } from "db/src/schema";
import { eq } from "drizzle-orm";

export type PlayerColor = "white" | "black" | "spectator";

export async function getFullGameState(gameId: string) {
  const game = await db.query.games.findFirst({
    where: eq(gamesTable.id, gameId),
  });
  if (!game) return null;

  const whitePlayer = game.whitePlayerId
    ? ((await db.query.users.findFirst({
        where: eq(usersTable.id, game.whitePlayerId),
      })) ?? null)
    : null;
  const blackPlayer = game.blackPlayerId
    ? ((await db.query.users.findFirst({
        where: eq(usersTable.id, game.blackPlayerId),
      })) ?? null)
    : null;

  return { game, whitePlayer, blackPlayer };
}

export function colorForUser(
  game: { whitePlayerId: string | null; blackPlayerId: string | null },
  userId: string,
): PlayerColor {
  if (game.whitePlayerId === userId) return "white";
  if (game.blackPlayerId === userId) return "black";
  return "spectator";
}
