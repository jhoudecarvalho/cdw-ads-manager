import { auth } from "@/auth";
import { PlatformScreen } from "@/components/platform-screen";
import { parseDashboardFilters } from "@/lib/filters";
import { loadActorContext } from "@/server/auth/load-actor";
import { loadPlatformSlice } from "@/server/metrics/by-platform";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function GoogleAdsPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const session = await auth();
  const actor = await loadActorContext(session!);
  const filters = parseDashboardFilters(sp);
  const data = await loadPlatformSlice(
    actor.tenantId,
    actor,
    "GOOGLE_ADS",
    filters,
  );

  return <PlatformScreen slug={slug} platform="GOOGLE_ADS" data={data} />;
}
