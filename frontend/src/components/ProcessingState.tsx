import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle,
  Circle,
  Loader2,
  Download,
  CloudUpload,
  FileText,
  Database,
  Sparkles,
  ClipboardCheck,
} from 'lucide-react';
import type { PipelineStep } from '../types/api';

interface ProcessingStateProps {
  steps: PipelineStep[];
  startTime: number;
}

// Icon for each pipeline step
const STEP_ICONS = [Download, CloudUpload, FileText, Database, Sparkles, ClipboardCheck];

const ProcessingState = ({ steps, startTime }: ProcessingStateProps) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  return (
    <motion.div
      key="processing"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -30 }}
      transition={{ duration: 0.5 }}
      style={{ width: '100%', maxWidth: '680px', margin: '0 auto', position: 'relative' }}
    >
      {/* ── Slow animated background glow ─────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          inset: '-60px',
          zIndex: 0,
          pointerEvents: 'none',
          overflow: 'hidden',
          borderRadius: '40px',
        }}
      >
        {/* Slow rotating gradient ring */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'conic-gradient(from 0deg, rgba(37,99,235,0.25), rgba(8,145,178,0.15), rgba(139,92,246,0.2), rgba(37,99,235,0.25))',
            borderRadius: '50%',
            filter: 'blur(40px)',
          }}
        />
        {/* Slow pulsing center glow */}
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.65, 0.4] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '300px',
            height: '300px',
            background: 'radial-gradient(circle, rgba(37,99,235,0.3) 0%, transparent 70%)',
            borderRadius: '50%',
            filter: 'blur(30px)',
          }}
        />
      </div>

      {/* ── Content (above glow) ──────────────────────────────────────── */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Pulsing Radar */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '36px' }}>
          <div
            style={{
              position: 'relative',
              width: '120px',
              height: '120px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              className="radar-glow"
              style={{ position: 'absolute', inset: 0, borderRadius: '50%' }}
            />
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '50%',
                  border: '1.5px solid rgba(37,99,235,0.55)',
                  animation: `radar-pulse 2s ease-out infinite`,
                  animationDelay: `${i * 0.67}s`,
                }}
              />
            ))}
            <div
              style={{
                position: 'relative',
                zIndex: 10,
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                background: 'rgba(37,99,235,0.18)',
                border: '1px solid rgba(37,99,235,0.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              >
                <Loader2 size={26} color="#60a5fa" />
              </motion.div>
            </div>
          </div>
        </div>

        {/* Headline */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <h2
            style={{
              fontFamily: '"Playfair Display", Georgia, serif',
              fontSize: '34px',
              fontWeight: 500,
              color: '#ffffff',
              marginBottom: '8px',
            }}
          >
            Analyzing Your Video
          </h2>
          <p
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '13px',
              color: 'rgba(255,255,255,0.5)',
            }}
          >
            Running full compliance audit pipeline &nbsp;·&nbsp; {minutes}m {String(seconds).padStart(2, '0')}s elapsed
          </p>
        </div>

        {/* Pipeline Steps Card */}
        <div
          className="glass-card"
          style={{ borderRadius: '20px', padding: '8px 0', marginBottom: '24px' }}
        >
          {steps.map((step, index) => {
            const StepIcon = STEP_ICONS[index] ?? ClipboardCheck;
            const isDone = step.status === 'done';
            const isActive = step.status === 'active';
            const isPending = step.status === 'pending';

            return (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.06 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  padding: '14px 24px',
                  borderBottom:
                    index < steps.length - 1
                      ? '1px solid rgba(255,255,255,0.06)'
                      : 'none',
                  transition: 'background 0.3s ease',
                  background: isActive ? 'rgba(37,99,235,0.08)' : 'transparent',
                  borderRadius: index === 0 ? '20px 20px 0 0' : index === steps.length - 1 ? '0 0 20px 20px' : '0',
                }}
              >
                {/* Step-specific icon */}
                <div
                  style={{
                    flexShrink: 0,
                    width: '34px',
                    height: '34px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isDone
                      ? 'rgba(52,211,153,0.12)'
                      : isActive
                      ? 'rgba(37,99,235,0.2)'
                      : 'rgba(255,255,255,0.05)',
                    border: isDone
                      ? '1px solid rgba(52,211,153,0.25)'
                      : isActive
                      ? '1px solid rgba(37,99,235,0.35)'
                      : '1px solid rgba(255,255,255,0.08)',
                    transition: 'all 0.3s ease',
                  }}
                >
                  <StepIcon
                    size={16}
                    color={isDone ? '#34d399' : isActive ? '#60a5fa' : 'rgba(255,255,255,0.25)'}
                    strokeWidth={1.75}
                  />
                </div>

                {/* Label */}
                <span
                  style={{
                    flex: 1,
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '14px',
                    fontWeight: isActive ? 600 : 400,
                    color: isDone
                      ? '#34d399'
                      : isActive
                      ? '#ffffff'
                      : 'rgba(255,255,255,0.3)',
                    transition: 'color 0.3s ease',
                  }}
                >
                  {step.label}
                </span>

                {/* Step status indicator (right side) */}
                <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {/* Step number — now clearly visible */}
                  <span
                    style={{
                      fontFamily: '"Courier New", monospace',
                      fontSize: '12px',
                      fontWeight: 700,
                      color: isDone
                        ? 'rgba(52,211,153,0.6)'
                        : isActive
                        ? 'rgba(96,165,250,0.8)'
                        : 'rgba(255,255,255,0.25)',
                      letterSpacing: '0.05em',
                      transition: 'color 0.3s ease',
                    }}
                  >
                    {String(index + 1).padStart(2, '0')}
                  </span>

                  {/* Status icon */}
                  {isDone && <CheckCircle size={16} color="#34d399" />}
                  {isActive && (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                    >
                      <Loader2 size={16} color="#60a5fa" />
                    </motion.div>
                  )}
                  {isPending && <Circle size={16} color="rgba(255,255,255,0.18)" />}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Progress Bar */}
        <div
          style={{
            height: '3px',
            background: 'rgba(255,255,255,0.08)',
            borderRadius: '99px',
            overflow: 'hidden',
            marginBottom: '10px',
          }}
        >
          <div
            style={{
              height: '100%',
              background: 'linear-gradient(90deg, #2563eb, #0891b2)',
              borderRadius: '99px',
              animation: 'progress-fill 90s linear forwards',
              width: '0%',
            }}
          />
        </div>
        <p
          style={{
            textAlign: 'center',
            fontFamily: 'Inter, sans-serif',
            fontSize: '11px',
            color: 'rgba(255,255,255,0.25)',
          }}
        >
          This typically takes 2–10 minutes · Do not close this tab
        </p>
      </div>
    </motion.div>
  );
};

export default ProcessingState;
