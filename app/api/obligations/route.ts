import { z } from "zod";
import { computeObligations, whatIf } from "@/lib/engines";
import { rules } from "@/lib/engines/seed-data";
import { Obligation, Profile, WhatIfResult } from "@/lib/schemas";

export const runtime = "nodejs";

const RequestBody = z.object({
  profile: Profile,
  whatIf: z.record(z.string(), z.unknown()).optional(),
}).strict();
const ProfilePatch = Profile.partial().strict();

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON.", code: "INVALID_JSON" }, { status: 400 });
  }

  const input = RequestBody.safeParse(body);
  if (!input.success) {
    return Response.json({ error: "A valid profile and optional what-if patch are required.", code: "INVALID_INPUT" }, { status: 400 });
  }

  let patch: Partial<Profile> | undefined;
  if (input.data.whatIf !== undefined) {
    const parsedPatch = ProfilePatch.safeParse(input.data.whatIf);
    if (!parsedPatch.success) {
      return Response.json({ error: "The what-if patch contains invalid profile fields.", code: "INVALID_INPUT" }, { status: 400 });
    }
    // Zod defaults must not reset fields omitted from a partial scenario.
    patch = Object.fromEntries(Object.keys(input.data.whatIf).map((key) => [key, parsedPatch.data[key as keyof Profile]]));
  }

  try {
    if (patch !== undefined) {
      return Response.json(WhatIfResult.parse(whatIf(input.data.profile, patch)));
    }
    return Response.json(Obligation.array().parse(computeObligations(input.data.profile, rules)));
  } catch {
    return Response.json({ error: "Unable to compute obligations.", code: "COMPUTATION_FAILED" }, { status: 500 });
  }
}
