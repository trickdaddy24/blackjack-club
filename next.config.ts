import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { NextConfig } from "next";

// Baked in at build time — the VERSION file is the source of truth
const version = readFileSync(join(__dirname, "VERSION"), "utf8").trim();

const nextConfig: NextConfig = {
  output: "standalone",
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
  },
};

export default nextConfig;
