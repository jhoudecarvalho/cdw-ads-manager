import { PlatformScreen } from "@/components/platform-screen";
import { parseDashboardFilters } from "@/lib/filters";
import { requireActor } from "@/server/auth/require-actor";
import { loadPlatformSlice } from "@/server/metrics/by-platform";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function MetaAdsPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const actor = await requireActor(slug);
  const filters = parseDashboardFilters(sp);
  const data = await loadPlatformSlice(
    actor.tenantId,
    actor,
    "META_ADS",
    filters,
  );

  return <PlatformScreen slug={slug} platform="META_ADS" data={data} />;
}
