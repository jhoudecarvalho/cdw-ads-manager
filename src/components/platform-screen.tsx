import type { Platform } from "@/generated/prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardHeader } from "@/components/dashboard-header";
import { KpiCard } from "@/components/kpi-card";
import { LineTrendChart } from "@/components/charts/line-trend-chart";
import { DistributionBarChart } from "@/components/charts/distribution-bar-chart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { brl, int, multiplier, pct, platformLabel } from "@/lib/format";
import type { PlatformSlice } from "@/server/metrics/by-platform";

type Props = {
  slug: string;
  platform: Platform;
  data: PlatformSlice;
};

/**
 * Tela compartilhada por "Google Ads" e "Meta Ads" — mesma estrutura,
 * platform diferente. KPIs + tendência diária + distribuição por tipo +
 * top 10 campanhas.
 */
export function PlatformScreen({ slug, platform, data }: Props) {
  return (
    <div className="space-y-6 p-6">
      <DashboardHeader
        title={platformLabel(platform)}
        subtitle={`${slug} · últimos ${data.rangeDays} dias`}
      />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <KpiCard label="Investimento" value={brl(data.totals.spend)} />
        <KpiCard label="Receita" value={brl(data.totals.revenue)} />
        <KpiCard label="ROAS" value={multiplier(data.totals.roas)} />
        <KpiCard label="Conversões" value={int(data.totals.conversions)} />
        <KpiCard label="Cliques" value={int(data.totals.clicks)} />
        <KpiCard label="CTR" value={pct(data.totals.ctr)} />
        <KpiCard label="CPC" value={brl(data.totals.cpc, 2)} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Investimento vs Receita — diário
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.byDay.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Sem dados.
              </p>
            ) : (
              <LineTrendChart
                data={data.byDay}
                series={[
                  {
                    key: "spend",
                    label: "Investimento",
                    color: "var(--chart-2)",
                  },
                  { key: "revenue", label: "Receita", color: "var(--chart-1)" },
                ]}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Investimento por {platform === "GOOGLE_ADS" ? "tipo" : "objetivo"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.byType.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Sem dados.
              </p>
            ) : (
              <DistributionBarChart
                data={data.byType.map((t) => ({
                  label: t.type,
                  value: t.spend,
                }))}
                valueLabel="Investimento"
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            ROAS por {platform === "GOOGLE_ADS" ? "tipo" : "objetivo"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.byType.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">Sem dados.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Investimento</TableHead>
                  <TableHead className="text-right">Receita</TableHead>
                  <TableHead className="text-right">Conversões</TableHead>
                  <TableHead className="text-right">ROAS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.byType.map((t) => (
                  <TableRow key={t.type}>
                    <TableCell className="font-medium">{t.type}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {brl(t.spend)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {brl(t.revenue)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {int(t.conversions)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">
                      {multiplier(t.roas)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Top 10 campanhas por receita
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.topCampaigns.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">Sem dados.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campanha</TableHead>
                  <TableHead>Franquia</TableHead>
                  <TableHead className="text-right">Investimento</TableHead>
                  <TableHead className="text-right">Receita</TableHead>
                  <TableHead className="text-right">Conv.</TableHead>
                  <TableHead className="text-right">ROAS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.topCampaigns.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="max-w-[300px] truncate text-muted-foreground">
                      {c.franchiseName}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {brl(c.spend)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {brl(c.revenue)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {int(c.conversions)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">
                      {multiplier(c.roas)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
