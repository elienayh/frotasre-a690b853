import re

file_path = 'src/routes/_authenticated/admin.veiculos.$vehicleId.tsx'
with open(file_path, 'r') as f:
    content = f.read()

# 1. Update imports
imports_pattern = r'import \{.*?\} from "@\/lib\/frota";'
new_imports = '''import {
  fmtDate,
  fmtDateTime,
  fmtKm,
  fmtTime,
  isoToLocalInput,
  localInputToIso,
  todayInput,
  FLEET_STATUS_LABEL,
  calculateAutonomy,
} from "@/lib/frota";'''
content = re.sub(imports_pattern, new_imports, content, flags=re.DOTALL)

# Add Gauge and other icons
icons_pattern = r'ArrowLeft, Plus, TriangleAlert, Wrench, Fuel, Activity, History'
if 'Gauge' not in content:
    content = content.replace(icons_pattern, icons_pattern + ', Gauge, Settings, AlertTriangle')

# Add VehicleMaintenanceCard import
if 'VehicleMaintenanceCard' not in content:
    content = content.replace('import { AuditTimeline } from "@/components/AuditTimeline";', 'import { AuditTimeline } from "@/components/AuditTimeline";\nimport { VehicleMaintenanceCard } from "@/components/VehicleMaintenanceCard";')

# 2. Add Odometer history query
odo_query = '''  const { data: odometerHistory = [] } = useQuery({
    queryKey: ["vehicle-odometer", vehicleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("odometer_history")
        .select("*, profiles(full_name)")
        .eq("vehicle_id", vehicleId)
        .order("recorded_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });'''

if 'odometerHistory' not in content:
    content = content.replace('  const { data: fuels = [] } = useQuery({', odo_query + '\n\n  const { data: fuels = [] } = useQuery({')

# 3. Add Odometer history tab
if '<TabsTrigger value="hodometro">Hodômetro</TabsTrigger>' not in content:
    content = content.replace('<TabsTrigger value="abastecimento">Abastecimento</TabsTrigger>', '<TabsTrigger value="abastecimento">Abastecimento</TabsTrigger>\n          <TabsTrigger value="hodometro">Hodômetro</TabsTrigger>')

# 4. Update Overview Tab with Maintenance Progress and better UI
preventive_section = '''<TabsContent value="geral" className="mt-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="md:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base font-bold uppercase tracking-wider">Dados do Veículo</CardTitle>
                <div className="rounded-full bg-primary/10 p-2">
                  <Info className="h-4 w-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                  {[
                    ["Placa", <span className="rounded bg-muted px-2 py-0.5 font-bold ring-1 ring-border">{vehicle?.plate}</span>],
                    ["Marca / Fabricante", vehicle?.manufacturer],
                    ["Modelo", vehicle?.model],
                    ["Ano / Modelo", vehicle?.year ?? "—"],
                    ["Tipo de Veículo", vehicle?.vehicle_type ?? "—"],
                    ["Combustível", vehicle?.fuel ?? "—"],
                    ["Capacidade", `${vehicle?.capacity ?? "—"} pessoas`],
                    ["Patrimônio / ID", vehicle?.asset_number ?? "—"],
                    ["Hodômetro Atual", <span className="flex items-center gap-1 font-bold text-primary"><Gauge className="h-3.5 w-3.5" /> {fmtKm(vehicle?.odometer)}</span>],
                    ["Status Operacional", <StatusBadge status={vehicle?.base_status ?? "DISPONIVEL"} kind="fleet" className="h-5" />],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="flex justify-between gap-4 border-b border-border/50 py-2.5">
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className="text-right font-medium">{value ?? "—"}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base font-bold uppercase tracking-wider">Manutenção Preventiva</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                 <VehicleMaintenanceCard vehicle={vehicle} />
                 
                 <div className="rounded-lg border border-warning/20 bg-warning/5 p-4 text-xs text-warning-foreground">
                    <div className="flex items-center gap-2 font-bold uppercase tracking-wider mb-2">
                      <AlertTriangle className="h-4 w-4" />
                      Aviso de Segurança
                    </div>
                    As revisões devem ser realizadas rigorosamente conforme o manual do fabricante ou a cada 10.000km rodados.
                 </div>
              </CardContent>
            </Card>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-bold uppercase tracking-wider">Observações Adicionais</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground italic">
                {vehicle?.notes || "Nenhuma observação registrada para este veículo."}
              </p>
            </CardContent>
          </Card>
        </TabsContent>'''

content = re.sub(r'<TabsContent value="geral".*?<\/TabsContent>', preventive_section, content, flags=re.DOTALL)

# 5. Add Odometer Tab content
odo_tab_content = '''<TabsContent value="hodometro" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base font-bold uppercase tracking-wider">Histórico do Hodômetro</CardTitle>
              <Gauge className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {odometerHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum histórico de quilometragem registrado.</p>
              ) : (
                <div className="relative overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-border text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">Data/Hora</th>
                        <th className="px-4 py-3 text-right">Anterior</th>
                        <th className="px-4 py-3 text-right">Novo</th>
                        <th className="px-4 py-3 text-right">Percurso</th>
                        <th className="px-4 py-3">Origem</th>
                        <th className="px-4 py-3">Registrado por</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {odometerHistory.map((h: any) => (
                        <tr key={h.id} className="hover:bg-muted/30">
                          <td className="px-4 py-3 whitespace-nowrap">{fmtDateTime(h.recorded_at)}</td>
                          <td className="px-4 py-3 text-right font-mono text-muted-foreground">{h.old_value?.toLocaleString() ?? "—"} km</td>
                          <td className="px-4 py-3 text-right font-mono font-bold">{h.new_value.toLocaleString()} km</td>
                          <td className="px-4 py-3 text-right font-mono text-primary">
                            {h.old_value ? `+${(h.new_value - h.old_value).toLocaleString()} km` : "—"}
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn(
                              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ring-inset",
                              h.origin === 'trip_start' ? "bg-info/10 text-info ring-info/30" :
                              h.origin === 'trip_end' ? "bg-success/10 text-success ring-success/30" :
                              h.origin === 'manual' ? "bg-warning/10 text-warning ring-warning/30" :
                              "bg-muted text-muted-foreground ring-border"
                            )}>
                              {h.origin === 'trip_start' ? "Saída Viagem" :
                               h.origin === 'trip_end' ? "Retorno Viagem" :
                               h.origin === 'manual' ? "Manual" :
                               h.origin === 'maintenance' ? "Manutenção" :
                               h.origin === 'fuel' ? "Abastecimento" : h.origin}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{h.profiles?.full_name || "Sistema"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>'''

if '</TabsContent>' in content:
    content = content.replace('</Tabs>', odo_tab_content + '\n      </Tabs>')

with open(file_path, 'w') as f:
    f.write(content)
