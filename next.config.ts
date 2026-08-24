import type { NextConfig } from "next";

/**
 * `standalone` sirve para la imagen de Docker (docker-compose), pero en
 * Vercel estorba: la plataforma arma su propio empaquetado. Se activa solo
 * cuando se construye para Docker.
 */
const nextConfig: NextConfig = {
  ...(process.env.BUILD_STANDALONE === "true" ? { output: "standalone" as const } : {}),
};

export default nextConfig;
