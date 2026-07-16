# بازبینی مجدد امنیت، حریم خصوصی و حاکمیت داده — Divan HRIS

**اسناد بررسی‌شده:** نسخهٔ به‌روزشدهٔ `prd.md` و `addendum.md` در 2026-07-11  
**مبنای تطبیق:** یافته‌های C-1، C-2، H-1 تا H-8 و M-1 تا M-4 در `review-security-privacy.md`  
**نوع بررسی:** الزامات محصول؛ مستقل از انتخاب پشته و سازوکار فنی

## حکم

**اصلاحات عمده و واقعی‌اند، نه صرفاً تغییر نام gateها؛ اما سند هنوز برای تصویب کامل baselineهای identity/authorization/temporal/reporting/recovery آماده نیست.**

FR-46 تا FR-56 بیشتر اصلاحات پیشنهادی را به invariantهای الزام‌آور و آزمون‌پذیر تبدیل کرده‌اند. §8.1 و §8.2 نیز owner، approver، زمان تحویل، blocking effect و test oracle را مرحله‌بندی کرده‌اند و تصریح می‌کنند امضای production نمی‌تواند gate بالادستیِ ازدست‌رفته را جبران کند. بنابراین C-1 و H-1، H-2، H-4، H-5، H-7، H-8 و هر چهار یافتهٔ متوسط قبلی از نظر قرارداد محصول materially resolved هستند.

بااین‌حال، چهار شکاف با شدت بالا باقی مانده است: semantics حداقلیِ دسترسی مدیریتی تاریخی هنوز می‌تواند با سیاستی بیش‌ازحد باز تصویب شود؛ «لغو فوری» با bound نامحدود و cardinality نامتقارن identity/account تضعیف شده؛ restore می‌تواند داده/مجوز منقضی یا حذف‌شده را زنده کند؛ و FR-15 هنوز تغییرات بسیار حساس را بدون تأیید مستقل پیشینی authoritative می‌کند.

## شمارش شدت

- **بحرانی:** 0
- **بالا:** 4
- **متوسط:** 1
- **پایین:** 2
- **مجموع یافته‌های باز:** 7

## وضعیت یافته‌های قبلی

### C-1 — حل‌شده

**شواهد:** `prd.md` §5.11 FR-46، FR-51 و FR-55؛ §8.1 AR-ACCESS/AR-AUDIT؛ §8.2؛ §10 بند privileged access؛ `addendum.md` §10.1 و §12.3/§12.4.

FR-46 چرخهٔ کامل entitlement، منع self-approval/self-recertification/self-waiver، حد delegation، toxic combinations در تمام مسیرها، approval مستقل برای grant حساس/global/bulk/mass، expiry و break-glass محدود را الزام می‌کند. FR-51 استقلال audit را از همان actors تثبیت می‌کند و FR-55 waiver را از دورزدن default-deny، audit independence، integrity و gateهای بالادستی منع می‌کند. این اصلاح ماهوی است.

**باقیماندهٔ مرتبط:** ناسازگاری «immediate revocation» با bound نامحدود در V2-H2 جداگانه ثبت شده است.

### C-2 — تا حد زیادی حل‌شده، اما یک شکاف بالا باقی است

**شواهد اصلاح:** `prd.md` §5.10 FR-45؛ §5.11 FR-47؛ §8.1 AR-ACCESS/AR-TEMPORAL/AR-REPORTING؛ §8.2؛ `addendum.md` §12.3.

تقاطع همهٔ populationهای زیربنایی، حفظ همان population در drill-down، fail-closed برای input امنیتی stale/ambiguous، و revocation برای session/queue/cache/link/artifact اکنون requirement صریح‌اند. fixtureهای former/current manager، retroactive membership و cross-boundary نیز ذکر شده‌اند.

**باقیمانده:** V2-H1.

### H-1 — حل‌شده

**شواهد:** `prd.md` FR-48؛ §8.1 AR-ACCESS و AR-REPORTING؛ §8.2؛ `addendum.md` §8.5 و §12.3.

small cohort، zero/small cell، differencing، repeated query، comparison و drill-down در screen/export الزام شده‌اند؛ threshold و acceptance sequence پیش از baseline feature لازم‌اند. این دیگر «صرفاً در نظر گرفته شود» نیست.

### H-2 — حل‌شده

**شواهد:** `prd.md` FR-48 و FR-52؛ FR-56؛ §8.1 AR-ACCESS/AR-REPORTING؛ `addendum.md` §6.5 و §12.4.

