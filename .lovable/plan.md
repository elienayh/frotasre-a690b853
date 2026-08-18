# Redesign UX/UI — Frota SRE

Reformulação visual completa para transformar o sistema em uma aplicação moderna, administrativa e operacional, mantendo a integridade total das funcionalidades e dados.

## Mudanças

### Visual e Temas
- **Tema Híbrido**: Implementação de sistema de temas (Claro/Escuro) com preferência persistente no localStorage (padrão inicial: Claro).
- **Glassmorphism**: Aplicação de transparências sutis e `backdrop-blur` no cabeçalho e cards principais.
- **Paleta de Cores**: Refinamento dos tokens OKLCH no `styles.css` para garantir contraste e estética moderna em ambos os temas.
- **Tipografia**: Ajuste fino da hierarquia usando Archivo (títulos) e Public Sans (corpo).

### Componentes de Interface
- **Sidebar Dinâmica**: Modernização do menu lateral com suporte a estados expandido/compacto e animações suaves.
- **Header Premium**: Reconstrução do cabeçalho com título de contexto, alternador de tema, notificações e perfil do usuário.
- **Cards & Badges**: Padronização global de cards (hover, elevação) e badges (pills) para status.
- **Microinterações**: Adição de transições via Framer Motion para entradas de página e feedbacks visuais (hover, focus).

### Experiência do Usuário (UX)
- **Skeleton Loading**: Implementação de estados de carregamento para Dashboard e Calendário.
- **Dashboard Operacional**: Modernização visual dos KPIs e indicadores da DAFI sem alterar os dados.
- **Calendário**: Refinamento visual dos eventos no calendário mensal para facilitar identificação por cores.
- **Responsividade**: Adaptação completa para mobile, incluindo menu lateral em Sheet e cards de largura total.

## Detalhes Técnicos
- Uso de `next-themes` ou lógica customizada no `__root.tsx` para persistência de tema.
- Atualização de variáveis `@theme` no `styles.css` para o novo design system.
- Refatoração do `AppShell.tsx` para acomodar a nova Sidebar e Header.
- Manutenção rigorosa das tabelas, RLS e `createServerFn` existentes.

## Checklist de Segurança
- [x] Nenhuma alteração em RLS ou permissões.
- [x] API keys e secrets permanecem protegidos.
- [x] Persistência de tema segura no cliente.
