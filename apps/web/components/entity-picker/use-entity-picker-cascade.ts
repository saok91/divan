"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { EntityPickerValue } from "./types";

export type CascadeParentLabel = string;

export type UseEntityPickerCascadeResult = {
  value: EntityPickerValue;
  onValueChange: (next: EntityPickerValue) => void;
  disabled: boolean;
  disabledReasonFa: string | undefined;
};

/**
 * When parent selection changes, clear the dependent value and expose
 * FR58 / UX-DR30 disabled-with-reason copy.
 */
export function useEntityPickerCascade(
  parent: EntityPickerValue,
  parentLabelFa: CascadeParentLabel,
  options?: {
    /** Controlled child value (optional). */
    value?: EntityPickerValue;
    onValueChange?: (next: EntityPickerValue) => void;
  },
): UseEntityPickerCascadeResult {
  const [internal, setInternal] = useState<EntityPickerValue>(null);
  const controlled = options?.value !== undefined;
  const value = controlled ? (options.value ?? null) : internal;
  const onValueChangeProp = options?.onValueChange;
  const onValueChangeRef = useRef(onValueChangeProp);
  onValueChangeRef.current = onValueChangeProp;

  const setValue = useCallback(
    (next: EntityPickerValue) => {
      if (!controlled) setInternal(next);
      onValueChangeRef.current?.(next);
    },
    [controlled],
  );

  const prevParentId = useRef<string | null | undefined>(undefined);
  const [clearedReason, setClearedReason] = useState<string | undefined>();

  useEffect(() => {
    const nextId = parent?.id ?? null;
    if (prevParentId.current === undefined) {
      prevParentId.current = nextId;
      return;
    }
    if (prevParentId.current === nextId) return;
    const hadParent = prevParentId.current != null;
    prevParentId.current = nextId;
    setValue(null);
    // Only announce clear when replacing an existing parent (not first select).
    if (nextId && hadParent) {
      setClearedReason(
        `با تغییر ${parentLabelFa}، انتخاب وابسته پاک شد.`,
      );
    } else {
      setClearedReason(undefined);
    }
  }, [parent?.id, parentLabelFa, setValue]);

  const disabled = !parent;
  const disabledReasonFa = disabled
    ? `ابتدا ${parentLabelFa} را انتخاب کنید.`
    : clearedReason;

  return {
    value,
    onValueChange: (next) => {
      setClearedReason(undefined);
      setValue(next);
    },
    disabled,
    disabledReasonFa,
  };
}