همهٔ UI/API/search/list/count/dashboard/report/export به‌عنوان مسیرهای مشترک retrieval دیده می‌شوند و cumulative volume/window/range/field controls، approval اضافی، audit/alert/response، snapshot و reauthorization الزام شده‌اند.

**باقیماندهٔ محدود:** custody نسخهٔ دانلودشده در V2-M1.

### H-3 — تا حد زیادی حل‌شده، اما یک شکاف بالا باقی است

**شواهد اصلاح:** `prd.md` FR-49؛ FR-46/FR-47؛ §8.1 AR-IDENTITY؛ NFR-7؛ `addendum.md` §7 و §12.3.

duplicate/ambiguous/unmapped/conflicting link، rename، disable/delete/lock، orphan/dormant account، rehire و outage اکنون رفتار fail-safe دارند.

**باقیمانده:** cardinality معکوس account/identity و bound لغو در V2-H2.

### H-4 — حل‌شده

**شواهد:** `prd.md` FR-42 و FR-51؛ FR-50؛ §8.1 AR-AUDIT؛ NFR-9؛ `addendum.md` §10 و §12.3.

trust boundary، منع concealment یک‌جانبه توسط هر actor، کنترل و audit دسترسی به audit، fail-safe هنگام شکست ثبت، تشخیص gap/clock/integrity، حداقل baseline reads و منع value duplication اکنون صریح و آزمون‌پذیرند.

### H-5 — حل‌شده

**شواهد:** `prd.md` NFR-6 و NFR-8؛ §10؛ AR-DATA/AR-NFR؛ `addendum.md` §6.4 و §12.3.

production data در non-production به‌طور پیش‌فرض ممنوع است؛ approval به‌تنهایی کافی نیست. ضرورت، حداقل dataset، masking متناسب، re-identification assessment، scope/time، inventory و purge evidence الزام شده و restore نیز همان قواعد را دارد. copy/backup باید کنترل معادل یا قوی‌تر از production داشته باشد.

**باقیماندهٔ recovery-state:** V2-H3.

### H-6 — تا حد زیادی حل‌شده، اما recovery gap باقی است

**شواهد اصلاح:** `prd.md` FR-50؛ FR-7؛ §8.1 AR-DATA؛ NFR-6/NFR-8؛ §10؛ `addendum.md` §2.2 و §6.4.

retention/disposal/hold اکنون قابلیت محصول برای همهٔ Data Elementها و artifactهاست؛ propagation، failure evidence، reconstruction limitation و تعارض immutability/minimization نیز پوشش داده شده‌اند. owner/source قبل از enablement/migration الزامی است.

**باقیمانده:** پس از restore، الزام صریح برای بازاعمال disposal/revocation وجود ندارد؛ V2-H3.

### H-7 — حل‌شده

**شواهد:** `prd.md` FR-37/FR-38/FR-52/FR-56؛ §8.1 AR-MIGRATION؛ `addendum.md` §6.2 و §6.5.

field/template مصوب، source identity/version، محتوای فعال و formula/link، permission-filtered preview/error، revalidation، batch conflict، تفکیک upload/approval/execution و lifecycle تمام artifactها اکنون requirement هستند.

### H-8 — حل‌شده

**شواهد:** `prd.md` §8.1 Canonical Launch Artifact Register؛ §8.2 Authoritative Decision Stages؛ §13 مراحل 1 و 2؛ FR-55؛ `addendum.md` §1.

تصمیم‌ها به پیش از architecture baseline، پیش از feature/story baseline/build، و پیش از production تقسیم شده‌اند. owner، approver، timing، affected requirements و blocking effect ثبت شده‌اند و استفاده از فرض محلی یا درمان gate ازدست‌رفته با امضای production ممنوع است. این ساختار security theater قبلی را materially برطرف می‌کند.

### M-1 — حل‌شده

**شواهد:** `prd.md` §4 تعریف Data Element و Data Dictionary؛ FR-7؛ §10.

stored، free text، metadata، inferred/derived، error، filter و artifact value صریحاً داخل Data Dictionary آمده‌اند؛ lineage و حداقل sensitivity برای مشتقات نیز requirement است.

### M-2 — حل‌شده برای artifact مدیریت‌شده

**شواهد:** `prd.md` FR-52؛ FR-47؛ NFR-8؛ `addendum.md` §6.5.

