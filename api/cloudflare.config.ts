import { bindings, defineConfig } from "cf/config";

export default defineConfig({
  worker: {
    name: "rifador-api",
    entrypoint: "./src/index.js",
    compatibilityDate: "2026-11-20",
    compatibilityFlags: ["nodejs_compat"],
    observability: {
      enabled: true,
      traces: { enabled: true },
    },
    env: {
      DB: bindings.d1({ name: "rifador", id: "829768c1-b6f5-405b-90e7-dd69c9c9978c" }),
    },
  },
});
