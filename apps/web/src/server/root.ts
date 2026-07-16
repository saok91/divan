import { createTRPCRouter, publicProcedure } from "./trpc";

export const appRouter = createTRPCRouter({
  health: publicProcedure.query(() => ({
    status: "ok" as const,
    app: "دیوان",
  })),
});

export type AppRouter = typeof appRouter;
