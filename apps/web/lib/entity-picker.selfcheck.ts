/**
 * Entity-picker selfcheck (Story 8.3 / UX-DR29 / FR57).
 * Run: pnpm --filter @divan/web selfcheck:entity-picker
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "..");

function read(rel: string): string {
  return fs.readFileSync(path.join(webRoot, rel), "utf8");
}

function exists(rel: string): boolean {
  return fs.existsSync(path.join(webRoot, rel));
}

assert.ok(
  exists("components/entity-picker/entity-picker.tsx"),
  "EntityPicker module must exist",
);
assert.ok(
  exists("components/entity-picker/entity-token.tsx"),
  "EntityToken module must exist",
);
assert.ok(
  exists("components/entity-picker/index.ts"),
  "entity-picker barrel export must exist",
);

const indexSrc = read("components/entity-picker/index.ts");
assert.match(indexSrc, /EntityPicker/, "barrel must export EntityPicker");
assert.match(indexSrc, /EntityToken/, "barrel must export EntityToken");
assert.match(
  indexSrc,
  /useEntityPickerCascade/,
  "barrel must export useEntityPickerCascade",
);

const pickerSrc = read("components/entity-picker/entity-picker.tsx");
assert.match(
  pickerSrc,
  /role=["']combobox["']/,
  "EntityPicker input must expose role=combobox",
);
assert.match(
  pickerSrc,
  /aria-activedescendant/,
  "EntityPicker must wire aria-activedescendant",
);
assert.match(
  pickerSrc,
  /aria-expanded/,
  "EntityPicker must wire aria-expanded",
);
assert.match(
  pickerSrc,
  /aria-controls/,
  "EntityPicker must wire aria-controls",
);
assert.match(
  pickerSrc,
  /role=["']option["']/,
  "EntityPicker options must use role=option",
);
assert.match(
  pickerSrc,
  /normalizeDigitsForMatch/,
  "EntityPicker must normalize digits before search",
);
assert.doesNotMatch(
  pickerSrc,
  /CommandDialog/,
  "EntityPicker must not use CommandDialog",
);

const tokenSrc = read("components/entity-picker/entity-token.tsx");
assert.match(
  tokenSrc,
  /entity-token/,
  "EntityToken must set data-slot entity-token",
);
assert.match(
  tokenSrc,
  /پاک کردن انتخاب|clearLabelFa/,
  "EntityToken clear must have Persian aria-label",
);

const galleryPage = read("app/(app)/dev/gallery/page.tsx");
assert.match(
  galleryPage,
  /EntityPickerGalleryDemos|EntityPicker/,
  "Gallery must reference EntityPicker demos",
);
assert.doesNotMatch(
  galleryPage,
  /entity-picker — Story 8\.3/,
  "Gallery must not keep the 8.3 stub-only label",
);
assert.match(
  galleryPage,
  /NODE_ENV === ["']production["']/,
  "Gallery production notFound gate must remain",
);

const orgRouter = read("src/server/organization.ts");
assert.match(
  orgRouter,
  /getByCode/,
  "organization router must expose getByCode",
);

const jobRefRouter = read("src/server/job-reference.ts");
assert.match(
  jobRefRouter,
  /getByCode/,
  "jobReference router must expose getByCode",
);

const personRouter = read("src/server/person.ts");
assert.match(
  personRouter,
  /listSelectableEmployments/,
  "person router must expose listSelectableEmployments",
);
assert.match(
  personRouter,
  /listSelectablePrimaryAssignments/,
  "person router must expose listSelectablePrimaryAssignments",
);

// 8.4 boundary: personnel-event-form still uses raw UUID Inputs
const eventForm = read("components/personnel/personnel-event-form.tsx");
assert.match(
  eventForm,
  /teamId|ladderId|personId/,
  "personnel-event-form UUID fields remain for Story 8.4 retrofit",
);
assert.doesNotMatch(
  eventForm,
  /EntityPicker/,
  "personnel-event-form must not consume EntityPicker yet (8.4)",
);

const resolvers = read("components/entity-picker/resolvers.ts");
assert.match(resolvers, /createPersonSearch/, "person resolver");
assert.match(resolvers, /createOrgUnitSearch/, "org resolver");
assert.match(resolvers, /createGradeSearch/, "grade cascade resolver");
assert.match(resolvers, /createEmploymentSearch/, "employment dependent resolver");
assert.match(resolvers, /createPrimaryAssignmentSearch/, "PA dependent resolver");
assert.match(resolvers, /createHeadcountApprovalSearch/, "approval resolver");
assert.match(resolvers, /createAccountSearch/, "account resolver");

console.log("entity-picker selfcheck: ok");
