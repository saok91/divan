import assert from "node:assert/strict";
import { startRecoveryLoop } from "./recovery-loop";

async function main() {
  let finish: (() => void) | undefined;
  let queued: (() => void) | undefined;
  let calls = 0;
  let errors = 0;
  let cancelled = false;
  function fireScheduled() { assert.ok(queued); queued(); }
  const stop = startRecoveryLoop(async () => {
    calls++;
    if (calls === 2) throw new Error("temporary enqueue failure");
    await new Promise<void>((resolve) => { finish = resolve; });
  }, {
    onError: () => { errors++; },
    schedule: (callback) => { queued = callback; return 1 as unknown as ReturnType<typeof setTimeout>; },
    cancel: () => { cancelled = true; queued = undefined; },
  });
  assert.equal(calls, 1);
  assert.equal(queued, undefined, "No second run while recovery is pending");
  finish!();
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.ok(queued);
  fireScheduled();
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(errors, 1);
  assert.equal(calls, 2);
  assert.ok(queued, "Failures must schedule another attempt");
  fireScheduled();
  assert.equal(calls, 3);
  let stopped = false;
  const stopping = stop().then(() => { stopped = true; });
  await Promise.resolve();
  assert.equal(stopped, false, "Shutdown waits for in-flight recovery");
  finish!();
  await stopping;
  assert.equal(cancelled, true);
  assert.equal(queued, undefined, "Shutdown must not schedule more work");
  console.log("recovery-loop.selfcheck: ok");
}
void main();
