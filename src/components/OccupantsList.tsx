import { useState } from "react";
import { UserPlus, X } from "lucide-react";

import { ComboBox } from "@/components/ComboBox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/useAuth";
import { usePeople } from "@/hooks/useFrotaOptions";
import { occupantName, useOccupantMutations, useTripOccupants } from "@/hooks/useOccupants";
import { cn } from "@/lib/utils";

export interface OccupantsListProps {
  tripId: string;
  /** Solicitante da viagem — pode gerenciar os ocupantes da própria solicitação. */
  requesterId?: string | null | undefined;
  /** Exibe apenas a lista, sem ações de edição. */
  readOnly?: boolean | undefined;
  className?: string | undefined;
}

/** Lista de ocupantes da viagem com inclusão, remoção e recusa de participação. */
export function OccupantsList({
  tripId,
  requesterId,
  readOnly = false,
  className,
}: OccupantsListProps) {
  const { user, profile, isAdmin, isSuperAdmin } = useAuth();
  const { data: occupants = [], isLoading } = useTripOccupants(tripId);
  const { data: people = [] } = usePeople();
  const { add, remove, decline } = useOccupantMutations(tripId);

  const [newUserId, setNewUserId] = useState<string | null>(null);
  const [externalOpen, setExternalOpen] = useState(false);
  const [externalName, setExternalName] = useState("");
  const [externalDoc, setExternalDoc] = useState("");
  const [externalPhone, setExternalPhone] = useState("");
  const [confirmDecline, setConfirmDecline] = useState<string | null>(null);

  const canManage =
    !readOnly &&
    (isAdmin || isSuperAdmin || Boolean(profile?.is_sre_driver) || user?.id === requesterId);
  const canAddExternal = !readOnly && (isAdmin || isSuperAdmin);

  const taken = new Set(occupants.map((o) => o.user_id).filter(Boolean) as string[]);
  const options = people
    .filter((p) => !taken.has(p.id))
    .map((p) => ({
      value: p.id,
      label: p.full_name,
      hint: [p.sector, p.registration].filter(Boolean).join(" · ") || undefined,
    }));

  const mine = occupants.find((o) => o.user_id === user?.id && o.status === "CONFIRMADO");

  return (
    <div className={cn("space-y-3", className)}>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando ocupantes…</p>
      ) : occupants.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum ocupante registrado.</p>
      ) : (
        <ul className="space-y-2">
          {occupants.map((o) => (
            <li
              key={o.id}
              className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm"
            >
              <span className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "font-bold text-sm",
                      o.status === "RECUSADO" && "text-muted-foreground/60 line-through",
                    )}
                  >
                    {occupantName(o)}
                  </span>
                  {o.is_external && (
                    <Badge variant="outline" className="text-[9px] font-black tracking-widest px-1 py-0 h-4 bg-muted/50 border-muted-foreground/20 uppercase">
                      Externo
                    </Badge>
                  )}
                  {o.status === "RECUSADO" && (
                    <Badge variant="destructive" className="text-[9px] font-black tracking-widest px-1 py-0 h-4 uppercase">
                      Recusou participação
                    </Badge>
                  )}
                </div>
                {!o.is_external && o.profile && (
                  <div className="flex gap-1.5 mt-0.5 text-[10px] font-medium text-muted-foreground">
                    {o.profile.sector && <span>{o.profile.sector}</span>}
                    {o.profile.registration && (
                      <>
                        <span className="opacity-30">·</span>
                        <span>{o.profile.registration}</span>
                      </>
                    )}
                  </div>
                )}
                {o.is_external && (o.external_document || o.external_phone) && (
                  <div className="flex gap-1.5 mt-0.5 text-[10px] font-medium text-muted-foreground">
                    {o.external_document && <span>{o.external_document}</span>}
                    {o.external_phone && (
                      <>
                        <span className="opacity-30">·</span>
                        <span>{o.external_phone}</span>
                      </>
                    )}
                  </div>
                )}
              </span>

              {canManage ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remover ${occupantName(o)}`}
                  onClick={() => remove.mutate(o.id)}
                  disabled={remove.isPending}
                >
                  <X className="h-4 w-4" />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {mine && !readOnly ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setConfirmDecline(mine.id)}
        >
          Não vou participar
        </Button>
      ) : null}

      {canManage ? (
        <div className="space-y-2 rounded-md border border-dashed border-border p-3">
          <Label className="text-xs uppercase text-muted-foreground">Incluir ocupante</Label>
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-[200px] flex-1">
              <ComboBox
                options={options}
                value={newUserId}
                onSelect={(option) => setNewUserId(option.value)}
                placeholder="Selecionar usuário"
                searchPlaceholder="Buscar por nome, matrícula ou setor…"
                emptyText="Nenhum usuário disponível."
              />
            </div>
            <Button
              type="button"
              size="sm"
              disabled={!newUserId || add.isPending}
              onClick={() => {
                if (!newUserId) return;
                add.mutate(
                  { tripId, userId: newUserId },
                  { onSuccess: () => setNewUserId(null) },
                );
              }}
            >
              <UserPlus className="mr-1 h-4 w-4" /> Incluir
            </Button>
          </div>

          {canAddExternal ? (
            externalOpen ? (
              <div className="grid gap-2 pt-2 sm:grid-cols-3">
                <Input
                  placeholder="Nome completo"
                  value={externalName}
                  onChange={(e) => setExternalName(e.target.value)}
                />
                <Input
                  placeholder="Documento"
                  value={externalDoc}
                  onChange={(e) => setExternalDoc(e.target.value)}
                />
                <Input
                  placeholder="Telefone"
                  value={externalPhone}
                  onChange={(e) => setExternalPhone(e.target.value)}
                />
                <div className="flex gap-2 sm:col-span-3">
                  <Button
                    type="button"
                    size="sm"
                    disabled={externalName.trim().length < 3 || add.isPending}
                    onClick={() =>
                      add.mutate(
                        {
                          tripId,
                          external: {
                            name: externalName.trim(),
                            document: externalDoc.trim() || null,
                            phone: externalPhone.trim() || null,
                          },
                        },
                        {
                          onSuccess: () => {
                            setExternalName("");
                            setExternalDoc("");
                            setExternalPhone("");
                            setExternalOpen(false);
                          },
                        },
                      )
                    }
                  >
                    Adicionar externo
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setExternalOpen(false)}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setExternalOpen(true)}
              >
                + Adicionar ocupante externo
              </Button>
            )
          ) : null}
        </div>
      ) : null}

      <AlertDialog
        open={Boolean(confirmDecline)}
        onOpenChange={(open) => !open && setConfirmDecline(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar ausência</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza de que não participará desta viagem?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDecline) decline.mutate(confirmDecline);
                setConfirmDecline(null);
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
