"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ExportButton() {
  function onClick() {
    // O endpoint serve com Content-Disposition: attachment, então o browser
    // baixa direto.
    window.location.href = "/api/lgpd/export";
  }
  return (
    <Button variant="outline" size="sm" onClick={onClick}>
      Baixar meus dados (JSON)
    </Button>
  );
}

export function DeleteAccountFlow({ tenantSlug }: { tenantSlug: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="border-red-700/40 text-red-300 hover:bg-red-950/30"
        onClick={() => setOpen(true)}
      >
        Excluir minha conta
      </Button>
    );
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const r = await fetch("/api/lgpd/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm, reason: reason || undefined }),
      });
      if (!r.ok) {
        const body = (await r.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Falha ao processar exclusão.");
        return;
      }
      router.push(`/${tenantSlug}/login`);
    });
  }

  return (
    <div className="space-y-3 rounded-lg border border-red-700/40 bg-red-950/10 p-4 text-sm">
      <p className="font-medium text-red-300">
        Confirmar exclusão da conta — ação irreversível
      </p>
      <p className="text-xs text-muted-foreground">
        Seus dados pessoais serão anonimizados conforme o art. 18 da LGPD. Você
        não conseguirá mais logar com este e-mail. A trilha de auditoria é
        mantida sem identificá-lo.
      </p>
      <div className="space-y-2">
        <label className="block text-xs">
          <span className="text-muted-foreground">
            Motivo (opcional, ajuda nossa documentação):
          </span>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex.: não uso mais o serviço"
            className="mt-1 h-8"
            maxLength={500}
          />
        </label>
        <label className="block text-xs">
          <span className="text-muted-foreground">
            Digite <strong className="text-red-300">EXCLUIR</strong> para
            confirmar:
          </span>
          <Input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="EXCLUIR"
            className="mt-1 h-8"
            autoComplete="off"
          />
        </label>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setOpen(false);
            setConfirm("");
            setReason("");
            setError(null);
          }}
          disabled={pending}
        >
          Cancelar
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="border-red-700 bg-red-950/40 text-red-100 hover:bg-red-900/60"
          onClick={submit}
          disabled={pending || confirm !== "EXCLUIR"}
        >
          {pending ? "Anonimizando…" : "Anonimizar minha conta"}
        </Button>
      </div>
    </div>
  );
}
