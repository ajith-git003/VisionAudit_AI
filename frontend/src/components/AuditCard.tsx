import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Youtube, Search, AlertCircle, Lock, Zap, CheckCircle } from 'lucide-react';
import { getValidationError } from '../utils/validation';

interface AuditCardProps {
  onSubmit: (url: string) => void;
}

const AuditCard = ({ onSubmit }: AuditCardProps) => {
  const [url, setUrl] = useState('');
  const [touched, setTouched] = useState(false);

  const error = touched ? getValidationError(url) : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!getValidationError(url)) {
      onSubmit(url.trim());
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
      <form onSubmit={handleSubmit} noValidate>
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

        {/* URL Input */}
        <div style={{ position: 'relative', marginBottom: error ? '8px' : '20px' }}>
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
              ...(error ? { borderColor: 'rgba(239,68,68,0.6)' } : {}),
            }}
            aria-describedby={error ? 'url-error' : undefined}
            aria-invalid={error ? 'true' : undefined}
            autoComplete="url"
            spellCheck={false}
          />
        </div>

        {/* Inline validation error */}
        <AnimatePresence>
          {error && (
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
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Submit Button */}
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
      </form>
    </motion.div>
  );
};

export default AuditCard;
