import { Shield } from 'lucide-react';

const Footer = () => (
  <footer
    style={{
      backgroundColor: '#050a1a',
      borderTop: '1px solid rgba(255,255,255,0.08)',
      padding: '40px',
      textAlign: 'center',
    }}
  >
    <div
      style={{
        maxWidth: '1280px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '16px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div
          className="hero-gradient"
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '7px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Shield size={14} color="white" strokeWidth={2.5} />
        </div>
        <span
          style={{
            fontFamily: '"Playfair Display", Georgia, serif',
            fontSize: '18px',
            fontWeight: 600,
            color: 'rgba(255,255,255,0.8)',
          }}
        >
          VisionAudit AI
        </span>
      </div>
      <p
        style={{
          fontFamily: 'Inter, sans-serif',
          fontSize: '13px',
          color: 'rgba(255,255,255,0.4)',
          margin: 0,
        }}
      >
        © {new Date().getFullYear()} Vision Audit AI · Powered by Azure · GPT-4o · LangGraph
      </p>
    </div>
  </footer>
);

export default Footer;
