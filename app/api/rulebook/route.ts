import { rulebookDataset } from "@/components/rulebook/dataset";

export const dynamic = "force-static";

export function GET() {
  return Response.json(rulebookDataset(), { headers: {
    "Content-Disposition": 'attachment; filename="manzil-rulebook.json"',
    "X-Content-Type-Options": "nosniff",
  } });
}
