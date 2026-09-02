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
import { calculateTripOccupancy, isOccupantActive } from "@/lib/occupancy";
import { useTripStops } from "@/hooks/useTripStops";

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
  const { data: occupants = [], isLoading: isLoadingOccupants } = useTripOccupants(tripId);
  const { data: people = [] } = usePeople();
  const { data: stops = [], isLoading: isLoadingStops } = useTripStops(tripId);
  const { add, remove, decline } = useOccupantMutations(tripId);

  const [newUserId, setNewUserId] = useState<string | null>(null);
  const [externalOpen, setExternalOpen] = useState(false);
  const [externalName, setExternalName] = useState("");
  const [externalDoc, setExternalDoc] = useState("");
  const [externalPhone, setExternalPhone] = useState("");
  const [confirmDecline, setConfirmDecline] = useState<string | null>(null);

  const isLoading = isLoadingOccupants || isLoadingStops;

  const canManage =
    !readOnly &&
    (isAdmin || isSuperAdmin || Boolean(profile?.is_sre_driver) || user?.id === requesterId);
  const canAddExternal = !readOnly && (isAdmin || isSuperAdmin);

  const occupancy = calculateTripOccupancy(
    stops,
    occupants
      .filter((o) => isOccupantActive(o) && !o.is_driver)
      // Ocupantes externos não possuem user_id: usam um token único para contarem como pessoas.
      .map((o) => (o.is_external ? `ext:${o.id}` : o.user_id)),
    5
  );


  const taken = new Set(occupants.map((o) => o.user_id).filter(Boolean) as string[]);
  const options = people
    .filter((p) => !taken.has(p.id))
    .map((p) => ({
      value: p.id,
      label: p.full_name,
      hint: [p.sector, p.registration].filter(Boolean).join(" · ") || undefined,
    }));

  // Ocupantes removidos permanecem apenas para visualização/auditoria.
  const activeOccupants = occupants.filter((o) => !o.removed_at);
  const removedOccupants = occupants.filter((o) => Boolean(o.removed_at));

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70">
          Ocupação Total: {occupancy.totalPeople} de {occupancy.capacity}
        </h3>
        {!readOnly && occupancy.remaining > 0 && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setExternalOpen(true)}>
              <UserPlus className="mr-1 h-3 w-3" /> Externo
            </Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando ocupantes…</p>
      ) : activeOccupants.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum ocupante registrado.</p>
      ) : (
        <ul className="space-y-2">
          {activeOccupants.map((o) => (
            <li
              key={o.id}
              className="space-y-2 rounded-md border border-border px-3 py-2 text-sm"
            >
              <div className="flex items-center justify-between gap-3">
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
                  {o.is_driver && (
                    <Badge variant="secondary" className="text-[9px] font-black tracking-widest px-1 py-0 h-4 bg-primary/10 border-primary/20 text-primary uppercase">
                      Motorista
                    </Badge>
                  )}
                  {o.is_external && (
                    <Badge variant="outline" className="text-[9px] font-black tracking-widest px-1 py-0 h-4 bg-muted/50 border-muted-foreground/20 uppercase">
                      Externo
                    </Badge>
                  )}
                  {o.status === "RECUSADO" && (
                    <Badge variant="destructive" className="text-[9px] font-black tracking-widest px-1 py-0 h-4 uppercase">
                      Recusou
                    </Badge>
                  )}
                </div>
              </span>

              {canManage && !o.is_driver && o.status !== "RECUSADO" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => remove.mutate(o.id)}
                  disabled={remove.isPending}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}

              {o.is_driver && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                  Definido no condutor
                </span>
              )}


              {!readOnly && o.user_id === user?.id && o.status === "CONFIRMADO" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-[10px] font-bold text-destructive hover:bg-destructive/10"
                  onClick={() => setConfirmDecline(o.id)}
                >
                  Recusar participação
                </Button>
              )}
              </div>

              <OccupantDestinations
                links={destinationLinks.filter((l) => l.occupant_id === o.id)}
                options={placeOptions}
                canManage={canManage}
                isPending={linkDestination.isPending}
                onLink={(payload) => linkDestination.mutate({ occupantId: o.id, ...payload })}
                onUnlink={(id) => unlinkDestination.mutate(id)}
              />
            </li>
          ))}

        </ul>
      )}

      {removedOccupants.length > 0 && (
        <div className="space-y-2 pt-2">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">
            Passageiros removidos
          </h4>
          <ul className="space-y-1">
            {removedOccupants.map((o) => (
              <li
                key={o.id}
                className="flex items-center gap-2 rounded-md border border-dashed border-border/60 px-3 py-1.5 text-sm"
              >
                <span className="font-medium text-muted-foreground/70 line-through">
                  {occupantName(o)}
                </span>
                {o.is_external && (
                  <Badge variant="outline" className="text-[9px] font-black tracking-widest px-1 py-0 h-4 uppercase">
                    Externo
                  </Badge>
                )}
                <Badge variant="secondary" className="text-[9px] font-black tracking-widest px-1 py-0 h-4 uppercase">
                  {o.status === "RECUSADO" ? "Recusou" : "Removido"}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      )}

      {canManage && occupancy.remaining > 0 && (
        <div className="flex gap-2">
          <div className="flex-1">
            <ComboBox
              options={options}
              value={newUserId}
              onSelect={(option) => setNewUserId(option.value)}
              placeholder="Adicionar servidor…"
              searchPlaceholder="Nome, matrícula ou setor…"
            />
          </div>
          <Button
            size="sm"
            onClick={() => {
              if (newUserId) {
                add.mutate({ tripId, userId: newUserId });
                setNewUserId(null);
              }
            }}
            disabled={!newUserId || add.isPending}
          >
            Adicionar
          </Button>
        </div>
      )}

      {/* Modal para Externo */}
      <AlertDialog open={externalOpen} onOpenChange={setExternalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Adicionar Ocupante Externo</AlertDialogTitle>
            <AlertDialogDescription>
              Pessoas que não possuem cadastro no sistema (ex: convidados, palestrantes).
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="ext-name">Nome Completo</Label>
              <Input
                id="ext-name"
                value={externalName}
                onChange={(e) => setExternalName(e.target.value)}
                placeholder="Nome do ocupante"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="ext-doc">Documento (CPF/RG)</Label>
                <Input
                  id="ext-doc"
                  value={externalDoc}
                  onChange={(e) => setExternalDoc(e.target.value)}
                  placeholder="000.000.000-00"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ext-phone">Telefone</Label>
                <Input
                  id="ext-phone"
                  value={externalPhone}
                  onChange={(e) => setExternalPhone(e.target.value)}
                  placeholder="(38) 99999-9999"
                />
              </div>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (externalName) {
                  add.mutate({
                    tripId,
                    external: {
                      name: externalName,
                      document: externalDoc,
                      phone: externalPhone,
                    }
                  });
                  setExternalName("");
                  setExternalDoc("");
                  setExternalPhone("");
                  setExternalOpen(false);
                }
              }}
              disabled={!externalName || add.isPending}
            >
              Adicionar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal para Recusar */}
      <AlertDialog open={Boolean(confirmDecline)} onOpenChange={(o) => !o && setConfirmDecline(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Recusa</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja recusar sua participação nesta viagem? Esta ação não pode ser
              desfeita pelo próprio usuário.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (confirmDecline) {
                  decline.mutate(confirmDecline);
                  setConfirmDecline(null);
                }
              }}
              disabled={decline.isPending}
            >
              Sim, Recusar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
