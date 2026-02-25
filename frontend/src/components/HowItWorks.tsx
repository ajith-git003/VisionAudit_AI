import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Link, Brain, Shield } from 'lucide-react';

const STEPS = [
  {
    number: '01',
    icon: Link,
    title: 'Paste your YouTube URL',
    description:
      'Simply drop in any YouTube video link. Our system handles the rest — no account, no upload, no setup required.',
  },
  {
    number: '02',
    icon: Brain,
    title: 'AI extracts & analyzes',
    description:
      'We pull transcripts via Azure Video Indexer, run OCR on on-screen text, and cross-reference every claim against our compliance knowledge base.',
  },
  {
    number: '03',
    icon: Shield,
    title: 'Get structured compliance report',
    description:
      'Receive a detailed report with severity-scored violations — CRITICAL, MAJOR, WARNING, MINOR — plus a plain-language GPT-4o executive summary.',
  },
];

const HowItWorks = () => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px 0px' });

  return (
    <section
      ref={ref}
      style={{
        backgroundColor: '#050a1a',
        padding: '120px 40px',
      }}
      id="how-it-works"
    >
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          style={{ textAlign: 'center', marginBottom: '60px' }}
        >
          <p
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '11px',
              fontWeight: 700,
              color: 'rgba(255,255,255,0.4)',
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              marginBottom: '16px',
            }}
          >
            How It Works
          </p>
          <h2
            style={{
              fontFamily: '"Playfair Display", Georgia, serif',
              fontSize: '56px',
              fontWeight: 400,
              color: '#ffffff',
              lineHeight: 1.1,
              marginBottom: '16px',
            }}
          >
            From URL to report
            <br />
            in under 2 minutes.
          </h2>
          <p
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '16px',
              color: 'rgba(255,255,255,0.5)',
              maxWidth: '480px',
              margin: '0 auto',
              lineHeight: 1.6,
            }}
          >
            A fully automated pipeline from YouTube link to structured audit report.
          </p>
        </motion.div>

        {/* Three cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '24px',
          }}
        >
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 40 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: i * 0.15, ease: 'easeOut' }}
                whileHover={{ translateY: -4 }}
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '16px',
                  padding: '32px',
                  cursor: 'default',
                  transition: 'border-color 0.25s ease',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.2)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.1)';
                }}
              >
                {/* Number + Icon row */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    marginBottom: '20px',
                  }}
                >
                  <div
                    className="hero-gradient"
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon size={20} color="white" strokeWidth={1.5} />
                  </div>
                  <span
                    style={{
                      fontFamily: '"Playfair Display", Georgia, serif',
                      fontSize: '48px',
                      fontWeight: 700,
                      color: 'rgba(255,255,255,0.07)',
                      lineHeight: 1,
                    }}
                  >
                    {step.number}
                  </span>
                </div>

                <h3
                  style={{
                    fontFamily: '"Playfair Display", Georgia, serif',
                    fontSize: '22px',
                    fontWeight: 500,
                    color: '#ffffff',
                    marginBottom: '12px',
                  }}
                >
                  {step.title}
                </h3>
                <p
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '14px',
                    color: 'rgba(255,255,255,0.5)',
                    lineHeight: 1.65,
                    margin: 0,
                  }}
                >
                  {step.description}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
