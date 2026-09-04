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
        overlay: 'var(--overlay)',
        'success-soft': 'var(--success-bg)',
        'warning-soft': 'var(--warning-bg)',
        'danger-soft': 'var(--danger-bg)',
      },
      borderColor: {
        muted: 'var(--border-muted)',
        strong: 'var(--border-strong)',
        accent: 'var(--color-accent)',
        success: 'var(--success-border)',
        warning: 'var(--warning-border)',
        danger: 'var(--danger-border)',
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
        success: 'var(--success-text)',
        warning: 'var(--warning-text)',
        danger: 'var(--danger-text)',
      },
      ringColor: {
        muted: 'var(--border-muted)',
        strong: 'var(--border-strong)',
        accent: 'var(--color-accent)',
        success: 'var(--success-border)',
        warning: 'var(--warning-border)',
        danger: 'var(--danger-border)',
      },
    },
  },
  plugins: [],
};
