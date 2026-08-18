# Plano de Atualização UX/UI — Calendário e Detalhes de Viagem

Melhorar a legibilidade e a hierarquia visual do calendário de viagens e refatorar o painel de detalhes para uma apresentação mais clara das informações, especialmente ocupantes e condutores.

## Alterações

### 🎨 UI Architect
- **Calendário (`agenda-publica.tsx`)**:
    - Simplificar o card do evento: mostrar apenas Horário, Cidade (em destaque/UPPERCASE) e Local/Destino (em fonte menor/secundária).
    - Remover a placa do veículo do card.
    - Aplicar cores baseadas no setor/status à tipografia da cidade.
    - Garantir que o card suporte quebra de linha para destinos longos (até 2 linhas).
    - Melhorar responsividade no mobile (largura total).
- **Painel de Detalhes (`TripDrawer.tsx`)**:
    - Reordenar campos: 1. Cidade, 2. Local, 3. Data/Hora, 4. Status, 5. Veículo, 6. Motorista, 7. Ocupantes, 8. Motivo...
    - Exibir nomes dos ocupantes diretamente na lista principal.
    - Diferenciar claramente Motorista dos Ocupantes.
    - Mostrar contagem de ocupantes vs capacidade (ex: "3 de 5").
    - Implementar seção de "Capacidade" detalhada (Lugares, Motorista, Ocupantes, Total).
- **Lista de Ocupantes (`OccupantsList.tsx`)**:
    - Ajustar estilos para melhor hierarquia.
    - Exibir claramente o status "RECUSOU PARTICIPAÇÃO" para quem declinou.
    - Mostrar Setor/Matrícula como informação secundária quando disponível.

### 🔍 Code Auditor
- Validar se a remoção da placa do card não afeta a funcionalidade de clique.
- Garantir que a lógica de "Ocupante Externo" e "Recusado" permaneça funcional no backend/Supabase.
- Verificar se a hierarquia visual no `TripDrawer` mantém a acessibilidade.

## Detalhes Técnicos
- Utilizar tokens `oklch` para cores dinâmicas por setor no calendário.
- Manter o uso de `fmtTime` e `tripCity` para consistência.
- Assegurar que o `OccupantsList` continue permitindo a gestão (inclusão/remoção) para perfis autorizados, mesmo com o novo layout.
