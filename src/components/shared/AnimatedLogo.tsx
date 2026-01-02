import React from 'react';

export const AnimatedLogo: React.FC<{ scale?: number }> = ({ scale = 1 }) => (
  <div 
    className="relative flex items-center justify-center group shrink-0"
    style={{ width: `${2.5 * scale}rem`, height: `${2.5 * scale}rem` }}
  >
    <div 
      className="absolute inset-0 bg-indigo-600 rounded-xl rotate-3 group-hover:rotate-12 transition-transform duration-500 shadow-xl shadow-indigo-500/20"
    />
    <div 
      className="absolute inset-0 bg-slate-900 rounded-xl -rotate-3 group-hover:rotate-0 transition-transform duration-500 border border-indigo-500/30 flex items-center justify-center text-white"
    >
      <div className="flex gap-[1px]">
        <span 
          className="font-black animate-hbb-pulse-1"
          style={{ fontSize: `${0.5 * scale}rem` }}
        >
          H
        </span>
        <span 
          className="font-black text-indigo-400 animate-hbb-pulse-2"
          style={{ fontSize: `${0.5 * scale}rem` }}
        >
          B
        </span>
        <span 
          className="font-black animate-hbb-pulse-3"
          style={{ fontSize: `${0.5 * scale}rem` }}
        >
          B
        </span>
      </div>
    </div>
    <div 
      className="absolute left-1/2 -translate-x-1/2 bg-indigo-400 rounded-full animate-bridge-glow"
      style={{ 
        bottom: `-${0.25 * scale}rem`,
        width: `${0.75 * scale}rem`,
        height: `${0.125 * scale}rem`
      }}
    />
  </div>
);
