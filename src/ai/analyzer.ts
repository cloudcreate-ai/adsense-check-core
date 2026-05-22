import type { Lang, SiteTopic, PageType } from '../types.js';
import { loadPrompt, renderPrompt } from './prompts.js';
import { isProxyEnabled, proxyAnalyzePage, proxyRecheckCompliance } from './api-proxy.js';
import { clampScore, extractJson, getLangName } from '../utils/prompt-utils.js';

export { configureApiProxy, isProxyEnabled } from './api-proxy.js';

export interface AiAnalysis {
  suggestions: string[];
}

export interface PageAiAnalysis {
  url: string;
  status: 'pass' | 'warn' | 'fail';
  relevance?: 'relevant' | 'tangential' | 'off-topic';
  // Five-dimension scores (0-10)
  valueScore?: number;
  originalityScore?: number;
  relevanceScore?: number;
  complianceScore?: number;
  translationScore?: number;
  // Reasoning behind each score
  valueReason?: string;
  originalityReason?: string;
  relevanceReason?: string;
  complianceReason?: string;
  translationReason?: string;
  assessment: string;
  suggestions: string[];
  // AI-inferred page type (overrides URL-based classification when AI is enabled)
  inferredPageType?: PageType;
}

export interface FullAiAnalysis extends AiAnalysis {
  pageAnalyses: PageAiAnalysis[];
  _rateLimited?: boolean; // true if analysis was interrupted by rate limiting
}

function getApiEndpoint(base?: string): string {
  const resolved = base || process.env.AI_API_BASE || 'https://api.deepseek.com';
  return `${resolved.replace(/\/$/, '')}/chat/completions`;
}

function getApiKey(key?: string): string | undefined {
  return key || process.env.AI_API_KEY;
}

export function getFastApiBase(): string {
  return process.env.AI_FAST_API_BASE || process.env.AI_API_BASE || 'https://api.deepseek.com';
}

export function getFastApiKey(): string | undefined {
  return process.env.AI_FAST_API_KEY || process.env.AI_API_KEY;
}

export function getExpertApiBase(): string {
  return process.env.AI_EXPERT_API_BASE || process.env.AI_API_BASE || 'https://api.anthropic.com';
}

export function getExpertApiKey(): string | undefined {
  return process.env.AI_EXPERT_API_KEY || process.env.AI_API_KEY;
}

export function getFastModel(): string {
  return process.env.AI_FAST_MODEL || process.env.AI_MODEL || 'deepseek-chat';
}

