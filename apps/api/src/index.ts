import { serve } from "@hono/node-server";
import { Chess } from "chess.js";
import { db } from "db/src/index";
import { games as gamesTable, users as usersTable } from "db/src/schema";
import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { type Socket, Server as SocketIOServer } from "socket.io";

const app = new Hono();

type ActiveUserProfile = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
};

const activeUserProfiles = new Map<string, ActiveUserProfile>();
const liveWaitingPublicGames = new Map<
  string,
  { hostUserId: string; socketId: string }
>();
const waitingPublicGameBySocket = new Map<string, string>();

function trackWaitingPublicGame(
  gameId: string,
  hostUserId: string,
  socketId: string,
) {
  const previousGameId = waitingPublicGameBySocket.get(socketId);
  if (previousGameId && previousGameId !== gameId) {
    liveWaitingPublicGames.delete(previousGameId);
  }

  liveWaitingPublicGames.set(gameId, { hostUserId, socketId });
  waitingPublicGameBySocket.set(socketId, gameId);
}

function clearWaitingPublicGame(gameId: string, socketId?: string) {
  const liveGame = liveWaitingPublicGames.get(gameId);
  if (!liveGame || (socketId && liveGame.socketId !== socketId)) return;

  liveWaitingPublicGames.delete(gameId);
  waitingPublicGameBySocket.delete(liveGame.socketId);
}

app.use(
  "*",
  cors({
    origin: "http://localhost:3000",
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  }),
);

// API Routes
app.get("/", (c) => c.json({ message: "Hono is running!" }));

app.get("/open", async (c) => {
  try {
    const liveOpenGameIds = [...liveWaitingPublicGames.keys()];
    if (liveOpenGameIds.length === 0) return c.json([]);

    const openGames = await db.query.games.findMany({
      where: and(
        inArray(gamesTable.id, liveOpenGameIds),
        eq(gamesTable.status, "waiting"),
        eq(gamesTable.gameType, "public"),
        isNotNull(gamesTable.whitePlayerId),
        isNull(gamesTable.blackPlayerId),
      ),
      with: { whitePlayer: { columns: { id: true, name: true, image: true } } },
      orderBy: (games, { desc }) => [desc(games.createdAt)],
      limit: 50,
    });

    return c.json(
      openGames
        .filter((game) => {
          const liveGame = liveWaitingPublicGames.get(game.id);
          return liveGame?.hostUserId === game.whitePlayerId;
        })
        .map((game) => ({
          ...game,
          whitePlayer:
            game.whitePlayer ??
            activeUserProfiles.get(game.whitePlayerId ?? "") ??
            null,
        })),
    );
  } catch (e) {
    console.error("Failed to fetch open games:", e);
    return c.json({ error: "Failed to fetch open games" }, 500);
  }
});

const server = serve(
  {
    fetch: app.fetch,
    port: 8000,
  },
  (info) => {
    console.log(`API server is running on http://localhost:${info.port}`);
  },
);

const io = new SocketIOServer(server, {
  cors: { origin: "http://localhost:3000", methods: ["GET", "POST"] },
});

