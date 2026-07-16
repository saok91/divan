# تطبیق منبع `pre-prd.md` با PRD و Addendum

## ۱. مشخصات و روش

- **منبع کاربر:** `C:\Users\AtA\projects\divan\docs\pre-prd.md`
- **سند مرجع دامنه:** `prd.md`
- **سند همراه:** `addendum.md`
- **روش:** استخراج معنا و الزام، سپس مقایسه؛ متن منبع به اسناد مقصد کپی یا بازنویسی نشده است.
- **معیار پوشش:** هر جزء منبع باید یکی از این وضعیت‌ها را داشته باشد: الزام معتبر در PRD، جزئیات محفوظ در Addendum، تعویق/Non-goal صریح، یا جایگزینی عمدی همراه با دلیل.
- **شواهد تشخیص عمد:** علاوه بر خود دو سند مقصد، تصمیم‌های ثبت‌شده در `.memlog.md` فقط برای تشخیص عمد و دلیل استفاده شدند؛ آن فایل جای پوشش در PRD/Addendum را نمی‌گیرد.

## ۲. رأی نهایی

**رأی: پوشش قوی اما ناقص؛ چهار شکاف مادی باید پیش از اعلام تطبیق کامل تعیین تکلیف شوند.**

هسته محصول—HRIS رویدادمحور، Person/Employment/Assignment، وضعیت جاری و تاریخی، کنترل هدکانت، مهاجرت، دسترسی، Audit، فارسی/RTL/Jalali و استقرار داخلی—به‌خوبی حفظ شده است. مهم‌ترین تغییرات پرریسک منبع نیز عمدی و موجه اصلاح شده‌اند. بااین‌حال، فهرست دقیق داده‌های نامزد، بخشی از قرارداد داشبورد/گزارش/جست‌وجو، تعهدات Roadmap و معنای آستانه‌های کارایی یا از دست رفته‌اند یا بدون دلیل کافی تغییر کرده‌اند.

## ۳. شکاف‌های مادی

### GAP-1 — فهرست دقیق داده‌های پرونده برای Data Dictionary حفظ نشده است

**شدت: بالا — حذف تصادفی پس از یک اصلاح سیاستی موجه**

منبع فهرست مفصلی از داده‌های هویتی، تماس، سکونت، خانواده، تحصیلات، استخدام، قرارداد، بیمه، جبران خدمت و داده‌های حساس ارائه می‌کند. PRD به‌درستی حکم منبع مبنی بر «وجود همه فیلدها در مدل صرفاً چون در Excel هستند» را با Data Dictionary و اصل کمینه‌سازی داده جایگزین کرده است؛ این اصلاح عمدی و موجه است.

اما Addendum که باید فهرست نامزدها را برای تصمیم Data Dictionary حفظ کند، فقط دسته‌های کلی را نگه داشته است. نمونه‌های از‌دست‌رفته یا مبهم عبارت‌اند از نام پدر، شماره/سری/سریال شناسنامه، محل تولد و صدور، کد پستی، محل استقرار کاری، تاریخ ازدواج، جزئیات همسر و فرزندان، نسبت تماس اضطراری، رشته/گرایش/مؤسسه/تاریخ فارغ‌التحصیلی و چند ویژگی قراردادی/بیمه‌ای دقیق.

**اثر:** تیم Data Governance یا Migration نمی‌تواند ثابت کند همه ستون‌های منبع بررسی، رد، تعویق یا تصویب شده‌اند. حذف این موارد از MVP ممکن است درست باشد، ولی اکنون تصمیم‌پذیر و قابل حسابرسی نیست.

**وضعیت لازم:** فهرست کامل نامزدها باید در Addendum یا Data Dictionary ارجاع‌شده حفظ و برای هر مورد disposition ثبت شود؛ فعال‌سازی همچنان باید تابع تصویب باشد.

### GAP-2 — تعهدات و ترتیب Roadmap پس از MVP حذف شده‌اند

**شدت: بالا — حذف تصادفی**

