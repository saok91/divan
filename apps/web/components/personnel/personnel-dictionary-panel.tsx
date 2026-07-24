"use client";

import * as React from "react";

import { operationalCopy } from "@/lib/operational-copy";
import { api } from "@/lib/trpc/client";

/**
 * Dictionary registry UI — Admin-only tab content (Story 4b.7).
 */
export function PersonnelDictionaryPanel() {
  const formId = React.useId();
  const dictionaryQuery = api.person.listDictionary.useQuery();

  return (
    <div className="mx-auto max-w-3xl space-y-4 text-foreground">
      <header className="space-y-2">
        <h2 id={`${formId}-heading`} className="text-heading-sm">
          {operationalCopy.personDictionaryHeading}
        </h2>
        <p className="text-caption text-muted-foreground">
          {operationalCopy.personDictionaryHint}
        </p>
      </header>

      {dictionaryQuery.isLoading ? (
        <p className="text-body text-muted-foreground" role="status">
          {operationalCopy.personDictionaryLoading}
        </p>
      ) : null}
      {dictionaryQuery.isError ? (
        <p className="text-body text-destructive" role="alert">
          {dictionaryQuery.error.message ||
            operationalCopy.personDictionaryError}
        </p>
      ) : null}
      {dictionaryQuery.data && dictionaryQuery.data.length === 0 ? (
        <p className="text-body text-muted-foreground" role="status">
          {operationalCopy.personDictionaryEmpty}
        </p>
      ) : null}
      {dictionaryQuery.data && dictionaryQuery.data.length > 0 ? (
        <ul
          className="divide-y divide-border border border-border text-caption"
          aria-labelledby={`${formId}-heading`}
        >
          {dictionaryQuery.data.map((el) => (
            <li
              key={el.elementId}
              className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2"
            >
              <span className="text-foreground">{el.labelFa}</span>
              <span className="text-muted-foreground">
                {el.disposition}
                {" · "}
                {el.enabled
                  ? operationalCopy.personDictionaryEnabled
                  : operationalCopy.personDictionaryDisabled}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
