import { memo } from 'react';

const FloatingOrbs = memo(() => {
  return (
    <div
      className="pointer-events-none fixed inset-0 overflow-hidden z-0"
      aria-hidden="true"
    >
      {/* Orb 1: Purple – top right */}
      <div
        className="absolute rounded-full"
        style={{
          width: '600px',
          height: '600px',
          top: '-100px',
          right: '-80px',
          background: 'radial-gradient(circle, rgba(139, 92, 246, 0.35) 0%, rgba(139, 92, 246, 0) 70%)',
          filter: 'blur(80px)',
          animation: 'float-orb 10s ease-in-out infinite',
          animationDelay: '0s',
        }}
      />

      {/* Orb 2: Pink – center right */}
      <div
        className="absolute rounded-full"
        style={{
          width: '450px',
          height: '450px',
          top: '40%',
          right: '5%',
          background: 'radial-gradient(circle, rgba(236, 72, 153, 0.3) 0%, rgba(236, 72, 153, 0) 70%)',
          filter: 'blur(80px)',
          animation: 'float-orb 8s ease-in-out infinite',
          animationDelay: '-3s',
        }}
      />

      {/* Orb 3: Teal – bottom left */}
      <div
        className="absolute rounded-full"
        style={{
          width: '500px',
          height: '500px',
          bottom: '-80px',
          left: '-60px',
          background: 'radial-gradient(circle, rgba(20, 184, 166, 0.3) 0%, rgba(20, 184, 166, 0) 70%)',
          filter: 'blur(80px)',
          animation: 'float-orb 9s ease-in-out infinite',
          animationDelay: '-6s',
        }}
      />
    </div>
  );
});

FloatingOrbs.displayName = 'FloatingOrbs';
export default FloatingOrbs;
