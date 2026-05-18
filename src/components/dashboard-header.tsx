type Props = {
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
};

export function DashboardHeader({ title, subtitle, actions }: Props) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          {subtitle}
        </p>
        <h1 className="mt-1 text-2xl font-semibold">{title}</h1>
      </div>
      {actions}
    </header>
  );
}
