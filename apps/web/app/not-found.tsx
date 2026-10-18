import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <section className="flex max-w-md flex-col items-start gap-4" aria-labelledby="not-found-title">
        <FileQuestion className="size-10 text-primary" aria-hidden="true" />
        <h1 id="not-found-title" className="text-heading">صفحه پیدا نشد</h1>
        <p className="text-body text-muted-foreground">نشانی ممکن است تغییر کرده باشد یا این صفحه دیگر در دسترس نباشد. از صفحهٔ اصلی به بخش موردنظر بروید.</p>
        <Button variant="primary" asChild><Link href="/">بازگشت به صفحهٔ اصلی</Link></Button>
      </section>
    </main>
  );
}