منبع سه گام پس از MVP را با ترتیب روشن بیان می‌کند: گردش ارتقا، چارت سازمانی تعاملی، سپس فرآیندساز HR؛ همچنین چند قابلیت احتمالی دیگر و اقلام Could Have را نام می‌برد. PRD فقط این قابلیت‌ها را Non-goal فعلی می‌کند و Addendum فقط ترتیب تحویل MVP را دارد.

اقلامی مانند داشبورد شخصی‌سازی‌شونده، خروجی تصویر/PDF، مقایسه بازه‌ها، نمایش ساده سلسله‌مراتب، اعلان داخلی و ترتیب اولویت قابلیت‌های پس از MVP نه حفظ شده‌اند، نه صریحاً کنار گذاشته شده‌اند و نه با دلیل supersede شده‌اند.

**اثر:** Non-goal بودن در MVP معادل لغو تعهد Roadmap نیست. ذی‌نفع پایین‌دستی ممکن است تصور کند اولویت‌های پس از MVP پس گرفته شده‌اند، درحالی‌که چنین تصمیمی ثبت نشده است.

**وضعیت لازم:** این موارد باید به‌عنوان «جهت‌گیری/فرضیه Roadmap غیرمتعهد» حفظ شوند یا لغو/بازاولویت‌بندی آن‌ها صریحاً توسط مالک محصول ثبت شود.

### GAP-3 — قرارداد داشبورد، گزارش و جست‌وجو به «کاتالوگ بعداً مصوب» تضعیف شده است

**شدت: بالا — تغییر مادی بدون دلیل ثبت‌شده**

منبع برای MVP رفتارهای مشخصی مطالبه می‌کند: روند تعداد کارکنان با بازه و دانه‌بندی زمانی، وضعیت اعضا و ظرفیت تیم‌ها، جذب در برابر خاتمه، هدکانت باز و نزدیک انقضا، فیلتر هماهنگ سازمانی/زمانی، مجموعه مشخص گزارش‌ها، و فهرست دقیق فیلدهای جست‌وجو و فیلتر.

PRD هسته داشبورد را عمدتاً به شمارنده‌های جاری محدود می‌کند و بقیه را به «کاتالوگ گزارش مورد تأیید» واگذار می‌کند. Addendum بسیاری از گزارش‌ها را صرفاً candidate می‌نامد و مواردی مانند نمودار روند نیروی فعال، دانه‌بندی روزانه/ماهانه، نمایش نزدیک‌به‌انقضا و بخشی از فهرست دقیق جست‌وجو/فیلتر را کامل حفظ نمی‌کند.

**اثر:** قابلیت‌هایی که در منبع MVP بودند می‌توانند بدون تصمیم تعویق از پذیرش حذف شوند. همچنین «داشبورد ساده» ممکن است به محصولی بسیار محدودتر از رفتار پذیرفته‌شده منبع تبدیل شود.

**وضعیت لازم:** برای هر Dashboard/Report/Search behavior منبع، یکی از سه حالت ثبت شود: launch-core، deferred، یا rejected with reason. کاتالوگ نامزد باید کامل بماند حتی اگر دامنه نهایی کوچک‌تر شود.

### GAP-4 — اهداف کارایی ترجیحی به آستانه اجباری p95 تبدیل شده‌اند

**شدت: بالا — سخت‌سازی بدون تأیید یا دلیل**

منبع بارگذاری معمول کمتر از ۲ ثانیه، جست‌وجو کمتر از ۳ ثانیه و داشبورد کمتر از ۵ ثانیه را «ترجیحاً» بیان می‌کند و تصریح می‌کند مقادیر نهایی پس از شناخت زیرساخت تثبیت شوند. PRD همان اعداد را به MUST و p95 تبدیل کرده است؛ هرچند تعریف پروفایل تست را به پیش از Go-live موکول می‌کند.

**اثر:** یک ترجیح اولیه به Launch Contract قطعی تبدیل شده است. این تغییر می‌تواند هزینه معماری و پذیرش را بالا ببرد یا موجب شکست غیرضروری Gate شود. در هیچ تصمیم ثبت‌شده‌ای دلیل یا تأیید مالک برای p95 و اجباری‌شدن این سه عدد وجود ندارد.

