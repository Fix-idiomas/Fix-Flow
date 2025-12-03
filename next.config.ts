import type { NextConfig } from "next";

// Força o root correto para file tracing (evita Next inferir C:\Users\bruno como raíz)
// Remova o lockfile externo (C:\Users\bruno\package-lock.json) para que o warning suma totalmente.
// Isso ajuda Vercel a incluir corretamente funções API como /api/ai/analyze.
const nextConfig: NextConfig = {
  outputFileTracingRoot: __dirname,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "img.youtube.com" },
    ],
  },
};

export default nextConfig;
