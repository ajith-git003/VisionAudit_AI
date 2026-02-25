import { motion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import {
  ShieldCheck,
  ShieldX,
  ShieldAlert,
  RefreshCw,
  FileText,
  Download,
  Sparkles,
} from 'lucide-react';
import type { AuditResponse } from '../types/api';
import ViolationCard from './ViolationCard';
import { normalizeSeverity } from '../utils/validation';

interface ResultsStateProps {
  result: AuditResponse;
  onRunAnother: () => void;
  videoUrl: string;
}

function extractYouTubeId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/
  );
  return match ? match[1] : null;
}

// ── Stagger variants — applied to wrapper divs in ResultsState ─────────────
const listContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.05 } },
};

const listItem: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.38 } },
};

// ── Severity helpers ───────────────────────────────────────────────────────
type Sev = 'CRITICAL' | 'MAJOR' | 'WARNING' | 'MINOR';
const SEV_COLOR: Record<Sev, string> = {
  CRITICAL: '#ef4444',
  MAJOR:    '#f97316',
  WARNING:  '#eab308',
  MINOR:    '#3b82f6',
};

// ── Verdict config ─────────────────────────────────────────────────────────
type VerdictKind = 'pass' | 'fail' | 'inconclusive';
function getKind(status: string, count: number): VerdictKind {
  if (status === 'PASS') return 'pass';
  if (status === 'FAIL' && count > 0) return 'fail';
  return 'inconclusive';
}

