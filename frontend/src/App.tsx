import { useState, useEffect, useRef, useCallback } from 'react';
import axios, { AxiosError } from 'axios';
import type { AppState, AuditResponse, PipelineStep } from './types/api';
import Navigation from './components/Navigation';
import FloatingOrbs from './components/FloatingOrbs';
import Hero from './components/Hero';
import HowItWorks from './components/HowItWorks';
import Footer from './components/Footer';

// ── Initial pipeline steps ────────────────────────────────────────────────────
const INITIAL_STEPS: PipelineStep[] = [
  { id: 1, label: 'Downloading Video from YouTube', status: 'pending' },
  { id: 2, label: 'Uploading to Azure Video Indexer', status: 'pending' },
  { id: 3, label: 'Extracting Transcript & OCR', status: 'pending' },
  { id: 4, label: 'Querying Compliance Knowledge Base', status: 'pending' },
  { id: 5, label: 'Running GPT-4o Analysis', status: 'pending' },
  { id: 6, label: 'Generating Audit Report', status: 'pending' },
];

// ── App state snapshot ────────────────────────────────────────────────────────
interface AppStateSnapshot {
  appState: AppState;
  result: AuditResponse | null;
  errorMessage: string | null;
  processingSteps: PipelineStep[];
  startTime: number;
  videoUrl: string;
}

const INITIAL_STATE: AppStateSnapshot = {
  appState: 'IDLE',
  result: null,
  errorMessage: null,
  processingSteps: INITIAL_STEPS,
  startTime: 0,
  videoUrl: '',
};

// ── App Component ─────────────────────────────────────────────────────────────
export default function App() {
  const [state, setState] = useState<AppStateSnapshot>(INITIAL_STATE);
  const stepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentStepRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stepTimerRef.current) clearInterval(stepTimerRef.current);
      abortControllerRef.current?.abort();
    };
  }, []);

  // Advance one pipeline step every 15 seconds (cosmetic UX only)
  const advanceStep = useCallback(() => {
    currentStepRef.current += 1;
    const next = currentStepRef.current;

    setState((prev) => {
      if (prev.appState !== 'PROCESSING') return prev;

      if (next >= INITIAL_STEPS.length) {
        if (stepTimerRef.current) clearInterval(stepTimerRef.current);
        return {
          ...prev,
          processingSteps: prev.processingSteps.map((s, i) => ({
            ...s,
            status: i < INITIAL_STEPS.length - 1 ? 'done' : 'active',
          })),
        };
      }

      return {
        ...prev,
        processingSteps: prev.processingSteps.map((s, i) => {
          if (i < next) return { ...s, status: 'done' };
          if (i === next) return { ...s, status: 'active' };
          return s;
        }),
      };
    });
  }, []);

  const handleSubmit = useCallback(
    async (url: string) => {
      currentStepRef.current = 0;
      abortControllerRef.current = new AbortController();

      setState({
        ...INITIAL_STATE,
        appState: 'PROCESSING',
        startTime: Date.now(),
        videoUrl: url,
        processingSteps: INITIAL_STEPS.map((s, i) => ({
          ...s,
          status: i === 0 ? 'active' : 'pending',
        })),
      });

      if (stepTimerRef.current) clearInterval(stepTimerRef.current);
      stepTimerRef.current = setInterval(advanceStep, 15_000);

      try {
        // 12-minute timeout — the pipeline can take up to 10 minutes
        const response = await axios.post<AuditResponse>(
          '/api/audit',
          { video_url: url },
          {
            timeout: 720_000,
            signal: abortControllerRef.current.signal,
            headers: { 'Content-Type': 'application/json' },
          }
        );

        if (stepTimerRef.current) clearInterval(stepTimerRef.current);
        setState((prev) => ({
          ...prev,
          appState: 'RESULTS',
          result: response.data,
          processingSteps: prev.processingSteps.map((s) => ({ ...s, status: 'done' })),
        }));
      } catch (err) {
        if (stepTimerRef.current) clearInterval(stepTimerRef.current);

        // Ignore intentional abort from user reset
        if (axios.isCancel(err)) return;

        let message = 'The audit pipeline encountered an unexpected error. Please try again.';

        if (err instanceof AxiosError) {
          if (err.code === 'ECONNABORTED' || err.code === 'ERR_NETWORK') {
            message =
              'The request timed out. The backend pipeline may still be running — ' +
              'please wait a moment and try again.';
          } else if (err.response?.status === 500) {
            const detail = (err.response.data as { detail?: string })?.detail;
            message = detail
              ? `Pipeline error: ${detail}`
              : 'The audit pipeline failed on the server. Please check the backend logs.';
          } else if (err.response?.status === 422) {
            message = 'Invalid request. Please ensure you have entered a valid YouTube URL.';
          } else if (!err.response) {
            message =
              'Unable to connect to the backend. Please ensure the FastAPI server is running at http://localhost:8000.';
          }
        }

        setState((prev) => ({
          ...prev,
          appState: 'ERROR',
          errorMessage: message,
        }));
      }
    },
    [advanceStep]
  );

  const handleReset = useCallback(() => {
    if (stepTimerRef.current) clearInterval(stepTimerRef.current);
    abortControllerRef.current?.abort();
    setState(INITIAL_STATE);
  }, []);

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      {/* Decorative background orbs */}
      <FloatingOrbs />

      {/* Sticky navigation */}
      <Navigation onLogoClick={handleReset} />

      {/* Main content */}
      <main style={{ position: 'relative', zIndex: 10 }}>
        <Hero
          appState={state.appState}
          result={state.result}
          errorMessage={state.errorMessage}
          onSubmit={handleSubmit}
          onReset={handleReset}
          processingSteps={state.processingSteps}
          startTime={state.startTime}
          videoUrl={state.videoUrl}
        />

        {state.appState === 'IDLE' && (
          <>
            <HowItWorks />
            <Footer />
          </>
        )}
      </main>
    </div>
  );
}
