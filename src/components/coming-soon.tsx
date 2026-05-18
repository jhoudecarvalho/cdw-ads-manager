import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Props = {
  title: string;
  description: string;
  phase?: string;
};

/**
 * Placeholder usado para os 4 módulos "BREVE" (Ecocentauro, Indicação,
 * Sellflux, Landing Page) e para as telas de Campanhas Ads ainda não
 * implementadas. A estrutura de rotas já existe — quando a feature ficar
 * pronta, basta substituir o conteúdo desta tela.
 */
export function ComingSoon({ title, description, phase }: Props) {
  return (
    <div className="mx-auto w-full max-w-2xl p-8">
      <Card className="border-dashed">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>{title}</CardTitle>
            <Badge variant="secondary" className="text-[10px] uppercase">
              {phase ?? "Em breve"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{description}</p>
          <p className="mt-4 text-xs text-muted-foreground/70">
            A rota já está registrada e o layout já comporta este módulo. Quando
            o conteúdo entrar, é trocar este placeholder pelo componente real —
            nenhum ajuste de navegação ou auth necessário.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
