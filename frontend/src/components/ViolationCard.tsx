import { AlertTriangle, AlertCircle, Info, XCircle } from 'lucide-react';
import type { ComplianceIssue } from '../types/api';
import {
  normalizeSeverity,
  getSeverityHexColor,
} from '../utils/validation';

interface ViolationCardProps {
  issue: ComplianceIssue;
  index: number;
}

const SEVERITY_ICONS = {
  CRITICAL: XCircle,
  MAJOR: AlertCircle,
  WARNING: AlertTriangle,
  MINOR: Info,
};

const SEVERITY_LABEL_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  CRITICAL: { bg: 'rgba(239,68,68,0.12)', color: '#f87171', border: 'rgba(239,68,68,0.35)' },
  MAJOR:    { bg: 'rgba(249,115,22,0.12)', color: '#fb923c', border: 'rgba(249,115,22,0.35)' },
  WARNING:  { bg: 'rgba(234,179,8,0.12)',  color: '#fbbf24', border: 'rgba(234,179,8,0.35)'  },
  MINOR:    { bg: 'rgba(59,130,246,0.12)', color: '#60a5fa', border: 'rgba(59,130,246,0.35)' },
};

const ViolationCard = ({ issue }: ViolationCardProps) => {
  const severity = normalizeSeverity(issue.severity);
  const Icon = SEVERITY_ICONS[severity];
  const hexColor = getSeverityHexColor(issue.severity);
  const label = SEVERITY_LABEL_STYLE[severity] ?? SEVERITY_LABEL_STYLE.MINOR;

  return (
    /* Plain div — animation handled entirely by the motion.div wrapper in ResultsState */
    <div
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.09)',
        borderLeft: `3px solid ${hexColor}`,
        borderRadius: '12px',
        padding: '18px 22px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
        {/* Icon box */}
        <div
          style={{
            flexShrink: 0,
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            background: label.bg,
            border: `1px solid ${label.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon size={18} color={hexColor} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Category + badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              flexWrap: 'wrap',
              marginBottom: '8px',
            }}
          >
            <h3
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: '14px',
                fontWeight: 600,
                color: '#ffffff',
                margin: 0,
              }}
            >
              {issue.category}
            </h3>
            <span
              style={{
                flexShrink: 0,
                background: label.bg,
                color: label.color,
                border: `1px solid ${label.border}`,
                fontSize: '10px',
                fontFamily: 'Inter, sans-serif',
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: '99px',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
              }}
            >
              {severity}
            </span>
          </div>

          {/* Description */}
          <p
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '14px',
              color: 'rgba(255,255,255,0.78)',
              lineHeight: 1.65,
              margin: 0,
            }}
          >
            {issue.description}
          </p>

          {issue.timestamp && (
            <p
              style={{
                marginTop: '6px',
                fontFamily: '"Courier New", monospace',
                fontSize: '11px',
                color: 'rgba(255,255,255,0.3)',
              }}
            >
              @ {issue.timestamp}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ViolationCard;
