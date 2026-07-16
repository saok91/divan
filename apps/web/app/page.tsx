import { Button } from "@/components/ui/button";
import { UserMenuStub } from "@/components/user-menu-stub";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Temporary chrome strip — full app-shell lands in Story 1.3 */}
      <header className="flex h-chrome-height items-center justify-between bg-chrome px-4 text-chrome-foreground">
        <p className="text-heading-sm">دیوان</p>
        <UserMenuStub />
      </header>

      <main className="mx-auto max-w-3xl space-y-form-section-gap p-6">
        <section className="space-y-2">
          <h1 className="text-heading">دیوان</h1>
          <p className="text-body text-muted-foreground">
            بستر ماژولار مونولیت — توکن‌های برند، تایپوگرافی یکان‌بخ و پوسته روشن/تاریک
          </p>
          <p className="text-caption text-muted-brand">
            کروم سرمه‌ای در هر دو حالت ثابت می‌ماند؛ بوم محتوا با تم عوض می‌شود.
          </p>
        </section>

        <section className="rounded-md border border-border bg-card p-6 text-card-foreground shadow-xs">
          <h2 className="mb-4 text-heading-sm">دکمه‌های برند</h2>
          <p className="mb-4 text-body text-muted-foreground">
            دکمه اصلی (طلایی، وابسته به تم) و دکمه ثانویه (آبی ساختاری).
          </p>
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" type="button">
              اقدام اصلی
            </Button>
            <Button variant="secondary" type="button">
              اقدام ثانویه
            </Button>
          </div>
          <p className="mt-4 text-tabular text-muted-foreground">
            نمونه ارقام جدولی: 1,234,567
          </p>
        </section>
      </main>
    </div>
  );
}
