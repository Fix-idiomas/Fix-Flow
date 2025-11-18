# Supabase — Esquema atual e introspecção

Este documento registra o estado atual do schema (somente leitura) e como inspecionar rapidamente tabelas/colunas. Fonte: introspecção via código e resultados compartilhados do ambiente vigente.

Atualizado em: 2025-11-13

## Tabelas disponíveis (schema public)

| table_name  |
| ----------- |
| push_tokens |
| users       |

Observação: a tabela `user_private` (CPF/telefone/endereço) pode estar presente no seu ambiente. Veja também o arquivo `docs/db/policies.user_private.sql` para habilitar RLS adequada.

## users — colunas atuais

| column_name         | data_type                | nullable | default              |
| ------------------- | ------------------------ | -------- | -------------------- |
| id                  | uuid                     | NO       | gen_random_uuid()    |
| firebase_uid        | text                     | NO       |                      |
| display_name        | text                     | NO       |                      |
| avatar_url          | text                     | YES      |                      |
| onboarding_completed| boolean                  | NO       | false                |
| legacy_linked       | boolean                  | NO       | false                |
| push_opt_in         | boolean                  | NO       | false                |
| push_last_token_at  | timestamp with time zone | YES      |                      |
| status              | text                     | NO       | 'active'             |
| created_at          | timestamp with time zone | NO       | now()                |

Ausentes (para dados pessoais): `full_name`, `email`.

### Vínculo Auth→DB (promoção de anônimo)

- Chave canônica: `users.firebase_uid` (único). Este campo referencia o UID do Firebase Auth e é o elo entre autenticação e o banco principal.
- Promoção de conta: o endpoint `POST /api/auth/promote` (no app) verifica o ID token via Firebase Admin, faz upsert em `public.users` por `firebase_uid` e atualiza `display_name`, `avatar_url` e, quando possível, `email`.
- Índices/constraints: garanta `users_firebase_uid_unique` e, opcionalmente, `users_email_unique` em `lower(email)` (quando `email` existir). Use `GET /api/db/check-indexes` para validar rapidamente.
- RLS: endpoints de servidor usam a Service Role (bypass RLS). Acesso direto via cliente deve permanecer restrito; usuários não devem escrever em `public.users` diretamente com a chave `anon`/`authenticated`.
- Magic Link e preservação de UID: quando o link é concluído no mesmo dispositivo do login anônimo, usamos `linkWithCredential` para manter o `firebase_uid` e preservar progresso. Em outro dispositivo, pode ocorrer `signInWithEmailLink` e gerar um novo UID — por isso há avisos na UI para finalizar no mesmo dispositivo.

## push_tokens — colunas atuais

| column_name | data_type                | nullable | default                               |
| ----------- | ------------------------ | -------- | ------------------------------------- |
| id          | bigint                   | NO       | nextval('push_tokens_id_seq'::regclass) |
| user_id     | uuid                     | NO       |                                       |
| token       | text                     | NO       |                                       |
| platform    | text                     | NO       | 'web'                                  |
| user_agent  | text                     | YES      |                                       |
| created_at  | timestamp with time zone | NO       | now()                                  |
| revoked_at  | timestamp with time zone | YES      |                                       |

Índices/constraints recomendados (confirmar no ambiente):
- Unique em `token` (ex.: `create unique index if not exists push_tokens_token_unique on public.push_tokens(token);`).
- FK `user_id -> users.id` (cascade delete desejável).

## Rotas úteis de introspecção (read-only)

- `GET /api/db/introspect` — verifica existência de tabelas e colunas relevantes (não altera schema).
- `GET /api/db/check-indexes` — verifica índices/constraints úteis (não altera schema). Se a função RPC estiver ausente, retorna o SQL para criá-la.

Exemplo de resposta (resumo):
```json
{
  "ok": true,
  "checks": {
    "users": { "exists": true, "columns": { "full_name": false, "email": false, "display_name": true, "firebase_uid": true } },
    "push_tokens": { "exists": true, "columns": { "token": true, "created_at": true } },
    "user_private": { "exists": false, "columns": {} }
  }
}
```

### Verificação de índices/constraints

1) Abra `GET /api/db/check-indexes` no navegador. Se vier `requiresSetup: true`, copie o SQL retornado e rode no Supabase SQL Editor para criar a função `public.db_check_indexes()`.

2) Recarregue `GET /api/db/check-indexes`. O retorno indicará, por booleanos, se os índices/constraints existem:
- `users_firebase_uid_unique`
- `users_email_unique` (opcional)
- `push_tokens_token_unique`
- `push_tokens_user_id_fk`

3) Se algo estiver ausente ou duplicado, aplique o script idempotente em `docs/db/fixes.indexes.sql` no Supabase SQL Editor.

SQL da função de checagem:
- `docs/db/check-indexes.sql` define `public.db_check_indexes()` que retorna JSON com indicadores:
  - `users_firebase_uid_unique`
  - `users_email_unique`
  - `push_tokens_token_unique`
  - `push_tokens_user_id_fk`

## Impacto na aplicação

- A UI de perfil envia dados pessoais para `POST /api/profile/update-sensitive`.
  - Se `users.full_name` e `users.email` não existirem, a API ignora esses campos e retorna `warnings`.
  - Se `user_private` não existir, CPF/telefone/endereço são ignorados com aviso.
  - Nenhuma migração é feita automaticamente pelo app.

## RLS recomendada para user_private

Para permitir que o próprio usuário leia/crie/atualize/exclua seus dados via UI (cliente autenticado), ative RLS e aplique policies de “proprietário”. No Supabase SQL Editor:

