export const colorsForScheme = {
  light: {
    background: '#f8fafc',
    surface: '#ffffff',
    surfaceMuted: '#f1f5f9',
    text: '#0f172a',
    muted: '#64748b',
    border: '#e2e8f0',
    primary: '#2563eb',
    primarySoft: '#eef2ff',
    danger: '#dc2626',
    success: '#15803d',
    warning: '#b45309',
  },
  dark: {
    background: '#020617',
    surface: '#0f172a',
    surfaceMuted: '#1e293b',
    text: '#f1f5f9',
    muted: '#94a3b8',
    border: '#334155',
    primary: '#60a5fa',
    primarySoft: '#1e293b',
    danger: '#f87171',
    success: '#4ade80',
    warning: '#fbbf24',
  },
} as const;

export type AppTheme = keyof typeof colorsForScheme;
export type AppColors = {
  [Key in keyof (typeof colorsForScheme)['light']]: string;
};

const roleAccents = {
  1: {
    light: { primary: '#e11d48', primarySoft: '#fff1f2' },
    dark: { primary: '#fb7185', primarySoft: '#4c0519' },
  },
  2: {
    light: { primary: '#059669', primarySoft: '#ecfdf5' },
    dark: { primary: '#34d399', primarySoft: '#064e3b' },
  },
  3: {
    light: { primary: '#0284c7', primarySoft: '#f0f9ff' },
    dark: { primary: '#38bdf8', primarySoft: '#0c4a6e' },
  },
} as const;

export function colorsForRole(theme: AppTheme, roleId?: number): AppColors {
  const base = colorsForScheme[theme];
  const accent = roleId === 1 || roleId === 2 || roleId === 3
    ? roleAccents[roleId][theme]
    : undefined;

  return accent ? { ...base, ...accent } : base;
}
