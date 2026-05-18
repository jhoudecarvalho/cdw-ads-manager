import { Card, CardContent } from "@/components/ui/card";

type Props = {
  label: string;
  value: string;
  hint?: string;
};

export function KpiCard({ label, value, hint }: Props) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}
