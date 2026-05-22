# @cloudcreate/adsense-check-core

Core library for Google AdSense website compliance checking. All business logic — crawling, checks, AI analysis, scoring, and prompts — lives here. Consumed by the CLI, API, and future web frontend.

## Install

```bash
npm install @cloudcreate/adsense-check-core
```

## Usage

### Full Site Check

```typescript
import { check } from '@cloudcreate/adsense-check-core';

const report = await check('https://example.com', {
  ai: true,
  lang: 'en',
});

console.log(report.compositeScore);
console.log(report.hardStatus); // 'ready' | 'warn' | 'fail'
console.log(report.categories);
```

### Homepage Quality Check

```typescript
import { checkHomeQuality } from '@cloudcreate/adsense-check-core';

const quality = await checkHomeQuality('https://example.com');
console.log(quality); // 0-100
```

### Quick Site Check (Hard Requirements Only)

```typescript
import { checkSiteBasic } from '@cloudcreate/adsense-check-core';

const report = await checkSiteBasic('https://example.com');
console.log(report.hardStatus);
```

### AI Page Analysis

```typescript
import { analyzeSinglePage } from '@cloudcreate/adsense-check-core';

const analysis = await analyzeSinglePage(url, content, lang, apiKey);
console.log(analysis.valueScore);      // 0-10
console.log(analysis.originalityScore); // 0-10
console.log(analysis.relevanceScore);   // 0-10
console.log(analysis.complianceScore);  // 0-10
console.log(analysis.translationScore); // 0-10
```

### Scoring

```typescript
import { computePageAiScore, computeCompositeScore } from '@cloudcreate/adsense-check-core';

const pageScore = computePageAiScore(aiAnalysis);
const composite = computeCompositeScore(
  pageValueScore,
  siteQuality,
  landingPageQuality,
  hardCategories,
  softCategories,
  aiAnalyses
);
```

### Site Type Detection

```typescript
import { detectSiteType } from '@cloudcreate/adsense-check-core';

const result = await detectSiteType(pageSignals);
console.log(result.type);        // 'content' | 'tool' | 'game' | 'video' | 'reference'
console.log(result.confidence);  // 'high' | 'medium' | 'low'
```

### Check Modules

```typescript
import {
  checkContentQuality,
  checkRequiredPages,
  checkSiteStructure,
  checkPerformance,
  checkPolicyCompliance,
} from '@cloudcreate/adsense-check-core';

const qualityResult = await checkContentQuality(page);
const pagesResult = await checkRequiredPages(siteUrls);
```

### Configuration

```typescript
import { loadConfig, saveConfig, DEFAULTS } from '@cloudcreate/adsense-check-core';

const config = await loadConfig();
console.log(config.maxCrawl);
console.log(config.sampleRatio);

// Save config to .adsense-check.yaml
await saveConfig({ ...DEFAULTS, maxCrawl: 100 });
```

### i18n

```typescript
import { t, isValidLang, getSupportedLangs } from '@cloudcreate/adsense-check-core';

console.log(t('pass'));              // 'PASS' or '通过'
console.log(getSupportedLangs());    // ['en', 'zh']
```

## Exports

| Category | Exports |
|----------|---------|
| **Checker** | `check`, `checkSiteBasic`, `checkHomeQuality` |
| **AI** | `analyzeWithAI`, `analyzeBatch`, `analyzeSinglePage`, `analyzeSiteTopic`, `estimateByRules`, `summarizeFinal`, `recheckCompliance` |
| **Scorer** | `computePageAiScore`, `scorePage`, `scoreCategory`, `computeCompositeScore`, `computeSiteAiScore` |
| **Detector** | `detectSiteType` |
| **Browser** | `BrowserManager`, `fetchPage`, `fetchSitemapUrls`, `getSitemapFromRobots`, `isContentUrl` |
| **Checks** | `checkContentQuality`, `checkRequiredPages`, `checkSiteStructure`, `checkPerformance`, `checkPolicyCompliance` |
| **Config** | `loadConfig`, `saveConfig`, `getConfigPath`, `getGlobalConfigPath`, `DEFAULTS` |
| **Utils** | `renderPrompt`, `extractJson`, `getLangName`, `clampScore`, `AI_LANG_NAMES` |
| **i18n** | `t`, `isValidLang`, `getSupportedLangs` |
| **Types** | `CheckReport`, `CheckOptions`, `CheckCategory`, `CheckItem`, `PageDetail`, `SiteTopic`, `SiteType`, `PageType`, `Lang`, `CheckStatus`, `PageAiAnalysis`, `FullAiAnalysis`, `PageSignals`, `SiteTypeResult`, `AdsenseConfig` |

## Development

```bash
npm install
npm run build        # Build with tsup
npm run dev          # Watch mode
npm run typecheck    # Type check only
```

## Peer Dependencies

- `playwright` (optional) — required for browser-based crawling and DOM measurements

## License

MIT
