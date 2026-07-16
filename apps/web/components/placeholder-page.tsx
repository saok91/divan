type PlaceholderPageProps = {
  title: string;
  description: string;
};

/** Empty Persian shell for Epic-1 IA destinations (no domain features). */
export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="mx-auto max-w-3xl space-y-2 bg-background p-6 text-foreground">
      <h1 className="text-heading">{title}</h1>
      <p className="text-body text-muted-foreground">{description}</p>
    </div>
  );
}
