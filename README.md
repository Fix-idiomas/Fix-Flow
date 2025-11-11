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

## Variáveis de ambiente
Firebase:
- NEXT_PUBLIC_FIREBASE_API_KEY
- NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
- NEXT_PUBLIC_FIREBASE_PROJECT_ID
- NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
- NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
- NEXT_PUBLIC_FIREBASE_APP_ID
- NEXT_PUBLIC_APP_ID

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
	- Supabase (Flow): NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (apenas Server)
	- (Opcional) Legado: LEGACY_DB_URL ou credenciais read-only
3) Deploy automático na `main`.
4) Health check (server): acessar `/api/health` → `{ ok: true }`.
	- Observação: este endpoint valida apenas o ambiente serverless. Para testar conexão/regras do Firebase no cliente, use os helpers `tryWriteHealthPing`/`tryReadHealthPing`.

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
