import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createPgPool, getSharedPrismaClient } from "@divan/db";
import { createPerson, getRecalculationStatus, markRecalculationPending, setRecalcEnqueue } from "@divan/person-employment";

/** Run with the worker already running on the same isolated database. */
async function main() {
  const databaseName = new URL(process.env.DATABASE_URL ?? "").pathname.slice(1);
  assert.ok(process.env.NODE_ENV !== "production" && databaseName &&
    process.env.DIVAN_TEST_DATABASE_CONFIRM === databaseName,
  "Confirm an isolated database with DIVAN_TEST_DATABASE_CONFIRM");
  const db = getSharedPrismaClient();
  const account = await db.internalAccount.findUniqueOrThrow({where:{username:"hr.admin"}});
  const person = await createPerson({personnelCode:`QA-RECALC-${randomUUID().slice(0,8)}`,
    givenName:"آزمون",familyName:"بازیابی", mobilePhone:"09120000300"},
  {accountId:account.id,correlationId:randomUUID()},db);
  const pool = createPgPool(process.env.DATABASE_URL!);
  try {
    // Simulate an API process that committed durable state but lost its enqueue port.
    setRecalcEnqueue(null);
    await markRecalculationPending(pool,person.id,"2020-01-01");
    assert.equal((await getRecalculationStatus(pool,person.id))?.status,"pending");
    const started = performance.now();
    let status: string | undefined;
    while (performance.now()-started < 45_000) {
      await new Promise((resolve)=>setTimeout(resolve,500));
      status = (await getRecalculationStatus(pool,person.id))?.status;
      if (status === "clear") break;
    }
    assert.equal(status,"clear","A running worker must recover an unsent durable row without restart");
    console.log(`durable-recovery.selfcheck: ok; recovered without restart in ${Math.round(performance.now()-started)}ms`);
  } finally { await pool.end(); }
}
main().then(()=>process.exit(0)).catch((error)=>{console.error(error);process.exit(1);});
