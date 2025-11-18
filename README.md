Fix Flow — Projeto e arquitetura

## Em poucas palavras
- DB principal próprio (Supabase) para o novo app.  
- Acesso parcial e somente leitura ao DB legado (Students/Sessions) para “conhecer” o aluno e seu histórico.  
- Firebase para camada de experiência (auth anônima, realtime/UX, FCM).  
- Sem escrita no legado; sem risco à UX/UI do site existente.

## Visão geral
- Web: Next.js 16 (App Router) + React 19
- UX/Realtime: Firebase (Auth anônima + Firestore para cache/tempo real + FCM)
- Dados principais: Supabase (Postgres) — fonte de verdade do Flow
- Dados legados: Supabase (outro projeto) — acesso read-only via views/usuário restrito

## Autenticação e Contas (estado atual)
- Mantemos o Firebase Auth para autenticação (anônima, Google e Magic Link).
- O banco principal é o Supabase. Os usuários são consolidados em `public.users` e vinculados por `users.firebase_uid`.
- Meta: permitir que o usuário anônimo preserve o progresso ao “promover” a conta, mantendo o mesmo `firebase_uid` e passando a funcionar em qualquer dispositivo.

Fluxos implementados:
- Anônimo: login automático ao abrir o app (Firebase Auth anônimo). Aparece um call-to-action para promover a conta.
- Google: `linkWithPopup` (se anônimo) ou `signInWithPopup` + chamada a `POST /api/auth/promote` para sincronizar/atualizar o usuário no Supabase.
- Magic Link: `sendSignInLinkToEmail` e página de conclusão em `/auth/complete-link`.
	- Se aberto no mesmo dispositivo: usamos `linkWithCredential` para manter o UID. Caso contrário, fazemos `signInWithEmailLink` (pode gerar outro UID, por isso incentivamos finalizar no mesmo dispositivo para preservar progresso).

Endpoint de promoção (server):
- `POST /api/auth/promote`
	- Verifica o ID token do Firebase (Admin SDK), upsert em `public.users` usando `firebase_uid`, e atualiza `display_name`, `avatar_url` e, quando possível, `email`.
	- Usa a chave Service Role do Supabase (bypass RLS) apenas no servidor.

Pós-login/promoção:
- Após Google ou Magic Link, redirecionamos para `/`.
- A home exibe um card para “Curso: Direct Principle” em `/curso/direct-principle` como primeiro ponto de entrada.

## Objetivos do Produto & MVP

### Problema que resolvemos
Dar ao aluno uma rotina simples e engajante de prática diária (atividade do dia + micro tarefas) que gere progresso visível e motivação (pontos / ranking), enquanto o professor tem o mínimo para publicar conteúdo e acompanhar evolução sem atrito.

### Público inicial
- Alunos existentes (já registrados no sistema legado) — acesso rápido via onboarding anônimo + hidratação de histórico.
- Professores internos / equipe pedagógica para validar publicação e métricas.

### Escopo MVP (Prioridade ↓)
1. Atividade do dia (placeholder + conclusão gera pontos)
2. Tarefas pessoais (CRUD simples, lembrete horário opcional futuro)
3. Pontuação e Leaderboard (top N público)
4. Feedback in-app (/feedback) para coleta qualitativa
5. Hidratação básica de perfil (últimas sessões do legado) — pós-deploy fase 2
6. Publicação manual de "daily_activity" (doc único) pelo professor (via console inicialmente)
7. Templates placeholder (PD_TEXT, PD_MC, etc.) só como rótulo, sem lógica completa

### Fora do MVP (post-launch)
- Chat/comunidade em tempo real
- Gamificação avançada (badges, streak calendar)
- Editor completo de templates com versionamento
- Loja / conquistas monetizadas
- Relatórios avançados (filtros por turma, evolução por habilidade)

### Métricas de sucesso (alfa testers)
- Time to first attempt < 60s após abrir o site
- ≥ 70% dos testers criam pelo menos 1 tarefa no primeiro dia
- Média de 3+ tentativas (atividade do dia ou inicial) por usuário na primeira semana
- Feedback positivo (≥ 60% classificam experiência "fácil" ou "muito fácil")
- Erros críticos (console / permission-denied) < 2% das sessões

