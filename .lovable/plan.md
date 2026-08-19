# Plano de Implementação: Unificação Estrutural do Odômetro

Este plano visa consolidar o controle de quilometragem dos veículos em uma "Fonte Única de Verdade", integrando todos os módulos (Viagens, Manutenção, Abastecimento e Organização do Dia) ao odômetro oficial do veículo.

## 1. Alterações no Banco de Dados (Supabase)
- Criar trigger `update_vehicle_odometer_on_trip_finish` para atualizar a tabela `vehicles` e inserir no `odometer_history` automaticamente ao concluir viagens.
- Criar trigger `update_vehicle_odometer_on_manual_adjustment` para registrar ajustes manuais e atualizações de manutenção.
- Reforçar RLS para garantir que `odometer` em `vehicles` só seja atualizado via fluxos autorizados.

## 2. Componente Centralizado de Odômetro
- Refatorar `src/components/TripMileageDialog.tsx` para se tornar o componente padrão de atualização de KM em todo o sistema.
- Adicionar suporte a "Motivo da Alteração" e validações de segurança (KM novo >= KM atual).
- Permitir override por Administradores/Super Admins com registro de justificativa.

## 3. Integração nos Módulos

### Módulo de Viagens
- **Saída:** Pré-preencher KM de saída com o odômetro atual; permitir ajuste por motoristas autorizados.
- **Retorno:** Registrar KM de retorno e disparar a atualização do odômetro oficial do veículo.
- **Cálculo:** Exibir distância percorrida nos detalhes da viagem (`KM retorno - KM saída`).

### Módulo de Manutenção
- Remover a necessidade de informar o KM atual manualmente ao registrar manutenções.
- Recalcular barras de progresso preventivas em tempo real com base no odômetro oficial centralizado.

### Módulo de Abastecimento
- Utilizar o odômetro oficial para registrar novos abastecimentos.
- Permitir correção do KM no ato do abastecimento apenas para usuários com permissão de ajuste.

### Ficha e Cards de Veículo
- Exibir o odômetro oficial sincronizado em todos os cards e na ficha técnica.
- Adicionar botão "Atualizar Odômetro" na ficha do veículo (apenas para Admin/Motorista SRE).

## 4. Histórico e Auditoria
- Garantir que toda alteração (Viagem, Manutenção, Abastecimento, Ajuste Manual) gere um registro detalhado em `odometer_history` com `old_value`, `new_value`, `source`, `recorded_by` e `reason`.

## Detalhes Técnicos
- Utilização de `useQueryClient.invalidateQueries()` para garantir que a interface reflita a nova quilometragem imediatamente sem refresh.
- Validação no frontend e backend para impedir que quilometragens retrocedam, exceto via intervenção de Super Admin.
