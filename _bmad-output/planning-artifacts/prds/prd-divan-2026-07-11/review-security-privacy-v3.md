# بررسی نهایی متمرکز دروازهٔ امنیت و حریم خصوصی — Divan HRIS

**اسناد بررسی‌شده:** `prd.md` و `addendum.md` به‌روزشده در 2026-07-11  
**مبنای تطبیق:** V2-H1 تا V2-H4 و V2-M1 در `review-security-privacy-v2.md`  
**نوع بررسی:** الزامات محصول؛ بدون انتخاب پشته یا سازوکار فنی

## حکم

**دروازهٔ نهایی در سطح الزامات محصول با یک یافتهٔ متوسط پاس می‌شود: هر پنج یافتهٔ هدف به‌صورت ماهوی بسته شده‌اند و هیچ یافتهٔ بحرانی یا بالای جدیدی مشاهده نشد.**

این حکم به معنای تصویب baseline معماری یا build نیست. `prd.md` §8.1 صریحاً وضعیت تمام Launch Artifactها را `pending` ثبت کرده است؛ بنابراین baselineهای متأثر تا تولید، تصویب و version-freeze مصنوعات مربوط طبق §8.2 همچنان مسدودند. این وضعیت یک نقص امنیتی نیست، بلکه اجرای درست staged gate است.

## شمارش شدت

- **بحرانی:** 0
- **بالا:** 0
- **متوسط:** 1
- **پایین:** 0
- **مجموع یافته‌های باز:** 1

## تطبیق یافته‌های V2

### V2-H1 — حل‌شده

**عنوان قبلی:** policy زمانی می‌توانست دسترسی مدیریتی تاریخیِ بیش‌ازحد باز را مجاز کند.

**شواهد:** `prd.md` §5.11 FR-47، به‌ویژه consequences دوم تا چهارم؛ §8.1 AR-ACCESS/AR-REPORTING؛ `addendum.md` §12.3.

FR-47 اکنون یک invariant مستقل از artifact تعیین می‌کند: management-derived scope به‌طور پیش‌فرض فقط facts و intervalهای پوشیده‌شده توسط رابطهٔ مدیریتی/سازمانی مجاز را می‌بیند. دسترسی مدیر فعلی به pre-scope history و مدیر سابق به post-scope history نیازمند grant جداگانهٔ purpose/category/time-bounded و audit است؛ AR-ACCESS فقط می‌تواند این مرز را محدودتر کند و حق گسترش ضمنی ندارد. fixture پذیرش نیز این رفتار را پوشش می‌دهد.

**نتیجه:** اصلاح ماهوی و آزمون‌پذیر؛ finding بسته شد.

### V2-H2 — حل‌شده

**عنوان قبلی:** cardinality حساب/identity و bound نامحدود revocation.

**شواهد:** `prd.md` FR-46 consequences دوم و سوم؛ FR-47 consequence چهارم؛ FR-49؛ §8.1 AR-ACCESS/AR-IDENTITY؛ `addendum.md` §12.3.

- هر internal human account دقیقاً نمایندهٔ یک انسان و یک external identity فعال یا aliasهای اثبات‌شدهٔ همان انسان است.
- shared human account و aliasهای متعلق به افراد متفاوت ممنوع‌اند.
- merge/split/relink نیازمند evidence، approval مستقل و audit است.
- revocation پیش از protected action بعدی enforce می‌شود و objective محدود و version-frozen دارد.
- queued work و artifact retrieval پیش از اجرا/تحویل دوباره authorization می‌شوند.
- entitlement با recertification عقب‌افتاده نمی‌تواند نامحدود فعال بماند.

**نتیجه:** هر دو loophole بسته شدند؛ finding بسته شد.

### V2-H3 — حل‌شده

**عنوان قبلی:** restore می‌توانست داده، grant یا artifact منقضی را زنده کند.

**شواهد:** `prd.md` NFR-6؛ §8.1 AR-CUTOVER؛ LG-5؛ `addendum.md` §10 و §12.3/§12.5.

restored state تا تکمیل و امضای catch-up برای disposal/hold، identity/entitlement revocation، artifact expiry/revocation، policy version، event/Correction delta و derived-state reconciliation در دسترس کاربران قرار نمی‌گیرد. session، queued work و emergency grant بازیابی‌شده نیز به‌طور پیش‌فرض نامعتبرند. witnessed restore اکنون catch-up را نیز در acceptance شامل می‌شود.

**نتیجه:** اصلاح ماهوی و fail-closed؛ finding بسته شد.

### V2-H4 — حل‌شده

**عنوان قبلی:** تغییرات بسیار حساس فقط کنترل پسینی داشتند.

