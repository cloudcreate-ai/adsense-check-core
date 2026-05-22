import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  target: 'node18',
  clean: true,
  external: ['playwright'],
  // Copy prompt templates to dist so they can be loaded at runtime
  onSuccess: 'mkdir -p dist/prompts && cp -r src/ai/prompts/* dist/prompts/ 2>/dev/null || true',
});
