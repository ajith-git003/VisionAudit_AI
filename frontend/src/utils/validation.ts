import type { Severity } from '../types/api';

// ── URL Validation ────────────────────────────────────────────────────────────
const YOUTUBE_PATTERNS = [
  /^https?:\/\/(www\.)?youtube\.com\/watch\?.*v=[\w-]{11}/,
  /^https?:\/\/youtu\.be\/[\w-]{11}/,
  /^https?:\/\/(www\.)?youtube\.com\/shorts\/[\w-]{11}/,
  /^https?:\/\/(www\.)?youtube\.com\/embed\/[\w-]{11}/,
];

export function isValidYouTubeUrl(url: string): boolean {
  return YOUTUBE_PATTERNS.some((p) => p.test(url.trim()));
}

export function getValidationError(url: string): string | null {
  if (!url.trim()) return 'Please enter a YouTube URL.';
  if (!isValidYouTubeUrl(url)) return 'Must be a valid YouTube URL (youtube.com or youtu.be).';
  return null;
}

// ── Severity Helpers ──────────────────────────────────────────────────────────
const SEVERITY_MAP: Record<string, Severity> = {
  CRITICAL: 'CRITICAL',
  MAJOR: 'MAJOR',
  WARNING: 'WARNING',
  MINOR: 'MINOR',
  ERROR: 'CRITICAL',
  HIGH: 'MAJOR',
  MEDIUM: 'WARNING',
  LOW: 'MINOR',
  INFO: 'MINOR',
};

export function normalizeSeverity(raw: string): Severity {
  return SEVERITY_MAP[raw?.toUpperCase()] ?? 'MINOR';
}

export function getSeverityBorderColor(severity: string): string {
  const s = normalizeSeverity(severity);
  return {
    CRITICAL: 'border-l-severity-critical',
    MAJOR: 'border-l-severity-major',
    WARNING: 'border-l-severity-warning',
    MINOR: 'border-l-severity-minor',
  }[s];
}

export function getSeverityTextColor(severity: string): string {
  const s = normalizeSeverity(severity);
  return {
    CRITICAL: 'text-severity-critical',
    MAJOR: 'text-severity-major',
    WARNING: 'text-severity-warning',
    MINOR: 'text-severity-minor',
  }[s];
}

export function getSeverityBgColor(severity: string): string {
  const s = normalizeSeverity(severity);
  return {
    CRITICAL: 'bg-red-500/10',
    MAJOR: 'bg-orange-500/10',
    WARNING: 'bg-yellow-500/10',
    MINOR: 'bg-blue-500/10',
  }[s];
}

export function getSeverityHexColor(severity: string): string {
  const s = normalizeSeverity(severity);
  return {
    CRITICAL: '#ef4444',
    MAJOR: '#f97316',
    WARNING: '#eab308',
    MINOR: '#3b82f6',
  }[s];
}
