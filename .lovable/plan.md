# Redesign do Cronograma - Frota SRE

O objetivo é transformar o calendário mensal atual em uma agenda operacional robusta, com múltiplas visualizações (Semana, Dia, Mês, Lista), priorizando a legibilidade e o fluxo de trabalho administrativo.

## Mudanças Propostas

### 1. Estrutura de Navegação e Visualização
- Adicionar seletor de visualização (Tabs ou ToggleGroup) na barra superior: **Semana (padrão)**, **Dia**, **Mês**, **Lista**.
- Implementar indicadores de resumo dinâmicos: Total de viagens, Aprovadas, Aguardando, Em andamento.

### 2. Visualização Semana (Principal)
- Layout em colunas (SEG a DOM).
- Cabeçalhos com dia, número e contador de viagens.
- Cards grandes organizados cronologicamente, com hierarquia visual clara:
  - Horário e Destino em destaque.
  - Subtítulo com Local/Solicitante.
  - Detalhes compactos de Veículo e Motorista.
  - Status via badge colorido.

### 3. Visualização Dia
- Agenda vertical com coluna de horários à esquerda.
- Cards amplos à direita, suportando múltiplas viagens no mesmo horário.

### 4. Visualização Lista
- Tabela operacional com colunas de Horário, Destino, Origem, Solicitante, Veículo, Motorista e Status.
- Suporte a ordenação e filtros.

### 5. Visualização Mês (Simplificada)
- Cards compactos (Horário · Destino).
- Indicador "+X viagens" para dias lotados.
- Clique no dia muda para a visão "Dia".

### 6. Detalhes e Ações
- Unificar o uso do `TripDrawer` para abertura lateral ao clicar em qualquer card de viagem.
- Padronizar os cards em todo o sistema para manter a consistência visual (hierarquia Horário > Destino > Local > Recursos).

## Detalhes Técnicos
- **Roteamento:** Utilizar estados do TanStack Router para gerenciar a visualização selecionada e o cursor de data.
- **Componentes:** 
  - Criar sub-componentes especializados: `TimelineWeek`, `TimelineDay`, `TimelineList`, `TimelineMonth`.
  - Reutilizar `useAgendaTrips` e hooks de filtros existentes.
  - Utilizar `shadcn/ui` (Tabs, Table, Badge, Card).
  - Animações suaves com `framer-motion` na troca de visualizações.
- **Responsividade:** Implementar scroll horizontal na visão Semana em telas mobile.

## User Experience
- **Filtros:** Manter o comportamento colapsável com badge de contagem.
- **Cores:** Utilizar cores de status para os cards de viagem, facilitando a identificação imediata da situação operacional.
