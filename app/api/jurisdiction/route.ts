import { z } from "zod";
import { compareJurisdictions } from "@/lib/engines";
import { jurisdictions } from "@/lib/engines/seed-data";
import { JurisdictionComparison, Profile } from "@/lib/schemas";

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
    const result = compareJurisdictions(input.data.profile, jurisdictions);
    return Response.json(JurisdictionComparison.array().parse(result));
  } catch {
    return Response.json({ error: "Unable to compare jurisdictions.", code: "COMPUTATION_FAILED" }, { status: 500 });
  }
}
