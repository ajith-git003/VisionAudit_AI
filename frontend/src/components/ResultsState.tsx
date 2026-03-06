import { useState } from 'react';
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
  Youtube,
  Users,
} from 'lucide-react';
import type { AuditResponse, AuditResultBlock } from '../types/api';
import ViolationCard from './ViolationCard';
import { normalizeSeverity } from '../utils/validation';

interface ResultsStateProps {
  result: AuditResponse;
  onRunAnother: () => void;
  videoUrl: string;
}

// ── Stagger variants ──────────────────────────────────────────────────────
const listContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.05 } },
};
const listItem: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.38 } },
};

// ── Severity helpers ──────────────────────────────────────────────────────
type Sev = 'CRITICAL' | 'MAJOR' | 'WARNING' | 'MINOR';
const SEV_COLOR: Record<Sev, string> = {
  CRITICAL: '#ef4444',
  MAJOR:    '#f97316',
  WARNING:  '#eab308',
  MINOR:    '#3b82f6',
};

// ── Verdict config ────────────────────────────────────────────────────────
type VerdictKind = 'pass' | 'fail' | 'inconclusive';
function getKind(status: string, count: number): VerdictKind {
  if (status === 'PASS') return 'pass';
  if (status === 'FAIL' && count > 0) return 'fail';
  return 'inconclusive';
}

// ── Tab config ────────────────────────────────────────────────────────────
type Tab = 'youtube' | 'influencer';
const TAB_CONFIG: Record<Tab, { label: string; Icon: typeof Youtube; color: string; borderColor: string }> = {
  youtube: {
    label: 'YouTube Ad Guidelines',
    Icon: Youtube,
    color: '#ff4444',
    borderColor: 'rgba(255,68,68,0.5)',
  },
  influencer: {
    label: 'Influencer Guidelines',
    Icon: Users,
    color: '#a78bfa',
    borderColor: 'rgba(167,139,250,0.5)',
  },
};

