import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield } from 'lucide-react';

interface NavigationProps {
  onLogoClick: () => void;
}

const Navigation = ({ onLogoClick }: NavigationProps) => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <motion.nav
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="glass-nav fixed top-0 left-0 right-0 z-50"
      style={{
        boxShadow: scrolled ? '0 4px 24px rgba(0,0,0,0.08)' : 'none',
        transition: 'box-shadow 0.3s ease',
      }}
    >
      <div
        style={{
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '0 40px',
          height: '70px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Logo only */}
        <button
          onClick={onLogoClick}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
          }}
          aria-label="Go to homepage"
        >
          <div
            className="hero-gradient"
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '9px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Shield size={17} color="white" strokeWidth={2.5} />
          </div>
          <span
            style={{
              fontFamily: '"Playfair Display", Georgia, serif',
              fontSize: '22px',
              fontWeight: 600,
              color: '#0f172a',
              letterSpacing: '-0.01em',
            }}
          >
            VisionAudit{' '}
            <span style={{ color: '#2563eb' }}>AI</span>
          </span>
        </button>
      </div>
    </motion.nav>
  );
};

export default Navigation;
