# Plano de Migração para Google OAuth Institucional — Frota SRE

Migrar o mecanismo de autenticação para uso exclusivo do Google OAuth com o domínio institucional `@educacao.mg.gov.br`, preservando perfis, permissões e histórico existentes.

## 🛠️ Alterações Estruturais

### 1. Backend e Segurança (Supabase)
- **Restrição de Domínio:** Implementar uma Trigger no banco de dados (`auth.users`) para validar o domínio do e-mail no momento da criação da conta.
- **RLS:** Garantir que as políticas existentes continuem protegendo os dados, já que o UUID do usuário permanecerá o mesmo.

### 2. Fluxo de Autenticação (Frontend)
- **Refatoração da Página de Login (`src/routes/auth.tsx`):**
    - Remover formulários de e-mail/senha.
    - Implementar botão "Entrar com Google".
    - Adicionar mensagens de erro específicas para domínio não autorizado.
- **Vinculação Automática:** O Supabase Auth lida com a vinculação de identidades quando o e-mail coincide. Se um usuário já existe no `auth.users` com o e-mail Google, o Supabase vincula a identidade ao invés de criar um novo usuário.
- **Hook de Auth (`src/hooks/useAuth.tsx`):** Garantir que a carga de perfil e roles continue funcionando perfeitamente após a troca de provedor.

### 3. Cadastro Complementar
- **Detecção de Cadastro Incompleto:** Se um novo usuário entrar, redirecionar para uma tela de "Completar Cadastro" para coletar CPF, Matrícula, Setor, etc.
- **Bloqueio de Funções:** Novos usuários receberão apenas a role `user` (padrão). Admin/Super Admin/Motorista devem ser atribuídos manualmente.

## 📝 Detalhes Técnicos

- **Trigger de Validação:**
```sql
CREATE OR REPLACE FUNCTION public.check_institutional_domain()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email NOT LIKE '%@educacao.mg.gov.br' THEN
    RAISE EXCEPTION 'Acesso restrito ao domínio @educacao.mg.gov.br';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```
- **Login via Google:**
```typescript
supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: `${window.location.origin}/auth/callback`,
    queryParams: { hd: 'educacao.mg.gov.br' }
  }
})
```

## ✅ Plano de Verificação
1. **Teste de Login Institucional:** Validar que `@educacao.mg.gov.br` acessa corretamente.
2. **Teste de Bloqueio:** Validar que `@gmail.com` é bloqueado.
3. **Teste de Preservação:** Entrar com um e-mail de administrador existente via Google e confirmar que as permissões foram mantidas.
4. **Teste de Novo Usuário:** Confirmar que um novo e-mail institucional cria um perfil com permissões básicas.