**وضعیت لازم:** یا اعداد به‌عنوان target موقت و قابل تصویب معرفی شوند، یا تأیید صریح مالک و دلیل تبدیل به p95/MUST ثبت شود.

## ۴. اصلاحات عمدی و موجه

### ۴.۱ دسترسی Viewer

- **منبع:** Viewer فقط‌خواندنی ولی دارای مشاهده گسترده، حتی برای داده حساس؛ هم‌زمان اصل حداقل دسترسی و permission مستقل جبران خدمت.
- **مقصد:** default-deny بر اساس دسته داده، عمل و Organizational Scope؛ Viewer عمومی مجوز داده حساس نمی‌دهد.
- **تشخیص:** **جایگزینی عمدی و موجه.**
- **دلیل:** read-only بودن ریسک افشای داده را رفع نمی‌کند و منبع با اصل حداقل دسترسی خود متناقض بود. تصمیم در memlog صریح است.

### ۴.۲ Multi-tenancy و `tenant_id`

- **منبع:** استقرار اول تک‌سازمانی، اما `tenant_id` روی همه داده‌های کسب‌وکاری و جداسازی Tenant به‌عنوان Must Have.
- **مقصد:** MVP تک‌سازمانی؛ آمادگی آینده فقط consideration غیرالزام‌آور در Addendum و ممنوعیت تحمیل `tenant_id` بدون Roadmap مصوب.
- **تشخیص:** **جایگزینی عمدی و موجه.**
- **دلیل:** نیاز تجاری نزدیک‌مدت برای چندمستاجری اثبات نشده و الزام منبع بار امنیتی/پیاده‌سازی بی‌پشتوانه ایجاد می‌کرد. تصمیم در memlog صریح است.

### ۴.۳ Finalized در برابر Effective و زنجیره اصلاح

- **منبع:** «نهایی فوراً معتبر است» در کنار رویداد آینده‌ای که نباید وضعیت جاری را تغییر دهد؛ Cancel، Reverse و Correction مرز قطعی نداشتند.
- **مقصد:** Finalized/Authoritative از Effective جدا شده و Cancel، Reverse و Correction رفتارهای متمایز و قابل حسابرسی‌اند.
- **تشخیص:** **اصلاح عمدی و موجه.**
- **دلیل:** تناقض را رفع و محاسبه تاریخی deterministic می‌کند. تصمیم در memlog صریح است.

### ۴.۴ رزرو ظرفیت رویداد آینده

- **منبع:** کنترل ظرفیت برای شروع/انتقال آینده لازم بود، ولی زمان رزرو و رقابت روی آخرین ظرفیت مشخص نبود.
- **مقصد:** ظرفیت مقصد هنگام Finalization رزرو می‌شود و ظرفیت مبدأ تا Effective شدن انتقال مصرف‌شده می‌ماند.
- **تشخیص:** **تکمیل عمدی و موجه، نه تحریف.**
- **دلیل:** جلوگیری از overbooking هم‌زمان؛ تصمیم در memlog صریح و در Addendum به‌عنوان default محافظه‌کارانه قابل اعتبارسنجی توضیح داده شده است.

### ۴.۵ «فقط LDAP باز است»

- **منبع:** LDAP را تنها موضوع اصلی باز می‌داند، با وجود پرسش‌های باز متعدد در امنیت، نگهداری، دسترسی، Baseline، RPO/RTO و قواعد دامنه.
- **مقصد:** همه تصمیم‌های policy، temporal، headcount، migration، NFR و Legal به Gate مالک‌دار تبدیل شده‌اند.
- **تشخیص:** **اصلاح عمدی و موجه.**
- **دلیل:** ادعای منبع از نظر داخلی نادرست و برای Go-live ناامن بود.

### ۴.۶ TLS، امنیت، نگهداری و بازیابی

