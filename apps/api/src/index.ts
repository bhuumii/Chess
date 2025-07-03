import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { Server as SocketIOServer, Socket } from "socket.io";
import { db } from "db/src/index";
import { games as gamesTable, users as usersTable } from "db/src/schema";
import { eq, and } from "drizzle-orm";
import { Chess } from "chess.js";

const app = new Hono();

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
    const openGames = await db.query.games.findMany({
      where: and(
        eq(gamesTable.status, "waiting"),
        eq(gamesTable.gameType, "public"),
      ),
      with: { whitePlayer: { columns: { id: true, name: true, image: true } } },
      orderBy: (games, { desc }) => [desc(games.createdAt)],
      limit: 50,
    });
    return c.json(openGames);
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
      gameType?: "public" | "private";
    }) => {
      const { gameId, userId, gameType } = data;
      if (!userId || !gameId) return;

      await db
        .insert(gamesTable)
        .values({ id: gameId, gameType: gameType || "public" })
        .onConflictDoNothing();

      let gameState = await db.query.games.findFirst({
        where: eq(gamesTable.id, gameId),
      });
      if (!gameState) {
        console.error(`Critical: Game ${gameId} not found after insert.`);
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
          ? await db.query.users.findFirst({
              where: eq(usersTable.id, game.whitePlayerId),
            })
          : null;
        const blackPlayer = game.blackPlayerId
          ? await db.query.users.findFirst({
              where: eq(usersTable.id, game.blackPlayerId),
            })
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
    console.log(`User disconnected: ${socket.id}`);
  });
});
