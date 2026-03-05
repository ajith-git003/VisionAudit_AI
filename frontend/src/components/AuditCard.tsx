import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Lock, Zap, CheckCircle, Upload, FileVideo, Search } from 'lucide-react';

interface AuditCardProps {
  onSubmit: (url: string) => void;        // kept for App.tsx compatibility (unused)
  onFileSubmit: (file: File) => void;
}

const AuditCard = ({ onFileSubmit }: AuditCardProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFile) {
      onFileSubmit(selectedFile);
    }
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

      <form onSubmit={handleFileSubmit}>
        {/* Drag & Drop Zone */}
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          style={{
            border: `2px dashed ${dragOver ? 'rgba(99,102,241,0.8)' : selectedFile ? 'rgba(34,197,94,0.5)' : 'rgba(255,255,255,0.2)'}`,
            borderRadius: '12px',
            padding: '40px 20px',
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
            onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
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
      </form>

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
