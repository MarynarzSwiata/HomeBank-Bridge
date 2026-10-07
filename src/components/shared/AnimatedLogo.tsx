import React from 'react';

/** App mark: a calm accent square with "HB" (2026 redesign; name kept for existing imports). */
export const AnimatedLogo: React.FC<{ scale?: number }> = ({ scale = 1 }) => (
  <div
    className="shrink-0 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold"
    style={{ width: `${2 * scale}rem`, height: `${2 * scale}rem`, fontSize: `${0.8125 * scale}rem` }}
    aria-hidden="true"
  >
    HB
  </div>
);
