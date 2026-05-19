import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardHeader } from "@/components/dashboard-header";
import { loadActorContext } from "@/server/auth/load-actor";
import { prisma } from "@/server/db/prisma";
import { BrandingForm } from "./_form";

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function SettingsPage({ params }: Props) {
  const { slug } = await params;
  const session = await auth();
  const actor = await loadActorContext(session!);

  // Apenas ADMIN acessa as configurações do tenant.
  if (actor.role !== "ADMIN") notFound();

  const tenant = await prisma.tenant.findUnique({
    where: { id: actor.tenantId },
    select: { name: true, logoUrl: true, primaryColor: true },
  });

  if (!tenant) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <DashboardHeader
        title="Configurações do tenant"
        subtitle={`${slug} · ${tenant.name}`}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Identidade visual</CardTitle>
        </CardHeader>
        <CardContent>
          <BrandingForm
            tenantSlug={slug}
            initialLogoUrl={tenant.logoUrl}
            initialPrimaryColor={tenant.primaryColor}
          />
        </CardContent>
      </Card>
    </div>
  );
}
