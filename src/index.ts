// Core library exports — consumed by CLI, API, and future Web frontend
export { check, checkSiteBasic, checkHomeQuality } from './checker.js';
export type {
  CheckReport,
  CheckOptions,
  CheckCategory,
  CheckItem,
  PageDetail,
  SiteTopic,
  SiteType,
  PageType,
  Lang,
  CheckStatus,
} from './types.js';

// AI module
export {
  analyzeWithAI,
  analyzeBatch,
  analyzeSinglePage,
  recheckCompliance,
  callWithRetry,
  callAIWithModel,
  getFastApiBase,
  getFastApiKey,
  getExpertApiBase,
  getExpertApiKey,
  getFastModel,
  getExpertModel,
  configureApiProxy,
  isProxyEnabled,
} from './ai/analyzer.js';

export { analyzeSiteTopic } from './ai/topic.js';
export { estimateByRules, summarizeFinal } from './ai/approval.js';

// Utils
export { renderPrompt, extractJson, getLangName, clampScore, AI_LANG_NAMES } from './utils/prompt-utils.js';

// i18n
export { t, isValidLang, getSupportedLangs } from './i18n.js';

// Browser
export { BrowserManager, fetchPage, fetchSitemapUrls, getSitemapFromRobots, isContentUrl } from './browser.js';

// Detector
export { detectSiteType } from './detector.js';
export type { PageSignals, SiteTypeResult } from './detector.js';

// Scorer
export { computePageAiScore, scorePage, scoreCategory, computeCompositeScore, computeSiteAiScore } from './scorer.js';

// Config
export { loadConfig, saveConfig, getConfigPath, getGlobalConfigPath, DEFAULTS } from './config.js';
export type { AdsenseConfig } from './config.js';
