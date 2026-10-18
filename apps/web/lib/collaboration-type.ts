/** Known collaboration codes retain readable labels; arbitrary legacy text stays intact. */
const labels = new Map<string, string>([["employee", "کارمند"], ["contractor", "پیمانکار"]]);
export const collaborationTypeLabels = labels;
export function collaborationTypeLabel(value: string): string {
  return labels.get(value) ?? value;
}
