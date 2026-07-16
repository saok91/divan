import { createTRPCRouter, publicProcedure, protectedProcedure } from "./trpc";

export const appRouter = createTRPCRouter({
  health: publicProcedure.query(() => ({
    status: "ok" as const,
    app: "دیوان",
  })),
  me: protectedProcedure.query(({ ctx }) => ({
    accountId: ctx.session.accountId,
    username: ctx.session.username,
    displayName: ctx.session.displayName,
    coarseRole: ctx.session.coarseRole,
  })),
});

export type AppRouter = typeof appRouter;
