import { NextResponse } from "next/server";

// Simple runtime guard (executa apenas no server)
export const dynamic = "force-dynamic"; // sempre server-side
export const runtime = "nodejs"; // garante Node runtime no Vercel

// Environment variables (configure em Vercel e .env.local)
const API_KEY = process.env.GEMINI_API_KEY;
const DEFAULT_MODEL = process.env.GEMINI_MODEL_DEFAULT || "gemini-1.5-flash-latest";
const COMPLEX_MODEL = process.env.GEMINI_MODEL_COMPLEX || "gemini-1.5-pro-latest";

// Timeout helper
async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => reject(new Error("timeout")), ms);
    p.then(v => { clearTimeout(id); resolve(v); }, e => { clearTimeout(id); reject(e); });
  });
}

// Very small schema validator (evita dependência extra). If we later add zod, replace.
interface AnalyzeRequestBody {
  task: string;          // enunciado da atividade
  submission: string;    // resposta do aluno
  criteria?: string[];   // ex.: ["clareza","vocabulário","gramática"]
  mode?: "auto" | "flash" | "pro"; // seleção manual ou automática
  premium?: boolean;     // se true força upgrade (ex: revisão premium)
}

interface AnalysisResponse {
  scores: Record<string, number>;
  overallComment: string;
  improvementSuggestion: string;
  confidence: number; // 0..1
  modelUsed: string;
  escalated: boolean;
  rawTokensApprox?: number;
}

function validateBody(b: any): { ok: true; data: AnalyzeRequestBody } | { ok: false; error: string } {
  if (!b || typeof b !== "object") return { ok: false, error: "Body inválido" };
  if (!b.task || typeof b.task !== "string") return { ok: false, error: "'task' obrigatório" };
  if (!b.submission || typeof b.submission !== "string") return { ok: false, error: "'submission' obrigatório" };
  if (b.criteria && (!Array.isArray(b.criteria) || b.criteria.some((c: any) => typeof c !== "string"))) {
    return { ok: false, error: "'criteria' deve ser array de strings" };
  }
  if (b.mode && !["auto", "flash", "pro"].includes(b.mode)) {
    return { ok: false, error: "'mode' inválido" };
  }
  return { ok: true, data: b as AnalyzeRequestBody };
}

function buildPrompt(input: AnalyzeRequestBody, model: string) {
  const criteria = input.criteria && input.criteria.length > 0 ? input.criteria : ["clareza", "vocabulário", "gramática"];
  return `Você é um avaliador pedagógico conciso. Analise a resposta do aluno.
Retorne APENAS um JSON no seguinte formato:
{
  "scores": { "criterio": 0-10, ... },
  "overallComment": "string curta (<=200 caracteres)",
  "improvementSuggestion": "sugestão prática em até 200 caracteres",
  "confidence": 0..1
}
Critérios: ${criteria.join(", ")}
Consistência: se estiver faltando material para avaliar, reduza a confidence.
Evite adicionar campos extras.

Atividade:
"""
${input.task}
"""

Resposta do aluno:
"""
${input.submission}
"""
Modelo: ${model}`;
}

interface GeminiCandidate {
  content?: { parts?: { text?: string }[] };
}
interface GeminiResponse { candidates?: GeminiCandidate[] }

async function callGemini(model: string, prompt: string): Promise<string> {
  if (!API_KEY) throw new Error("GEMINI_API_KEY ausente");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;
  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.2, topP: 0.9 },
  };
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Gemini HTTP ${res.status}: ${txt}`);
  }
  const json = (await res.json()) as GeminiResponse;
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) throw new Error("Resposta vazia do modelo");
  return text;
}

function safeParseJson(text: string): any | null {
  // Tenta extrair apenas bloco JSON se vier com texto extra
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

export async function POST(req: Request) {
  const started = Date.now();
  try {
    const json = await req.json().catch(() => null);
    const validation = validateBody(json);
    if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 });
    const body = validation.data;

    // Estratégia de escalonamento
    let chosen = DEFAULT_MODEL;
    let escalated = false;
    if (body.mode === "pro") { chosen = COMPLEX_MODEL; escalated = true; }
    else if (body.mode === "flash") { chosen = DEFAULT_MODEL; }
    else { // auto
      const complexityHeuristic = (body.submission.length + body.task.length) > 2500 || (body.criteria?.length || 0) > 6;
      if (body.premium || complexityHeuristic) { chosen = COMPLEX_MODEL; escalated = true; }
    }

    if (!API_KEY) {
      return NextResponse.json({ error: "Config faltando (GEMINI_API_KEY)", modelUsed: chosen }, { status: 503 });
    }

    const prompt = buildPrompt(body, chosen);
    let modelRaw = await withTimeout(callGemini(chosen, prompt), 18_000).catch(e => { throw e; });

    // Tentativa de parsing
    const parsed = safeParseJson(modelRaw);
    if (!parsed || typeof parsed !== "object" || !parsed.scores) {
      // Fallback heurístico
      const fallback: AnalysisResponse = {
        scores: (body.criteria || ["clareza", "vocabulário", "gramática"]).reduce((acc, c) => { acc[c] = 5; return acc; }, {} as Record<string, number>),
        overallComment: "Não foi possível estruturar totalmente a análise — fallback neutro.",
        improvementSuggestion: "Tente novamente mais tarde para análise detalhada.",
        confidence: 0.2,
        modelUsed: chosen,
        escalated,
        rawTokensApprox: prompt.length / 4
      };
      return NextResponse.json({ ...fallback, rawOutputSnippet: modelRaw.slice(0, 300) }, { status: 200 });
    }

    // Normalização dos scores
    const normalizedScores: Record<string, number> = {};
    const criteria = Object.keys(parsed.scores);
    for (const c of criteria) {
      const v = parsed.scores[c];
      let num = typeof v === "number" ? v : parseFloat(v);
      if (Number.isNaN(num)) num = 0;
      // clamp 0..10
      num = Math.max(0, Math.min(10, num));
      normalizedScores[c] = Math.round(num * 10) / 10;
    }

    const confidence = typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : 0.6;

    const response: AnalysisResponse = {
      scores: normalizedScores,
      overallComment: parsed.overallComment || "",
      improvementSuggestion: parsed.improvementSuggestion || "",
      confidence,
      modelUsed: chosen,
      escalated,
      rawTokensApprox: Math.round((prompt.length + JSON.stringify(parsed).length) / 4)
    };

    return NextResponse.json(response, { status: 200 });
  } catch (e: any) {
    const elapsed = Date.now() - started;
    const message = e?.message || "erro";
    const isTimeout = message.includes("timeout");
    return NextResponse.json({ error: message, timeout: isTimeout, elapsedMs: elapsed }, { status: isTimeout ? 504 : 500 });
  }
}

// Ajuda quem acessa via navegador: orienta a usar POST
export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      message: "Use POST para analisar atividades",
      endpoint: "/api/ai/analyze",
      bodySchema: {
        task: "string",
        submission: "string",
        criteria: ["clareza", "vocabulário", "gramática"],
        mode: "auto|flash|pro",
        premium: false
      }
    },
    { status: 405 }
  );
}
