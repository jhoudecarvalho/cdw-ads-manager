import { PlatformScreen } from "@/components/platform-screen";
import { parseDashboardFilters } from "@/lib/filters";
import { requireActor } from "@/server/auth/require-actor";
import { loadPlatformSlice } from "@/server/metrics/by-platform";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function GoogleAdsPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const actor = await requireActor(slug);
  const filters = parseDashboardFilters(sp);
  const data = await loadPlatformSlice(
    actor.tenantId,
    actor,
    "GOOGLE_ADS",
    filters,
  );

  return <PlatformScreen slug={slug} platform="GOOGLE_ADS" data={data} />;
}
