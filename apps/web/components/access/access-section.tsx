export function AccessSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 border-t border-border pt-6 first:border-t-0 first:pt-0">
      <header className="flex flex-col gap-1">
        <h2 className="text-title-medium text-foreground">{title}</h2>
        <p className="text-body-medium text-muted-foreground">{description}</p>
      </header>
      {children}
    </section>
  );
}
