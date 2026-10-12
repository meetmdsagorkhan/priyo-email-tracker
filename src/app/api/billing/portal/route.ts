import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { applicationOrigin } from "@/lib/site";
import { stripePost } from "@/lib/stripe";

export async function POST(request: Request) {
  const access = await requireApiUser("admin");
  if (access.response) return access.response;
  try {
    const workspace = await prisma.workspace.findUnique({
      where: { id: access.user.workspaceId },
      select: { stripeCustomerId: true },
    });
    if (!workspace?.stripeCustomerId)
      return NextResponse.json(
        { error: "No Stripe customer is linked to this workspace yet." },
        { status: 409 },
      );
    const session = await stripePost("billing_portal/sessions", {
      customer: workspace.stripeCustomerId,
      return_url: `${applicationOrigin(request.url)}/billing`,
    });
    if (typeof session.url !== "string")
      throw new Error("Stripe did not return a billing portal URL.");
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe billing portal creation failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to open the billing portal.",
      },
      { status: 502 },
    );
  }
}
