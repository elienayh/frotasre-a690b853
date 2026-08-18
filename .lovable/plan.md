# Correção da Gestão de Manutenção Preventiva

Este plano detalha as correções para o erro de coluna inexistente no Supabase e a melhoria visual das barras de progresso de manutenção dos veículos, garantindo contraste adequado e lógica de cores precisa.

## Alterações Propostas

### 1. Banco de Dados (Supabase)
- **Correção da Coluna**: A coluna `next_alignment_change_km` não existe. O banco utiliza `next_alignment_km`.
- **Ação**: Renomear a chamada no frontend para usar a coluna correta do banco (`next_alignment_km`) e garantir que todas as manutenções (óleo, pneus, alinhamento, balanceamento) sigam o mesmo padrão de nomenclatura e persistência.

### 2. Componentes Frontend
- **VehicleMaintenanceCard.tsx**:
    - Aumentar o contraste das barras de progresso.
    - Implementar a lógica de cores por limiar:
        - 0-70%: Verde
        - 70-90%: Amarelo
        - 90-100%: Vermelho
        - \>100%: Vermelho Intenso pulsante + Texto "VENCIDA".
    - Exibir "KM restante" com valores negativos quando vencida.
    - Melhorar a legibilidade do estado "Sem histórico".
- **Ficha do Veículo (admin.veiculos.$vehicleId.tsx)**:
    - Corrigir a função `updateMaintenance` para usar os nomes de colunas corretos.
    - Atualizar os campos de input para refletir as mudanças e garantir salvamento imediato com feedback visual.

### 3. Lógica de Negócio
- Garantir que o cálculo de progresso considere o intervalo entre a última manutenção e a próxima planejada.
- Caso não haja última manutenção, usar uma representação visual neutra.

## Detalhes Técnicos

- **Interface de Dados**: Unificar as props e o tratamento de dados entre a listagem (Card) e a ficha detalhada.
- **Tailwind CSS**: Utilizar tokens `bg-success`, `bg-warning` e `bg-destructive` com variações de opacidade para as trilhas das barras.
- **Supabase client**: Garantir que o cache do TanStack Query seja invalidado após cada atualização manual.

## Verificação
- Testar salvamento de quilometragem no veículo Chevrolet S10 (Exemplo do usuário).
- Validar visualmente as cores em diferentes estágios de proximidade da manutenção.
- Confirmar persistência no banco via query.