**شواهد:** `prd.md` §5.4 FR-15؛ §8.1 AR-ACCESS/AR-AUDIT/AR-MIGRATION؛ `addendum.md` §12.3.

FR-15 دیگر secondary approval را به‌طور مطلق حذف نمی‌کند. termination، compensation change، retroactive change خارج از window مصوب، high-impact headcount Override و production bulk import حداقل باید independent pre-authorization داشته باشند یا تا review مستقل non-authoritative/non-effective بمانند. تنها کارهای routine خارج از risk tier بدون approval دوم عمومی باقی می‌مانند. threshold، reviewer و oracle پیش از feature baseline version-freeze می‌شوند.

**نتیجه:** اصلاح ماهوی و پیشگیرانه؛ finding بسته شد.

### V2-M1 — حل‌شده

**عنوان قبلی:** custody نسخهٔ دانلودشده خارج از artifact مدیریت‌شده روشن نبود.

**شواهد:** `prd.md` FR-52، به‌ویژه consequences چهارم؛ `addendum.md` §6.5 و §12.3.

هنگام download، classification/handling/expiry نمایش داده می‌شود؛ recipient/destination class و custody transfer ثبت می‌شوند؛ bulk/sensitive retrieval نیازمند acknowledgement است؛ و مرز کنترل صادقانه تعریف شده است: Divan می‌تواند artifact/link مدیریت‌شده را revoke کند، نه local/email/share copy را. نسخهٔ خارج‌شده تابع فرایند سازمانی disposal/incident است.

**نتیجه:** اصلاح ماهوی؛ finding بسته شد.

## بررسی critical/high جدید

هیچ مسیر جدیدی یافت نشد که:

- default-deny، temporal scope یا cross-boundary intersection را دور بزند؛
- self-escalation، shared account یا revocation تأخیریِ نامحدود ایجاد کند؛
- inference/bulk retrieval را به یک کانال کنترل‌نشده منتقل کند؛
- audit concealment یا fail-open sensitive operation را مجاز کند؛
- restore، non-production، backup یا migration را از lifecycle/security gate خارج کند؛
- sensitive event را بدون risk-tier پیشگیرانه authoritative کند؛
- retention/disposal را با immutability یا report reproducibility خنثی کند.

همچنین FR-55 اکنون conflict میان Launch Artifactها را fail-closed می‌کند و threshold/workload/environment change را مشمول rebaseline می‌داند؛ این دو افزوده از ایجاد loophole از طریق policy conflict یا تغییر دیرهنگام جلوگیری می‌کنند.

## یافتهٔ متوسط جدید

### V3-M1 — attachmentهای correction case هنوز قرارداد ایمنی فایل ندارند

**ارجاع دقیق:** `prd.md` FR-53 consequences اول؛ §6 non-goal مربوط به document management؛ §7.1؛ در برابر FR-52؛ `addendum.md` §12.4.

**مسئله:** FR-53 اکنون bounded attachment را در صورت approval/classification/lifecycle governance مجاز می‌کند. این اصلاح scope را روشن می‌کند، اما attachment لزوماً spreadsheet نیست و FR-52 safeguards محتوای فعال را مشخصاً برای import/export artifactهای CSV/XLSX تعریف کرده است. برای correction-case attachment الزام صریحی دربارهٔ:

- نوع و اندازهٔ مجاز؛
- محتوای فعال، executable، script، link یا archive؛
- رفتار preview/download؛
- filename/metadata حساس؛
- quarantine/rejection و خطای امن؛
- ممنوعیت پردازش خودکار محتوای فایل

وجود ندارد. AR-DATA classification/lifecycle محرمانگی و retention را پوشش می‌دهد، ولی به‌تنهایی فایل مخرب یا active content را متوقف نمی‌کند.

**اثر:** مسیر محدود جدید برای محتوای مخرب، افشای metadata یا unsafe preview/download. با توجه به bounded scope، default-deny و approval پیشینی، شدت فعلی متوسط است، نه بالا.

**اصلاح الزام محصول:** FR-53 یا FR-52 باید تمام attachmentهای MVP را مشمول policy ایمنی فایل کند: allowlist نوع/اندازه، reject یا inert handling برای active/executable content و archive نامجاز، filename/metadata minimization، permission-safe preview/download، failure-safe handling و acceptance tests. روش تشخیص یا ابزار فنی در معماری انتخاب شود.

## نتیجهٔ gate

- **V2-H1 تا V2-H4:** بسته‌شده.
- **V2-M1:** بسته‌شده.
- **critical/high جدید:** ندارد.
- **product-requirement security/privacy gate:** پاس، با یک اصلاح متوسط.
- **architecture/feature/build gate:** تا تصویب artifactهای `pending` مربوط پاس نشده است.
