"use client";

import { collaborationTypeLabel, collaborationTypeLabels } from "@/lib/collaboration-type";
import { useId, type ComponentProps } from "react";
import { Input } from "@/components/ui/input";



/** Familiar labels for known codes, while retaining the existing free-text contract. */
export function CollaborationTypeInput({ value, onValueChange, ...props }: {
  value: string;
  onValueChange: (value: string) => void;
} & Omit<ComponentProps<typeof Input>, "value" | "onChange">) {
  const listId = useId();
  return <>
    <Input {...props} list={listId} value={collaborationTypeLabel(value)} onChange={(event) => {
      const text = event.target.value;
      onValueChange([...collaborationTypeLabels].find(([, label]) => label === text)?.[0] ?? text);
    }} autoComplete="off" />
    <datalist id={listId}>{[...collaborationTypeLabels].map(([code, label]) => <option key={code} value={label} />)}</datalist>
  </>;
}
