/** Schedule only after completion, so slow or failed recovery never overlaps. */
export function startRecoveryLoop(
  task: () => Promise<void>,
  options: {
    intervalMs?: number;
    onError: () => void;
    schedule?: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;
    cancel?: (timer: ReturnType<typeof setTimeout>) => void;
  },
) {
  const schedule = options.schedule ?? setTimeout;
  const cancel = options.cancel ?? clearTimeout;
  let stopping = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let active: Promise<void>;
  const run = async () => {
    try { await task(); } catch { options.onError(); }
    if (!stopping) timer = schedule(() => { active = run(); }, options.intervalMs ?? 30_000);
  };
  active = run();
  return async () => {
    stopping = true;
    if (timer !== undefined) cancel(timer);
    await active;
  };
}
