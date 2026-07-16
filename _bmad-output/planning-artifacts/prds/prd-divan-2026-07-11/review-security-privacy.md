# بازبینی امنیت، حریم خصوصی و حاکمیت داده — Divan HRIS

**اسناد بررسی‌شده:** `prd.md` و `addendum.md`، نسخهٔ 2026-07-11  
**نوع بررسی:** بازبینی الزامات محصول؛ مستقل از انتخاب پشته، معماری یا سازوکار فنی  
**حکم:** **برای تثبیت معماری و شکستن کار به storyهای امنیتی آماده نیست.** اسناد پایه‌های خوبی مانند default-deny، کنترل هم‌زمانِ دستهٔ داده/عمل/دامنه، مجوز مستقل export، provenance مهاجرت، بازسازی قطعی، و منع دسترسی عادی System Admin دارند؛ اما دو مرز بنیادی—حاکمیت اعطای امتیاز و معنای دامنه در زمان/گزارش—هنوز قرارداد محصولِ آزمون‌پذیر ندارند. چند کنترل مهم دیگر نیز صرفاً به «تصویب سیاست قبل از go-live» واگذار شده‌اند؛ چنین تصویبی به‌تنهایی مانع طراحی یا استقرار ناامن نمی‌شود.

## خلاصهٔ شدت

- **بحرانی:** 2
- **بالا:** 8
- **متوسط:** 4
- **پایین:** 0
- **مجموع:** 14

## نقاط قوت قابل اتکا

- `prd.md` §5.1، FR-2 و FR-3: مجوزدهی backend، default-deny، تفکیک دستهٔ حساس و export، و منع ضمنی‌بودن دسترسی از روی عنوان نقش.
- `prd.md` §5.8، FR-33: تصریح به حفاظت از search، facet، count، suggestion و column.
- `prd.md` §5.4، FR-18 و §9، NFR-3: آشکارسازی شکست/کهنگی دادهٔ مشتق‌شده.
- `prd.md` §5.9، FR-38 تا FR-40: atomicity، provenance و reconciliation مهاجرت.
- `prd.md` §5.10، FR-42: الزام audit برای رخدادهای تجاری و امنیتی و تفکیک مجوز مشاهدهٔ audit.
- `prd.md` §8.1، LG-2 و LG-3: منع go-live با یافتهٔ امنیتی بحرانی/بالا و الزام تصویب مصنوعات حاکمیتی.

این نقاط قوت لازم‌اند، اما یافته‌های زیر نشان می‌دهند هنوز کافی نیستند.

## یافته‌های بحرانی

### C-1 — اعطای امتیاز و break-glass می‌تواند به خودارتقایی یا دسترسی نامحدود منجر شود

**ارجاع دقیق:** `prd.md` §5.1 FR-3 (به‌ویژه consequence دوم)، FR-4؛ §10 بند «Privileged access… to the degree approved»؛ §14 پرسش‌های 1 و 7. `addendum.md` §7، به‌ویژه break-glass/local emergency account، و §12.4.

**مسئله:** FR-4 فقط می‌گوید مدیران مجاز نقش، permission، scope، account link و active status را مدیریت می‌کنند. سند منع نمی‌کند که permission administrator:

- برای خود یا همدست خود نقش/دامنهٔ قوی‌تر بسازد یا اعطا کند؛
- هم‌زمان HR Admin، permission admin، export، audit viewer و break-glass را در اختیار داشته باشد؛
- scope سراسری، grant دائمی یا نقش مرکبِ بیش‌ازحد وسیع ایجاد کند؛
- grant، تمدید، لغو یا بازبینی entitlement خود را تأیید کند؛
- از break-glass برای export، تغییر permission، خاموش‌کردن کنترل یا دسترسی تکرارشونده استفاده کند.

عبارت «to the degree approved» در §10 حتی تفکیک وظایف را به یک تصمیم اختیاری تبدیل می‌کند. time-bound/reasoned/audited بودن به‌تنهایی جلوی سوءاستفاده را نمی‌گیرد؛ این کنترل پسینی است.

