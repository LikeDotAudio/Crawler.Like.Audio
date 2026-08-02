import React from 'react';

export function SpiderLogo({ className = '' }: { className?: string }) {
  return (
    <div className={`spider-logo-container ${className}`}>
      <style>{`
        .spider-logo-container {
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        
        .spider-leg {
          transition: transform 0.1s ease-in-out;
        }
        
        .group:hover .spider-leg-l1, .spider-logo-container:hover .spider-leg-l1 {
          animation: wiggle-l1 0.4s infinite alternate;
          transform-origin: 42px 40px;
        }
        .group:hover .spider-leg-l2, .spider-logo-container:hover .spider-leg-l2 {
          animation: wiggle-l2 0.3s infinite alternate 0.1s;
          transform-origin: 40px 50px;
        }
        .group:hover .spider-leg-l3, .spider-logo-container:hover .spider-leg-l3 {
          animation: wiggle-l3 0.35s infinite alternate 0.2s;
          transform-origin: 40px 60px;
        }
        .group:hover .spider-leg-l4, .spider-logo-container:hover .spider-leg-l4 {
          animation: wiggle-l4 0.45s infinite alternate 0.3s;
          transform-origin: 45px 70px;
        }
        
        .group:hover .spider-leg-r1, .spider-logo-container:hover .spider-leg-r1 {
          animation: wiggle-r1 0.4s infinite alternate 0.2s;
          transform-origin: 58px 40px;
        }
        .group:hover .spider-leg-r2, .spider-logo-container:hover .spider-leg-r2 {
          animation: wiggle-r2 0.35s infinite alternate 0.1s;
          transform-origin: 60px 50px;
        }
        .group:hover .spider-leg-r3, .spider-logo-container:hover .spider-leg-r3 {
          animation: wiggle-r3 0.3s infinite alternate;
          transform-origin: 60px 60px;
        }
        .group:hover .spider-leg-r4, .spider-logo-container:hover .spider-leg-r4 {
          animation: wiggle-r4 0.4s infinite alternate 0.15s;
          transform-origin: 55px 70px;
        }

        @keyframes wiggle-l1 { 0% { transform: rotate(0deg); } 100% { transform: rotate(15deg); } }
        @keyframes wiggle-l2 { 0% { transform: rotate(0deg); } 100% { transform: rotate(20deg); } }
        @keyframes wiggle-l3 { 0% { transform: rotate(0deg); } 100% { transform: rotate(-15deg); } }
        @keyframes wiggle-l4 { 0% { transform: rotate(0deg); } 100% { transform: rotate(-20deg); } }
        
        @keyframes wiggle-r1 { 0% { transform: rotate(0deg); } 100% { transform: rotate(-15deg); } }
        @keyframes wiggle-r2 { 0% { transform: rotate(0deg); } 100% { transform: rotate(-20deg); } }
        @keyframes wiggle-r3 { 0% { transform: rotate(0deg); } 100% { transform: rotate(15deg); } }
        @keyframes wiggle-r4 { 0% { transform: rotate(0deg); } 100% { transform: rotate(20deg); } }
      `}</style>
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        viewBox="0 0 100 100" 
        className="w-full h-full fill-current stroke-current" 
        strokeWidth="4" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      >
        {/* Left Legs */}
        <path className="spider-leg spider-leg-l1" d="M42 40 Q25 15, 10 30" fill="none" />
        <path className="spider-leg spider-leg-l2" d="M40 50 Q15 40, 5 60" fill="none" />
        <path className="spider-leg spider-leg-l3" d="M40 60 Q15 70, 10 90" fill="none" />
        <path className="spider-leg spider-leg-l4" d="M45 70 Q30 90, 20 95" fill="none" />
        
        {/* Right Legs */}
        <path className="spider-leg spider-leg-r1" d="M58 40 Q75 15, 90 30" fill="none" />
        <path className="spider-leg spider-leg-r2" d="M60 50 Q85 40, 95 60" fill="none" />
        <path className="spider-leg spider-leg-r3" d="M60 60 Q85 70, 90 90" fill="none" />
        <path className="spider-leg spider-leg-r4" d="M55 70 Q70 90, 80 95" fill="none" />

        {/* Head */}
        <circle cx="50" cy="38" r="8" fill="currentColor" stroke="none" />
        {/* Eyes */}
        <circle cx="47" cy="36" r="2" fill="var(--background)" stroke="none" />
        <circle cx="53" cy="36" r="2" fill="var(--background)" stroke="none" />
        
        {/* Body */}
        <circle cx="50" cy="60" r="16" fill="currentColor" stroke="none" />
      </svg>
    </div>
  );
}
