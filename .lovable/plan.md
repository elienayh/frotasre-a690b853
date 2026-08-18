# Plano de Reforma da Página "Aprovações"

Transformar a página de Aprovações em uma central de trabalho unificada para o DAFI/Admin, consolidando solicitações de viagem e carona em uma única fila de análise com filtros rápidos e design responsivo.

## Alterações Propostas

### 1. Refatoração da Página Principal (`src/routes/_authenticated/admin.solicitacoes.tsx`)
- **Unificação de Dados**: Buscar simultaneamente `trip_requests` e `ride_requests`.
- **Interface de Filtros**: Substituir as abas (`Tabs`) por uma barra de botões/chips: `[ Pendentes ] [ Programadas ] [ Aprovadas ] [ Carona ] [ Encerradas ]`.
- **Resumo Executivo**: Exibir no topo o total de itens aguardando análise (ex: "8 itens aguardando análise: 6 viagens e 2 caronas").
- **Busca e Filtragem Adicional**: Implementar busca por texto (cidade, solicitante, código) e popover para filtros avançados (setor, motorista, etc.).

### 2. Novos Cards de Aprovação
- **Layout de Grade**: Grade de duas colunas em desktop e coluna única em mobile.
- **Identidade Visual**: 
  - **Verde**: Viagens (faixa lateral ou indicador).
  - **Amarelo/Âmbar**: Caronas.
- **Conteúdo dos Cards**:
  - Viagem: Código, cidade, destino, datas/horários, solicitante, ocupantes, motivo, status.
  - Carona: Vínculo com viagem original, cidade, data/hora, solicitante, motivo.
- **Interatividade**: O card inteiro será clicável, abrindo os respectivos diálogos de ação (`AllocateDialog` para viagens ou um novo diálogo detalhado para caronas).

### 3. Gestão de Fluxos e Ações
- **Fluxo de Carona**: Integrar as ações de `RideRequestsPanel` em uma experiência de diálogo similar à de viagens.
- **Manutenção de Regras**: Preservar todas as lógicas de negócio existentes (definição de transporte, cálculo de ocupação, auditoria).

### 4. Sincronização em Tempo Real
- **Realtime**: Garantir que o contador do menu lateral (`AppShell.tsx`) e a listagem se mantenham sincronizados via Supabase Realtime (já implementado no `usePendingCounts`, garantindo consistência).

## Detalhes Técnicos

- **Hooks**: Criar/atualizar hooks para busca unificada de dados.
- **Componentes**:
  - `ApprovalCard`: Componente polimórfico para lidar com viagens e caronas.
  - `FilterBar`: Gerenciamento de estado dos filtros e contadores.
- **Roteamento**: Manter `/admin/solicitacoes`, mas remover a dependência de abas físicas na URL em favor de parâmetros de busca (`?filter=pending`).

---

### 📊 Relatório de Execução Previsto

- 🎨 **UI Architect** — ✅ Refatoração visual e novos componentes de card.
- 🗄️ **Supabase Engineer** — ➖ Sem alterações no esquema; apenas queries otimizadas.
- 🔍 **Code Auditor** — ✅ Garantia de performance em listas longas e acessibilidade.
- 🚀 **Deploy Ops** — ➖ Não necessário.