**اثر:** تصاحب یا سوءاستفاده از یک حساب مدیریتی می‌تواند تمام مرزهای field، action و Organizational Scope را خنثی کند، بدون آن‌که الزام محصولی برای جلوگیری از self-approval یا toxic combination وجود داشته باشد.

**اصلاح الزام محصول:**

1. FR مستقلی برای چرخهٔ entitlement اضافه شود: درخواست، تأیید، اعمال، تاریخ شروع/انقضا، لغو فوری، recertification، و evidence.
2. self-request/self-approval/self-recertification و اعطای دسترسی فراتر از دامنهٔ خودِ grantor صریحاً ممنوع شود.
3. ترکیب‌های ناسازگار حداقلی تعریف شوند: permission administration با تأیید همان grant؛ HR-content administration با audit review همان فعالیت؛ break-glass با تأیید/بازبینی همان رخداد.
4. ایجاد/تغییر role و scope، assignment انبوه، grant سراسری و grant حساس نیازمند تأیید مستقل و قابل انتساب باشد.
5. break-glass فقط برای رخداد اعلام‌شده، حداقل دامنه و عمل، مدت کوتاه، تأیید مستقل، لغو خودکار، و بازبینی پس از استفاده با SLA مشخص مجاز باشد؛ export و permission administration در آن به‌طور پیش‌فرض ممنوع و هر استثنا جداگانه تصویب شود.
6. acceptance ثابت کند هیچ مسیر UI/API/import/configuration نمی‌تواند این قواعد را دور بزند.

### C-2 — معنای Organizational Scope در گزارش تاریخی، انتقال افراد و دادهٔ مشتق‌شده تعریف نشده است

**ارجاع دقیق:** `prd.md` §4 تعریف Organizational Scope؛ §5.1 FR-2؛ §5.4 FR-18؛ §5.6 FR-25 تا FR-27؛ §5.8 FR-33 تا FR-36؛ §9 NFR-3؛ §8.3 SM-C5. `addendum.md` §4.3، §8.3 تا §8.5، §9 و §12.4.

**مسئله:** سند می‌گوید هر نتیجه permission-safe است، اما تعیین نمی‌کند authorization برای دادهٔ historical/as-of با کدام دامنه سنجیده می‌شود:

- دامنهٔ فعلی کاربر؛
- رابطهٔ مدیریتی کاربر در تاریخ گزارش؛
- دامنهٔ فعلی Person؛
- دامنهٔ Person در تاریخ مورد پرسش؛
- یا اشتراک چند مورد.

در انتقال بین Team/Department/Legal Entity، این ابهام می‌تواند به مدیر فعلی اجازه دهد سابقهٔ خارج از مرز قبلی را ببیند، یا به مدیر قبلی اجازه دهد دادهٔ بعد از خروج را ببیند. همچنین FR-18/NFR-3 فقط کهنگی را آشکار می‌کنند؛ الزام نمی‌کنند projection یا cache که scope/role/person membership آن stale است برای تصمیم authorization استفاده نشود. گزارش‌های چندبعدی و detail drill-down نیز قاعدهٔ صریح برای اشتراک scopeهای Person، Assignment، Event، Headcount و Import Batch ندارند.

**اثر:** خواندن مستقیم یا تجمیعیِ دادهٔ خارج از مرز سازمانی، به‌ویژه پس از transfer، correction، retroactive event یا تأخیر recalculation.

**اصلاح الزام محصول:**

