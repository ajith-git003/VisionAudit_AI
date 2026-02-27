import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, RefreshCw } from 'lucide-react';
import type { AppState, AuditResponse, PipelineStep } from '../types/api';
import AuditCard from './AuditCard';
import ProcessingState from './ProcessingState';
import ResultsState from './ResultsState';

interface HeroProps {
  appState: AppState;
  result: AuditResponse | null;
  errorMessage: string | null;
  onSubmit: (url: string) => void;
  onFileSubmit: (file: File) => void;
  onReset: () => void;
  processingSteps: PipelineStep[];
  startTime: number;
  videoUrl: string;
}

const Hero = ({
  appState,
  result,
  errorMessage,
  onSubmit,
  onFileSubmit,
  onReset,
  processingSteps,
  startTime,
  videoUrl,
}: HeroProps) => {
  return (
    <section
      className="hero-gradient"
      style={{
        position: 'relative',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '100px 24px 80px',
        overflow: 'hidden',
      }}
    >
      {/* Hero text — shown only when IDLE */}
      <AnimatePresence>
        {appState === 'IDLE' && (
          <motion.div
            key="hero-text"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            style={{
              textAlign: 'center',
              maxWidth: '760px',
              marginBottom: '48px',
            }}
          >
            {/* Small label */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 16px',
                borderRadius: '99px',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                fontFamily: 'Inter, sans-serif',
                fontSize: '12px',
                fontWeight: 500,
                color: 'rgba(255,255,255,0.8)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginBottom: '28px',
              }}
            >
              ◈ AI-Powered Compliance Auditing Platform
            </div>

            {/* Main headline */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.6 }}
              style={{
                fontFamily: '"Playfair Display", Georgia, serif',
                fontSize: 'clamp(44px, 7vw, 72px)',
                fontWeight: 400,
                color: '#ffffff',
                lineHeight: 1.1,
                letterSpacing: '-0.02em',
                marginBottom: '20px',
              }}
            >
              Audit your video content.
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.6 }}
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: '18px',
                color: 'rgba(255,255,255,0.7)',
                lineHeight: 1.6,
                maxWidth: '600px',
                margin: '0 auto 48px',
              }}
            >
              Transform hours of manual compliance review into seconds. Our AI pipeline
              analyzes transcripts, on-screen text, and visual content against regulatory rules.
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main interactive area — cross-fades between all 4 states */}
      <div style={{ width: '100%', maxWidth: '760px' }}>
        <AnimatePresence mode="wait">
          {appState === 'IDLE' && (
            <AuditCard key="idle" onSubmit={onSubmit} onFileSubmit={onFileSubmit} />
          )}

          {appState === 'PROCESSING' && (
            <ProcessingState
              key="processing"
              steps={processingSteps}
              startTime={startTime}
            />
          )}

          {appState === 'RESULTS' && result && (
            <ResultsState
              key="results"
              result={result}
              onRunAnother={onReset}
              videoUrl={videoUrl}
            />
          )}

          {appState === 'ERROR' && (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="glass-card"
              style={{
                borderRadius: '20px',
                padding: '48px 40px',
                textAlign: 'center',
                maxWidth: '520px',
                margin: '0 auto',
              }}
            >
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 20px',
                }}
              >
                <AlertCircle size={28} color="#ef4444" />
              </div>
              <h2
                style={{
                  fontFamily: '"Playfair Display", Georgia, serif',
                  fontSize: '28px',
                  fontWeight: 500,
                  color: '#ffffff',
                  marginBottom: '12px',
                }}
              >
                Audit Failed
              </h2>
              <p
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '14px',
                  color: 'rgba(255,255,255,0.55)',
                  lineHeight: 1.65,
                  marginBottom: '28px',
                }}
              >
                {errorMessage ?? 'An unexpected error occurred. Please try again.'}
              </p>
              <button
                onClick={onReset}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 24px',
                  borderRadius: '10px',
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: '#ffffff',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                <RefreshCw size={15} />
                Try Again
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </section>
  );
};

export default Hero;
