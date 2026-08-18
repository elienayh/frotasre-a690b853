import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";


import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { fmtDateTime } from "@/lib/frota";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface NotificationRow {
  id: string;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
  link: string | null;
  type: string;
}

/** Sino único de notificações: lista pessoal, tempo real e navegação para o registro. */
export function NotificationsBell() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async (): Promise<NotificationRow[]> => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, title, body, read_at, created_at, link, type")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as NotificationRow[];
    },
  });

  // Atualização em tempo real: novas notificações aparecem sem recarregar a página.
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["notifications"] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  const unread = notifications.filter((n) => !n.read_at).length;

  const markRead = useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) return;
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const open = (n: NotificationRow) => {
    if (!n.read_at) markRead.mutate([n.id]);
    if (n.link) void navigate({ to: n.link });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative rounded-full hover:bg-accent/80 transition-all duration-300" aria-label="Notificações">
          <Bell className="h-5 w-5 text-muted-foreground" />
          {unread > 0 ? (
            <motion.span 
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-extrabold text-destructive-foreground ring-2 ring-background shadow-lg shadow-destructive/20"
            >
              {unread}
            </motion.span>
          ) : null}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-96 p-0 overflow-hidden rounded-2xl border-border/40 shadow-2xl backdrop-blur-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-semibold">
            Notificações {unread > 0 ? `(${unread} novas)` : ""}
          </p>
          {unread > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                markRead.mutate(notifications.filter((n) => !n.read_at).map((n) => n.id))
              }
            >
              Marcar lidas
            </Button>
          ) : null}
        </div>
        <ScrollArea className="max-h-96">
          {notifications.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">Nenhuma notificação.</p>
          ) : (
            <ul className="divide-y divide-border">
              {notifications.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => open(n)}
                    className={cn(
                      "w-full px-4 py-3 text-left transition-colors hover:bg-accent/60",
                      n.read_at ? "" : "bg-accent/40",
                    )}
                  >
                    <span className="flex items-center gap-2">
                      {n.read_at ? null : (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                      )}
                      <span className="text-sm font-medium text-foreground">{n.title}</span>
                    </span>
                    {n.body ? (
                      <span className="mt-1 block whitespace-pre-line text-sm text-muted-foreground">
                        {n.body}
                      </span>
                    ) : null}
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {fmtDateTime(n.created_at)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