1. یک «policy زمانیِ authorization» به PRD افزوده شود که برای profile، timeline، search، count، dashboard، report، export و audit تعیین کند دسترسی historical بر اساس کدام subject/object/scope و کدام زمان ارزیابی می‌شود.
2. برای هر گزارش چنددامنه‌ای، نتیجه فقط از اشتراک مجازِ همهٔ رکوردهای پایه و dimensions ساخته شود؛ drill-down نیز دقیقاً همان population مجاز را حفظ کند.
3. تغییر role/scope/account/person membership باید روی همهٔ مسیرهای خواندن و artifactهای در دسترس اثر فوری و قابل آزمون داشته باشد.
4. اگر دادهٔ لازم برای تصمیم authorization stale، failed یا unreconciled است، دسترسی fail-closed شود؛ صرف نمایش برچسب stale کافی نیست.
5. fixtureهای انتقال بین مرزها، correction گذشته‌نگر، مدیر قبلی/فعلی، cross-entity report، cache/projection stale و export تکرارشده به acceptance افزوده شوند.

## یافته‌های با شدت بالا

### H-1 — جلوگیری از inference از طریق count/facet/report قرارداد آزمون‌پذیر ندارد

**ارجاع دقیق:** `prd.md` §5.1 FR-2؛ §5.8 FR-33 تا FR-36؛ §8.3 SM-C4. `addendum.md` §8.5 جملهٔ «Small-group suppression … must be considered» و §12.4.

**مسئله:** ممنوعیت افشای count و facet خوب است، ولی «عدم reveal» برای گروه کوچک، zero/one result، differencing بین queryها، مقایسهٔ بازه‌ها، drill-down و ترکیب dimensions تعریف نشده است. تنها اشاره به small-group suppression در addendum غیرالزام‌آور و با فعل «considered» است. مهاجم می‌تواند با تغییر یک filter یا مقایسهٔ دو گزارش، وضعیت استخدام، termination، compensation change، religion/health/family یا عضو یک Team کوچک را استنتاج کند.

**اصلاح الزام محصول:** PRD باید نتیجهٔ مورد انتظار را الزام کند: سیاست مصوب و یکنواختِ حداقل cohort/suppression یا کنترل معادل، جلوگیری از differencing و drill-down افشاگر، رفتار امن برای zero/small cells، سازگاری بین screen/export، و آزمون queryهای متوالی و ترکیبی. عدد یا روش فنی می‌تواند تصمیم مالک باشد، ولی وجود کنترل و پوشش تمام سطوح نباید اختیاری باشد.

### H-2 — «مجوز export» مسیرهای دیگر bulk exfiltration را پوشش نمی‌دهد

**ارجاع دقیق:** `prd.md` §5.8 FR-33 تا FR-36؛ §5.9 FR-41؛ §10 بند export volume/approval و unusual-export monitoring؛ §14 پرسش 1. `addendum.md` §8.1 تا §8.4 و §12.4.

**مسئله:** کاربر بدون export permission ممکن است با pagination، reportهای وسیع، repeated filtered queries، selectable columns، API یا اسکرین‌برداری حجم بزرگی را بازیابی کند. FR-41 فقط artifact صادراتی رسمی را کنترل می‌کند. volume approval و unusual-export monitoring نیز تصمیم باز هستند و analytics مربوط به export activity در addendum §8.4 «non-launch candidate» است.

**اصلاح الزام محصول:** «bulk data access» مستقل از نام عملیات تعریف شود و مجموع list/report/search/API/export را پوشش دهد. محصول باید سقف/پنجرهٔ حجم مصوب، مجوز یا تأیید افزوده برای bulk/sensitive retrieval، rate/behavior monitoring، alert و پاسخ قابل مالکیت، محدودیت range/columns، و audit تجمعیِ queryهای مرتبط را enforce کند. thresholdها می‌توانند owner decision باشند، اما نبود threshold باید پیش از طراحی report/export مسدودکننده باشد.

### H-3 — چرخهٔ عمر directory و internal account رفتار fail-safe مشخصی ندارد

**ارجاع دقیق:** `prd.md` §5.1 FR-1 و FR-4؛ §9 NFR-7؛ §11 dependency LDAP/AD؛ §14 پرسش 7. `addendum.md` §7 و §12.2.

