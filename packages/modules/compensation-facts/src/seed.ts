/**
 * Demo seed for compensation / contractual facts (Story 3.4 / FR-8).
 * Invoked from identity-access seedDevAccounts after employment fixtures.
 * Uses skipDictionaryGate — catalogue elements remain later until AR-DATA.
 */

import type { PrismaClient } from "@divan/db";
import {
  SEED_PERSON_IDENTITY,
  seedEmploymentLifecycleFixtures,
} from "@divan/person-employment";

import {
  applyCompensationProjection,
  applyContractualProjection,
  FACT_KIND,
  listCompensationFactsForPerson,
} from "./compensation";
import { getCompensationDb } from "./db";

/** Adjacent half-open intervals for demo Person 10001. */
export const SEED_COMPENSATION_FACTS = {
  historicalStart: "2020-01-01",
  historicalEndExclusive: "2024-01-01",
  activeStart: "2024-01-01",
  historicalAmount: "45000000",
  activeAmount: "52000000",
  currency: "IRR",
  changeTypeHistorical: "baseline",
  changeTypeActive: "adjustment",
  collaborationHistorical: "contractor",
  collaborationActive: "employee",
  contractTypeHistorical: "fixed_term",
  contractTypeActive: "indefinite",
} as const;

function isAdjacentCompensationPair(
  rows: Awaited<ReturnType<typeof listCompensationFactsForPerson>>,
): boolean {
  const comps = rows.filter((r) => r.factKind === FACT_KIND.compensation);
  const hist = comps.find(
    (e) =>
      e.startDate === SEED_COMPENSATION_FACTS.historicalStart &&
      e.endDateExclusive === SEED_COMPENSATION_FACTS.historicalEndExclusive,
  );
  const open = comps.find(
    (e) =>
      e.startDate === SEED_COMPENSATION_FACTS.activeStart &&
      e.endDateExclusive === null,
  );
  return Boolean(hist && open && hist.endDateExclusive === open.startDate);
}

function isAdjacentContractualPair(
  rows: Awaited<ReturnType<typeof listCompensationFactsForPerson>>,
): boolean {
  const contracts = rows.filter((r) => r.factKind === FACT_KIND.contractual);
  const hist = contracts.find(
    (e) =>
      e.startDate === SEED_COMPENSATION_FACTS.historicalStart &&
      e.endDateExclusive === SEED_COMPENSATION_FACTS.historicalEndExclusive,
  );
  const open = contracts.find(
    (e) =>
      e.startDate === SEED_COMPENSATION_FACTS.activeStart &&
      e.endDateExclusive === null,
  );
  return Boolean(hist && open && hist.endDateExclusive === open.startDate);
}

/**
 * Seed closed historical + open current compensation + contractual facts.
 * Idempotent when both adjacent seed pairs are already present.
 */
export async function seedDemoCompensationFacts(
  db: PrismaClient = getCompensationDb(),
): Promise<{ personId: string; factIds: string[] }> {
  const person = await db.person.findUnique({
    where: { personnelCode: SEED_PERSON_IDENTITY.demoPersonnelCode },
  });
  if (!person) {
    throw new Error(
      `Demo person ${SEED_PERSON_IDENTITY.demoPersonnelCode} required before compensation seed`,
    );
  }

  const existing = await listCompensationFactsForPerson(person.id, undefined, db);
  if (
    existing.length >= 4 &&
    isAdjacentCompensationPair(existing) &&
    isAdjacentContractualPair(existing)
  ) {
    return {
      personId: person.id,
      factIds: existing.map((e) => e.id),
    };
  }

  return db.$transaction(async (tx) => {
    const client = tx as unknown as PrismaClient;
    if (existing.length > 0) {
      await client.compensationFact.deleteMany({ where: { personId: person.id } });
    }

    const histComp = await applyCompensationProjection(
      {
        personId: person.id,
        startDate: SEED_COMPENSATION_FACTS.historicalStart,
        endDateExclusive: SEED_COMPENSATION_FACTS.historicalEndExclusive,
        amount: SEED_COMPENSATION_FACTS.historicalAmount,
        currency: SEED_COMPENSATION_FACTS.currency,
        changeType: SEED_COMPENSATION_FACTS.changeTypeHistorical,
        skipDictionaryGate: true,
      },
      client,
    );
    const openComp = await applyCompensationProjection(
      {
        personId: person.id,
        startDate: SEED_COMPENSATION_FACTS.activeStart,
        endDateExclusive: null,
        amount: SEED_COMPENSATION_FACTS.activeAmount,
        currency: SEED_COMPENSATION_FACTS.currency,
        changeType: SEED_COMPENSATION_FACTS.changeTypeActive,
        skipDictionaryGate: true,
      },
      client,
    );

    const histContract = await applyContractualProjection(
      {
        personId: person.id,
        startDate: SEED_COMPENSATION_FACTS.historicalStart,
        endDateExclusive: SEED_COMPENSATION_FACTS.historicalEndExclusive,
        collaborationType: SEED_COMPENSATION_FACTS.collaborationHistorical,
        contractType: SEED_COMPENSATION_FACTS.contractTypeHistorical,
        contractingEntity: "Demo Contracting Co",
        skipDictionaryGate: true,
      },
      client,
    );
    const openContract = await applyContractualProjection(
      {
        personId: person.id,
        startDate: SEED_COMPENSATION_FACTS.activeStart,
        endDateExclusive: null,
        collaborationType: SEED_COMPENSATION_FACTS.collaborationActive,
        contractType: SEED_COMPENSATION_FACTS.contractTypeActive,
        contractingEntity: "Demo Legal Entity",
        insuringEntity: "Demo Insurer",
        skipDictionaryGate: true,
      },
      client,
    );

    return {
      personId: person.id,
      factIds: [histComp.id, openComp.id, histContract.id, openContract.id],
    };
  });
}

/** Employment lifecycle + compensation facts (Stories 3.2–3.4). */
export async function seedCompensationFactsFixtures(
  db: PrismaClient = getCompensationDb(),
): Promise<void> {
  await seedEmploymentLifecycleFixtures(db);
  await seedDemoCompensationFacts(db);
}
