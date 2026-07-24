/**
 * Headcount conservation identity (Story 5.4 / FR-30 reuse).
 * approved = used + reserved + free — fail-closed on violation (never silent floor).
 */

export const MSG_DASHBOARD_HEADCOUNT_CONSERVATION_FA =
  "توازن ظرفیت برقرار نیست؛ اعداد قطعی ارائه نمی‌شود.";

export type HeadcountConservationQuantities = {
  approved: number;
  used: number;
  reserved: number;
  free: number;
};

export type HeadcountConservationResult =
  | { ok: true; quantities: HeadcountConservationQuantities }
  | { ok: false; messageFa: string; quantities: HeadcountConservationQuantities };

export function assertHeadcountConservation(
  quantities: HeadcountConservationQuantities,
): HeadcountConservationResult {
  const { approved, used, reserved, free } = quantities;
  for (const n of [approved, used, reserved, free]) {
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
      return {
        ok: false,
        messageFa: MSG_DASHBOARD_HEADCOUNT_CONSERVATION_FA,
        quantities,
      };
    }
  }
  if (approved !== used + reserved + free) {
    return {
      ok: false,
      messageFa: MSG_DASHBOARD_HEADCOUNT_CONSERVATION_FA,
      quantities,
    };
  }
  return { ok: true, quantities };
}
