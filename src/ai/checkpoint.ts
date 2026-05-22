// Checkpoint: save and resume AI analysis progress
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { PageAiAnalysis, FullAiAnalysis } from './analyzer.js';

export interface Checkpoint {
  version: 1;
  url: string;
  lang: string;
  totalPages: number;
  completedPages: PageAiAnalysis[];
  overallSuggestions: string[];
  timestamp: string;
  reason: 'in_progress' | 'rate_limited';
}

const CHECKPOINT_PATH = '~/.adsense-check/checkpoint.json';

function resolvePath(path?: string): string {
  return path || CHECKPOINT_PATH.replace('~', process.env.HOME || '');
}

/**
 * Save checkpoint after a batch of AI analysis.
 */
export function saveCheckpoint(
  url: string,
  lang: string,
  totalPages: number,
  completedPages: PageAiAnalysis[],
  path?: string,
  reason: 'in_progress' | 'rate_limited' = 'in_progress'
): string {
  const resolved = resolvePath(path);
  const dir = dirname(resolved);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const cp: Checkpoint = {
    version: 1,
    url,
    lang,
    totalPages,
    completedPages,
    overallSuggestions: [],
    timestamp: new Date().toISOString(),
    reason,
  };
  writeFileSync(resolved, JSON.stringify(cp, null, 2), 'utf-8');
  return resolved;
}

/**
 * Load checkpoint for resume.
 */
export function loadCheckpoint(path?: string): Checkpoint | null {
  const resolved = resolvePath(path);
  if (!existsSync(resolved)) return null;
  try {
    const raw = readFileSync(resolved, 'utf-8');
    return JSON.parse(raw) as Checkpoint;
  } catch {
    return null;
  }
}

/**
 * Delete checkpoint after successful completion.
 */
export function deleteCheckpoint(path?: string): void {
  const resolved = resolvePath(path);
  try {
    if (existsSync(resolved)) {
      const { unlinkSync } = require('node:fs');
      unlinkSync(resolved);
    }
  } catch { /* ignore */ }
}

/**
 * Get pages that still need AI analysis (not in checkpoint).
 */
export function getPendingPages(
  pages: Array<{ url: string; text: string; lang?: string; embedType?: 'game' | 'video' | 'tool' | 'none'; listingSignals?: { listItems: number; hasPagination: boolean; hasCategories: boolean; hasSearch: boolean } }>,
  completedPages: PageAiAnalysis[]
): { pending: typeof pages; completed: PageAiAnalysis[] } {
  const completedUrls = new Set(completedPages.map(p => p.url));
  return {
    pending: pages.filter(p => !completedUrls.has(p.url)),
    completed: completedPages.filter(p => completedUrls.has(p.url)),
  };
}