### Guardrails
- Nenhum write no DB legado (somente leitura via views)
- Pontos oficiais calculados em Supabase; Firestore apenas cache UI
- Feature flags para integrar hidratação e cron leaderboard

### Release Plan (Resumo)
Dia 1: Deploy + smoke test + ativar pontos / tarefas
Dia 2: Coleta de feedback inicial + ajustes de UX
Dia 3–4: Hidratação de perfil (sessions recentes) + convite ampliado
Dia 5+: Refinar templates e iniciar medição de retenção

## Fluxo de dados (alto nível)
1) Aluno abre o app → autentica via Firebase (anônimo).  
2) Endpoint server (`/api/profile/hydrate`) consulta Supabase principal e, quando preciso, lê dados legados (read-only) para montar o perfil (últimos tópicos/sessões).  
3) UI usa Firestore para estados reativos (tarefas, presença) e/ou cache de ranking.  
4) Push notifications via FCM (tokens salvos no DB principal).  
5) Opcional: cron publica top N do leaderboard no Firestore a cada 10 minutos.

## Isolamento e segurança
- DB legado: usuário de conexão só com SELECT, consultando views específicas (sem PII desnecessária).  
- Nenhuma escrita no legado.  
- Feature flag para desligar integrações rapidamente.  
- Timeout/circuit breaker em chamadas ao legado para não impactar UX.

## Desenvolvimento local
- Node 18+ e npm  
- `.env.local` com chaves Firebase e Supabase

Rodar em dev:
```bash
npm run dev
```

Build produção local:
```bash
npm run build
npm start
```

## Rotas e Endpoints relevantes
- Páginas
	- `/` — Home (cards de entrada, incluindo “Direct Principle”).
	- `/curso/direct-principle` — Página inicial da trilha Direct Principle.
	- `/auth/complete-link` — Conclusão do Magic Link (linka UID anônimo quando possível).
- API (App Router)
	- `POST /api/auth/promote` — Valida token Firebase e sincroniza/atualiza usuário em `public.users` (via Service Role).
	- `GET /api/db/check-indexes` — Verifica integridade de índices/constraints essenciais; retorna JSON.
	- (Existente) `GET /api/db/introspect` — Leitura de esquema/colunas (read-only) para diagnóstico.

## Banco de dados (Supabase)

- Esquema atual, introspecção e migrações sugeridas: veja `docs/db/README.md`.
- Consultas úteis de descoberta (somente leitura): `docs/db/discovery.sql`.

### Índices e constraints indispensáveis
- Validação rápida via endpoint: `GET /api/db/check-indexes` → deve retornar algo como:
	```json
	{ "ok": true, "indexes": { "users_firebase_uid_unique": true, "users_email_unique": true, "push_tokens_token_unique": true, "push_tokens_user_id_fk": true }}
	```
- Caso o RPC helper não exista no banco, o endpoint retorna o SQL para criar a função.
- SQLs disponíveis:
	- `docs/db/check-indexes.sql` — Função `public.db_check_indexes()` (estável e apenas leitura)
	- `docs/db/fixes.indexes.sql` — Correções idempotentes (unique em `users.firebase_uid`, unique opcional em `lower(users.email)`, FK em `push_tokens.user_id`)

## Variáveis de ambiente
Firebase:
- NEXT_PUBLIC_FIREBASE_API_KEY
- NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
- NEXT_PUBLIC_FIREBASE_PROJECT_ID
- NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
- NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
- NEXT_PUBLIC_FIREBASE_APP_ID
- NEXT_PUBLIC_APP_ID

Firebase (Admin — servidor):
- FIREBASE_PROJECT_ID
- FIREBASE_CLIENT_EMAIL
- FIREBASE_PRIVATE_KEY  
	Observação: cuide da quebra de linhas/escapes no Vercel; usar `-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n`.

Supabase (projeto do Flow):
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY (server-side somente)

Supabase (legado):
- LEGACY_DB_URL ou credenciais de conexão (somente leitura)  
- LEGACY_DB_READONLY_USER / LEGACY_DB_READONLY_PASSWORD

