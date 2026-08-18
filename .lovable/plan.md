# Plano de Redesign e Gestão de Usuários (Supabase Auth)

Este plano detalha a reformulação da tela de usuários para um fluxo de "Ficha Individual", concentrando todas as ações administrativas em uma página dedicada e utilizando exclusivamente o Supabase Auth para gestão de senhas.

## 🟢 Fase 1: Fundação e Rotas
- Criar a nova rota para edição individual: `src/routes/_authenticated/admin.usuarios.$userId.tsx`.
- Criar a rota pública de redefinição de senha: `src/routes/redefinir-senha.tsx`.
- Registrar as novas rotas (automaticamente via TanStack Router).

## 🟡 Fase 2: Redesign da Listagem (`admin.usuarios.tsx`)
- Remover switches e botões (Editar, Viagens, Histórico) dos cards.
- Transformar o card em um resumo limpo: Nome, Setor, Matrícula e Badges de função.
- Tornar o card clicável, navegando para a nova rota de edição.
- Implementar efeitos de hover e cursor apropriados.
- Preservar os filtros e a busca existentes.

## 🔵 Fase 3: Ficha Individual do Usuário (`admin.usuarios.$userId.tsx`)
- Implementar seções organizadas:
  - **Dados do Usuário**: Nome, Matrícula, E-mail, Setor, Telefone, CPF, CNH.
  - **Funções e Permissões**: Switches para Login Ativo, Coordenador, Motorista SRE, Credenciado, Admin, Super Admin.
  - **Segurança**: Botão para disparar `supabase.auth.resetPasswordForEmail()`.
  - **Histórico**: Integração com `AuditTimeline`.
  - **Viagens**: Listagem de solicitações vinculadas ao usuário.
  - **Zona de Perigo**: Opção de exclusão (via desativação ou API administrativa).

## 🟣 Fase 4: Fluxo de Senha (Supabase Auth)
- Implementar `supabase.auth.resetPasswordForEmail()` com `redirectTo` apontando para `/redefinir-senha`.
- Na página `/redefinir-senha`, capturar o evento de recuperação e permitir `supabase.auth.updateUser({ password })`.
- Garantir que nenhuma senha seja trafegada ou armazenada nas tabelas da aplicação.

## 🔴 Fase 5: Segurança e Auditoria
- Registrar a solicitação de redefinição no `permission_history`.
- Validar permissões de Admin/Super Admin na nova página de edição.
- Garantir que a desativação do login (`is_active: false`) impeça o acesso imediato (já implementado no `useAuth.tsx`).

## Detalhes Técnicos
- **Supabase Auth**: Uso exclusivo para credenciais.
- **TanStack Router**: Uso de `$userId` para navegação dinâmica.
- **Framer Motion**: Transições suaves entre a lista e a ficha.
- **RLS**: Manutenção das políticas de segurança existentes.
