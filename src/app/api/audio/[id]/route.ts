import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { getSignedUrl } from "@/lib/r2";
import { NextResponse } from "next/server";

/**
 * GET /api/audio/[id]
 * Streams audio for a generation by redirecting to a signed R2 URL.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { orgId } = await auth();
    if (!orgId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;

    const generation = await prisma.generation.findFirst({
      where: { id, orgId },
      select: { r2ObjectKey: true },
    });

    if (!generation?.r2ObjectKey) {
      return NextResponse.json(
        { error: "Audio not found" },
        { status: 404 }
      );
    }

    // Generate a pre-signed URL and redirect to it
    const signedUrl = await getSignedUrl(generation.r2ObjectKey);

    return NextResponse.redirect(signedUrl);
  } catch (error) {
    console.error("[GET /api/audio] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