```sql
-- Habilitar RLS e políticas owner-only
alter table public.user_private enable row level security;

create policy if not exists user_private_select_own on public.user_private for select to authenticated using (uid = auth.uid());
create policy if not exists user_private_insert_own on public.user_private for insert to authenticated with check (uid = auth.uid());
create policy if not exists user_private_update_own on public.user_private for update to authenticated using (uid = auth.uid()) with check (uid = auth.uid());
create policy if not exists user_private_delete_own on public.user_private for delete to authenticated using (uid = auth.uid());

-- Constraints sugeridas
alter table public.user_private add constraint if not exists user_private_uid_pk primary key (uid);
create unique index if not exists user_private_cpf_unique on public.user_private (cpf) where cpf is not null;
```

Opcional:
- “Travar CPF após definido”: substitua a policy de UPDATE por uma que permita alterar CPF apenas se `old.cpf is null` (ver `docs/db/policies.user_private.sql`).
- “View mascarada”: exponha apenas `cpf_masked` em uma view de leitura e continue escrevendo na tabela base.

Nota: a Service Role (usada pelos endpoints do Next.js) ignora RLS; policies impactam apenas acesso direto com `anon`/`authenticated` do cliente.

### Estratégias para correção de CPF

Para permitir correção segura de CPF (evitar erro de digitação sem abrir brecha para trocas arbitrárias):

- Janela de correção: permitir mudar o CPF por um período após a primeira definição (ex.: 24h).
- Até verificação: permitir alterações enquanto `cpf_verified_at` estiver nulo; após verificar (ex.: SMS/email/documento), bloquear.
- Override administrativo: um admin pode limpar `cpf_verified_at` para permitir nova correção.

DDL e policy exemplo (ver também `docs/db/policies.user_private.sql`):

```sql
alter table public.user_private add column if not exists cpf_set_at timestamptz;
alter table public.user_private add column if not exists cpf_verified_at timestamptz;

create or replace function public.set_cpf_timestamp()
returns trigger language plpgsql as $$
begin
  if tg_op in ('INSERT','UPDATE') then
    if new.cpf is distinct from old.cpf then
      new.cpf_set_at := now();
      new.cpf_verified_at := null; -- reset verify on change
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists trg_user_private_cpf_set_at on public.user_private;
create trigger trg_user_private_cpf_set_at before insert or update on public.user_private
  for each row execute function public.set_cpf_timestamp();

-- UPDATE policy (substitui a padrão):
create or replace policy user_private_update_own_cpf_grace
on public.user_private
for update to authenticated
using (uid = auth.uid())
with check (
  uid = auth.uid()
  and (
    old.cpf = new.cpf
    or age(now(), coalesce(old.cpf_set_at, old.created_at)) < interval '24 hours'
    or old.cpf_verified_at is null
  )
);
```

## Próximos passos sugeridos (migrações)

Somente aplicar após validar necessidade com `GET /api/db/introspect`.

1) `users`: adicionar `full_name` e `email` (único em lowercase)
```sql
alter table public.users add column if not exists full_name text;
alter table public.users add column if not exists email text;
create unique index if not exists users_email_unique on public.users (lower(email)) where email is not null;
create unique index if not exists users_firebase_uid_unique on public.users (firebase_uid);
```

2) `user_private`: criar tabela de PII (CPF/telefone/endereço)
```sql
create table if not exists public.user_private (
  uid text primary key,
  cpf varchar(11) unique,
  phone_e164 varchar(20),
  address_street text,
  address_number text,
  address_complement text,
  address_neighborhood text,
  address_city text,
  address_state char(2),
  address_cep char(8),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- FK opcional
alter table public.user_private
  add constraint if not exists user_private_uid_fkey
  foreign key (uid) references public.users(firebase_uid) on delete cascade;

create index if not exists user_private_cpf_idx on public.user_private (cpf);
```

3) `push_tokens`: garantir unicidade e FKs
```sql
create unique index if not exists push_tokens_token_unique on public.push_tokens (token);
alter table public.push_tokens
  add constraint if not exists push_tokens_user_id_fkey
  foreign key (user_id) references public.users(id) on delete cascade;
create index if not exists push_tokens_user_id_idx on public.push_tokens (user_id);
```

---

Para inspeção manual detalhada, veja também `docs/db/discovery.sql` (consultas somente leitura para tabelas, colunas, índices, RLS e policies).

Resumo do que foi commitado

APIs
auth/init: retorna cpf (sem máscara), phone e endereço completo de user_private; mantém fullName/email de users.
profile/update-sensitive: salva e devolve cpf/phone/endereço completos; remove máscara; inclui mais campos no select de retorno.
profile/update-basic: resposta inclui fullName e email para consistência.
db/introspect (novo): rota de introspecção read-only de tabelas/colunas.
UI
perfil/page.tsx: reidrata telefone, CPF e endereço após refresh; valida e envia CPF bruto; hidrata fullName e email.
Docs
docs/db/README.md: estado do schema, introspecção, RLS recomendada e estratégias para correção de CPF.
docs/db/policies.user_private.sql: script RLS owner-only completo e opções (janela de correção, verificação).
docs/db/discovery.sql: expandido com consultas úteis.
Qualidade

Build/Typecheck: PASS
Lint: PASS
Deploy

O push foi feito no branch main; seu provedor (p.ex. Vercel) deve iniciar o build automaticamente. Se quiser, posso acompanhar logs e validar um smoke test quando estiver no ar.
