# Firebase Storage CORS / Upload Troubleshooting

Este guia resolve o erro de upload (preflight 404 / CORS error / `storage/canceled`) visto ao tentar enviar avatar em desenvolvimento (`localhost:3000`).

## Sintomas Observados
- Network tab mostra requisições OPTIONS e POST para `https://firebasestorage.googleapis.com/v0/b/<bucket>/o?name=...` com Status 404 (preflight) ou `CORS error`.
- Console: `Access to XMLHttpRequest ... has been blocked by CORS policy: Response to preflight request doesn't pass access control check`.
- SDK retorna erro `Firebase Storage: User canceled the upload/download. (storage/canceled)` mesmo sem cancelar.
- Progresso fica travado em `Enviando 0%`.

## Causa
O bucket GCS do Firebase Storage não possui política CORS permitindo os headers usados pelo upload resumível (x-goog-upload-*) e/ou o domínio `http://localhost:3000` ainda não está habilitado.

## Passo 1 – Domínios autorizados no Firebase Auth
A tela de Authentication > Configurações só aceita nomes de domínio (sem porta). Para desenvolvimento já existe normalmente `localhost`. NÃO tente adicionar `localhost:3000` (vai rejeitar). Para outros hosts, adicione apenas o host (ex: `dev.fixflow.local`).

## Passo 2 – Regras do Storage (para testes anônimos)
Garanta que regras permitem usuários autenticados anonimamente:
```
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if request.auth != null; // anônimo OK
    }
  }
}
```
Depois ajuste para algo mais restrito em produção.

## Passo 3 – Configurar CORS no bucket
É feito via Google Cloud Storage (gsutil). Isso NÃO é definido nas "Rules". Criar arquivo `cors.json` local:
```json
[
  {
    "origin": ["http://localhost:3000"],
    "method": ["GET", "POST", "PUT", "DELETE", "HEAD", "OPTIONS"],
    "responseHeader": [
      "Content-Type",
      "Authorization",
      "x-goog-resumable",
      "x-goog-meta-*",
      "x-goog-upload-command",
      "x-goog-upload-header-content-length",
      "x-goog-upload-header-content-type",
      "x-goog-upload-protocol",
      "x-goog-upload-status",
      "x-goog-upload-url"
    ],
    "maxAgeSeconds": 3600
  }
]
```
Adicione depois o domínio de produção, ex: `"https://fix-flow-web.vercel.app"`.

### Instalar gcloud (Windows PowerShell)
1. Baixar installer: https://cloud.google.com/sdk/docs/install
2. Após instalar, abrir PowerShell e rodar:
```
gcloud init
```
Selecione o projeto: `fix-flow-45f6e`.

### Aplicar CORS
No diretório onde salvou `cors.json`:
```
# Verificar bucket correto
gsutil ls -p fix-flow-45f6e

# Aplicar
gsutil cors set cors.json gs://fix-flow-45f6e.appspot.com

# Confirmar
gsutil cors get gs://fix-flow-45f6e.appspot.com
```
Saída esperada: o mesmo JSON (a ordem dos campos pode variar).

## Passo 4 – Limpar cache e retestar
1. Fechar aba do navegador.
2. Reabrir `http://localhost:3000/perfil`.
3. Fazer upload novamente. Esperado: progresso > 0%, sem erros CORS.

## Passo 5 – (Opcional) Upload simples somente
Se ainda estiver depurando, é possível desabilitar temporariamente upload resumível e usar apenas `uploadBytes`, mas **ainda exige CORS** em muitos cenários. Portanto aplicar CORS é a solução definitiva.

## Passo 6 – Produção
Atualize `cors.json` para incluir:
```json
"origin": ["http://localhost:3000", "https://fix-flow-web.vercel.app"]
```
Reaplique o comando `gsutil cors set`.

## Checklist Final
| Item | OK? |
|------|-----|
| Domínio `localhost` aparece em Authentication > Domínios autorizados |  |
| Regras do Storage permitem request.auth != null |  |
| CORS configurado (`gsutil cors get` mostra JSON) |  |
| Upload mostra progresso acima de 0% |  |
| Sem erros CORS no console |  |

## Troubleshooting extra
- Extensão de navegador (adblock / privacy) pode bloquear preflight. Teste em janela anônima sem extensões.
- API Key restrita a referrers: adicione `localhost` (sem porta) e o domínio de produção.
- Se continuar 404 em preflight: confirme nome exato do bucket (`fix-flow-45f6e.appspot.com`).

## Segurança
Não commite chaves privadas fora de arquivos `.env`. Este guia não altera código fonte sensível.

---
Se quiser, podemos criar script de verificação automática futuramente.
