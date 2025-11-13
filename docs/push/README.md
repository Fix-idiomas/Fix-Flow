# Web Push & FCM (Fix Flow)

Este documento descreve como configurar, testar e manter o fluxo de Push Notifications Web usando Firebase Cloud Messaging (FCM) dentro do projeto Fix Flow.

## Objetivos
- Obter permissão do usuário para notificações.
- Registrar token FCM atrelado ao `firebase_uid` do usuário anônimo / autenticado.
- Persistir token em `push_tokens` (Supabase) e marcar o usuário como apto a receber push.
- Suportar múltiplos tokens por usuário (multi‑device / multi‑browser / rota incognito).
- Permitir renovação automática quando o token expira ou a permission muda.

## Visão Geral da Arquitetura
Fluxo principal:
1. Client carrega e inicializa Firebase (`src/lib/fcm.ts`).
2. Autentica anonimamente (ou usuário já autenticado) e obtém `firebase_uid`.
3. Solicita `Notification.requestPermission()` quando apropriado (hook `usePushNotifications`).
4. Obtém `messaging.getToken` com `NEXT_PUBLIC_FCM_VAPID_KEY`.
5. Envia POST para `/api/push/register-token` com header `x-firebase-uid` e body `{ token, platformMeta }`.
6. Server (route handler) usa Supabase *service role* para: upsert em `users`, upsert em `push_tokens`, atualizar flags (`has_push_token = true`, `last_push_registered_at`).
7. Futuro: enviar push via Cloud Function / Supabase Edge Function / servidor Next API.

## Pastas & Arquivos Relevantes
- `public/firebase-messaging-sw.js` – Service Worker (placeholder, expandir futuramente para foreground handling, analytics ou clique em notification).
- `src/lib/fcm.ts` – Inicialização Firebase + obtenção de token.
- `src/lib/hooks/usePushNotifications.ts` – Hook de estado e fluxo de permissão/registro.
- `src/app/push-test/page.tsx` – Página de teste manual para dev.
- `src/app/api/push/register-token/route.ts` – Endpoint server para persistir token.
- `docs/db/ddl.flow.sql` – DDL que define tabelas `users` e `push_tokens`.

## Variáveis de Ambiente Necessárias
Adicionar em `.env.local` e na plataforma (ex: Vercel):
```
# Firebase (exemplo – já existentes)
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...

# FCM Web Push (VAPID)
NEXT_PUBLIC_FCM_VAPID_KEY=BD...xxxx

# Supabase (server side)
SUPABASE_SERVICE_ROLE_KEY=... (NÃO expor no client)
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
```
Checklist:
- [ ] Chave VAPID gerada no Firebase Console (Configuração > Cloud Messaging > Web Push certificates).
- [ ] `firebase-messaging-sw.js` disponível em produção (domínio raiz).
- [ ] Keys replicadas em Vercel (Production / Preview / Development).

## Estrutura das Tabelas (Resumo)
### users
Campos relevantes: `id (uuid)`, `firebase_uid (text unique)`, `has_push_token (bool)`, `last_push_registered_at (timestamptz)`, etc.

### push_tokens
Campos: `id (uuid)`, `user_id (uuid FK users)`, `token (text unique)`, `platform (text)`, `ua (text)`, `created_at`, `last_seen_at`.

## Fluxo de Registro (Detalhado)
1. Hook detecta ausência de token válido e permissão ainda não concedida → exibe CTA.
2. Usuário clica “Ativar notificações”.
3. `requestPermission()` retorna `granted` → obtém token FCM.
4. POST `/api/push/register-token` body:
```json
{
  "token": "<fcm_token>",
  "platformMeta": {
    "platform": "web",
    "userAgent": "<navigator.userAgent>",
    "language": "pt-BR"
  }
}
```
Headers: `x-firebase-uid: <uid>`.
5. Resposta `{ ok: true }`.
6. Estado local atualiza para `registered` e UI pode ocultar CTA.

## Renovação / Expiração
- FCM tokens podem expirar; o hook pode chamar `getToken()` em intervalos (ex: ao montar ou a cada reload) e comparar com o último registrado.
- Se novo token != antigo → reenviar POST para registrar.

## Boas Práticas de UX
- Solicitar permissão somente após ação explícita.
- Exibir benefício claro (“Receba lembretes de estudo e progresso”).
- Tratar `denied` oferecendo instruções para reativar nas configurações do navegador.

## Envio de Notificações (Futuro)
Opções:
1. Cloud Function Firebase usando Admin SDK para `sendToDevice`.
2. Supabase Edge Function chamando FCM HTTP v1 API.
3. Route handler Next.js server-side (cuidado com cold start / latência).

Recomendações iniciais:
- Manter um micro módulo `src/lib/push/send.ts` (futuro) com função `sendPush({ userId, title, body, data })`.
- Batch: coletar tokens ativos (`last_seen_at` < 30 dias) e enviar em lotes de ~500.

## Erros & Troubleshooting
| Sintoma | Causa Provável | Ação |
|--------|----------------|------|
| `messaging` null | Firebase app não inicializado | Verificar variáveis e inicialização em `fcm.ts` |
| 403 /api/push/register-token | Header `x-firebase-uid` ausente | Garantir auth anônima antes de chamar |
| Token vazio | Permissão não concedida | Checar `Notification.permission` e fluxo UX |
| Duplicação de tokens | Mesmo token enviado várias vezes | Upsert já evita; ok |
| Notificação não aparece | SW ausente ou permissão bloqueada | Confirmar `firebase-messaging-sw.js` na raiz e permissão | 

## Teste Manual Rápido
1. Acessar `/push-test`.
2. Clicar em “Ativar notificações”.
3. Aprovar permissão do navegador.
4. Verificar que mostra o token (string longa) e status “registered”.
5. Conferir no banco `push_tokens` (query manual no Supabase) que a linha existe.

## Consultas SQL Úteis
Listar tokens de um usuário:
```sql
select * from push_tokens pt
join users u on u.id = pt.user_id
where u.firebase_uid = 'UID_AQUI';
```
Limpar tokens órfãos (exemplo – rodar com cuidado):
```sql
delete from push_tokens
where user_id not in (select id from users);
```

## Segurança & Hardening
- Substituir cabeçalho simples por verificação de ID Token Firebase (decodificar e validar assinatura) antes de confiar no `firebase_uid`.
- Adicionar rate limit (ex: 20 req / hora / IP) ao endpoint de registro.
- Armazenar `last_seen_at` em heartbeat para tokens ativos (ex: ao abrir app).
- Planejar remoção de tokens devolvendo erro `NotRegistered` no momento do envio.

## Roadmap Próximo
- Implementar `/api/auth/init` com verificação de ID token.
- Persistir avatar do usuário e flag `has_avatar`.
- Implementar envio de push para lembretes de estudo.
- Criar utilitário de broadcast segmentado (ex: por streak de estudo, ranking semanal).

## Checklist de Produção
- [ ] SW versionado e deployado.
- [ ] Verificação de ID token implementada.
- [ ] Rate limiting básico.
- [ ] Logs estruturados de registro de token (user_id, token hash, UA, IP truncado).
- [ ] Rotina de limpeza de tokens antigos (>90 dias).
- [ ] Mecanismo de envio validado com 1 notificação real.

---
Manter este documento atualizado sempre que o fluxo evoluir (novos campos, novos endpoints, mudanças de UX).
