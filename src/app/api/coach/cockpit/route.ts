import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getCockpitData } from "@/lib/coach/aggregates";

export async function GET() {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await getCockpitData(userId);
    return NextResponse.json(data);
  } catch (error) {
    console.error("[GET /api/coach/cockpit]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