هویت، purpose، classification، scope، expiry، retrieval، revocation، disposal، reauthorization و stale-link denial الزام شده‌اند.

**باقیماندهٔ محدود:** نسخهٔ خارج‌شده از کنترل محصول در V2-M1.

### M-3 — حل‌شده

**شواهد:** `prd.md` FR-51 consequence سوم؛ AR-AUDIT؛ `addendum.md` §12.3.

baseline حداقلی برای highly-sensitive probe، reveal/unmask، bulk، historical، audit access، privileged read، entitlement و break-glass با context/scope/volume/outcome و بدون value duplication تعریف شده است.

### M-4 — حل‌شده

**شواهد:** `prd.md` FR-53؛ FR-50؛ §8.1 AR-DATA؛ `addendum.md` §12.3.

request authority، Person linkage، owner/status/deadline، decision، restricted evidence، correction/disposal/propagation، affected artifacts و closure evidence الزام شده‌اند، بدون افزودن self-service.

## یافته‌های باز با شدت بالا

### V2-H1 — policy زمانی هنوز می‌تواند دسترسی مدیریتی تاریخیِ بیش‌ازحد باز را «مجاز» کند

**ارجاع دقیق:** `prd.md` §4 تعریف Organizational Scope؛ §5.3 FR-13؛ §5.11 FR-47؛ §8.1 AR-ACCESS و AR-REPORTING؛ §14 موارد 1، 6 و 10؛ `addendum.md` §8.5 و §12.3.

**مسئله:** FR-47 الزام می‌کند «relevant current/as-of time semantics» طبق AR-ACCESS ارزیابی شود و intersection فقط population «permitted» را شامل شود؛ اما حداقل مرز امن را تعیین نمی‌کند. یک AR-ACCESS تصویب‌شده همچنان می‌تواند بگوید:

- مدیر فعلی تمام سابقهٔ فرد پیش از ورود به حوزهٔ او را می‌بیند؛
- مدیر سابق داده‌های بعد از خروج فرد را می‌بیند؛
- یک senior-manager به‌واسطهٔ نقش سازمانی، بدون grant تاریخی جداگانه، همهٔ گذشته را می‌بیند.

چنین سیاستی از نظر صوری با FR-47 سازگار است، چون «permitted» را خود artifact تعریف می‌کند. fail-closed فقط ambiguity را می‌بندد، نه policy صریح ولی over-broad را.

**اثر:** افشای compensation، termination، family/health یا event history بین Team/Department/Legal Entity پس از transfer/reorganization؛ C-2 از بحرانی به بالا کاهش یافته ولی کاملاً بسته نشده است.

**اصلاح الزام محصول:** یک invariant در FR-47 اضافه شود: management-derived scope به‌طور پیش‌فرض فقط facts و بازه‌هایی را مجاز می‌کند که رابطهٔ مدیریتی/سازمانیِ مجاز آن‌ها را پوشش می‌دهد. دسترسی مدیر فعلی به pre-scope history یا مدیر سابق به post-scope history باید grant جداگانه، purpose/category صریح، حداقل بازه و audit داشته باشد؛ AR-ACCESS می‌تواند این پیش‌فرض را محدودتر کند ولی نباید ضمنی گسترش دهد.

### V2-H2 — چرخهٔ identity/revocation دو loophole دارد: many-to-one account و bound نامحدود

**ارجاع دقیق:** `prd.md` FR-1؛ FR-46 consequence دوم؛ FR-47 consequence سوم؛ FR-49؛ §8.1 AR-ACCESS/AR-IDENTITY؛ NFR-7؛ `addendum.md` §7.

**مسئله 1 — cardinality:** FR-49 می‌گوید هر external identity حداکثر به یک internal account وصل شود؛ این قاعده مانع اتصال چند external identity متعلق به افراد متفاوت به یک internal account نمی‌شود. «rename cannot silently relink … to another Person» نیز فقط rename را پوشش می‌دهد. shared/many-to-one account می‌تواند attribution، recertification و revocation را مبهم کند.

**مسئله 2 — revocation:** متن اصلی FR-46 «immediate revocation» می‌گوید، اما consequences در FR-46/FR-47/FR-49 اجرای واقعی را «within the AR-ACCESS/AR-IDENTITY bound» می‌گذارند، بدون هیچ سقف محصولی یا الزام «پیش از protected action بعدی». یک bound طولانیِ تصویب‌شده می‌تواند disable یا لغو role را ساعت‌ها بی‌اثر نگه دارد و در عین حال requirement را پاس کند.