**مسئله:** عبارت «according to approved identity policy» نتیجهٔ امنیتی را تعیین نمی‌کند. رفتار sessionهای موجود پس از disable/delete/lock، account rename، immutable-ID change، duplicate/missing mapping، rehire، انتقال سازمانی، group-role mapping conflict، orphan internal account و directory outage باز است. «cannot silently bypass authentication» مانع ادامهٔ session فعال یا باقی‌ماندن entitlement داخلی نمی‌شود.

**اصلاح الزام محصول:** حداقل‌های غیرقابل‌مذاکره اضافه شود: یک identity پایدار به حداکثر یک internal account؛ ambiguity/duplicate/unmapped به‌صورت fail-closed؛ disable/delete/lock و لغو entitlement باعث منع دسترسی و ابطال session در زمان مصوب؛ rename بدون relink به فرد دیگر؛ orphan/dormant account غیرفعال و گزارش‌شده؛ rehire نیازمند بازاعتبارسنجی link و entitlement؛ conflict بین directory mapping و grant داخلی دارای precedence صریح؛ outage هرگز به local routine access تبدیل نشود.

### H-4 — audit در برابر مدیر ممتاز، افشای محتوای حساس و شکست ثبت، کامل تعریف نشده است

**ارجاع دقیق:** `prd.md` §5.4 FR-14؛ §5.10 FR-42؛ §9 NFR-9؛ §10؛ §14 پرسش 1. `addendum.md` §2.2، §10 و §12.2/§12.4.

**مسئله:** «tamper-resistant» و منع تغییر توسط «ordinary operational users» مدیر ممتاز، operator زیرساخت، permission admin یا reviewer را صریحاً محدود نمی‌کند. scope مشاهدهٔ audit، نمایش هویت/نام/شناسه/فیلتر حساس، redaction، جست‌وجو و export خود audit، تشخیص حذف/وقفه/تغییر clock، و رفتار سیستم هنگام failure ثبت رخداد تعیین نشده‌اند.

**اصلاح الزام محصول:** PRD باید الزام کند که هیچ actor منفردی نتواند فعالیت حساس خود را تغییر، حذف، پنهان یا تأیید کند؛ دسترسی و export audit بر اساس purpose/scope جداگانه کنترل و خودش audit شود؛ audit حداقل‌سازی و redaction مشخص برای values/filter/error داشته باشد؛ gap، integrity failure و clock anomaly قابل کشف و هشدار باشد؛ برای عملیات حساس، رفتار در صورت ناتوانی ثبت audit از پیش تعیین و fail-safe باشد؛ retention/legal hold audit با حذف دادهٔ موضوع هماهنگ شود.

### H-5 — حفاظت non-production و backup صرفاً «تصمیم قابل تصویب» است

**ارجاع دقیق:** `prd.md` §8.1 LG-3 و LG-5؛ §9 NFR-6 و NFR-8؛ §10 بند non-production؛ §14 پرسش‌های 2 و 8. `addendum.md` §6.4 و §10.

**مسئله:** PRD استفاده از production data در non-production را «مگر با approval» مجاز می‌گذارد، ولی حداقل لازم برای approval، masking، محدودیت گیرندگان، expiry، copy inventory، restore مقصد، backup operator access و audit کپی/restore را مشخص نمی‌کند. همین الگو برای backup encryption/access/retention نیز صرفاً به تصویب موکول است. سیاست ضعیف ولی «تصویب‌شده» می‌تواند gate را پاس کند.

**اصلاح الزام محصول:** استفاده از دادهٔ واقعی در non-production به‌طور پیش‌فرض ممنوع بماند و استثنا فقط با ضرورت مستند، حداقل dataset، masking متناسب با re-identification risk، دامنه/مدت/مالک، inventory و purge verification مجاز باشد. هر backup/restore/copy باید همان یا کنترل قوی‌تر از production، دسترسی جداگانه و حداقلی، مقصد مجاز، ثبت و بازبینی، retention/expiry و آزمون عدم دسترسی غیرمجاز داشته باشد. restore به محیط غیرتولیدی نیز صریحاً مشمول همین قواعد شود.