async function callAI(prompt: string, maxTokens: number = 4096, model?: string, apiBase?: string, apiKey?: string, maxRetries: number = 3): Promise<string> {
  // Use proxy-aware getters when apiBase/apiKey not explicitly passed
  const endpoint = getApiEndpoint(apiBase || getFastApiBase());
  const key = apiKey || getFastApiKey();
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: model || getFastModel(),
          max_tokens: maxTokens,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!response.ok) {
        throw new Error(`AI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content ?? '';
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      // Wait before retry — exponential backoff: 1s, 2s, 4s
      if (attempt < maxRetries - 1) {
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
      }
    }
  }
  throw lastError!;
}

export function getExpertModel(): string {
  return process.env.AI_EXPERT_MODEL || process.env.AI_MODEL || 'claude-sonnet-4-6';
}

export async function callAIWithModel(prompt: string, maxTokens: number, model: string, apiBase?: string, apiKey?: string): Promise<string> {
  return callAI(prompt, maxTokens, model, apiBase, apiKey);
}

function getAiLangName(lang: string): string {
  return getLangName(lang);
}

const PAGE_CHARS = 5000;

/**
 * Detect transient proxy errors that should be retried.
 * Covers: 502 Bad Gateway, empty AI response, JSON parse failures.
 */
function isTransientError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message;
  return (
    msg.includes('502') ||
    msg.includes('empty response') ||
    msg.includes('No JSON found') ||
    (msg.startsWith('Proxy error: 5') && !msg.includes('500'))
  );
}

export async function callWithRetry<T>(fn: () => Promise<T>, maxRetries: number = 2): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!isTransientError(err) || attempt === maxRetries) throw err;
      // Wait before retry — short backoff: 1s, 2s
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
    }
  }
  throw new Error('Unreachable');
}

export async function analyzeSinglePage(
  page: { url: string; text: string },
  langName: string,
  date: string,
  siteTopic?: SiteTopic,
  pageLanguage?: string,
  embedType?: 'game' | 'video' | 'tool' | 'none',
  listingSignals?: { listItems: number; hasPagination: boolean; hasCategories: boolean; hasSearch: boolean }
): Promise<PageAiAnalysis> {
  const content = page.text.slice(0, PAGE_CHARS);
  const embed = embedType ?? 'none';

  const listingCtx = listingSignals
    ? `\nListing structure: ${listingSignals.listItems} items, pagination=${listingSignals.hasPagination}, categories=${listingSignals.hasCategories}, search=${listingSignals.hasSearch}`
    : '';

  const template = loadPrompt('analyze-single');
  const prompt = renderPrompt(template, {
    date,
    langName,
    topicContext: siteTopic
      ? `\nSite topic: ${siteTopic.topic}\nSite type: ${siteTopic.type}\nSite description: ${siteTopic.description}`
      : '',
    pageLanguage: pageLanguage || 'English',
    url: page.url,
    embedSignal: embed,
    listingContext: listingCtx,
    content,
  });

  try {
    let result: any;
    if (isProxyEnabled()) {
      // Route through structured API proxy with retry for transient errors
      result = await callWithRetry(() => proxyAnalyzePage({
        url: page.url,
        content,
        lang: langName === '中文' ? 'zh' : 'en',
        pageLanguage: pageLanguage || 'English',
        embedSignal: embed,
        siteTopic: siteTopic || undefined,
        listingSignals: listingSignals || undefined,
      }));
    } else {
      // Direct AI call — render prompt locally
      const text = await callAI(prompt, 2048, undefined, getFastApiBase());
      result = extractJson(text);
    }
    const details = result.evaluation_details || result; // support both nested and flat formats
    let valueScore = clampScore(details.value);
    let originalityScore = clampScore(details.originality);
    const relevanceScore = clampScore(details.relevance);
    const complianceScore = clampScore(details.compliance);
    const translationScore = clampScore(details.translation);
    const validPageTypes: PageType[] = ['homepage', 'listing', 'content', 'game_detail', 'video_detail', 'reference_detail', 'required', 'utility', 'tool_detail'];
    const inferredPageType = validPageTypes.includes(result.pageType) ? result.pageType : undefined;
    const confidence: 'high' | 'medium' | 'low' = ['high', 'medium', 'low'].includes(result.confidence) ? result.confidence : 'high';

    // Low confidence → reduce value and originality to reflect evaluation uncertainty
    if (confidence === 'low') {
      valueScore = Math.max(0, valueScore - 2);
      originalityScore = Math.max(0, originalityScore - 2);
    } else if (confidence === 'medium') {
      valueScore = Math.max(0, valueScore - 1);
      originalityScore = Math.max(0, originalityScore - 1);
    }

    // For required/utility pages, don't penalize for low value/originality/relevance/translation
    let finalValueScore = valueScore;
    let finalOriginalityScore = originalityScore;
    let finalRelevanceScore = relevanceScore;
    let finalTranslationScore = translationScore;
    if (inferredPageType === 'required' || inferredPageType === 'utility') {
      finalValueScore = 10;
      finalOriginalityScore = 10;
      finalRelevanceScore = 10;
      finalTranslationScore = 10;
    } else if (!pageLanguage || pageLanguage === 'en') {
      finalTranslationScore = 10;
    }

    // Overall status based on geometric mean of 5 dimensions
    const geoMean = Math.pow(finalValueScore * finalOriginalityScore * finalRelevanceScore * complianceScore * finalTranslationScore, 0.2);
    const status: 'pass' | 'warn' | 'fail' = geoMean >= 7 ? 'pass' : geoMean >= 4 ? 'warn' : 'fail';
    return {
      url: page.url,
      status,
      relevance: result.relevanceLabel ?? (finalRelevanceScore >= 7 ? 'relevant' : finalRelevanceScore >= 4 ? 'tangential' : 'off-topic'),
      valueScore: finalValueScore,
      originalityScore: finalOriginalityScore,
      relevanceScore: finalRelevanceScore,
      complianceScore,
      translationScore: finalTranslationScore,
      valueReason: details.value_reason ?? '',
      originalityReason: details.originality_reason ?? '',
      relevanceReason: details.relevance_reason ?? '',
      complianceReason: details.compliance_reason ?? '',
      translationReason: details.translation_reason ?? '',
      assessment: result.assessment ?? '',
      suggestions: result.suggestions ?? [],
      inferredPageType,
    };
  } catch (err) {
    return {
      url: page.url,
      status: 'warn' as const,
      assessment: `Analysis failed: ${err instanceof Error ? err.message : String(err)}`,
      suggestions: [],
    };
  }
}

/**
 * Second-pass compliance check for suspicious pages (compliance 3-5).
 * Returns updated compliance scores — takes the higher of first and second pass.
 */
export async function recheckCompliance(
  pages: Array<{ url: string; text: string; firstComplianceScore: number }>,
  langName: string,
  onProgress?: (msg: string) => void
): Promise<Map<string, { complianceScore: number; complianceReason: string; assessment: string }>> {
  const result = new Map<string, { complianceScore: number; complianceReason: string; assessment: string }>();
  if (pages.length === 0) return result;

  const progress = onProgress ?? (() => {});
  progress(`AI: re-checking ${pages.length} suspicious page(s) for compliance...`);

  for (const page of pages) {
    const content = page.text.slice(0, PAGE_CHARS);
    const template = loadPrompt('compliance-recheck');
    const prompt = renderPrompt(template, {
      firstScore: String(page.firstComplianceScore),
      langName,
      url: page.url,
      content,
    });

    try {
      let r: any;
      if (isProxyEnabled()) {
        r = await callWithRetry(() => proxyRecheckCompliance({
          url: page.url,
          content,
          firstScore: page.firstComplianceScore,
          lang: langName === '中文' ? 'zh' : 'en',
        }));
      } else {
        const text = await callAI(prompt, 1024, undefined, getFastApiBase());
        r = extractJson(text);
      }
      const newScore = clampScore(r.compliance);
      // Take the higher score — give benefit of the doubt on re-check
      const finalScore = Math.max(page.firstComplianceScore, newScore);
      result.set(page.url, {
        complianceScore: finalScore,
        complianceReason: r.compliance_reason ?? '',
        assessment: r.assessment ?? '',
      });
    } catch {
      // On failure, keep the original score
      result.set(page.url, {
        complianceScore: page.firstComplianceScore,
        complianceReason: 'Re-check failed, keeping original score',
        assessment: 'Re-check failed, keeping original score',
      });
    }
  }

  return result;
}

/**
 * Analyze a batch of pages concurrently.
 * Used by pipeline mode where crawling and AI overlap.
 */
export async function analyzeBatch(
  pages: Array<{ url: string; text: string; lang?: string; embedType?: 'game' | 'video' | 'tool' | 'none'; listingSignals?: { listItems: number; hasPagination: boolean; hasCategories: boolean; hasSearch: boolean } }>,
  lang: string,
  apiKey: string,
  siteTopic?: SiteTopic,
  onProgress?: (message: string) => void
): Promise<PageAiAnalysis[]> {
  const langName = getAiLangName(lang);
  const date = new Date().toISOString().slice(0, 10);
  const progress = onProgress ?? (() => {});
  const paths = pages.map(p => { try { return new URL(p.url).pathname; } catch { return p.url; } });
  progress(`AI: analyzing ${pages.length} page(s) (${paths.join(', ')})`);
  return Promise.all(pages.map(p => analyzeSinglePage(p, langName, date, siteTopic, p.lang, p.embedType, p.listingSignals)));
}

export async function analyzeWithAI(
  pages: Array<{ url: string; text: string; lang?: string; embedType?: 'game' | 'video' | 'tool' | 'none'; listingSignals?: { listItems: number; hasPagination: boolean; hasCategories: boolean; hasSearch: boolean } }>,
  lang: string = 'en',
  apiKey?: string,
  onProgress?: (message: string) => void,
  siteTopic?: SiteTopic,
  concurrency: number = 5,
  checkpointFile?: string,
  existingPages?: PageAiAnalysis[]
): Promise<FullAiAnalysis> {
  const key = apiKey || getApiKey();
  const empty: FullAiAnalysis = {
    suggestions: [],
    pageAnalyses: [],
  };
  if (!key) return empty;

  const langName = getAiLangName(lang);
  const date = new Date().toISOString().slice(0, 10);

  // Resume from checkpoint
  const pageAnalyses: PageAiAnalysis[] = existingPages ? [...existingPages] : [];

  try {
    const progress = onProgress ?? (() => {});
    for (let i = 0; i < pages.length; i += concurrency) {
      const batch = pages.slice(i, i + concurrency);
      const batchNum = Math.floor(i / concurrency) + 1;
      const totalBatches = Math.ceil(pages.length / concurrency);
      progress(`AI: batch ${batchNum}/${totalBatches} (${batch.map(p => { try { return new URL(p.url).pathname; } catch { return p.url; } }).join(', ')})`);

      try {
        const results = await Promise.all(
          batch.map(p => analyzeSinglePage(p, langName, date, siteTopic, p.lang, p.embedType))
        );
        pageAnalyses.push(...results);
      } catch (err) {
        // Check if this is a rate limit error (429)
        const isRateLimit = err instanceof Error && (err.message.includes('429') || err.message.includes('rate limit'));
        if (isRateLimit && checkpointFile) {
          const { saveCheckpoint } = await import('./checkpoint.js');
          const path = saveCheckpoint(
            pages[0]?.url || 'unknown',
            lang,
            pages.length,
            pageAnalyses,
            checkpointFile,
            'rate_limited'
          );
          progress(`AI: rate limited — ${pageAnalyses.length}/${pages.length} pages completed. Checkpoint saved to ${path}`);
          progress(`AI: resume later with: adsense-check <url> --resume ${path}`);
          // Return partial results — caller should handle incomplete analysis
          return {
            suggestions: [],
            pageAnalyses,
            _rateLimited: true,
          } as FullAiAnalysis & { _rateLimited: boolean };
        }
        throw err;
      }

      // Save checkpoint after each batch
      if (checkpointFile && pageAnalyses.length > 0) {
        const { saveCheckpoint } = await import('./checkpoint.js');
        saveCheckpoint(
          pages[0]?.url || 'unknown',
          lang,
          pages.length,
          pageAnalyses,
          checkpointFile
        );
      }
    }

    // Phase 2: Aggregate suggestions from per-page analyses
    // (analyzeOverall was removed; overall suggestions now come from check() via summarizeFinal)
    const allSuggestions = pageAnalyses.flatMap(p => p.suggestions);
    const uniqueSuggestions = [...new Map(allSuggestions.map(s => [s, s])).values()];

    return {
      suggestions: uniqueSuggestions.slice(0, 5),
      pageAnalyses,
    };
  } catch (err) {
    // Save checkpoint on any failure
    if (checkpointFile && pageAnalyses.length > 0) {
      try {
        const { saveCheckpoint } = await import('./checkpoint.js');
        saveCheckpoint(
          pages[0]?.url || 'unknown',
          lang,
          pages.length,
          pageAnalyses,
          checkpointFile
        );
      } catch { /* ignore checkpoint save failure */ }
    }
    return {
      ...empty,
    };
  }
}
