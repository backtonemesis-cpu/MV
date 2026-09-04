/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      backgroundColor: {
        app: 'var(--bg-app)',
        surface: 'var(--bg-surface)',
        'surface-muted': 'var(--bg-surface-muted)',
        table: 'var(--bg-table)',
        'table-header': 'var(--bg-table-header)',
        accent: 'var(--color-accent)',
        'accent-soft': 'var(--color-accent-soft)',
      },
      borderColor: {
        muted: 'var(--border-muted)',
        strong: 'var(--border-strong)',
        accent: 'var(--color-accent)',
      },
      divideColor: {
        muted: 'var(--border-muted)',
        strong: 'var(--border-strong)',
      },
      textColor: {
        main: 'var(--text-main)',
        muted: 'var(--text-muted)',
        subtle: 'var(--text-subtle)',
        accent: 'var(--color-accent)',
        'on-accent': 'var(--text-on-accent)',
      },
    },
  },
  plugins: [],
};
