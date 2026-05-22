// Structured API proxy client for adsense-check-api
// Calls /analyze/page, /analyze/compliance, /analyze/topic, /analyze/approval endpoints

// Client version — set by the consumer (CLI/API) via configureApiProxy
const DEFAULT_CLIENT_VERSION = '1.0.0';

let proxyBase: string | undefined;
let proxyKey: string | undefined;
let clientVersion = DEFAULT_CLIENT_VERSION;

export function configureApiProxy(base?: string, key?: string, version?: string) {
  proxyBase = base;
  proxyKey = key;
  if (version) clientVersion = version;
}

export function isProxyEnabled(): boolean {
  return !!proxyBase;
}

async function callApiProxy<T = any>(endpoint: string, body: Record<string, unknown>): Promise<T> {
  if (!proxyBase || !proxyKey) throw new Error('Proxy not configured');

  const url = `${proxyBase.replace(/\/+$/, '')}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${proxyKey}`,
    },
    body: JSON.stringify({ ...body, clientVersion }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Proxy error: ${response.status} ${errText.slice(0, 200)}`);
  }

  return response.json();
}

/**
 * Call /analyze/page via proxy. Returns raw JSON result.
 */
export async function proxyAnalyzePage(body: {
  url: string;
  content: string;
  lang?: string;
  pageLanguage?: string;
  embedSignal?: string;
  siteTopic?: unknown;
  listingSignals?: unknown;
  model?: string;
  modelApiBase?: string;
  modelApiKey?: string;
}) {
  return callApiProxy('/api/analyze/page', body);
}

/**
 * Call /api/analyze/compliance via proxy. Returns raw JSON result.
 */
export async function proxyRecheckCompliance(body: {
  url: string;
  content: string;
  firstScore: number;
  lang?: string;
  model?: string;
  modelApiBase?: string;
  modelApiKey?: string;
}) {
  return callApiProxy('/api/analyze/compliance', body);
}

/**
 * Call /api/analyze/topic via proxy. Returns raw JSON result.
 */
export async function proxyAnalyzeTopic(body: {
  title: string;
  content: string;
  metaDescription?: string;
  navText?: string;
  lang?: string;
  model?: string;
  modelApiBase?: string;
  modelApiKey?: string;
}) {
  return callApiProxy('/api/analyze/topic', body);
}

/**
 * Call /api/analyze/approval via proxy. Returns raw JSON result.
 */
export async function proxyAnalyzeApproval(body: {
  siteUrl: string;
  pageSummaries: string;
  siteType?: string;
  siteTopic?: string;
  pagesAnalyzed?: number;
  totalDiscovered?: number;
  compositeScore?: number;
  pageValueScore?: number;
  siteQuality?: number;
  homeQuality?: number;
  pageValueNote?: string;
  lang?: string;
  expert?: boolean;
  model?: string;
  modelApiBase?: string;
  modelApiKey?: string;
}) {
  return callApiProxy('/api/analyze/approval', body);
}
