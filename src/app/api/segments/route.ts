import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { parseGroupDefinition } from "@/lib/recipient-groups";
import {
  ENGAGEMENT_FILTERS,
  getSegmentAudience,
  parseSegmentDefinition,
} from "@/lib/segments";

export async function GET() {
  const access = await requireApiUser("read");
  if (access.response) return access.response;
  try {
    const segments = await prisma.segment.findMany({
      where: { workspaceId: access.user.workspaceId },
      orderBy: { createdAt: "desc" },
    });
    const result = await Promise.all(
      segments.filter(segment => !parseGroupDefinition(segment.definition)).map(async (segment) => {
        const definition = parseSegmentDefinition(segment.definition);
        if (!definition) throw new Error(`Segment ${segment.id} is invalid`);
        const audience = await getSegmentAudience(
          access.user.workspaceId,
          definition,
        );
        return { ...segment, definition, audienceCount: audience.length };
      }),
    );
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to load workspace segments:", error);
    return NextResponse.json(
      { error: "Unable to load workspace segments." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const access = await requireApiUser("manage");
  if (access.response) return access.response;
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const campaignId =
    typeof body?.campaignId === "string" ? body.campaignId : "";
  const engagement = body?.engagement;
  if (
    !name ||
    name.length > 100 ||
    !campaignId ||
    !ENGAGEMENT_FILTERS.includes(engagement)
  )
    return NextResponse.json(
      { error: "Enter a segment name, campaign, and engagement filter." },
      { status: 400 },
    );
  try {
    const audience = await getSegmentAudience(access.user.workspaceId, {
      campaignId,
      engagement,
    });
    const segment = await prisma.segment.create({
      data: {
        name,
        workspaceId: access.user.workspaceId,
        definition: { campaignId, engagement },
      },
    });
    return NextResponse.json(
      { ...segment, definition: { campaignId, engagement }, audienceCount: audience.length },
      { status: 201 },
    );
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    )
      return NextResponse.json(
        { error: "A segment with this name already exists." },
        { status: 409 },
      );
    if (error instanceof Error && error.message === "Segment campaign not found")
      return NextResponse.json(
        { error: "The selected campaign is not in this workspace." },
        { status: 404 },
      );
    console.error("Failed to create workspace segment:", error);
    return NextResponse.json(
      { error: "Unable to create segment." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const access = await requireApiUser("manage");
  if (access.response) return access.response;
  const body = await request.json().catch(() => null);
  if (typeof body?.id !== "string")
    return NextResponse.json({ error: "Segment ID is required." }, { status: 400 });
  const deleted = await prisma.segment.deleteMany({
    where: { id: body.id, workspaceId: access.user.workspaceId },
  });
  if (!deleted.count)
    return NextResponse.json({ error: "Segment not found." }, { status: 404 });
  return NextResponse.json({ success: true });
}