**اثر:** استفادهٔ شخص دوم از entitlement حساب مشترک؛ ادامهٔ session/queued operation/artifact retrieval پس از leaver، lock یا لغو دسترسی.

**اصلاح الزام محصول:**

1. هر internal account فقط به یک انسان و یک active stable external identity یا مجموعه aliasهای اثبات‌شدهٔ همان انسان مرتبط باشد؛ shared human accounts ممنوع و merge/split/relink نیازمند workflow مستقل، evidence و audit باشد.
2. revocation باید قبل از protected action بعدی enforce شود و یک حداکثر objective الزام‌آور داشته باشد؛ مقدار عددی در AR تعیین شود، اما PRD اجازهٔ bound نامحدود یا صرفاً batch-based را ندهد.
3. queued work و artifact retrieval بعد از revocation باید مجدداً authorization شوند، حتی اگر پیش از revocation ایجاد شده‌اند.

### V2-H3 — restore می‌تواند دادهٔ حذف‌شده، grant لغوشده یا artifact منقضی را دوباره فعال کند

**ارجاع دقیق:** `prd.md` FR-46/FR-47/FR-49/FR-50/FR-52؛ §8.1 AR-DATA/AR-IDENTITY/AR-CUTOVER؛ NFR-6؛ NFR-8؛ `addendum.md` §6.4، §10 و §12.3/§12.5.

**مسئله:** الزامات می‌گویند deletion/anonymization به backup تحت recovery-aware policy منتشر شود و restore کنترل معادل production داشته باشد؛ اما requirement صریحی وجود ندارد که پیش از بازکردن سرویسِ restore‌شده:

- disposal/hold releaseهای بعد از زمان backup دوباره اعمال شوند؛
- leaver/disable/role revocationهای بعدی دوباره اعمال شوند؛
- export/artifact expiry و stale links دوباره باطل شوند؛
- correction/retroactive event و policy versionهای بعدی reconcile شوند؛
- restored sessions/emergency accounts/queued work غیرقابل استفاده بمانند.

backup قدیمی ذاتاً state قدیمی دارد. «equivalent controls» و witnessed restore، بدون security/lifecycle catch-up oracle، مانع resurrection نیست.

**اثر:** بازگشت PII که retention آن پایان یافته، بازفعال‌شدن حساب یا entitlement لغوشده، بازیابی artifact منقضی، و تصمیم‌گیری روی state قدیمی پس از disaster recovery.

**اصلاح الزام محصول:** NFR-6 یا FR مستقلی الزام کند restored state تا تکمیل و امضای security/lifecycle catch-up در دسترس کاربر قرار نگیرد. acceptance باید disposal/hold، identity/entitlement revocation، artifact expiry/revocation، policy version، correction/event delta و derived-state reconciliation از نقطهٔ backup تا recovery point را اعمال و اثبات کند؛ sessionها، queued work و emergency grants بازیابی‌شده به‌طور پیش‌فرض نامعتبر باشند.

### V2-H4 — FR-15 هنوز تغییرات بسیار حساس را با کنترل صرفاً پسینی authoritative می‌کند

**ارجاع دقیق:** `prd.md` §5.4 FR-15، به‌ویژه عبارت «without mandatory secondary approval» و consequence مربوط به independent post-review؛ FR-20 تا FR-24؛ FR-38؛ FR-52؛ §8.1 AR-ACCESS/AR-AUDIT/AR-MIGRATION.

**مسئله:** FR-15 صریحاً اجازه می‌دهد HR Admin یا HR Operator دارای permission، Draft معتبر را بدون secondary approval نهایی کند. برای termination، compensation، retroactive change، Override و production bulk import فقط «time-bound independent post-review and escalation» الزام شده است. post-review ممکن است پس از آن رخ دهد که:

- گزارش یا export رسمی تولید شده؛
- دسترسی فرد در اثر termination تغییر کرده؛
- compensation یا history برای تصمیم مدیریتی استفاده شده؛
- batch صدها رکورد را authoritative کرده است.

این با جهت‌گیری جدید FR-46/FR-51/FR-52 برای approval مستقلِ grant و sensitive batch ناسازگار است: upload/approval/execution برای batch حساس جداست، اما sensitive event تک‌نفره می‌تواند بلافاصله authoritative شود.

**اثر:** تقلب داخلی، sabotage یا خطای پراثر توسط یک حساب HR مجاز؛ audit و post-review آسیب را کشف می‌کنند ولی پیشگیری نمی‌کنند.