io.on("connection", (socket: Socket) => {
  console.log(`User connected: ${socket.id}`);

  // JOIN GAME HANDLER
  socket.on(
    "join_game",
    async (data: {
      gameId: string;
      userId?: string;
      userName?: string | null;
      userEmail?: string | null;
      userImage?: string | null;
      gameType?: "public" | "private";
    }) => {
      const { gameId, userId, gameType } = data;
      if (!userId || !gameId) return;

      activeUserProfiles.set(userId, {
        id: userId,
        name: data.userName ?? null,
        email: data.userEmail ?? null,
        image: data.userImage ?? null,
      });

      await db
        .insert(gamesTable)
        .values({ id: gameId, gameType: gameType || "public" })
        .onConflictDoNothing();

      const gameState = await db.query.games.findFirst({
        where: eq(gamesTable.id, gameId),
      });
      if (!gameState) {
        console.error(`Critical: Game ${gameId} not found after insert.`);
        return;
      }

      const isStalePublicWaitingGame =
        gameState.gameType === "public" &&
        gameState.status === "waiting" &&
        gameState.whitePlayerId &&
        !gameState.blackPlayerId &&
        gameState.whitePlayerId !== userId &&
        !liveWaitingPublicGames.has(gameId);

      if (isStalePublicWaitingGame) {
        socket.emit("join_error", {
          message: "This public game is no longer available.",
        });
        return;
      }

      const isPlayerInGame =
        gameState.whitePlayerId === userId ||
        gameState.blackPlayerId === userId;
      if (!isPlayerInGame) {
        if (!gameState.whitePlayerId) {
          await db
            .update(gamesTable)
            .set({ whitePlayerId: userId })
            .where(eq(gamesTable.id, gameId));
        } else if (!gameState.blackPlayerId) {
          await db
            .update(gamesTable)
            .set({ blackPlayerId: userId, status: "in_progress" })
            .where(eq(gamesTable.id, gameId));
        }
      }

      const getFullGameState = async () => {
        const game = await db.query.games.findFirst({
          where: eq(gamesTable.id, gameId),
        });
        if (!game) return null;
        const whitePlayer = game.whitePlayerId
          ? ((await db.query.users.findFirst({
              where: eq(usersTable.id, game.whitePlayerId),
            })) ??
            activeUserProfiles.get(game.whitePlayerId) ??
            null)
          : null;
        const blackPlayer = game.blackPlayerId
          ? ((await db.query.users.findFirst({
              where: eq(usersTable.id, game.blackPlayerId),
            })) ??
            activeUserProfiles.get(game.blackPlayerId) ??
            null)
          : null;
        return { game, whitePlayer, blackPlayer };
      };

      const fullState = await getFullGameState();
      if (!fullState) return;

      socket.join(gameId);
      console.log(
        `User ${userId} (socket: ${socket.id}) is in room: ${gameId}`,
      );

      let colorForThisSocket: "white" | "black" | "spectator" = "spectator";
      if (fullState.game.whitePlayerId === userId) colorForThisSocket = "white";
      if (fullState.game.blackPlayerId === userId) colorForThisSocket = "black";

      socket.emit("assign_color", colorForThisSocket);

      if (
        fullState.game.gameType === "public" &&
        fullState.game.status === "waiting" &&
        fullState.game.whitePlayerId === userId &&
        !fullState.game.blackPlayerId
      ) {
        trackWaitingPublicGame(gameId, userId, socket.id);
      } else {
        clearWaitingPublicGame(gameId);
      }

      io.to(gameId).emit("game_state_update", fullState);
    },
  );

  //MOVE HANDLER
  socket.on("move", async (data: { gameId: string; fen: string }) => {
    await db
      .update(gamesTable)
      .set({ fen: data.fen })
      .where(eq(gamesTable.id, data.gameId));
    const chess = new Chess(data.fen);
    io.to(data.gameId).emit("game_update", data.fen);
    io.to(data.gameId).emit(
      "game_status",
      `${chess.turn() === "w" ? "White" : "Black"}'s turn`,
    );
  });

  //RESIGN HANDLER
  socket.on(
    "resign",
    async (data: { gameId: string; color: "white" | "black" }) => {
      const winner = data.color === "white" ? "black" : "white";
      await db
        .update(gamesTable)
        .set({ status: "completed", winner: winner })
        .where(eq(gamesTable.id, data.gameId));
      io.to(data.gameId).emit("game_over", {
        reason: "resignation",
        winner: winner,
      });
    },
  );

  // DRAW HANDLER
  socket.on("offer_draw", (data: { gameId: string }) => {
    socket.to(data.gameId).emit("draw_offered");
  });

  socket.on("accept_draw", async (data: { gameId: string }) => {
    await db
      .update(gamesTable)
      .set({ status: "completed", winner: "draw" })
      .where(eq(gamesTable.id, data.gameId));
    io.to(data.gameId).emit("game_over", { reason: "draw", winner: "draw" });
  });

  socket.on("disconnect", () => {
    const waitingGameId = waitingPublicGameBySocket.get(socket.id);
    if (waitingGameId) clearWaitingPublicGame(waitingGameId, socket.id);

    console.log(`User disconnected: ${socket.id}`);
  });
});
