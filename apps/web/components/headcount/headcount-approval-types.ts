export type HeadcountApprovalRow = {
  id: string;
  requirementCode: string;
  teamId: string;
  /** Display label — never a bare UUID when org list is available. */
  teamLabel: string;
  teamCode: string;
  teamNameFa: string;
  jobTitleId: string;
  allowedCount: number;
  used: number;
  reserved: number;
  free: number;
  status: string;
  validityStart: string;
  validityEndExclusive: string;
};
