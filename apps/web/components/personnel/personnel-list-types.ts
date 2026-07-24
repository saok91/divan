export type PersonnelListRow = {
  id: string;
  personnelCode: string;
  givenName: string;
  familyName: string;
  team: string;
  role: string;
  jobTitle: string;
  ladder: string;
  grade: string;
  collaborationType: string;
  compensation: string;
  contractEndDate: string;
  contractParty: string;
  currentColleague: "yes" | "no";
  mobilePhone?: string;
};
