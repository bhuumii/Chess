import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors'; 
import { Server as SocketIOServer, Socket } from 'socket.io';
import { db } from 'db/src/index';
import { games as gamesTable, users as usersTable } from 'db/src/schema';
import { eq } from 'drizzle-orm';
import { Chess } from 'chess.js';

const app = new Hono();


app.use('/open', cors({
  origin: 'http://localhost:3000',
}));


app.get('/', (c) => c.json({ message: 'Hono is running!' }));

app.get('/open', async (c) => {
  try {
    const openGames = await db.query.games.findMany({
      where: eq(gamesTable.status, 'waiting'),
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


const server = serve({
    fetch: app.fetch,
    port: 8000,
}, (info) => {
    console.log(`API server is running on http://localhost:${info.port}`);
});

const io = new SocketIOServer(server, {
  cors: { origin: 'http://localhost:3000', methods: ['GET', 'POST'] },
});



io.on('connection', (socket: Socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('join_game', async (data: { gameId: string; userId?: string }) => {
    const { gameId, userId } = data;
    if (!userId || !gameId) return;

    socket.join(gameId);
    console.log(`User ${userId} (socket: ${socket.id}) joined game: ${gameId}`);
    
    const getFullGameState = async () => {
      const game = await db.query.games.findFirst({ where: eq(gamesTable.id, gameId) });
      if (!game) return null;
      const whitePlayer = game.whitePlayerId ? await db.query.users.findFirst({ where: eq(usersTable.id, game.whitePlayerId) }) : null;
      const blackPlayer = game.blackPlayerId ? await db.query.users.findFirst({ where: eq(usersTable.id, game.blackPlayerId) }) : null;
      return { game, whitePlayer, blackPlayer };
    };

    let gameState = await db.query.games.findFirst({ where: eq(gamesTable.id, gameId) });

    if (!gameState) {
      try {
         await db.insert(gamesTable).values({ 
      id: gameId, 
      whitePlayerId: userId 
    });
        gameState = await db.query.games.findFirst({ where: eq(gamesTable.id, gameId) });
    console.log(`New game created by ${userId} with ID: ${gameId}`);
  } catch (e) { 
    console.error("Failed to create game:", e); 
    return; 
  }
}
    if (!gameState) return;

    const isPlayerInGame = gameState.whitePlayerId === userId || gameState.blackPlayerId === userId;
    if (!isPlayerInGame) {
      if (!gameState.whitePlayerId) {
        await db.update(gamesTable).set({ whitePlayerId: userId }).where(eq(gamesTable.id, gameId));
      } else if (!gameState.blackPlayerId) {
        await db.update(gamesTable).set({ blackPlayerId: userId, status: 'in_progress' }).where(eq(gamesTable.id, gameId));
      }
    }

    const fullState = await getFullGameState();
    if (!fullState) return;
    
    io.to(gameId).emit('game_state_update', fullState);
    
    let color: 'white' | 'black' | 'spectator' = 'spectator';
    if (fullState.game.whitePlayerId === userId) color = 'white';
    if (fullState.game.blackPlayerId === userId) color = 'black';
    socket.emit('assign_color', color);
  });

  socket.on('move', async (data: { gameId: string, fen: string }) => {
    await db.update(gamesTable).set({ fen: data.fen }).where(eq(gamesTable.id, data.gameId));

    socket.on('resign', async (data: { gameId: string, color: 'white' | 'black' }) => {
    const winner = data.color === 'white' ? 'black' : 'white';
    await db.update(gamesTable)
        .set({ status: 'completed', winner: winner })
        .where(eq(gamesTable.id, data.gameId));

            io.to(data.gameId).emit('game_over', { reason: 'resignation', winner: winner });
});

socket.on('offer_draw', (data: { gameId: string }) => {
    // Forward the draw offer to the other player
    socket.to(data.gameId).emit('draw_offered');
});

socket.on('accept_draw', async (data: { gameId: string }) => {
    await db.update(gamesTable)
        .set({ status: 'completed', winner: 'draw' })
        .where(eq(gamesTable.id, data.gameId));

    io.to(data.gameId).emit('game_over', { reason: 'draw', winner: 'draw' });
});
    
    const chess = new Chess(data.fen);
    io.to(data.gameId).emit('game_update', data.fen);
    io.to(data.gameId).emit('game_status', `${chess.turn() === 'w' ? 'White' : 'Black'}'s turn`);
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});
