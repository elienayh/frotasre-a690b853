import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Pencil } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { DriverForm, type DriverRecord } from "@/components/DriverForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { fmtDate, fmtDateTime } from "@/lib/frota";
import { cnhStatus, DRIVER_TYPE_LABEL, fmtCpf } from "@/lib/motoristas";

export const Route = createFileRoute("/_authenticated/admin/motoristas/$driverId")({
  component: FichaMotorista,
});

const DRIVER_COLUMNS =
  "id, full_name, cpf, birth_date, phone, mobile, email, address, address_number, complement, district, city, state, zip_code, license_number, license_category, cnh_categories, cnh_issued_at, cnh_expires_at, cnh_first_at, cnh_notes, driver_type, profile_id, is_authorized, is_active, notes";

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border py-2 text-sm last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{value || "—"}</dd>
    </div>
  );
}

function onlyDate(value: string | null | undefined) {
  return value ? fmtDate(`${value}T12:00:00`) : null;
}

function FichaMotorista() {
  const { driverId } = Route.useParams();
  const [editOpen, setEditOpen] = useState(false);

  const { data: driver } = useQuery({
    queryKey: ["driver", driverId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("drivers")
        .select(DRIVER_COLUMNS)
        .eq("id", driverId)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as DriverRecord | null;
    },
  });

  const { data: trips = [] } = useQuery({
    queryKey: ["driver-trips", driverId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trip_requests")
        .select(
          "id, code, destination_text, departure_at, return_at, status, requester_name, vehicles(plate, manufacturer, model)",
        )
        .eq("driver_id", driverId)
        .order("departure_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const cnh = cnhStatus(driver?.cnh_expires_at);
  const now = new Date().toISOString();
  const upcoming = trips.filter((t) => t.departure_at >= now);
  const history = trips.filter((t) => t.departure_at < now);

  return (
    <AppShell
      title={driver?.full_name ?? "Motorista"}
      description={
        driver ? `${DRIVER_TYPE_LABEL[driver.driver_type] ?? driver.driver_type}` : "Ficha do motorista"
      }
      actions={
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/motoristas">
              <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
            </Link>
          </Button>
          <Button size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-1 h-4 w-4" /> Editar
          </Button>
        </div>
      }
    >
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <span
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-semibold",
            driver?.is_active
              ? "border-success/30 bg-success/15 text-success"
              : "border-destructive/30 bg-destructive/15 text-destructive",
          )}
        >
          {driver?.is_active ? "ATIVO" : "INATIVO"}
        </span>
        <span className={cn("rounded-full border px-3 py-1 text-xs font-semibold", cnh.tone)}>
          {cnh.label}
        </span>
        {!cnh.apt || !driver?.is_authorized ? (
          <span className="rounded-full border border-destructive/30 bg-destructive/15 px-3 py-1 text-xs font-semibold text-destructive">
            NÃO APTO PARA CONDUÇÃO
          </span>
        ) : null}
      </div>

      <Tabs defaultValue="pessoais">
        <TabsList className="flex-wrap">
          <TabsTrigger value="pessoais">Dados pessoais</TabsTrigger>
          <TabsTrigger value="cnh">Habilitação</TabsTrigger>
          <TabsTrigger value="viagens">Viagens</TabsTrigger>
          <TabsTrigger value="agenda">Agenda</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="pessoais" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dados pessoais e contato</CardTitle>
            </CardHeader>
            <CardContent>
              <dl>
                <Row label="Nome completo" value={driver?.full_name} />
                <Row label="CPF" value={driver ? fmtCpf(driver.cpf) : null} />
                <Row label="Nascimento" value={onlyDate(driver?.birth_date)} />
                <Row label="Telefone" value={driver?.phone} />
                <Row label="Celular" value={driver?.mobile} />
                <Row label="E-mail" value={driver?.email} />
                <Row
                  label="Endereço"
                  value={
                    [driver?.address, driver?.address_number, driver?.complement]
                      .filter(Boolean)
                      .join(", ") || null
                  }
                />
                <Row label="Bairro" value={driver?.district} />
                <Row
                  label="Cidade/UF"
                  value={[driver?.city, driver?.state].filter(Boolean).join(" / ") || null}
                />
                <Row label="CEP" value={driver?.zip_code} />
                <Row label="Observações" value={driver?.notes} />
              </dl>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cnh" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Carteira Nacional de Habilitação</CardTitle>
            </CardHeader>
            <CardContent>
              <dl>
                <Row label="Número" value={driver?.license_number} />
                <Row label="Categorias" value={driver?.cnh_categories?.join(", ") || null} />
                <Row label="Primeira habilitação" value={onlyDate(driver?.cnh_first_at)} />
                <Row label="Emissão" value={onlyDate(driver?.cnh_issued_at)} />
                <Row label="Validade" value={onlyDate(driver?.cnh_expires_at)} />
                <Row label="Situação" value={cnh.label} />
                <Row label="Observações" value={driver?.cnh_notes} />
              </dl>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="viagens" className="mt-4">
          <TripList trips={trips} empty="Nenhuma viagem vinculada a este motorista." />
        </TabsContent>

        <TabsContent value="agenda" className="mt-4">
          <TripList trips={upcoming} empty="Sem viagens futuras agendadas." />
        </TabsContent>

        <TabsContent value="historico" className="mt-4">
          <TripList trips={history} empty="Sem histórico de viagens." />
        </TabsContent>
      </Tabs>

      <DriverForm open={editOpen} driver={driver ?? null} onOpenChange={setEditOpen} />
    </AppShell>
  );
}

interface TripListItem {
  id: string;
  code: number;
  destination_text: string;
  departure_at: string;
  return_at: string;
  status: string;
  requester_name: string | null;
  vehicles: { plate: string; manufacturer: string; model: string } | null;
}

function TripList({ trips, empty }: { trips: TripListItem[]; empty: string }) {
  if (trips.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
        {empty}
      </p>
    );
  }
  return (
    <ul className="grid gap-3">
      {trips.map((t) => (
        <li
          key={t.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4 text-sm"
        >
          <div>
            <p className="font-medium">
              #{t.code} · {t.destination_text}
            </p>
            <p className="text-muted-foreground">
              {fmtDateTime(t.departure_at)} — {fmtDateTime(t.return_at)}
              {t.vehicles ? ` · ${t.vehicles.plate}` : ""}
            </p>
          </div>
          <StatusBadge status={t.status} />
        </li>
      ))}
    </ul>
  );
}
