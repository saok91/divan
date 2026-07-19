export type UnitType = "LEGAL_ENTITY" | "BUSINESS_UNIT" | "DEPARTMENT" | "TEAM";

export const UNIT_TYPE_LABEL_FA: Record<UnitType, string> = {
  LEGAL_ENTITY: "نهاد حقوقی",
  BUSINESS_UNIT: "واحد کسب‌وکار",
  DEPARTMENT: "دپارتمان",
  TEAM: "تیم",
};

export const PARENT_TYPE_FOR: Record<UnitType, UnitType | null> = {
  LEGAL_ENTITY: null,
  BUSINESS_UNIT: "LEGAL_ENTITY",
  DEPARTMENT: "BUSINESS_UNIT",
  TEAM: "DEPARTMENT",
};

export const CHILD_TYPE_FOR: Record<UnitType, UnitType | null> = {
  LEGAL_ENTITY: "BUSINESS_UNIT",
  BUSINESS_UNIT: "DEPARTMENT",
  DEPARTMENT: "TEAM",
  TEAM: null,
};

export type HierarchyNode = {
  id: string;
  code: string;
  nameFa: string;
  unitType: UnitType;
  parentId: string | null;
  startDate: string;
  endDateExclusive: string | null;
  active: boolean;
  children: HierarchyNode[];
};

export function findHierarchyNode(
  nodes: HierarchyNode[],
  id: string,
): HierarchyNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findHierarchyNode(node.children, id);
    if (found) return found;
  }
  return null;
}

/** Direct active children (for deactivate confirm listing). */
export function listActiveDirectChildren(node: HierarchyNode): HierarchyNode[] {
  return node.children.filter((c) => c.active);
}
