import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { reservation } from "@atrium/db/schema";
import { protectedProcedure, router } from "../trpc";

export const availabilityRouter = router({
  forResource: protectedProcedure
    .input(
      z
        .object({
          resourceId: z.uuid(),
          from: z.date(),
          to: z.date(),
        })
        .refine((v) => v.from < v.to, { message: "from musi być przed to", path: ["to"] }),
    )
    .query(({ ctx, input }) =>
      ctx.db
        .select({
          id: reservation.id,
          during: reservation.during,
          title: reservation.title,
          userId: reservation.userId,
        })
        .from(reservation)
        .where(
          and(
            eq(reservation.resourceId, input.resourceId),
            sql`${reservation.during} && tstzrange(${input.from.toISOString()}::timestamptz, ${input.to.toISOString()}::timestamptz, '[)')`,
          ),
        )
        .orderBy(reservation.during),
    ),
});
