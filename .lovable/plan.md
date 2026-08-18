# Plano de Reforma da Manutenção Preventiva por Quilometragem

Reformular a lógica de manutenção preventiva para basear-se no intervalo entre a última e a próxima manutenção, garantindo cálculos de progresso precisos, histórico estruturado e alertas visuais de alto contraste.

## 1. Banco de Dados (Supabase)

- Criar uma migration para garantir que a tabela `maintenance_history` possua as colunas necessárias para o novo fluxo:
    - `vehicle_id` (FK)
    - `maintenance_type` (OIL, TIRE, OIL_FILTER, AIR_FILTER, ALIGNMENT, BALANCING, OTHERS)
    - `performed_at_km` (KM da realização)
    - `performed_date` (Data da realização)
    - `next_planned_km` (Próxima troca configurada)
    - `notes` (Observações)
    - `recorded_by` (FK para profiles)
- Sincronizar estas informações com a tabela `vehicles` (colunas `last_*_km` e `next_*_km`) para facilitar a leitura no frontend.

## 2. Componente: VehicleMaintenanceCard

- Atualizar a lógica de cálculo de progresso:
    - `intervalo = próxima - última`
    - `percorrido = hodômetro_atual - última`
    - `progresso = percorrido / intervalo`
- Implementar estados visuais:
    - **NORMAL (Verde):** Distância segura.
    - **ATENÇÃO (Amarelo):** >= 70% do intervalo.
    - **CRÍTICO (Vermelho):** >= 90% do intervalo.
    - **VENCIDA (Vermelho Intenso):** `hodômetro >= próxima`. Exibir "X km acima do limite".
- Adicionar ícones para os novos tipos: Filtro de Óleo, Filtro de Ar.
- Garantir alto contraste nas barras e tooltips informativos.

## 3. Tela: Ficha do Veículo (`admin.veiculos.$vehicleId.tsx`)

- **Refatorar Aba Manutenção:**
    - Listar os tipos configurados com detalhes (Última, Próxima, Intervalo, KM Restante).
    - Adicionar botão "Registrar Manutenção" que abre um diálogo específico.
- **Diálogo de Registro:**
    - Campos: Tipo, Data, KM da realização, Próxima manutenção, Observações.
    - Validação: `Próxima > Última`.
    - Ao salvar: Inserir no histórico e atualizar o cabeçalho do veículo.
- **Ajuste na Edição Direta:** Permitir alterar apenas a "Próxima Manutenção" sem criar novo registro histórico de execução (apenas configuração de limite).

## 4. Integração e Sincronização

- Garantir que qualquer atualização no hodômetro do veículo (via viagens ou manual) dispare o recálculo imediato de todos os indicadores de progresso na interface.

## Detalhes Técnicos

- **Mapeamento de Tipos:**
    - OIL, TIRE, ALIGNMENT, BALANCING (Existentes).
    - OIL_FILTER, AIR_FILTER (Novos).
- **Cálculo Defensivo:** Tratar casos "S/ Histórico" (quando `last_km` é nulo) exibindo apenas a distância para a próxima e barra neutra.
