# Plano de Implementação: Motorista por Destino e Controle de Ocupação

Refatoração do formulário de solicitação de viagem para permitir a definição de motorista individual por parada, controle visual de ocupação (1 motorista + 4 passageiros) e integração automática do motorista na lista de ocupantes.

## 1. Banco de Dados e Backend (Supabase)
- **RLS e Notificações**: Criar uma trigger/função para notificar motoristas (via `notifications`) quando forem atribuídos ou alterados em `trip_stops.driver_user_id`.
- **Histórico**: Garantir que as alterações em `driver_user_id` sejam registradas na auditoria (usando a estrutura de `permission_history` ou similar, se aplicável, ou logs de `trip_stops`).

## 2. Refatoração de Componentes (Frontend)

### `src/components/TripStops.tsx`
- **Campo de Motorista**: Adicionar um campo `ComboBox` em cada card de parada para selecionar o motorista.
- **Padrão**: O valor inicial será `null` (representando "DAFI DEFINIR").
- **Opções**:
    - "DAFI DEFINIR" (valor `null`).
    - "EU" (usuário logado, se `is_driver_certified`).
    - Lista de usuários ativos e credenciados (`is_driver_certified` e `is_active`).
- **Props**: Receber o perfil do usuário logado para validar credencial.

### `src/components/TripForm.tsx`
- **Lógica de Ocupação**:
    - A capacidade total é fixa em 5 (1 motorista + 4 passageiros).
    - Mudar o campo "Número de ocupantes" para "Número de passageiros" (limite máximo 4).
    - O sistema deve calcular `Total = Motoristas Únicos + Passageiros Selecionados`.
- **Sincronização**:
    - Quando um motorista é selecionado em qualquer parada, ele deve ser bloqueado na lista de passageiros (ou removido dela se já estiver lá) para evitar duplicidade.
    - Se "DAFI DEFINIR" for mantido, a vaga do motorista continua reservada na contagem de capacidade.
- **Visualização**: Adicionar seção "OCUPAÇÃO DO VEÍCULO" com o resumo: Motorista, Lista de Passageiros, Total/5 e Vagas Restantes.

### `src/components/OccupantsPicker.tsx`
- **Exclusão**: Passar a lista de motoristas selecionados nas paradas como `exclude` para o seletor de ocupantes/passageiros.

## 3. Fluxo de Envio e Edição
- **Payload**: O `driver_user_id` será salvo na tabela `trip_stops` para cada destino.
- **Trip Request**: O campo `suggested_driver` e `requested_driver_id` na tabela pai `trip_requests` podem ser preenchidos com o motorista do primeiro destino ou mantidos nulos se a lógica for puramente por parada agora.

## Detalhes Técnicos
- Utilizar a prop `is_driver_certified` do perfil para habilitar a opção "EU".
- Validar no `handleReview` se `Total de Ocupantes (Motoristas + Passageiros) <= 5`.
- As notificações usarão a tabela `notifications` já integrada ao sistema de "sino".

---
*Este plano foca na experiência do usuário e na integridade dos dados de ocupação, sem alterar as regras de aprovação da DAFI.*
