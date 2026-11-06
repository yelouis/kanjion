/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dossier: {
          bg: '#E5DEC9',          // Outer archival desk background
          paper: '#F4EFE6',       // Broadsheet newsprint paper
          card: '#FFFDF9',        // Microfiche stage & telegram paper
          ink: '#111111',         // Carbon ink rules and typography
          muted: '#57534E',       // Muted forensic coordinates & timestamps
          note: '#FEF08A',        // Yellow index-card pinned thought note
          accent: '#FACC15',      // Telegraph ribbon yellow & line highlight
          stampGreen: '#15803D',  // [VERIFIED ✓] rubber ink stamp
          stampRed: '#B91C1C',    // [CONTAMINATED ✗] rubber ink stamp
          blueAction: '#2563EB',  // Final confirm CTA button
          somFuchsia: '#C026D3',  // Backend Set-of-Mark overlay badge
        },
      },
      fontFamily: {
        gazette: ['Georgia', '"Times New Roman"', 'Times', 'serif'],
        monoClean: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      boxShadow: {
        'ink-sm': '2px 2px 0px #111111',
        'ink': '3px 3px 0px #111111',
        'ink-lg': '6px 6px 0px #111111',
      },
      rotate: {
        'stamp': '-4deg',
        'stamp-alt': '3deg',
      },
      keyframes: {
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%': { transform: 'translateX(-6px) rotate(-0.5deg)' },
          '40%': { transform: 'translateX(6px) rotate(0.5deg)' },
          '60%': { transform: 'translateX(-4px)' },
          '80%': { transform: 'translateX(4px)' },
        },
      },
      animation: {
        shake: 'shake 0.4s ease-in-out',
      },
    },
  },
  plugins: [],
};