- **منبع:** TLS مشروط به پشتیبانی زیرساخت؛ RPO/RTO، retention و چند کنترل امنیتی باز.
- **مقصد:** TLS و تصمیم‌های امنیت/بازیابی/نگهداری Gate پیش از Go-live هستند.
- **تشخیص:** **سخت‌سازی موجه.**
- **دلیل:** محصول داده‌های بسیار حساس HR را پردازش می‌کند و نبود این کنترل‌ها نمی‌تواند فرض خوش‌بینانه باشد.

### ۴.۷ فهرست فیلدها به‌عنوان «الزام مدل»

- **منبع:** همه فیلدهای فهرست‌شده باید در مدل قابل نگهداری باشند، حتی اگر اختیاری باشند.
- **مقصد:** فقط داده تصویب‌شده در Data Dictionary فعال می‌شود؛ وجود در Excel مجوز جمع‌آوری نیست.
- **تشخیص:** **اصلاح سیاستی موجه، با نقص حفظ فهرست نامزدها طبق GAP-1.**

### ۴.۸ Secondary Assignment

- **منبع:** هم در دامنه/مدل وجود دارد و هم Should Have است.
- **مقصد:** فقط میزانی که برای حفظ و نگهداری داده جاری سازمان لازم است در MVP است؛ workflow گسترده‌تر deferred است.
- **تشخیص:** **حل تعارض موجه و قابل آزمون.**

### ۴.۹ برآورد ۲ تا ۳ هفته

- **منبع:** برآورد اولیه را نقل می‌کند ولی خود نیز بازبرآورد را لازم می‌داند.
- **مقصد:** این بازه به‌صراحت تعهد محسوب نمی‌شود و بازبرآورد به تصمیم‌ها، profiling داده و معماری وابسته است.
- **تشخیص:** **رد عمدی و موجه.**

### ۴.۱۰ زبان سند و انتقال جزئیات

- **منبع:** فارسی و آمیخته با محصول، طراحی، تست و برنامه تحویل.
- **مقصد:** PRD انگلیسی با اصطلاحات فارسی در Glossary؛ جزئیات طراحی، داده، تست و sequencing در Addendum.
- **تشخیص:** **تغییر عمدی و موجه.**
- **دلیل:** تصمیم زبان در memlog ثبت شده و الزام محصول برای UI کاملاً فارسی/RTL بدون تغییر باقی مانده است.

## ۵. دفتر پوشش کامل منبع

### بخش‌های ۱ تا ۷ — خلاصه، مسئله، چشم‌انداز، اهداف، موفقیت، ذی‌نفعان، اصول

- مسئله Excel، منبع واحد حقیقت، تاریخچه، effective dating، ظرفیت، گزارش، مهاجرت و Audit در §§1–3 و FRها حفظ شده‌اند.
- نقش‌ها به actors/JTBD قابل‌آزمون تبدیل شده‌اند.
- دسترسی گسترده Viewer عمداً supersede شده است.
- معیارهای بدون baseline به owner، window، launch measurement و counter-metric مجهز شده‌اند؛ این تکمیل موجه است.
- هدف «زیرساخت Multi-tenancy» عمداً از MVP حذف و در Addendum غیرالزامی شده است.

**وضعیت:** پوشش کامل، جز اصلاحات عمدی ثبت‌شده.

### بخش ۸ — دامنه MVP و Non-goals

- قابلیت‌های اصلی در §7 PRD و FR-1 تا FR-45 پوشش دارند.
- Payroll، حضور/مرخصی/ماموریت، ATS، گردش ارتقا، فرآیندساز، چارت تعاملی، analytics پیشرفته، موبایل/تبلت، UI دوزبانه، self-service و مدیریت اسناد به‌صراحت Non-goal یا deferred هستند.
- اعلان‌های غیرفنی در Deferred آمده‌اند.
- Multi-tenancy عمداً supersede شده است.

**وضعیت:** پوشش کامل با اصلاح عمدی Multi-tenancy و محدودسازی Secondary Assignment.

### بخش ۹ — مدل مفهومی دامنه

