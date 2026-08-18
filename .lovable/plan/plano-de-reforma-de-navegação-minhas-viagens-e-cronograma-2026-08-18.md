# Plano de Reforma de Navegação — Minhas Viagens e Cronograma

O objetivo é simplificar a experiência do usuário consolidando "Painel", "Minhas Solicitações" e "Minhas Viagens" em uma única área centralizada ("Minhas Viagens") e renomeando o Calendário para "Cronograma", adicionando interações para agilizar novas solicitações.

## Alterações de Navegação e UX

1.  **Consolidação de Menus:**
    *   Remover "Painel" e "Minhas Solicitações" do menu lateral para usuários comuns.
    *   Manter "Minhas Viagens" como a central pessoal.
    *   Renomear "Calendário de Viagens" para "Cronograma" e defini-lo como item principal (preservando como Home se já for o caso).

2.  **Nova Página "Minhas Viagens":**
    *   A página `/viagens` será reconstruída para reunir todas as solicitações e viagens onde o usuário é solicitante, motorista ou ocupante.
    *   Implementar sistema de abas: [Todas] [Próximas] [Aguardando] [Realizadas] [Canceladas].
    *   Adicionar barra de busca.
    *   Os cards de viagem serão padronizados e clicáveis, abrindo o `TripDrawer` existente.

3.  **Melhorias no "Cronograma" (/agenda-publica):**
    *   Renomear o título da página para "Cronograma".
    *   Adicionar interação de clique em espaços vazios do calendário para abrir o formulário de "Solicitar Viagem" (`/solicitacoes/nova`) com a data pré-preenchida.
    *   Garantir que cliques em viagens existentes continuem abrindo os detalhes (TripDrawer), sem conflito com a criação.

## Detalhes Técnicos

### 1. Navegação (`src/components/AppShell.tsx`)
*   Atualizar `SERVER_ITEMS` para refletir os novos nomes e ocultar itens redundantes.
*   Garantir que o "Cronograma" esteja no topo.

### 2. Página Minhas Viagens (`src/routes/_authenticated/viagens.tsx`)
*   Implementar query unificada no Supabase buscando:
    *   `requester_id` igual ao usuário.
    *   `assigned_driver_user_id` igual ao usuário.
    *   Participação na tabela `trip_occupants` (via subquery ou join).
*   Estrutura de abas usando `Tabs` do shadcn/ui.
*   KPIs rápidos no topo (ex: "3 próximas", "1 aguardando").

### 3. Cronograma (`src/routes/_authenticated/agenda-publica.tsx`)
*   Envolver as células do calendário em um componente clicável.
*   Passar a data via state ou query param para `/solicitacoes/nova`.

### 4. Formulário de Viagem (`src/components/TripForm.tsx`)
*   Ler a data inicial de um search param `initialDate`.

## Plano de Execução

1.  **Fase 1: Ajuste de Navegação** - Modificar `AppShell.tsx`.
2.  **Fase 2: Reforma de Minhas Viagens** - Reconstruir `viagens.tsx` com filtros e lógica de busca abrangente.
3.  **Fase 3: Interação do Cronograma** - Adicionar a função de "Nova Solicitação ao clicar no dia" em `agenda-publica.tsx`.
4.  **Fase 4: Integração de Dados** - Ajustar `TripForm.tsx` para aceitar a data sugerida.
5.  **Fase 5: Cleanup** - Remover rotas redundantes (`painel.tsx`, `solicitacoes.index.tsx`) ou transformá-las em redirects para `viagens.tsx`.

---
*Nota: Nenhuma regra de negócio ou permissão de banco de dados será alterada.*
