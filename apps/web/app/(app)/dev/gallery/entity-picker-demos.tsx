"use client";

import * as React from "react";

import {
  EntityPicker,
  createEmploymentSearch,
  createGradeSearch,
  createLadderSearch,
  createPersonSearch,
  useEntityPickerCascade,
  type EntityPickerValue,
} from "@/components/entity-picker";
import {
  FormField,
  FormLayout,
  FormSection,
} from "@/components/form-layout";

/**
 * Living entity-picker demos for /dev/gallery (Story 8.3).
 * Light/dark follow the gallery theme toggle.
 */
export function EntityPickerGalleryDemos() {
  const personSearch = React.useMemo(() => createPersonSearch(), []);
  const ladderSearch = React.useMemo(() => createLadderSearch(), []);

  const [person, setPerson] = React.useState<EntityPickerValue>(null);
  const [ladder, setLadder] = React.useState<EntityPickerValue>(null);

  const gradeCascade = useEntityPickerCascade(ladder, "لدر");
  const employmentCascade = useEntityPickerCascade(person, "پرسنل");

  const gradeSearch = React.useMemo(
    () => createGradeSearch(ladder?.id ?? null),
    [ladder?.id],
  );
  const employmentSearch = React.useMemo(
    () => createEmploymentSearch(person?.id ?? null),
    [person?.id],
  );

  return (
    <section
      className="space-y-3"
      aria-labelledby="gallery-entity-picker"
    >
      <h2
        id="gallery-entity-picker"
        className="text-heading-sm px-content-padding-inline"
      >
        Entity picker (8.3)
      </h2>
      <p className="text-caption text-text-secondary px-content-padding-inline">
        جستجوی ناهمگام از اولین نویسه؛ ارقام فارسی/عربی نرمال می‌شوند. فوکس روی
        ورودی می‌ماند (↑↓ · Enter · Esc). انتخاب به صورت entity-token نمایش داده
        می‌شود.
      </p>

      <FormLayout>
        <FormSection title="پرسنل + همکاری وابسته">
          <FormField label="پرسنل" htmlFor="gallery-ep-person" required>
            <EntityPicker
              id="gallery-ep-person"
              search={personSearch}
              value={person}
              onValueChange={setPerson}
              scopeNoteFa="جستجوی محدود به جمعیت قابل‌مشاهده"
              placeholder="کد یا نام پرسنل…"
            />
          </FormField>
          <FormField label="همکاری" htmlFor="gallery-ep-employment">
            <EntityPicker
              id="gallery-ep-employment"
              search={employmentSearch}
              value={employmentCascade.value}
              onValueChange={employmentCascade.onValueChange}
              disabled={employmentCascade.disabled}
              disabledReasonFa={employmentCascade.disabledReasonFa}
              scopeNoteFa="سوابق همکاری پس از انتخاب پرسنل"
              placeholder="تاریخ یا نوع همکاری…"
            />
          </FormField>
        </FormSection>

        <FormSection title="لدر → گرید (آبشاری)">
          <FormField label="لدر" htmlFor="gallery-ep-ladder">
            <EntityPicker
              id="gallery-ep-ladder"
              search={ladderSearch}
              value={ladder}
              onValueChange={setLadder}
              scopeNoteFa="مراجع شغلی"
              placeholder="کد یا نام لدر…"
            />
          </FormField>
          <FormField label="گرید" htmlFor="gallery-ep-grade">
            <EntityPicker
              id="gallery-ep-grade"
              search={gradeSearch}
              value={gradeCascade.value}
              onValueChange={gradeCascade.onValueChange}
              disabled={gradeCascade.disabled}
              disabledReasonFa={gradeCascade.disabledReasonFa}
              scopeNoteFa="گریدهای لدر انتخاب‌شده"
              placeholder="کد یا نام گرید…"
            />
          </FormField>
        </FormSection>

        <FormSection title="حالت غیرفعال با دلیل">
          <FormField label="نمونه" htmlFor="gallery-ep-disabled">
            <EntityPicker
              id="gallery-ep-disabled"
              search={async () => []}
              value={null}
              onValueChange={() => {}}
              disabled
              disabledReasonFa="ابتدا پرسنل را انتخاب کنید."
              placeholder="غیرفعال…"
            />
          </FormField>
        </FormSection>
      </FormLayout>
    </section>
  );
}
