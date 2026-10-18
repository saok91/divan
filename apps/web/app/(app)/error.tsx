"use client";

import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="mx-auto flex w-full max-w-lg flex-col items-start gap-4 p-6" aria-labelledby="page-error-title">
      <AlertCircle className="size-8 text-destructive" aria-hidden="true" />
      <h1 id="page-error-title" className="text-heading">بارگذاری صفحه کامل نشد</h1>
      <p role="alert" className="text-body text-muted-foreground">ممکن است ارتباط با سامانه موقتاً قطع شده باشد. دوباره تلاش کنید؛ اگر مشکل ادامه داشت با پشتیبانی سامانه تماس بگیرید.</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={reset}>تلاش دوباره</Button>
        <Button variant="tertiary" asChild><Link href="/">بازگشت به صفحهٔ اصلی</Link></Button>
      </div>
    </section>
  );
}