**اصلاح الزام محصول:** FR-15 باید risk-tier داشته باشد. حداقل termination حساس، compensation، retroactive change خارج از بازهٔ مصوب، headcount Override پراثر و production bulk import باید پیش از authoritative/effective شدن تأیید مستقل داشته باشند یا طبق policy مصوب تا review در وضعیت غیرموثر بمانند. سناریوها و thresholdها در AR-ACCESS/AR-AUDIT/AR-MIGRATION تعیین شوند، ولی PRD نباید همهٔ secondary approval پیشینی را مطلقاً حذف کند.

## یافتهٔ باز با شدت متوسط

### V2-M1 — custody نسخهٔ دانلودشده پس از خروج از artifact مدیریت‌شده روشن نیست

**ارجاع دقیق:** `prd.md` FR-41، FR-48 و FR-52؛ NFR-8؛ SM-C2؛ `addendum.md` §6.5.

**مسئله:** reauthorization، stale-link denial، expiry و disposal برای artifact تحت کنترل Divan روشن‌اند. پس از download، ممکن است یک local/email/share copy ایجاد شود که product دیگر نمی‌تواند آن را revoke یا purge کند. addendum از «controlled delivery and disposal» سخن می‌گوید، اما PRD الزام نمی‌کند export هنگام تحویل classification، recipient/purpose، handling obligation و custody transfer قابل اثبات داشته باشد یا کاربر بداند expiry سامانه فایل محلی را حذف نمی‌کند.

**اصلاح الزام محصول:** FR-52 باید boundary مسئولیت را صریح کند: retrieval evidence شامل recipient/destination class و انتقال custody باشد؛ artifact دارای classification/handling/expiry notice قابل مشاهده باشد؛ bulk/sensitive export نیازمند acknowledgement مسئولیت و فرایند سازمانیِ disposal/incident باشد؛ metrics بین managed artifact و downloaded copy تمایز بگذارند. محصول نباید ادعای revoke/delete فایل خارج از کنترل خود کند.

## یافته‌های پایین

### V2-L1 — مقدمهٔ PRD هنوز همهٔ تصمیم‌های باز را «launch gates» می‌نامد

**ارجاع دقیق:** `prd.md` §0 جملهٔ پایانی در برابر §8.1 و §8.2.

§0 می‌گوید open decisions «explicit launch gates» هستند، درحالی‌که مدل جدید بسیاری را پیش از architecture یا feature baseline مسدود می‌کند. متن authoritative جدید روشن‌تر است، اما عبارت قدیمی ممکن است در خلاصه‌خوانی دوباره H-8 را القا کند.

**اصلاح:** عبارت §0 به «staged decision gates under §8.1–§8.2» تغییر کند.

### V2-L2 — addendum زمان برخی NFRها را دوباره «launch blocker» می‌نامد

**ارجاع دقیق:** `addendum.md` §10، جملهٔ پایانی؛ در برابر `prd.md` §8.1 AR-NFR، §8.2 و NFR-2 تا NFR-14.

addendum می‌گوید exact availability/RPO/RTO/support/retention/scale/performance values «launch blockers» هستند. PRD authoritative تصریح می‌کند هر مقدار design-changing باید قبل از architecture/delivery baseline بسته شود. precedence مانع ضعف حقوقی requirement می‌شود، اما wording برای تیم delivery گمراه‌کننده است.

**اصلاح:** جملهٔ addendum به staged timing در PRD ارجاع دهد و «launch blockers» را با «blocking at the applicable §8.2 stage» جایگزین کند.

## نتیجهٔ آمادگی

- **قابل قبول برای ادامهٔ کار روی domainهای غیرمتأثر:** بله، مشروط به رعایت register.
- **قابل قبول برای baseline کامل authorization/reporting:** خیر، تا بسته‌شدن V2-H1 و V2-H2.
- **قابل قبول برای baseline recovery/retention:** خیر، تا بسته‌شدن V2-H3.
- **قابل قبول برای baseline sensitive-event workflow/import:** خیر، تا تعیین تکلیف V2-H4.
- **مانع بحرانی کل محصول:** وجود ندارد.

اصلاحات نسخهٔ جدید فاصلهٔ قابل‌توجهی با security theater گرفته‌اند؛ نتیجه اکنون «بازنویسی اساسی موفق با چهار شکاف high محدود و قابل اصلاح» است، نه رد کلی PRD.
