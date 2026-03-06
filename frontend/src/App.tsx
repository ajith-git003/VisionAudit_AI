import { useState, useEffect, useRef, useCallback } from 'react';
import axios, { AxiosError } from 'axios';
import type { AppState, AuditResponse, PipelineStep } from './types/api';
import Navigation from './components/Navigation';
import FloatingOrbs from './components/FloatingOrbs';
import Hero from './components/Hero';
import HowItWorks from './components/HowItWorks';
import Footer from './components/Footer';

const FILE_UPLOAD_STEPS: PipelineStep[] = [
  { id: 1, label: 'Receiving Video File', status: 'pending' },
  { id: 2, label: 'Uploading to Azure Video Indexer', status: 'pending' },
  { id: 3, label: 'Extracting Transcript & OCR', status: 'pending' },
  { id: 4, label: 'Querying Compliance Knowledge Base', status: 'pending' },
  { id: 5, label: 'Running GPT-4o Analysis', status: 'pending' },
  { id: 6, label: 'Generating Audit Report', status: 'pending' },
];

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
  processingSteps: FILE_UPLOAD_STEPS,
  startTime: 0,
  videoUrl: '',
};

export default function App() {
  const [state, setState] = useState<AppStateSnapshot>(INITIAL_STATE);
  const stepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentStepRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      if (stepTimerRef.current) clearInterval(stepTimerRef.current);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  const advanceStep = useCallback(() => {
    currentStepRef.current += 1;
    const next = currentStepRef.current;
    setState((prev) => {
      if (prev.appState !== 'PROCESSING') return prev;
      if (next >= FILE_UPLOAD_STEPS.length) {
        if (stepTimerRef.current) clearInterval(stepTimerRef.current);
        return {
          ...prev,
          processingSteps: prev.processingSteps.map((s, i) => ({
            ...s,
            status: i < FILE_UPLOAD_STEPS.length - 1 ? 'done' : 'active',
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

  const handleFileSubmit = useCallback(
    async (file: File) => {
      currentStepRef.current = 0;
      if (stepTimerRef.current) clearInterval(stepTimerRef.current);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);

      setState({
        ...INITIAL_STATE,
        appState: 'PROCESSING',
        startTime: Date.now(),
        videoUrl: file.name,
        processingSteps: FILE_UPLOAD_STEPS.map((s, i) => ({
          ...s,
          status: i === 0 ? 'active' : 'pending',
        })),
      });

      stepTimerRef.current = setInterval(advanceStep, 15_000);

      const apiBase = import.meta.env.VITE_API_URL || '/api';

      try {
        // Step 1: Submit file, get job_id back immediately
        const formData = new FormData();
        formData.append('file', file);
        const submitRes = await axios.post<{ job_id: string; status: string }>(
          `${apiBase}/audit-file`,
          formData,
          { headers: { 'Content-Type': 'multipart/form-data' } }
        );
        const { job_id } = submitRes.data;

        // Step 2: Poll /status/{job_id} every 10 seconds
        pollTimerRef.current = setInterval(async () => {
          try {
            const pollRes = await axios.get<{
              job_id: string;
              status: string;
              result?: AuditResponse;
              error?: string;
            }>(`${apiBase}/status/${job_id}`);

            const { status, result, error } = pollRes.data;

            if (status === 'complete' && result) {
              if (stepTimerRef.current) clearInterval(stepTimerRef.current);
              if (pollTimerRef.current) clearInterval(pollTimerRef.current);
              setState((prev) => ({
                ...prev,
                appState: 'RESULTS',
                result,
                processingSteps: prev.processingSteps.map((s) => ({ ...s, status: 'done' })),
              }));
            } else if (status === 'failed') {
              if (stepTimerRef.current) clearInterval(stepTimerRef.current);
              if (pollTimerRef.current) clearInterval(pollTimerRef.current);
              setState((prev) => ({
                ...prev,
                appState: 'ERROR',
                errorMessage: error
                  ? `Pipeline error: ${error}`
                  : 'The audit pipeline failed on the server.',
              }));
            }
          } catch {
            // polling errors are transient — keep polling
          }
        }, 10_000);

      } catch (err) {
        if (stepTimerRef.current) clearInterval(stepTimerRef.current);
        if (pollTimerRef.current) clearInterval(pollTimerRef.current);

        let message = 'The audit pipeline encountered an unexpected error. Please try again.';
        if (err instanceof AxiosError) {
          if (err.response?.status === 500) {
            const detail = (err.response.data as { detail?: string })?.detail;
            message = detail ? `Pipeline error: ${detail}` : message;
          } else if (!err.response) {
            message = 'Unable to connect to the backend. Please ensure the FastAPI server is running.';
          }
        }
        setState((prev) => ({ ...prev, appState: 'ERROR', errorMessage: message }));
      }
    },
    [advanceStep]
  );

  // kept for prop compatibility with Hero/AuditCard
  const handleSubmit = useCallback((_url: string) => {}, []);

  const handleReset = useCallback(() => {
    if (stepTimerRef.current) clearInterval(stepTimerRef.current);
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    setState(INITIAL_STATE);
  }, []);

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      <FloatingOrbs />
      <Navigation onLogoClick={handleReset} />
      <main style={{ position: 'relative', zIndex: 10 }}>
        <Hero
          appState={state.appState}
          result={state.result}
          errorMessage={state.errorMessage}
          onSubmit={handleSubmit}
          onFileSubmit={handleFileSubmit}
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