### H-6 — retention، deletion/anonymization و legal hold قابلیت محصول نیستند و با immutability تعارض حل‌نشده دارند

**ارجاع دقیق:** `prd.md` §4 Data Dictionary؛ §5.2 FR-7؛ §5.4 FR-14 تا FR-18؛ §8.1 LG-3؛ §10؛ §14 پرسش 2. `addendum.md` §3، §4.1، §6.4 و §10.

**مسئله:** ثبت retention در Data Dictionary الزام شده، اما FR عملیاتی برای اجرای retention، deletion/anonymization، hold/release، disposal evidence یا انتشار حذف به projection/report/search/export/import staging/backup وجود ندارد. Finalized event و audit «never hard-deleted» هستند، ولی نسبت این immutability با حذف قانونی، حداقل‌سازی و پایان retention مشخص نیست. همچنین `prd.md` §10 می‌گوید data owner/source برای هر field «after go-live» شناسایی شود که با FR-7 و governance پیش از enablement ناسازگار است.

**اصلاح الزام محصول:** FR چرخهٔ عمر داده اضافه شود که برای هر category و artifact، trigger، مدت، owner، action پایان مدت، legal hold و release، exception، evidence و دامنهٔ propagation را الزام کند. قرارداد باید روشن کند چه چیزی برای اثبات تاریخچه نگه داشته می‌شود، چه valueهایی حذف/ناشناس می‌شوند، و reconstruction پس از disposal چه محدودیتی دارد. owner/source باید پیش از enablement و migration قطعی باشد؛ عبارت «after go-live» اصلاح شود.

### H-7 — مهاجرت از نظر integrity قوی است، اما از نظر محرمانگی و محتوای مخرب الزام کافی ندارد

**ارجاع دقیق:** `prd.md` §5.9 FR-37 تا FR-40؛ §9 NFR-8؛ §10؛ §14 پرسش 6. `addendum.md` §6.2 تا §6.4 و §12.4.

**مسئله:** validate/preview/atomicity/reconciliation عمدتاً صحت داده را پوشش می‌دهند. الزامی برای جداسازی نقش upload/approve/execute، حداقل دسترسی به row errors، جلوگیری از افشای رکوردهای معتبر/نامعتبر به uploader، کنترل محتوای فرمولی/فعال، پاک‌سازی source/staging/preview، نسخه و اصالت فایل، یا جلوگیری از واردکردن category تأییدنشده وجود ندارد. «formula/content/file abuse» فقط test candidate در addendum غیرالزام‌آور است.

**اصلاح الزام محصول:** FR-37/38 باید تصریح کند import فقط category/field مصوب را می‌پذیرد؛ preview/error با همان field/scope policy محافظت می‌شود؛ نقش‌های upload، approval و production execution برای batch حساس طبق ماتریس مصوب تفکیک می‌شوند؛ محتوای فعال/فرمولی اجرا یا به خروجی unsafe منتقل نمی‌شود؛ source/staging/error artifact چرخهٔ عمر و purge evidence دارد؛ batch با template/version/source identity و approval قابل اثبات است؛ replay/corrected re-import مجوز و reconciliation مستقل دارد.

### H-8 — چند gate امنیتی «security theater» هستند و تصمیم را بیش از حد تا go-live عقب می‌اندازند

**ارجاع دقیق:** `prd.md` §8.1 LG-2، LG-3 و LG-5؛ §9 NFR-1، NFR-6 تا NFR-10 و NFR-13؛ §10؛ §13 مرحلهٔ 1؛ §14. `addendum.md` §1 و §10.

**مسئله:** اسناد می‌گویند access matrix، break-glass، retention، non-production، audit، export volume، session، backup و scale «قبل از go-live تصویب» شوند. اما این تصمیم‌ها اندازهٔ domain، authorization context، audit envelope، deletion semantics، report/query behavior، account lifecycle، backup boundary و acceptance را شکل می‌دهند. اگر تا اواخر delivery باز بمانند، architecture و storyها یا متوقف می‌شوند یا با فرض‌های ناامن ساخته و بعداً با sign-off ظاهری توجیه می‌شوند. addendum §1 می‌گوید برخی تصمیم‌ها قبل از acceptance معماری لازم‌اند، ولی authority ندارد و زمان/شرط خروج تعیین نمی‌کند.

