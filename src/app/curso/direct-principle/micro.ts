export type MicroConcept = {
  slug: string;
  title: string;
  goal: string;
  task: string;
  criteria: string[];
  mode?: "auto" | "flash" | "pro";
  estMinutes?: number;
};

export const microconceitos: MicroConcept[] = [
  {
    slug: "introducao-direta",
    title: "Introdução direta (self-intro)",
    goal: "Escrever uma apresentação simples e direta em inglês.",
    task:
      "Escreva um parágrafo curto se apresentando em inglês. Use frases curtas e diretas (5–6 frases). Foque em: nome, cidade, área de interesse e um hábito diário.",
    criteria: ["clareza", "vocabulário", "gramática"],
    mode: "auto",
    estMinutes: 5,
  },
];

export function getMicro(slug: string) {
  return microconceitos.find((m) => m.slug === slug) || null;
}
