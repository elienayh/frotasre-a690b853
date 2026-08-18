import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fmtDateTime } from "@/lib/frota";
import { History, User, Lock, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface AuditTimelineProps {
  entityId: string;
  entityType: "trip" | "user" | "vehicle";
}

export function AuditTimeline({ entityId, entityType }: AuditTimelineProps) {
  const { data: history = [], isLoading } = useQuery({
    queryKey: ["audit-history", entityId, entityType],
    queryFn: async () => {
      if (entityType === "trip") {
        const { data, error } = await supabase
          .from("trip_history")
          .select("*, actor:profiles!trip_history_actor_id_fkey(full_name)")
          .eq("trip_id", entityId)
          .order("created_at", { ascending: false });
        if (error) throw error;
        return data.map(item => ({
          id: item.id,
          date: item.created_at,
          actor: item.actor?.full_name ?? "Sistema",
          action: item.action,
          details: item.field_changed ? `${item.field_changed}: ${item.old_value} → ${item.new_value}` : item.notes,
          type: "trip"
        }));
      } else {
        const { data, error } = await supabase
          .from("permission_history")
          .select("*, actor:profiles!permission_history_actor_id_fkey(full_name)")
          .eq("target_user_id", entityId)
          .order("created_at", { ascending: false });
        if (error) throw error;
        return data.map(item => ({
          id: item.id,
          date: item.created_at,
          actor: item.actor?.full_name ?? "Sistema",
          action: item.action,
          details: item.field_changed ? `${item.field_changed}: ${item.old_value} → ${item.new_value}` : "",
          type: "permission"
        }));
      }
    }
  });

  if (isLoading) return <p className="text-xs text-muted-foreground">Carregando histórico...</p>;
  if (history.length === 0) return <p className="text-xs text-muted-foreground">Nenhum registro encontrado.</p>;

  return (
    <div className="space-y-4">
      <div className="relative space-y-4 before:absolute before:left-2.5 before:top-0 before:h-full before:w-px before:bg-border">
        {history.map((item) => (
          <div key={item.id} className="relative pl-8">
            <span className={cn(
              "absolute left-0 top-1 flex h-5 w-5 items-center justify-center rounded-full border bg-background",
              item.type === "permission" ? "text-warning" : "text-primary"
            )}>
              {item.type === "permission" ? <Lock className="h-3 w-3" /> : <Activity className="h-3 w-3" />}
            </span>
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground">
                {fmtDateTime(item.date)} · {item.actor}
              </span>
              <span className="text-sm font-medium">{item.action}</span>
              {item.details && (
                <span className="text-xs text-muted-foreground italic">{item.details}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
