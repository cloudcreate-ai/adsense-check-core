import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = join(__dirname, 'prompts');

const cache = new Map<string, string>();

/**
 * Load a prompt template from src/ai/prompts/. Results are cached.
 */
export function loadPrompt(name: string): string {
  if (!cache.has(name)) {
    const filePath = join(PROMPTS_DIR, `${name}.md`);
    cache.set(name, readFileSync(filePath, 'utf-8'));
  }
  return cache.get(name)!;
}

/**
 * Substitute {{key}} placeholders in a template string.
 */
export function renderPrompt(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}