- Person، Employment، Organizational Unit، Assignment، Role، Job Title، Ladder، Grade و Seniority در PRD و Addendum حفظ شده‌اند.
- Contracting Entity و Insuring Entity مستقل حفظ شده‌اند.
- invariants اصلی—یک Employment فعال، یک Primary Assignment، تاریخچه، half-grade، نبود نگاشت جهانی Grade/Seniority و مدیریت میان‌سطحی—نمایندگی دارند.
- الزام فیزیکی `tenant_id` عمداً رد شده است.
- جزئیات مکانیزم FK/unique/projection به‌درستی از قرارداد محصول خارج و به تصمیم معماری تبدیل شده‌اند.

**وضعیت:** پوشش کامل با supersession موجه.

### بخش ۱۰ — پرونده پرسنلی

- دسته‌ها، optional بودن، حداقل داده ایجاد Person/Employment، profile، تاریخچه و permission جبران خدمت در FR-5 تا FR-8 و FR-25/34 نمایندگی دارند.
- اصل «همه فیلدها چون در فایل‌اند» عمداً با Data Dictionary جایگزین شده است.
- فهرست تفصیلی نامزدها کامل به Addendum منتقل نشده است.

**وضعیت:** **پوشش ناقص؛ GAP-1.**

### بخش‌های ۱۱ و ۱۲ — رویداد و وضعیت زمانی

- envelope رویداد، Draft/Finalized/Scheduled/Effective، گذشته/آینده، immutability، Cancel/Reverse/Correction، تعارض، ترتیب قطعی، recalculation، current state و as-of reconstruction در FR-14 تا FR-27 پوشش کامل دارند.
- ابهام «فوراً معتبر» عمداً رفع شده است.
- مکانیزم Projection آزاد گذاشته شده ولی نتیجه deterministic و freshness الزام باقی مانده است.

**وضعیت:** پوشش کامل و از منبع دقیق‌تر.

### بخش ۱۳ — هدکانت

- approval lifecycle، Team + Job Title + optional Seniority، pooled count، اعتبار، مصرف/آزادسازی، انتقال اتمیک، concurrency، Override و گزارش‌پذیری در FR-28 تا FR-32 پوشش دارند.
- Reservation آینده افزوده شده تا شکاف منبع بسته شود.
- «در صورت نیاز» با coverage عمومی همراه exemption policy جایگزین شده است.

**وضعیت:** پوشش کامل با تکمیل موجه؛ جزئیات matching همچنان Gate صریح‌اند.

### بخش‌های ۱۴ و ۱۵ — جست‌وجو، داشبورد و گزارش

- امنیت جست‌وجو، sorting، pagination، count، columns، empty/error state، timeline، counts و گزارش‌های دامنه‌ای در FR-33 تا FR-36 وجود دارند.
- برخی رفتارها و inventory دقیق منبع فقط کلی یا candidate شده‌اند.

**وضعیت:** **پوشش ناقص/تضعیف‌شده؛ GAP-3.**

### بخش‌های ۱۶ و ۱۷ — Import و Export

- CSV/XLSX، identify/validate/preview/confirm/execute/result، خطای row/column فارسی، rollback، Batch، provenance، Baseline، duplicate warning، reconciliation و export محدود و auditشده در FR-37 تا FR-41 پوشش دارند.
- جزئیات قالب، idempotency، نگهداری فایل و حداکثر اندازه در Addendum یا Gate مالک‌دار هستند.

**وضعیت:** پوشش کامل؛ ابهام‌های منبع صریح شده‌اند.

### بخش‌های ۱۸ و ۱۹ — ماتریس دسترسی و Audit

- Role-only matrix با permission/category/action/scope جایگزین شده است.
- backend enforcement، جداسازی System Admin، export مستقل، privileged access، audit mutation/auth/import/export/override/config و tamper resistance حفظ یا تقویت شده‌اند.
- Viewer عمومی عمداً حذف شده است.
- sensitive-read audit و retention به Gate پیش از Go-live تبدیل شده‌اند.

**وضعیت:** پوشش کامل با اصلاح امنیتی موجه.

### بخش ۲۰ — LDAP

