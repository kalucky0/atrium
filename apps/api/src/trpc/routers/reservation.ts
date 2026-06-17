import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { reservation } from "@atrium/db/schema";
import { protectedProcedure, router } from "../trpc";

export const reservationRouter = router({
  listByResource: protectedProcedure
    .input(z.object({ resourceId: z.uuid() }))
    .query(({ ctx, input }) =>
      ctx.db.select().from(reservation).where(eq(reservation.resourceId, input.resourceId)),
    ),

  // Insert relies on the EXCLUDE constraint (reservation_no_overlap) to reject
  // overlaps atomically — no read-then-write race. '[)' (half-open) matches the
  // constraint, so back-to-back slots (end == next start) don't collide.
  create: protectedProcedure
    .input(
      z
        .object({
          resourceId: z.uuid(),
          start: z.date(),
          end: z.date(),
        })
        .refine((v) => v.start < v.end, { message: "start musi być przed end", path: ["end"] }),
    )
    .mutation(async ({ ctx, input }) => {
      const during = sql`tstzrange(${input.start}, ${input.end}, '[)')`;
      try {
        const [row] = await ctx.db
          .insert(reservation)
          .values({ resourceId: input.resourceId, userId: ctx.user.id, during })
          .returning();
        return row;
      } catch (e) {
        // Postgres 23P01 = exclusion_violation -> termin zajęty. drizzle 0.45 wraps
        // driver errors in DrizzleQueryError, so the SQLSTATE sits on .cause.
        const code =
          (e as { code?: string }).code ?? (e as { cause?: { code?: string } }).cause?.code;
        if (code === "23P01")
          throw new TRPCError({ code: "CONFLICT", message: "Termin jest już zajęty" });
        throw e;
      }
    }),
});
