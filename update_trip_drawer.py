import re

file_path = 'src/components/TripDrawer.tsx'
with open(file_path, 'r') as f:
    content = f.read()

# 1. Add TripMileageDialog import
if 'TripMileageDialog' not in content:
    content = content.replace('import { AllocateDialog } from "@/components/AllocateDialog";', 
                             'import { AllocateDialog } from "@/components/AllocateDialog";\nimport { TripMileageDialog } from "@/components/TripMileageDialog";')

# 2. Add state for mileage dialog
if '[mileageOpen, setMileageOpen]' not in content:
    content = content.replace('const [allocating, setAllocating] = useState<TripRow | null>(null);', 
                             'const [allocating, setAllocating] = useState<TripRow | null>(null);\n  const [mileageMode, setMileageMode] = useState<"start" | "end">("start");\n  const [mileageOpen, setMileageOpen] = useState(false);')

# 3. Add mileage fields to display
mileage_fields = '''                <Separator />
                <section className="space-y-2">
                  <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground/70">Controle de Quilometragem</h3>
                  <dl className="space-y-2 text-sm">
                    <Field 
                      label="KM Saída" 
                      value={trip.odometer_start ? `${trip.odometer_start.toLocaleString()} km` : "—"} 
                    />
                    <Field 
                      label="KM Retorno" 
                      value={trip.odometer_end ? `${trip.odometer_end.toLocaleString()} km` : "—"} 
                    />
                    {trip.odometer_start && trip.odometer_end && (
                      <div className="flex justify-between gap-4 border-t border-border/50 pt-2 font-bold text-primary">
                        <dt>Percurso Total</dt>
                        <dd>{(trip.odometer_end - trip.odometer_start).toLocaleString()} km</dd>
                      </div>
                    )}
                  </dl>
                </section>'''

content = content.replace('<OccupantsList tripId={trip.id} requesterId={trip.requester_id} />', 
                         '<OccupantsList tripId={trip.id} requesterId={trip.requester_id} />\n' + mileage_fields)

# 4. Update DAFI actions to use Mileage Dialog
new_actions = '''<h3 className="font-display text-sm font-semibold">Ações da DAFI</h3>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAllocating(trip as unknown as TripRow)}
                      >
                        Editar transporte
                      </Button>
                      
                      {trip.status === "APROVADA" || trip.status === "PROGRAMADA" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-info text-info hover:bg-info/10"
                          onClick={() => {
                            setMileageMode("start");
                            setMileageOpen(true);
                          }}
                        >
                          Iniciar Viagem
                        </Button>
                      ) : null}

                      {trip.status === "EM_ANDAMENTO" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-success text-success hover:bg-success/10"
                          onClick={() => {
                            setMileageMode("end");
                            setMileageOpen(true);
                          }}
                        >
                          Finalizar
                        </Button>
                      ) : null}

                      <Button
                        variant="ghost"
                        size="sm"
                        className="col-span-2 text-destructive hover:bg-destructive/10"
                        onClick={() => changeStatus.mutate("CANCELADA")}
                      >
                        Cancelar viagem
                      </Button>
                    </div>'''

content = re.sub(r'<h3 className="font-display text-sm font-semibold">Ações da DAFI<\/h3>.*?<\/div>', 
                new_actions, content, flags=re.DOTALL)

# 5. Add TripMileageDialog component at the end of JSX
if '<TripMileageDialog' not in content:
    content = content.replace('<AllocateDialog trip={allocating} onClose={() => setAllocating(null)} />', 
                             '<AllocateDialog trip={allocating} onClose={() => setAllocating(null)} />\n      <TripMileageDialog\n        trip={trip}\n        vehicle={trip.vehicles}\n        isOpen={mileageOpen}\n        onOpenChange={setMileageOpen}\n        mode={mileageMode}\n        onSuccess={invalidate}\n      />')

with open(file_path, 'w') as f:
    f.write(content)