const ResultsState = ({ result, onRunAnother, videoUrl }: ResultsStateProps) => {
  const issues   = result.compliance_results ?? [];
  const kind     = getKind(result.status, issues.length);
  const ytId     = extractYouTubeId(videoUrl);

  // Severity breakdown counts
  const sevCount: Record<Sev, number> = { CRITICAL: 0, MAJOR: 0, WARNING: 0, MINOR: 0 };
  issues.forEach((i) => { const s = normalizeSeverity(i.severity); sevCount[s]++; });

  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `audit-${result.video_id}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div
      key="results"
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      style={{ width: '100%', maxWidth: '840px', margin: '0 auto' }}
    >
      {/* ═══════════════════════════════════════════════════════════════
          SINGLE OUTER CARD — everything lives inside this box
      ════════════════════════════════════════════════════════════════ */}
      <div
        style={{
          background: 'rgba(8, 14, 40, 0.82)',
          border: '1px solid rgba(255,255,255,0.13)',
          borderRadius: '28px',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          overflow: 'hidden',
        }}
      >

        {/* ── SECTION 1: Verdict Header ─────────────────────────────── */}
        {kind === 'pass' && (
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(16,185,129,0.18) 0%, rgba(5,150,105,0.10) 100%)',
              borderBottom: '1px solid rgba(16,185,129,0.25)',
              padding: '32px 36px',
              display: 'flex',
              alignItems: 'center',
              gap: '20px',
            }}
          >
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: 'rgba(16,185,129,0.15)', border: '2px solid rgba(16,185,129,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <ShieldCheck size={32} color="#10b981" />
            </div>
            <div>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', fontWeight: 700, color: 'rgba(52,211,153,0.7)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: '6px' }}>
                Compliance Status
              </p>
              <h2 style={{ fontFamily: '"Playfair Display", Georgia, serif', fontSize: '32px', fontWeight: 700, color: '#34d399', margin: 0, lineHeight: 1.1 }}>
                Audit Passed
              </h2>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', color: 'rgba(255,255,255,0.55)', margin: '6px 0 0' }}>
                No compliance issues detected — fully compliant
              </p>
            </div>
          </div>
        )}

        {kind === 'fail' && (
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(185,28,28,0.08) 100%)',
              borderBottom: '1px solid rgba(239,68,68,0.22)',
              padding: '32px 36px',
            }}
          >
            {/* Top row: icon + title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '24px' }}>
              {/* Animated warning icon */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <motion.div
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                  style={{
                    width: '64px', height: '64px', borderRadius: '50%',
                    background: 'rgba(239,68,68,0.15)', border: '2px solid rgba(239,68,68,0.4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <ShieldX size={30} color="#ef4444" />
                </motion.div>
                {/* Pulse ring */}
                <motion.div
                  animate={{ scale: [1, 1.5], opacity: [0.4, 0] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
                  style={{
                    position: 'absolute', inset: 0, borderRadius: '50%',
                    border: '2px solid rgba(239,68,68,0.5)',
                  }}
                />
              </div>
              <div>
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', fontWeight: 700, color: 'rgba(248,113,113,0.7)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: '6px' }}>
                  Compliance Audit Failed
                </p>
                <h2 style={{ fontFamily: '"Playfair Display", Georgia, serif', fontSize: '32px', fontWeight: 700, color: '#f87171', margin: 0, lineHeight: 1.1 }}>
                  Violations Detected
                </h2>
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', color: 'rgba(255,255,255,0.55)', margin: '6px 0 0' }}>
                  {issues.length} issue{issues.length !== 1 ? 's' : ''} found — immediate review required
                </p>
              </div>
            </div>

            {/* Severity breakdown chips */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {(Object.entries(sevCount) as [Sev, number][])
                .filter(([, c]) => c > 0)
                .map(([sev, count]) => (
                  <div
                    key={sev}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '7px',
                      background: 'rgba(0,0,0,0.25)', border: `1px solid ${SEV_COLOR[sev]}55`,
                      borderRadius: '99px', padding: '6px 14px',
                    }}
                  >
                    <span style={{
                      width: '8px', height: '8px', borderRadius: '50%',
                      background: SEV_COLOR[sev], boxShadow: `0 0 8px ${SEV_COLOR[sev]}`,
                      display: 'inline-block', flexShrink: 0,
                    }} />
                    <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', fontWeight: 600, color: SEV_COLOR[sev] }}>
                      {count} {sev}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {kind === 'inconclusive' && (
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(234,179,8,0.12) 0%, rgba(161,120,0,0.06) 100%)',
              borderBottom: '1px solid rgba(234,179,8,0.22)',
              padding: '32px 36px',
              display: 'flex', alignItems: 'center', gap: '20px',
            }}
          >
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: 'rgba(234,179,8,0.12)', border: '2px solid rgba(234,179,8,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <ShieldAlert size={30} color="#eab308" />
            </div>
            <div>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', fontWeight: 700, color: 'rgba(251,191,36,0.7)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: '6px' }}>
                Analysis Inconclusive
              </p>
              <h2 style={{ fontFamily: '"Playfair Display", Georgia, serif', fontSize: '32px', fontWeight: 700, color: '#fbbf24', margin: 0, lineHeight: 1.1 }}>
                Result Unclear
              </h2>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', color: 'rgba(255,255,255,0.55)', margin: '6px 0 0' }}>
                The AI flagged potential issues but did not produce structured violations
              </p>
            </div>
          </div>
        )}

        {/* ── SECTION 2: Video Preview ─────────────────────────────── */}
        {videoUrl && (
          <div
            style={{
              padding: '20px 36px',
              borderBottom: '1px solid rgba(255,255,255,0.07)',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
            }}
          >
            {ytId && (
              <a
                href={videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ flexShrink: 0, display: 'block', borderRadius: '10px', overflow: 'hidden', lineHeight: 0 }}
              >
                <img
                  src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`}
                  alt="Video thumbnail"
                  style={{ width: '140px', height: '79px', objectFit: 'cover', display: 'block' }}
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                />
              </a>
            )}
            <div style={{ minWidth: 0 }}>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>
                Audited Video
              </p>
              <a
                href={videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '13px',
                  color: '#a5b4fc',
                  textDecoration: 'none',
                  wordBreak: 'break-all',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {videoUrl}
              </a>
            </div>
          </div>
        )}

        {/* ── SECTION 3: Metadata pills ────────────────────────────── */}
        <div
          style={{
            padding: '20px 36px',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
            display: 'flex', gap: '10px', flexWrap: 'wrap',
          }}
        >
          {[
            { emoji: '📹', label: 'Video ID',   value: result.video_id },
            { emoji: '⚖️',  label: 'Status',    value: result.status },
            { emoji: '🔍', label: 'Violations', value: String(issues.length) },
          ].map(({ emoji, label, value }) => (
            <div
              key={label}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px', padding: '7px 14px',
              }}
            >
              <span style={{ fontSize: '13px' }}>{emoji}</span>
              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '10px', color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {label}
              </span>
              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#fff', fontWeight: 600, marginLeft: '2px' }}>
                {value}
              </span>
            </div>
          ))}
        </div>

        {/* ── SECTION 4: AI Summary — in the MIDDLE ─────────────────── */}
        <div style={{ padding: '28px 36px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '8px',
              background: 'rgba(99,102,241,0.18)', border: '1px solid rgba(99,102,241,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Sparkles size={15} color="#a5b4fc" />
            </div>
            <div>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', fontWeight: 700, color: '#ffffff', margin: 0 }}>
                AI Analysis Summary
              </p>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', color: 'rgba(165,180,252,0.75)', margin: 0 }}>
                Generated by GPT-4o
              </p>
            </div>
          </div>

          {result.report ? (
            <div
              className="scrollbar-thin"
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: '15px',
                lineHeight: 1.8,
                color: 'rgba(255,255,255,0.82)',
                whiteSpace: 'pre-wrap',
                maxHeight: '200px',
                overflowY: 'auto',
                paddingRight: '6px',
              }}
            >
              {result.report}
            </div>
          ) : (
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', color: 'rgba(255,255,255,0.28)', fontStyle: 'italic' }}>
              No summary was generated for this run.
            </p>
          )}
        </div>

        {/* ── SECTION 5: Violation Cards (only when violations exist) ─ */}
        {kind === 'fail' && issues.length > 0 && (
          <div style={{ padding: '28px 36px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            {/* Section header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <FileText size={13} color="rgba(255,255,255,0.4)" />
              <span style={{
                fontFamily: 'Inter, sans-serif', fontSize: '11px', fontWeight: 700,
                color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.14em',
              }}>
                Detailed Violations
              </span>
              <span style={{
                marginLeft: 'auto',
                background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: '99px', padding: '2px 10px',
                fontFamily: 'Inter, sans-serif', fontSize: '11px', color: '#f87171', fontWeight: 600,
              }}>
                {issues.length} found
              </span>
            </div>

            {/* Stagger list — each motion.div wraps a plain ViolationCard div */}
            <motion.div
              variants={listContainer}
              initial="hidden"
              animate="visible"
              style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
            >
              {issues.map((issue, index) => (
                <motion.div key={index} variants={listItem}>
                  <ViolationCard issue={issue} index={index} />
                </motion.div>
              ))}
            </motion.div>
          </div>
        )}

        {/* ── SECTION 6: Action buttons ─────────────────────────────── */}
        <div
          style={{
            padding: '24px 36px',
            display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap',
          }}
        >
          <motion.button
            onClick={onRunAnother}
            whileHover={{ translateY: -2, scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '12px 28px', borderRadius: '10px',
              background: 'rgba(255,255,255,0.09)', border: '1px solid rgba(255,255,255,0.18)',
              color: '#ffffff', fontFamily: 'Inter, sans-serif', fontSize: '14px',
              fontWeight: 500, cursor: 'pointer',
            }}
          >
            <RefreshCw size={15} />
            Audit Another Video
          </motion.button>

          <motion.button
            onClick={handleDownload}
            whileHover={{ translateY: -2, scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '12px 28px', borderRadius: '10px',
              background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.35)',
              color: '#a5b4fc', fontFamily: 'Inter, sans-serif', fontSize: '14px',
              fontWeight: 500, cursor: 'pointer',
            }}
          >
            <Download size={15} />
            Download JSON
          </motion.button>
        </div>

      </div>{/* end outer card */}
    </motion.div>
  );
};

export default ResultsState;
