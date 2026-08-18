# Plano de Redesign do Cronograma - Frota SRE

Vou reformular a página de Cronograma para que o calendário ocupe 100% da largura, seguindo a referência visual fornecida, mantendo toda a lógica de negócio e funcionalidades existentes.

## Alterações Propostas

### 1. Layout Base (`AppShell.tsx`)
- Adicionar uma prop `fullWidth` ao `AppShell` para permitir que páginas específicas (como o Cronograma) ignorem o limite de `max-w-7xl`.
- Ajustar o container principal para remover as margens laterais quando `fullWidth` for ativado.

### 2. Cabeçalho e Indicadores (`agenda-publica.tsx`)
- Reorganizar o topo da página para incluir os indicadores resumidos (Total, Aprovadas, Aguardando, Em andamento) com dados reais.
- Alinhar os controles de visualização (Semana, Dia, Mês, Lista) e navegação temporal à direita.

### 3. Grade do Calendário (`agenda-publica.tsx`)
- Expandir a grade para 100% da largura disponível.
- Aumentar a altura mínima das células dos dias para `min-h-[180px]` (ou proporcional ao viewport) para melhor distribuição.
- Refinar a separação visual das células com bordas sutis.
- Adicionar destaque discreto para o "Dia Atual" (círculo no número).

### 4. Cards de Viagem (`agenda-publica.tsx`)
- Reformular a hierarquia visual dos cards internos:
    - **Hora** (em destaque).
    - **CIDADE** (Caixa alta, negrito).
    - **Local** (Texto menor, truncado).
- Ajustar as cores para usar os tokens de setores já existentes, garantindo legibilidade.
- Implementar o limite de exibição de itens por dia com o botão "+ X viagens".

### 5. Filtros e Interações (`agenda-publica.tsx`)
- Manter o painel de filtros como um "Sheet" lateral ou popover que não empurra o conteúdo do calendário.
- Garantir que o clique em dias vazios continue abrindo a nova solicitação com a data pré-preenchida.
- Preservar a abertura do `TripDrawer` ao clicar em uma viagem.

## Detalhes Técnicos

- **Componentes:** shadcn/ui (Cards, Buttons, Badges), Lucide React para ícones.
- **Animações:** Framer Motion para transições de meses e abertura de filtros.
- **Responsividade:** Uso de classes utilitárias do Tailwind (flex-row no desktop, stack no mobile para cabeçalho).
- **Dados:** Continuar usando o hook `useAgendaTrips` e `useMemo` para filtragem.

Não haverá alterações no banco de dados ou nas permissões de acesso.