- LDAP/AD launch dependency، account link، disabled identity، password handling، Persian errors و تنظیم امن حفظ شده‌اند.
- topology، bind/trust، attributes، group mapping، failover، session و break-glass در Addendum و Open Gates کامل‌تر آمده‌اند.

**وضعیت:** پوشش کامل.

### بخش ۲۱ — رابط کاربری

- Persian/RTL، Jalali، 1280×720 تا 2K با مرجع 1920×1080، desktop-only، فرم بخش‌بندی‌شده، inline validation، confirmation، unsaved warning و timeline در FR-43/44 و Addendum UX حفظ شده‌اند.
- accessibility به Gate جدید و موجه تبدیل شده است.

**وضعیت:** پوشش کامل.

### بخش ۲۲ — NFR

- امنیت انتقال، integrity، concurrency، freshness، availability، recovery، session، at-rest/artifact protection، audit، observability، browser، accessibility و scale envelope در NFR-1 تا NFR-13 پوشش یافته‌اند.
- retry/idempotency، restore و operational design در Addendum حفظ شده‌اند.
- عملکرد ۲/۳/۵ ثانیه بدون تأیید از preference به MUST p95 تبدیل شده است.
- اشاره آزمایشی منبع به «۵۰۰ تا چند هزار Person» به upper-bound قطعی تبدیل نشده، اما NFR-13 تصویب scale envelope را Gate می‌کند؛ این حذف عدد به‌تنهایی بحرانی نیست.

**وضعیت:** پوشش قوی با **تغییر مادی GAP-4**.

### بخش‌های ۲۳ و ۲۴ — قواعد کسب‌وکار و پذیرش

- قواعد Person/Employment/Assignment/Event/Headcount/Role/Ladder/Migration/Audit در FR consequenceها قابل آزمون شده‌اند.
- سناریوهای شروع، خاتمه، بازگشت، انتقال، اصلاح، آینده/گذشته، ساختار، Import، dashboard، export، access و RTL پوشش دارند.
- جزئیات پذیرش dashboard/search تحت GAP-3 تضعیف شده‌اند.

**وضعیت:** عمدتاً کامل؛ نقص تابع GAP-3.

### بخش ۲۵ — User Storyها

- داستان‌های ایجاد Person، شروع، انتقال، اصلاح، timeline، headcount، dashboard، migration و return در UJها و FRها نمایندگی دارند.
- داستان‌ها به journeys واقع‌گرایانه و consequenceهای تست‌پذیر تبدیل شده‌اند؛ intent از دست نرفته است.

**وضعیت:** پوشش کامل.

### بخش ۲۶ — اولویت‌بندی

- Must Haveها در MVP Scope و FRها جذب شده‌اند.
- Secondary Assignment با دلیل fidelity محدود شده، saved filters صریحاً deferred و local emergency account Gate شده است.
- بخشی از Could Haveها و backlog نامزد هیچ disposition صریحی ندارند و با Roadmap حذف شده‌اند.

**وضعیت:** **ناقص برای backlog/Roadmap؛ GAP-2.**

### بخش ۲۷ — وابستگی‌ها

- زیرساخت، LDAP، شبکه/TLS، محیط، monitoring، backup/recovery، HR reference data، Data Dictionary، source cleanup، Baseline، security/legal و sign-offها در §11 و Gates پوشش دارند.

**وضعیت:** پوشش کامل و مالک‌دارتر.

### بخش ۲۸ — ریسک‌ها

- exposure، تاریخچه نادرست، headcount، migration quality، dependency failure، shadow process و schedule optimism در §12 پوشش دارند.
- mitigationهای تخصصی در FR/NFR/Addendum پخش شده‌اند؛ intent حذف نشده است.

**وضعیت:** پوشش کامل در سطح PRD، هرچند register مقصد خلاصه‌تر است.

### بخش‌های ۲۹ و ۳۰ — فرضیات و پرسش‌های باز

- فرضیات ایمنی به owner-bound launch gates تبدیل شده‌اند.
- LDAP دیگر به‌اشتباه تنها موضوع باز نیست.
- scale، deployment و localization به‌عنوان declared input حفظ شده‌اند.

