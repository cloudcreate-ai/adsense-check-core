/**
 * Template variable renderer: {{key}} → value
 */
export function renderPrompt(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
}

/**
 * Extract first JSON object from text (handles markdown code blocks, prose + JSON)
 */
export function extractJson(text: string): unknown {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }
  throw new Error('No JSON found in response');
}

/**
 * Supported output languages for AI prompts
 */
export const AI_LANG_NAMES: Record<string, string> = {
  en: 'English',
  zh: '中文',
};

export function getLangName(code: string): string {
  return AI_LANG_NAMES[code] ?? code;
}

/**
 * Normalize AI score to 0-10 range
 */
export function clampScore(v: unknown): number {
  const n = Number(v);
  if (isNaN(n)) return 5;
  return Math.max(0, Math.min(10, Math.round(n)));
}