**اصلاح الزام محصول:** gateها به سه دستهٔ الزام‌آور تقسیم شوند:

1. **پیش از baseline معماری:** authorization/temporal scope، entitlement/break-glass invariants، data categories/retention classes، audit envelope، non-production/backup boundaries، identity lifecycle و bulk/inference policy.
2. **پیش از ساخت feature مربوط:** مقادیر و ماتریس‌های دقیق آن feature، test oracle و owner.
3. **پیش از production:** evidence اجرا، thresholds عملیاتی نهایی، restore/security acceptance و sign-off.

برای هر تصمیم deadline، owner، حداقل invariant، artifact، approver و اثر عدم تصمیم مشخص شود. sign-off نباید جای requirement/testable outcome را بگیرد.

## یافته‌های با شدت متوسط

### M-1 — free text، metadata و داده‌های مشتق‌شده ممکن است خارج از Data Dictionary بمانند

**ارجاع دقیق:** `prd.md` §4 تعریف Data Dictionary؛ §5.2 FR-7 و FR-8؛ §5.4 FR-14؛ §5.5 FR-24؛ §5.8 FR-34 تا FR-36. `addendum.md` §3.1، §3.4، §3.5، §3.7 و §8.

**مسئله:** FR-7 از «enabled fields» سخن می‌گوید، اما reason/reference/notes، row errors، source filenames/metadata، verification/data-quality flags، manager inference، correction descriptions و derived metrics صریحاً مشمول همان purpose/sensitivity/access/retention/export/audit governance نشده‌اند. کاربران ممکن است اطلاعات سلامت، خانوادگی، انضباطی یا قراردادی را در متن آزاد وارد کنند و سپس در timeline/audit/report ظاهر شود.

**اصلاح الزام محصول:** تعریف «field/data element» همهٔ stored، free-text، metadata، derived/inferred، error و filter value را پوشش دهد. متن آزاد حداقل‌سازی شود، purpose و محدودیت محتوایی داشته باشد و نمایش/audit/export آن تابع classification باشد. هر derived field/metric باید lineage، sensitivity و access مستقل داشته باشد و از حساس‌ترین ورودیِ مؤثر ضعیف‌تر طبقه‌بندی نشود مگر با ارزیابی تصویب‌شده.

### M-2 — چرخهٔ عمر و بازدریافت artifact صادراتی مشخص نیست

**ارجاع دقیق:** `prd.md` §5.9 FR-41 consequence دوم؛ §9 NFR-8؛ §10؛ §14 پرسش 1. `addendum.md` §6.4، §10 و §12.4.

**مسئله:** audit «generated-artifact handling» را ثبت می‌کند، ولی الزام محصولی برای expiry، authorization هنگام download مجدد، لغو دسترسی پس از role/scope change، فهرست artifactهای فعال، حذف، یا جلوگیری از دسترسی با link قدیمی وجود ندارد. ثبت رخداد، artifact باقی‌مانده را امن نمی‌کند.

**اصلاح الزام محصول:** هر artifact هویت، owner/requester، purpose، classification، scope/fields، ایجاد/انقضا، وضعیت، retrieval audit و disposal evidence داشته باشد؛ هر retrieval مجدداً authorization شود؛ expiry و revocation enforce شوند؛ scope/role change و incident امکان لغو artifactهای فعال را داشته باشد؛ cache/preview/failed export نیز همان چرخه را طی کند.

### M-3 — ثبت sensitive read به سیاست نامشخص واگذار شده و baseline حداقلی ندارد

