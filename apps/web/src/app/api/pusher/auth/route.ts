import { auth } from "@/auth";
import { getPusherServer } from "@/lib/pusher";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const socketId = formData.get("socket_id");
  const channelName = formData.get("channel_name");

  if (typeof socketId !== "string" || typeof channelName !== "string") {
    return Response.json({ error: "Invalid Pusher auth request" }, { status: 400 });
  }

  if (!channelName.startsWith("presence-game-")) {
    return Response.json({ error: "Forbidden channel" }, { status: 403 });
  }

  const authResponse = getPusherServer().authorizeChannel(socketId, channelName, {
    user_id: session.user.id,
    user_info: {
      name: session.user.name,
      email: session.user.email,
      image: session.user.image,
    },
  });

  return Response.json(authResponse);
}
