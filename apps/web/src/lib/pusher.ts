import Pusher from "pusher";

export const PUSHER_EVENTS = {
  GAME_STATE_UPDATE: "game-state-update",
  GAME_UPDATE: "game-update",
  GAME_STATUS: "game-status",
  DRAW_OFFERED: "draw-offered",
  GAME_OVER: "game-over",
} as const;

let pusherServer: Pusher | null = null;

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function getPusherServer() {
  if (!pusherServer) {
    pusherServer = new Pusher({
      appId: requiredEnv("PUSHER_APP_ID"),
      key: requiredEnv("NEXT_PUBLIC_PUSHER_KEY"),
      secret: requiredEnv("PUSHER_SECRET"),
      cluster: requiredEnv("NEXT_PUBLIC_PUSHER_CLUSTER"),
      useTLS: true,
    });
  }

  return pusherServer;
}

export function gameChannel(gameId: string) {
  return `presence-game-${gameId}`;
}

export async function triggerGameEvent(
  gameId: string,
  eventName: (typeof PUSHER_EVENTS)[keyof typeof PUSHER_EVENTS],
  payload: unknown,
) {
  await getPusherServer().trigger(gameChannel(gameId), eventName, payload);
}

export async function getPresenceUserIds(gameId: string) {
  try {
    const response = await getPusherServer().get({
      path: `/channels/${encodeURIComponent(gameChannel(gameId))}/users`,
    });
    const data = (await response.json()) as { users?: Array<{ id: string }> };
    return new Set((data.users ?? []).map((user) => user.id));
  } catch (error) {
    if ((error as { status?: number }).status === 404) return new Set<string>();
    throw error;
  }
}