Gemini (IA):
- GEMINI_API_KEY (obrigatório)
- GEMINI_MODEL_DEFAULT=gemini-2.5-flash (opcional)
- GEMINI_MODEL_COMPLEX=gemini-2.5-pro (opcional)

## Deploy (Vercel recomendado)
1) Conectar o repositório ao Vercel.  
2) Em Project Settings → Environment Variables (Production/Preview):
	- Firebase: NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, NEXT_PUBLIC_FIREBASE_PROJECT_ID, NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET, NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID, NEXT_PUBLIC_FIREBASE_APP_ID, NEXT_PUBLIC_APP_ID
	- Firebase Admin (Server): FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
	- Supabase (Flow): NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (apenas Server)
	- (Opcional) Legado: LEGACY_DB_URL ou credenciais read-only
3) Deploy automático na `main`.
4) Health check (server): acessar `/api/health` → `{ ok: true }`.
	- Observação: este endpoint valida apenas o ambiente serverless. Para testar conexão/regras do Firebase no cliente, use os helpers `tryWriteHealthPing`/`tryReadHealthPing`.

Autorização de domínios (Firebase Auth):
- Adicione `localhost` e seu domínio de produção para Google e Magic Link.
- Magic Link usa `actionCodeSettings` com `url` apontando para `/auth/complete-link` e `handleCodeInApp: true`.

Observação Next: se houver aviso de múltiplos lockfiles, remova o lockfile fora da pasta do projeto ou configure `outputFileTracingRoot`.

## IA (Gemini) — análise de atividades

- Endpoint: `POST /api/ai/analyze`
- Uso: avalia uma resposta curta do aluno com base em critérios simples e retorna pontuação por critério, comentário e sugestão de melhoria.
- Modelos: por padrão usa família 2.5 (flash -> barato/rápido, pro -> mais capaz). O serviço normaliza nomes (remove `models/` e mapeia família 1.5 para 2.5).

Body (JSON):
```json
{
	"task": "enunciado da atividade",
	"submission": "resposta do aluno",
	"criteria": ["clareza", "vocabulário", "gramática"],
	"mode": "auto|flash|pro",
	"premium": false
}
```

Notas:
- `mode`:
	- `flash`: força o modelo rápido (gemini-2.5-flash)
	- `pro`: força o modelo mais capaz (gemini-2.5-pro)
	- `auto` (padrão): escolhe com base no tamanho/complexidade ou `premium=true`
- Timeout: ~18s (com fallback curto). Em timeout retorna 504 com `{ error, timeout: true }`.
- Robustez: tenta parsear JSON do modelo; se falhar, entrega um fallback neutro para não quebrar a UX.

Resposta (exemplo simplificado):
```json
{
	"scores": { "clareza": 8.5, "vocabulário": 8.0, "gramática": 9.0 },
	"overallComment": "comentário breve",
	"improvementSuggestion": "sugestão breve",
	"confidence": 0.7,
	"modelUsed": "gemini-2.5-flash",
	"escalated": false,
	"rawTokensApprox": 420
}
```

Diagnóstico:
- `GET /api/ai/status` — verifica presença de chave e modelos default configurados
- `GET /api/ai/models` — lista modelos disponíveis (API v1)

## Páginas do MVP
- `/atividade-inicio` — primeira tentativa guiada (+50 pontos UX)  
- `/atividade` — placeholder do dia (+criar tarefa se vazio)  
- `/tarefas` — CRUD realtime  
- `/leaderboard` — ranking (pode usar cache Firestore)  
- `/feedback` — coleta de comentários dos testers

## Firestore (resumo de regras)
- Leitura pública do leaderboard.  
- Escrita limitada ao próprio UID em subcoleções de usuário.  
- Pontos no Firestore são para UX/cache; oficiais ficam no DB principal.

## Próximos passos
- Criar views no Supabase (Flow) e usuário read-only no legado.  
- Implementar `/api/profile/hydrate` (server-side) e feature flag da integração.  
- (Opcional) Cron de publicação do top N para Firestore.
