import re

file_path = 'src/routes/_authenticated/admin.veiculos.index.tsx'
with open(file_path, 'r') as f:
    content = f.read()

# 1. Update imports
imports_pattern = r'import \{ createFileRoute, Link \} from "@tanstack/react-router";.*?import \{ fmtDateTime, fmtKm, isoToLocalInput, localInputToIso, FLEET_STATUS_LABEL \} from "@\/lib\/frota";'
new_imports = '''import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { 
  CalendarRange, 
  FileText, 
  Pencil, 
  Plus, 
  Trash2, 
  Wrench, 
  Gauge, 
  Fuel, 
  Users, 
  ChevronRight,
  Info
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fmtDateTime, fmtKm, isoToLocalInput, localInputToIso, FLEET_STATUS_LABEL } from "@/lib/frota";
import { VehicleMaintenanceCard } from "@/components/VehicleMaintenanceCard";
import { cn } from "@/lib/utils";'''

content = re.sub(imports_pattern, new_imports, content, flags=re.DOTALL)

# 2. Update VehicleRow interface
vehicle_row_pattern = r'interface VehicleRow \{.*?\}'
new_vehicle_row = '''interface VehicleRow {
  id: string;
  plate: string;
  manufacturer: string;
  model: string;
  year: number | null;
  vehicle_type: string | null;
  fuel: string | null;
  capacity: number;
  asset_number: string | null;
  odometer: number;
  notes: string | null;
  is_active: boolean;
  last_oil_change_km?: number | null;
  next_oil_change_km?: number | null;
  last_tire_change_km?: number | null;
  next_tire_change_km?: number | null;
  last_alignment_km?: number | null;
  next_alignment_km?: number | null;
  last_balancing_km?: number | null;
  next_balancing_km?: number | null;
}'''
content = re.sub(vehicle_row_pattern, new_vehicle_row, content, flags=re.DOTALL)

# 3. Update query select
select_pattern = r'manufacturer, model, year, vehicle_type, fuel, capacity, asset_number, odometer, notes, is_active'
new_select = 'manufacturer, model, year, vehicle_type, fuel, capacity, asset_number, odometer, notes, is_active, last_oil_change_km, next_oil_change_km, last_tire_change_km, next_tire_change_km, last_alignment_km, next_alignment_km, last_balancing_km, next_balancing_km'
content = content.replace(select_pattern, new_select)

# 4. Update vehicle card in the list
card_pattern = r'<li key=\{v\.id\}.*?<\/li>'
new_card = '''<li key={v.id} className="group relative flex flex-col overflow-hidden rounded-xl border border-border/50 bg-card transition-all hover:border-primary/30 hover:shadow-md">
                <Link 
                  to="/admin/veiculos/$vehicleId" 
                  params={{ vehicleId: v.id }}
                  className="absolute inset-0 z-0"
                />
                
                <div className="relative z-10 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-display text-lg font-bold tracking-tight text-foreground">
                          {v.manufacturer} {v.model}
                        </p>
                        <StatusBadge
                          status={v.is_active ? (status?.status ?? "DISPONIVEL") : "INATIVO"}
                          kind="fleet"
                          className="h-5"
                        />
                      </div>
                      <p className="text-sm font-medium text-muted-foreground">
                        <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-bold text-foreground ring-1 ring-border">
                          {v.plate}
                        </span>
                        {v.year ? ` · ${v.year}` : ""}
                        {v.asset_number ? ` · Pat: ${v.asset_number}` : ""}
                      </p>
                    </div>
                    <div className="hidden group-hover:block">
                       <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <div className="rounded-full bg-primary/10 p-2">
                        <Gauge className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Hodômetro</p>
                        <p className="text-sm font-semibold">{fmtKm(v.odometer)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="rounded-full bg-success/10 p-2">
                        <Users className="h-4 w-4 text-success" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Capacidade</p>
                        <p className="text-sm font-semibold">{v.capacity} lug.</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="rounded-full bg-warning/10 p-2">
                        <Fuel className="h-4 w-4 text-warning" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Combustível</p>
                        <p className="text-sm font-semibold">{v.fuel || "—"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="rounded-full bg-info/10 p-2">
                        <Info className="h-4 w-4 text-info" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Tipo</p>
                        <p className="text-sm font-semibold truncate max-w-[80px]">{v.vehicle_type || "—"}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 space-y-4">
                    <VehicleMaintenanceCard vehicle={v} />
                    
                    <div className="space-y-1 rounded-md border border-border/40 bg-muted/20 p-2.5 text-xs text-muted-foreground">
                      <p className="flex justify-between">
                        <span>Próxima viagem:</span>
                        <span className="font-medium text-foreground">
                          {status?.next_trip_at
                            ? `${fmtDateTime(status.next_trip_at)}`
                            : "nenhuma"}
                        </span>
                      </p>
                      {block && (
                        <p className="flex justify-between text-warning">
                          <span>Em manutenção:</span>
                          <span className="font-medium truncate ml-2">{block.workshop || "Oficina"}</span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="relative z-20 mt-auto grid grid-cols-2 divide-x divide-border border-t border-border">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="rounded-none h-10 text-xs hover:bg-muted"
                    onClick={() => openForm(v)}
                  >
                    <Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="rounded-none h-10 text-xs hover:bg-muted"
                    onClick={() => {
                      setNextStatus(status?.status ?? "DISPONIVEL");
                      setStatusFor(v);
                    }}
                  >
                    <Wrench className="mr-1.5 h-3.5 w-3.5" /> Status
                  </Button>
                </div>
              </li>'''
content = re.sub(card_pattern, new_card, content, flags=re.DOTALL)

with open(file_path, 'w') as f:
    f.write(content)
