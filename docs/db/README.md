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
