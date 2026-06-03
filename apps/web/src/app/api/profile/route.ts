import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "db/src/index";
import { users } from "db/src/schema";

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    name?: unknown;
    image?: unknown;
  } | null;

  const name = String(body?.name ?? "").trim();
  const image = String(body?.image ?? "").trim();

  if (name.length < 2 || name.length > 30) {
    return Response.json(
      { error: "Username must be 2 to 30 characters." },
      { status: 400 },
    );
  }

  if (!image.startsWith("data:image/svg+xml;utf8,") || image.length > 30000) {
    return Response.json({ error: "Choose one of the generated avatars." }, { status: 400 });
  }

  await db
    .update(users)
    .set({ name, image })
    .where(eq(users.id, session.user.id));

  return Response.json({ name, image });
}
