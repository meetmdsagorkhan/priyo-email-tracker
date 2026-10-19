import { Prisma } from "@prisma/client";

// Old events may have SQL NULL, JSON null, or no is_test key. Preserve all
// of those; only an explicit true marks a test observation.
export const liveEventWhere: Prisma.TrackingEventWhereInput = {
  OR: [
    { NOT: { metadata: { path: ["is_test"], equals: true } } },
    { metadata: { path: ["is_test"], equals: Prisma.AnyNull } },
    { metadata: { equals: Prisma.DbNull } },
  ],
};

// Use recorded scanner/proxy classification consistently in engagement cohorts.
// Missing legacy classification means unknown, rather than proof of automation.
export const observedEventWhere: Prisma.TrackingEventWhereInput = {
  OR: [
    { NOT: { metadata: { path: ["automated_estimate"], equals: true } } },
    { metadata: { path: ["automated_estimate"], equals: Prisma.AnyNull } },
    { metadata: { equals: Prisma.DbNull } },
    {
      userAgent: {
        contains:
          "mozilla/5.0 (macintosh; intel mac os x 10_15_7) applewebkit/605.1.15",
        mode: "insensitive",
      },
    },
  ],
};
