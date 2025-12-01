export type MicroConcept = {
  slug: string;
  title: string;
  goal: string;
  task: string;
  criteria: string[];
  mode?: "auto" | "flash" | "pro";
  estMinutes?: number;
  video?: {
    provider: "youtube";
    videoId: string;
    privacy?: "public" | "unlisted";
    durationSec?: number;
    requiredWatchPct?: number; // 0..1 (e.g., 0.7 for 70%)
    allowBypass?: boolean;
    requireFullWatch?: boolean; // when true, force 100% and no bypass
  };
};

export const microconceitos: MicroConcept[] = [
  {
    slug: "onboarding-site",
    title: "Bem-vindo: como o site funciona",
    goal: "Entender propósito, navegação e fluxo de prática + feedback.",
    task:
      "Assista ao vídeo de introdução para conhecer o site e, se quiser, descreva em 2–3 frases o que você pretende praticar primeiro.",
    criteria: ["clareza", "vocabulário", "gramática"],
    mode: "auto",
    estMinutes: 3,
    video: {
      provider: "youtube",
      videoId: "REPLACE_ONBOARDING_VIDEO_ID",
      privacy: "public",
      durationSec: 180,
      requiredWatchPct: 0.7,
      allowBypass: true,
      requireFullWatch: false,
    },
  },
  {
    slug: "introducao-direta",
    title: "Introdução direta (self-intro)",
    goal: "Escrever uma apresentação simples e direta em inglês.",
    task:
      "Escreva um parágrafo curto se apresentando em inglês. Use frases curtas e diretas (5–6 frases). Foque em: nome, cidade, área de interesse e um hábito diário.",
    criteria: ["clareza", "vocabulário", "gramática"],
    mode: "auto",
    estMinutes: 5,
    video: {
      provider: "youtube",
      videoId: "REPLACE_CLASS1_VIDEO_ID",
      privacy: "public",
      durationSec: 120,
      requiredWatchPct: 0.7,
      allowBypass: true,
      requireFullWatch: false,
    },
  },
];

export function getMicro(slug: string) {
  return microconceitos.find((m) => m.slug === slug) || null;
}