// ── Audit panel (reusable for both tabs) ─────────────────────────────────
const AuditPanel = ({ block, videoUrl }: { block: AuditResultBlock; videoUrl: string }) => {
  const issues = block.compliance_results ?? [];
  const kind   = getKind(block.status, issues.length);

  const sevCount: Record<Sev, number> = { CRITICAL: 0, MAJOR: 0, WARNING: 0, MINOR: 0 };
  issues.forEach((i) => { const s = normalizeSeverity(i.severity); sevCount[s]++; });

  return (
    <>
      {/* Verdict header */}
      {kind === 'pass' && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(16,185,129,0.18) 0%, rgba(5,150,105,0.10) 100%)',
          borderBottom: '1px solid rgba(16,185,129,0.25)',
          padding: '28px 36px',
          display: 'flex', alignItems: 'center', gap: '20px',
        }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '50%',
            background: 'rgba(16,185,129,0.15)', border: '2px solid rgba(16,185,129,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <ShieldCheck size={28} color="#10b981" />
          </div>
          <div>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', fontWeight: 700, color: 'rgba(52,211,153,0.7)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: '4px' }}>
              Compliance Status
            </p>
            <h3 style={{ fontFamily: '"Playfair Display", Georgia, serif', fontSize: '26px', fontWeight: 700, color: '#34d399', margin: 0, lineHeight: 1.1 }}>
              Audit Passed
            </h3>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: 'rgba(255,255,255,0.55)', margin: '4px 0 0' }}>
              No compliance issues detected — fully compliant
            </p>
          </div>
        </div>
      )}

      {kind === 'fail' && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(185,28,28,0.08) 100%)',
          borderBottom: '1px solid rgba(239,68,68,0.22)',
          padding: '28px 36px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '20px' }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <motion.div
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                style={{
                  width: '56px', height: '56px', borderRadius: '50%',
                  background: 'rgba(239,68,68,0.15)', border: '2px solid rgba(239,68,68,0.4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <ShieldX size={26} color="#ef4444" />
              </motion.div>
              <motion.div
                animate={{ scale: [1, 1.5], opacity: [0.4, 0] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
                style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid rgba(239,68,68,0.5)' }}
              />
            </div>
            <div>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', fontWeight: 700, color: 'rgba(248,113,113,0.7)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: '4px' }}>
                Compliance Audit Failed
              </p>
              <h3 style={{ fontFamily: '"Playfair Display", Georgia, serif', fontSize: '26px', fontWeight: 700, color: '#f87171', margin: 0, lineHeight: 1.1 }}>
                Violations Detected
              </h3>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: 'rgba(255,255,255,0.55)', margin: '4px 0 0' }}>
                {issues.length} issue{issues.length !== 1 ? 's' : ''} found — immediate review required
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {(Object.entries(sevCount) as [Sev, number][]).filter(([, c]) => c > 0).map(([sev, count]) => (
              <div key={sev} style={{
                display: 'flex', alignItems: 'center', gap: '7px',
                background: 'rgba(0,0,0,0.25)', border: `1px solid ${SEV_COLOR[sev]}55`,
                borderRadius: '99px', padding: '5px 12px',
              }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: SEV_COLOR[sev], display: 'inline-block' }} />
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', fontWeight: 600, color: SEV_COLOR[sev] }}>
                  {count} {sev}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {kind === 'inconclusive' && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(234,179,8,0.12) 0%, rgba(161,120,0,0.06) 100%)',
          borderBottom: '1px solid rgba(234,179,8,0.22)',
          padding: '28px 36px',
          display: 'flex', alignItems: 'center', gap: '20px',
        }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '50%',
            background: 'rgba(234,179,8,0.12)', border: '2px solid rgba(234,179,8,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <ShieldAlert size={26} color="#eab308" />
          </div>
          <div>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', fontWeight: 700, color: 'rgba(251,191,36,0.7)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: '4px' }}>
              Analysis Inconclusive
            </p>
            <h3 style={{ fontFamily: '"Playfair Display", Georgia, serif', fontSize: '26px', fontWeight: 700, color: '#fbbf24', margin: 0, lineHeight: 1.1 }}>
              Result Unclear
            </h3>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: 'rgba(255,255,255,0.55)', margin: '4px 0 0' }}>
              The AI flagged potential issues but did not produce structured violations
            </p>
          </div>
        </div>
      )}

      {/* Metadata pills */}
      <div style={{
        padding: '16px 36px',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', gap: '10px', flexWrap: 'wrap',
      }}>
        {[
          { emoji: '📹', label: 'Video ID',   value: videoUrl || '—' },
          { emoji: '⚖️',  label: 'Status',    value: block.status },
          { emoji: '🔍', label: 'Violations', value: String(issues.length) },
        ].map(({ emoji, label, value }) => (
          <div key={label} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px', padding: '6px 12px',
          }}>
            <span style={{ fontSize: '13px' }}>{emoji}</span>
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '10px', color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              {label}
            </span>
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#fff', fontWeight: 600, marginLeft: '2px' }}>
              {label === 'Video ID' ? value.slice(0, 40) + (value.length > 40 ? '…' : '') : value}
            </span>
          </div>
        ))}
      </div>

      {/* AI Summary */}
      <div style={{ padding: '24px 36px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <div style={{
            width: '30px', height: '30px', borderRadius: '8px',
            background: 'rgba(99,102,241,0.18)', border: '1px solid rgba(99,102,241,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Sparkles size={14} color="#a5b4fc" />
          </div>
          <div>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', fontWeight: 700, color: '#ffffff', margin: 0 }}>AI Analysis Summary</p>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', color: 'rgba(165,180,252,0.75)', margin: 0 }}>Generated by GPT-4o</p>
          </div>
        </div>
        {block.report ? (
          <div className="scrollbar-thin" style={{
            fontFamily: 'Inter, sans-serif', fontSize: '14px', lineHeight: 1.8,
            color: 'rgba(255,255,255,0.82)', whiteSpace: 'pre-wrap',
            maxHeight: '200px', overflowY: 'auto', paddingRight: '6px',
          }}>
            {block.report}
          </div>
        ) : (
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', color: 'rgba(255,255,255,0.28)', fontStyle: 'italic' }}>
            No summary was generated for this run.
          </p>
        )}
      </div>

      {/* Violations list */}
      {kind === 'fail' && issues.length > 0 && (
        <div style={{ padding: '24px 36px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <FileText size={13} color="rgba(255,255,255,0.4)" />
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.14em' }}>
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
          <motion.div variants={listContainer} initial="hidden" animate="visible"
            style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {issues.map((issue, index) => (
              <motion.div key={index} variants={listItem}>
                <ViolationCard issue={issue} index={index} />
              </motion.div>
            ))}
          </motion.div>
        </div>
      )}
    </>
  );
};

// ── Main ResultsState ─────────────────────────────────────────────────────
const ResultsState = ({ result, onRunAnother, videoUrl }: ResultsStateProps) => {
  const [activeTab, setActiveTab] = useState<Tab>('youtube');

  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `audit-${result.video_id}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const activeBlock = activeTab === 'youtube' ? result.youtube_audit : result.influencer_audit;

  return (
    <motion.div
      key="results"
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      style={{ width: '100%', maxWidth: '860px', margin: '0 auto' }}
    >
      <div style={{
        background: 'rgba(8, 14, 40, 0.82)',
        border: '1px solid rgba(255,255,255,0.13)',
        borderRadius: '28px',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        overflow: 'hidden',
      }}>

        {/* ── Tab selector ─────────────────────────────────────────── */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          padding: '0 36px',
          gap: '4px',
        }}>
          {(Object.entries(TAB_CONFIG) as [Tab, typeof TAB_CONFIG[Tab]][]).map(([tab, cfg]) => {
            const isActive = activeTab === tab;
            const block = tab === 'youtube' ? result.youtube_audit : result.influencer_audit;
            const isPassing = block.status === 'PASS';
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '16px 20px',
                  background: 'none', border: 'none', cursor: 'pointer',
                  borderBottom: isActive ? `2px solid ${cfg.color}` : '2px solid transparent',
                  marginBottom: '-1px',
                  transition: 'all 0.2s',
                }}
              >
                <cfg.Icon size={15} color={isActive ? cfg.color : 'rgba(255,255,255,0.4)'} />
                <span style={{
                  fontFamily: 'Inter, sans-serif', fontSize: '13px', fontWeight: isActive ? 600 : 400,
                  color: isActive ? '#fff' : 'rgba(255,255,255,0.45)',
                  whiteSpace: 'nowrap',
                }}>
                  {cfg.label}
                </span>
                {/* Status badge on tab */}
                <span style={{
                  padding: '2px 8px', borderRadius: '99px',
                  fontFamily: 'Inter, sans-serif', fontSize: '10px', fontWeight: 700,
                  background: isPassing ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                  border: `1px solid ${isPassing ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'}`,
                  color: isPassing ? '#34d399' : '#f87171',
                }}>
                  {block.status}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Active audit panel ───────────────────────────────────── */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          <AuditPanel block={activeBlock} videoUrl={videoUrl} />
        </motion.div>

        {/* ── Action buttons ───────────────────────────────────────── */}
        <div style={{
          padding: '24px 36px',
          display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap',
        }}>
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

      </div>
    </motion.div>
  );
};

export default ResultsState;
