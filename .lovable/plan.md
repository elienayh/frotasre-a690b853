# Evolução Frota SRE - Fases 4 e 5

Este plano detalha a implementação do ciclo de vida do veículo (odômetro, manutenção preventiva e abastecimento) e o fechamento do sistema com matriz de permissões rigorosa e auditoria.

## Fase 4: Ciclo de Vida do Veículo

### Backend (Banco de Dados)
- Criar trigger `update_vehicle_odometer_on_fuel` que atualiza o odômetro da tabela `vehicles` sempre que um registro de abastecimento for inserido (se o odômetro informado for maior).
- Adicionar colunas em `vehicles`: `next_preventive_km` (int4) e `preventive_km_interval` (int4).
- Criar trigger `check_preventive_maintenance` que gera notificações automáticas para a DAFI quando o odômetro atual se aproximar do `next_preventive_km`.

### Frontend (UI/UX)
- **Ficha do Veículo (`admin/veiculos/$vehicleId`):**
  - Implementar visualização de progresso da manutenção preventiva (barra de km).
  - Adicionar aba "Abastecimento" com listagem e formulário rápido.
  - Alertas visuais (badges) de "Troca de óleo próxima" ou "Revisão necessária".
- **Dashboards:**
  - Card de "Frota em Alerta" no Painel da DAFI com veículos próximos da revisão km.

## Fase 5: Segurança e Auditoria

### Matriz de Permissões (RLS)
- Revisar `profiles` e `user_roles` para garantir que `super_admin` e `admin` tenham acesso total.
- Garantir que `is_coordinator` veja apenas solicitações de seu `sector`.
- Garantir que usuários comuns (`servidor`) vejam apenas suas próprias solicitações e as caronas aprovadas.

### Histórico e Logs
- Implementar componente `AuditTimeline` que lê de `trip_history` e `permission_history`.
- Exibir quem aprovou, quem alterou motorista e quem finalizou a viagem em todas as telas de detalhe.

## Arquivos Envolvidos
- `supabase/migrations/[data]_fase_4_5_core.sql`
- `src/routes/_authenticated/admin.veiculos.$vehicleId.tsx`
- `src/components/FleetAlerts.tsx` (Novo)
- `src/hooks/useFleet.ts`
- `src/lib/frota.ts` (Helpers de km e autonomia)
