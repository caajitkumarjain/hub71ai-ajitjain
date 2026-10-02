import { z } from "zod";
import { compilePath } from "@/lib/engines";
import { steps } from "@/lib/engines/seed-data";
import { PathResult, Profile } from "@/lib/schemas";

export const runtime = "nodejs";

const RequestBody = z.object({ profile: Profile }).strict();

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON.", code: "INVALID_JSON" }, { status: 400 });
  }

  const input = RequestBody.safeParse(body);
  if (!input.success) {
    return Response.json({ error: "A valid profile is required.", code: "INVALID_INPUT" }, { status: 400 });
  }

  try {
    const production = process.env.NODE_ENV === "production";
    const result = compilePath(input.data.profile, steps, {
      cyclePolicy: production ? "break" : "throw",
      ...(production ? { onCycle: (edge: { from: string; to: string }) => console.warn("Path dependency cycle removed:", edge) } : {}),
    });
    return Response.json(PathResult.parse(result));
  } catch {
    return Response.json({ error: "Unable to compile the path.", code: "COMPUTATION_FAILED" }, { status: 500 });
  }
}
