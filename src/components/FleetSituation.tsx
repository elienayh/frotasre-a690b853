import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtDateTime, fmtTime } from "@/lib/frota";

/** Cards com o status atual de cada veículo, calculado no banco. */
export function FleetSituation() {
  const { data, isLoading } = useQuery({
    queryKey: ["fleet-now"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("fleet_now");
      if (error) throw error;
      return data;
    },
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-36 w-full" />
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
        Nenhum veículo cadastrado.
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {data.map((v) => (
        <Link
          key={v.vehicle_id}
          to="/admin/veiculos/$vehicleId"
          params={{ vehicleId: v.vehicle_id }}
          className="rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/50"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-display text-base font-semibold">
                {v.manufacturer} {v.model}
              </p>
              <p className="text-sm text-muted-foreground">{v.plate}</p>
            </div>
            <StatusBadge status={v.status} kind="fleet" />
          </div>
          <dl className="mt-4 space-y-1 text-sm">
            {v.detail ? (
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Detalhe</dt>
                <dd className="truncate text-right">{v.detail}</dd>
              </div>
            ) : null}
            {v.until_at ? (
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">
                  {v.status === "EM_VIAGEM" ? "Retorno" : "Até"}
                </dt>
                <dd>{fmtDateTime(v.until_at)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Próxima viagem</dt>
              <dd>
                {v.next_trip_at ? `${fmtDateTime(v.next_trip_at)}` : "Sem reservas"}
                {v.next_trip_at ? "" : ""}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Lugares</dt>
              <dd>{v.capacity}</dd>
            </div>
          </dl>
          <span className="sr-only">{fmtTime(v.next_trip_at)}</span>
        </Link>
      ))}
    </div>
  );
}