**ارجاع دقیق:** `prd.md` §5.10 FR-42 عبارت «sensitive reads required by policy»؛ §10؛ §14 پرسش 1. `addendum.md` §10 و §12.4.

**مسئله:** ممکن است سیاست فقط export را ثبت کند و مشاهدهٔ تکراری profile، timeline، compensation یا national ID بدون evidence بماند. در عین حال ثبت همهٔ values خود audit را به مخزن حساس تبدیل می‌کند.

**اصلاح الزام محصول:** baseline حداقلی تعریف شود: دسترسی موفق/ناموفق به categoryهای بسیار حساس، bulk retrieval، reveal/unmask، historical access، audit access و privileged read باید با actor، purpose/context، scope، volume و outcome ثبت شود، بدون کپی غیرضروری value. cadence و trigger بازبینی، alert و مسئول رسیدگی نیز requirement باشد.

### M-4 — فرایند حقوق داده‌موضوع فقط بیرونی اعلام شده و قابلیت اثبات/انتشار correction ندارد

**ارجاع دقیق:** `prd.md` §2 actor «Employee as data subject»؛ §6 non-goal employee-facing correction؛ §8.1 LG-3؛ §10 و §14 پرسش 2.

**مسئله:** نداشتن self-service قابل قبول است، اما فقط گفتن «external transparency and correction-request process» تضمین نمی‌کند درخواست به Person درست متصل، مجاز، در مهلت رسیدگی، قابل ردگیری و در current/history/derived/report/export اصلاح شود. همچنین نتیجهٔ درخواست ممکن است با immutability یا retention تعارض پیدا کند.

**اصلاح الزام محصول:** بدون افزودن ESS، requirementی برای ثبت مرجع درخواست خارجی، احراز و authority، owner/status/deadline، تصمیم و دلیل، linkage به Correction/retention action، propagation/recalculation، پاسخ/closure evidence و محدودکردن دسترسی به محتوای درخواست اضافه شود.

## پوشش تهدیدهای درخواستی

- **خواندن غیرمجاز:** پایهٔ مناسب در FR-2؛ نقص بحرانی در C-2 و نقص entitlement در C-1.
- **استنتاج از search/count/report:** صریحاً ذکر شده، اما کنترل عملی ناقص؛ H-1.
- **اعطای نقش بیش‌ازحد:** C-1.
- **خروج انبوه داده:** H-2 و چرخهٔ artifact در M-2.
- **نشت/دستکاری audit:** H-4 و M-3.
- **سوءاستفاده از break-glass:** C-1.
- **شکست چرخهٔ directory/account:** H-3.
- **افشای non-production و backup:** H-5.
- **ابهام retention:** H-6.
- **مهاجرت ناامن:** H-7.
- **دادهٔ مشتق‌شدهٔ stale:** C-2.
- **گزارش cross-boundary:** C-2 و H-1.
- **فیلدهای حساسِ بدون حاکمیت:** M-1.
- **security theater / gateهای دیرهنگام:** H-8.

## تغییرات محصولی لازم پیش از baseline معماری

1. بستن C-1 با قرارداد entitlement و break-glass قابل آزمون.
2. بستن C-2 با semantics زمانی و چنددامنه‌ای authorization و fail-closed برای state امنیتی stale.
3. ارتقای inference/bulk-access از «policy to approve» به outcomeهای اجباری محصول.
4. افزودن FRهای lifecycle برای directory account، retention/legal hold، export artifact و non-production/backup copy.
5. تعریف audit trust boundary، minimization، integrity/failure behavior و review ownership.
6. تبدیل gateهای امنیتی از sign-off پیش از go-live به decision gates مرحله‌بندی‌شده با حداقل invariant و test oracle.

تا بسته‌شدن دو مورد بحرانی، شکستن authorization/reporting/audit به story احتمالاً فرض‌های متناقض یا ناامن را تثبیت می‌کند. موارد شدت بالا باید پیش از baseline feature مربوط بسته شوند؛ صرف ثبت آن‌ها به‌عنوان تصمیم go-live کافی نیست.
