import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Youtube, Search, AlertCircle, Lock, Zap, CheckCircle, Upload, FileVideo } from 'lucide-react';
import { getValidationError } from '../utils/validation';

interface AuditCardProps {
  onSubmit: (url: string) => void;
  onFileSubmit: (file: File) => void;
}

const AuditCard = ({ onSubmit, onFileSubmit }: AuditCardProps) => {
  const [tab, setTab] = useState<'url' | 'file'>('url');

  // URL tab state
  const [url, setUrl] = useState('');
  const [touched, setTouched] = useState(false);

  // File tab state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const urlError = touched ? getValidationError(url) : null;

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!getValidationError(url)) {
      onSubmit(url.trim());
    }
  };

  const handleFileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFile) {
      onFileSubmit(selectedFile);
    }
  };

  const handleFileChange = (file: File | null) => {
    setSelectedFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('video/')) {
      setSelectedFile(file);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.6, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="glass-card"
      style={{
        borderRadius: '24px',
        padding: '40px',
        width: '100%',
        maxWidth: '700px',
        margin: '0 auto',
        boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
      }}
    >
      {/* Label */}
      <p
        style={{
          fontFamily: 'Inter, sans-serif',
          fontSize: '11px',
          fontWeight: 600,
          color: 'rgba(255,255,255,0.5)',
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          marginBottom: '20px',
        }}
      >
        Compliance Audit Engine
      </p>

      {/* Tab Toggle */}
      <div
        style={{
          display: 'flex',
          gap: '4px',
          background: 'rgba(255,255,255,0.07)',
          borderRadius: '10px',
          padding: '4px',
          marginBottom: '24px',
        }}
      >
        {(['url', 'file'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              padding: '9px 16px',
              borderRadius: '7px',
              border: 'none',
              fontFamily: 'Inter, sans-serif',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              background: tab === t ? 'rgba(255,255,255,0.15)' : 'transparent',
              color: tab === t ? '#ffffff' : 'rgba(255,255,255,0.45)',
            }}
          >
            {t === 'url' ? <Youtube size={14} color={tab === 'url' ? '#ff0000' : 'rgba(255,255,255,0.4)'} /> : <Upload size={14} />}
            {t === 'url' ? 'YouTube URL' : 'Upload Video'}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {tab === 'url' ? (
          <motion.form
            key="url-form"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.2 }}
            onSubmit={handleUrlSubmit}
            noValidate
          >
            {/* URL Input */}
            <div style={{ position: 'relative', marginBottom: urlError ? '8px' : '20px' }}>
              <div
                style={{
                  position: 'absolute',
                  left: '16px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none',
                  zIndex: 1,
                }}
              >
                <Youtube size={18} color="#ff0000" />
              </div>
              <input
                id="video-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onBlur={() => setTouched(true)}
                placeholder="Paste YouTube video URL..."
                className="glass-input"
                style={{
                  width: '100%',
                  padding: '18px 20px 18px 48px',
                  borderRadius: '12px',
                  fontSize: '15px',
                  fontFamily: 'Inter, sans-serif',
                  boxSizing: 'border-box',
                  ...(urlError ? { borderColor: 'rgba(239,68,68,0.6)' } : {}),
                }}
                aria-describedby={urlError ? 'url-error' : undefined}
                aria-invalid={urlError ? 'true' : undefined}
                autoComplete="url"
                spellCheck={false}
              />
            </div>

            <AnimatePresence>
              {urlError && (
                <motion.div
                  id="url-error"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  role="alert"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: '#ef4444',
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '12px',
                    marginBottom: '16px',
                  }}
                >
                  <AlertCircle size={13} />
                  {urlError}
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button
              type="submit"
              className="hero-gradient"
              whileHover={{ translateY: -2, boxShadow: '0 8px 24px rgba(30,58,138,0.4)' }}
              whileTap={{ scale: 0.98 }}
              style={{
                width: '100%',
                padding: '18px',
                borderRadius: '12px',
                border: 'none',
                color: '#ffffff',
                fontFamily: 'Inter, sans-serif',
                fontSize: '16px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                cursor: 'pointer',
                marginBottom: '20px',
                boxShadow: '0 4px 16px rgba(30,58,138,0.3)',
              }}
            >
              <Search size={18} />
              Run Compliance Audit
            </motion.button>
          </motion.form>
        ) : (
          <motion.form
            key="file-form"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
            onSubmit={handleFileSubmit}
          >
            {/* Drag & Drop Zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              style={{
                border: `2px dashed ${dragOver ? 'rgba(99,102,241,0.8)' : selectedFile ? 'rgba(34,197,94,0.5)' : 'rgba(255,255,255,0.2)'}`,
                borderRadius: '12px',
                padding: '32px 20px',
                textAlign: 'center',
                cursor: 'pointer',
                marginBottom: '20px',
                background: dragOver ? 'rgba(99,102,241,0.07)' : selectedFile ? 'rgba(34,197,94,0.05)' : 'rgba(255,255,255,0.03)',
                transition: 'all 0.2s',
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                style={{ display: 'none' }}
                onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
              />
              {selectedFile ? (
                <>
                  <FileVideo size={32} color="rgba(34,197,94,0.8)" style={{ margin: '0 auto 12px' }} />
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', color: '#ffffff', marginBottom: '4px', fontWeight: 500 }}>
                    {selectedFile.name}
                  </p>
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
                    {(selectedFile.size / 1024 / 1024).toFixed(1)} MB — click to change
                  </p>
                </>
              ) : (
                <>
                  <Upload size={32} color="rgba(255,255,255,0.3)" style={{ margin: '0 auto 12px' }} />
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', color: 'rgba(255,255,255,0.7)', marginBottom: '6px' }}>
                    Drag & drop a video file, or click to browse
                  </p>
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}>
                    MP4, MOV, AVI, MKV supported
                  </p>
                </>
              )}
            </div>

            {/* Helper hint */}
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: 'rgba(255,255,255,0.35)', marginBottom: '20px', lineHeight: 1.5 }}>
              Can't use YouTube URL? Download the video first using a tool like vidssave.com/yt, then upload it here.
            </p>

            <motion.button
              type="submit"
              disabled={!selectedFile}
              className="hero-gradient"
              whileHover={selectedFile ? { translateY: -2, boxShadow: '0 8px 24px rgba(30,58,138,0.4)' } : {}}
              whileTap={selectedFile ? { scale: 0.98 } : {}}
              style={{
                width: '100%',
                padding: '18px',
                borderRadius: '12px',
                border: 'none',
                color: '#ffffff',
                fontFamily: 'Inter, sans-serif',
                fontSize: '16px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                cursor: selectedFile ? 'pointer' : 'not-allowed',
                marginBottom: '20px',
                boxShadow: '0 4px 16px rgba(30,58,138,0.3)',
                opacity: selectedFile ? 1 : 0.5,
              }}
            >
              <Search size={18} />
              Run Compliance Audit
            </motion.button>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Trust signals */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '20px',
          flexWrap: 'wrap',
        }}
      >
        {[
          { icon: Lock, label: 'Secure' },
          { icon: Zap, label: 'Results in ~2 min' },
          { icon: CheckCircle, label: 'No signup' },
        ].map(({ icon: Icon, label }) => (
          <span
            key={label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              fontFamily: 'Inter, sans-serif',
              fontSize: '12px',
              color: 'rgba(255,255,255,0.45)',
            }}
          >
            <Icon size={12} />
            {label}
          </span>
        ))}
      </div>
    </motion.div>
  );
};

export default AuditCard;
