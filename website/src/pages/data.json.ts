import { mixes } from "@/data/mixes";

export function GET() {
    return new Response(
      JSON.stringify(mixes.sort((a, b) => a.id.localeCompare(b.id))),
    );
  }