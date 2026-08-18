# Plano de Reforma da Gestão de Usuários — UX/UI

Este plano descreve a reformulação da página de Gestão de Usuários para melhorar a eficiência visual, busca e navegação, focando em cards compactos e totalmente clicáveis.

## 🎨 Design e UI

- **Cards Compactos**: Reduzir drasticamente a altura e remover espaços vazios.
- **Layout de Grade/Lista**: Organizar usuários em cards horizontais no desktop e verticais no mobile.
- **Feedback Visual**: Implementar `cursor: pointer`, elevação no hover e um ícone discreto `›` à direita.
- **Badges de Função**: Padronizar cores das permissões (Coordenador, Credenciado, Admin, Super Admin).
- **Busca e Filtros**: Adicionar barra de busca em tempo real e painel de filtros recolhível.

## 🛠️ Implementação Técnica

### 1. Refatoração da Rota de Listagem (`src/routes/_authenticated/admin.usuarios.tsx`)
- Implementar estado local para busca (`search`) e filtros (`filters`).
- Utilizar `useQuery` para buscar perfis e integrar com o novo server function `getUsersEmails` para permitir busca por e-mail.
- Filtragem em tempo real no frontend para melhor performance.
- Substituir o grid atual por uma estrutura de lista de cards compactos.
- Garantir que o componente `Link` do TanStack Router envolva todo o conteúdo do card para clique funcional.

### 2. Aperfeiçoamento da Ficha Individual (`src/routes/_authenticated/admin.usuarios.$userId.tsx`)
- Adicionar botão "← Voltar para usuários" destacado.
- Garantir persistência (se possível via query params) da busca ao voltar.

### 3. Server Functions (`src/integrations/supabase/admin.functions.ts`)
- Implementar `getUsersEmails` para permitir que o administrador busque usuários pelo e-mail do Auth.

### 4. Componentes e Estilos
- Criar `UserFilters` como sub-componente para gestão de filtros (Ativos, Inativos, Administradores, etc.).
- Utilizar `Skeleton` para estados de carregamento.

## 🔍 Verificação e Testes

- Validar responsividade em dispositivos móveis e desktop.
- Confirmar que o clique em qualquer parte do card redireciona corretamente.
- Testar a busca por Nome, Matrícula, E-mail e Setor.
- Verificar se usuários inativos são visualmente distinguidos.

**Nota:** Nenhuma alteração será feita na lógica de banco de dados, RLS ou processos de autenticação existentes.
