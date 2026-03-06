// ── Severity ──────────────────────────────────────────────────────────────────
export type Severity = 'CRITICAL' | 'MAJOR' | 'WARNING' | 'MINOR';

// ── App State Machine ─────────────────────────────────────────────────────────
export type AppState = 'IDLE' | 'PROCESSING' | 'RESULTS' | 'ERROR';

// ── API Request ───────────────────────────────────────────────────────────────
export interface AuditRequest {
  video_url: string;
}

// ── API Response Models ───────────────────────────────────────────────────────
export interface ComplianceIssue {
  category: string;
  description: string;
  severity: Severity | string; // string fallback for unexpected LLM output
  timestamp: string | null;
}

export interface AuditResultBlock {
  status: 'PASS' | 'FAIL';
  compliance_results: ComplianceIssue[];
  report: string;
}

export interface AuditResponse {
  video_id: string;
  youtube_audit: AuditResultBlock;
  influencer_audit: AuditResultBlock;
}

// ── Processing Pipeline ───────────────────────────────────────────────────────
export interface PipelineStep {
  id: number;
  label: string;
  status: 'pending' | 'active' | 'done';
}