**وضعیت:** پوشش کامل و اصلاح موجه.

### بخش ۳۱ — برنامه تحویل

- sequencing تفصیلی به Addendum منتقل و صریحاً planning hypothesis غیرمتعهد شده است.
- خروجی‌های اصلی همه فازها در ترتیب پیشنهادی جدید وجود دارند.
- تعهد ۲–۳ هفته با دلیل معتبر رد شده است.

**وضعیت:** پوشش کامل و جایگذاری درست.

### بخش ۳۲ — راهبرد تست

- unit/property، integration، acceptance، security، performance/reliability و UAT evidence در §12 Addendum حفظ و به FR/NFR traceability متصل شده‌اند.

**وضعیت:** پوشش کامل و جایگذاری درست.

### بخش‌های ۳۳ و ۳۴ — آمادگی انتشار و خروج از MVP

- migration rehearsal/reconciliation، LDAP، permissions، restore، security، concurrency، dashboard/detail reconciliation، UAT، training، support و sign-off در LG-1 تا LG-6 پوشش دارند.
- post-launch adoption، trusted state، spreadsheet retirement، headcount governance و 30/60/90 review در Success Metrics/Rollout پوشش یافته‌اند.

**وضعیت:** پوشش کامل و قابل‌اندازه‌گیری‌تر.

### بخش ۳۵ — Roadmap پس از MVP

- قابلیت‌ها عمدتاً فقط به‌عنوان Non-goal دیده می‌شوند؛ ترتیب و قصد Roadmap حفظ نشده است.

**وضعیت:** **ناقص؛ GAP-2.**

### بخش ۳۶ — واژه‌نامه

- اصطلاحات کلیدی Person، Employment، Assignment، Primary/Secondary، Event، Effective Date، Baseline، Headcount، Seniority، Grade، Ladder، Role، Job Title، Cancel، Reverse و Override حفظ و دقیق‌تر شده‌اند.
- Tenant عمداً از glossary قراردادی MVP حذف شده و در Addendum non-MVP تعریف مفهومی دارد.
- Finalized/Authoritative، Correction، Reservation، Data Dictionary و Organizational Scope برای رفع ابهام افزوده شده‌اند.

**وضعیت:** پوشش کامل با تحول اصطلاحی عمدی.

### بخش ۳۷ — جمع‌بندی

- هویت محصول، مقیاس، استقرار، localization، رویدادها، وضعیت تاریخی، headcount، migration، access و Non-goalهای اصلی در PRD حفظ شده‌اند.
- ادعای «فقط LDAP باز است» عمداً تصحیح شده است.

**وضعیت:** پوشش کامل، تابع چهار شکاف گزارش‌شده.

## ۶. نتیجه حسابرسی

- **نمایندگی مستقیم یا معادل در PRD:** هسته محصول، دامنه MVP، FRها، NFRها، launch gates، success/counter-metrics، dependencies، risks و open decisions.
- **حفظ درست در Addendum:** مدل مفهومی، event/headcount mechanics، migration، LDAP، UX، عملیات، sequencing و test strategy.
- **تعویق/Non-goal صریح:** Payroll، attendance/leave/mission، ATS، promotion workflow در MVP، process engine، interactive org chart، advanced analytics، self-service، mobile/tablet، bilingual UI، document management، broader secondary workflows و saved filters.
- **Supersession عمدی و موجه:** Viewer گسترده، `tenant_id` اجباری، finalization/effect ambiguity، headcount reservation ambiguity، TLS مشروط، «فقط LDAP باز»، برآورد ۲–۳ هفته و فعال‌سازی خودکار همه فیلدهای Excel.
- **بدون disposition کافی:** فهرست کامل فیلدهای نامزد، Roadmap/Backlog پس از MVP، بخشی از قرارداد dashboard/report/search و سخت‌سازی p95 اهداف کارایی.

تا زمانی که GAP-1 تا GAP-4 تعیین تکلیف نشوند، ادعای «تمام محتوای منبع یا حفظ، یا تعویق، یا supersede شده است» قابل اثبات نیست.
