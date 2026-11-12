/** Light/dark toggle. Sets data-theme on the document root; the CSS tokens do the rest. */
import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | null;

function read(): Theme {
  try {
    const v = localStorage.getItem('bb-theme');
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(read);

  useEffect(() => {
    const root = document.documentElement;
    if (theme) root.setAttribute('data-theme', theme);
    else root.removeAttribute('data-theme');
    try {
      if (theme) localStorage.setItem('bb-theme', theme);
      else localStorage.removeItem('bb-theme');
    } catch {
      /* ignore */
    }
  }, [theme]);

  const prefersDark = typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = theme === 'dark' || (theme === null && prefersDark);

  return (
    <button className="theme-toggle" onClick={() => setTheme(isDark ? 'light' : 'dark')} aria-label="Toggle light or dark theme" title="Toggle theme">
      {isDark ? '☀' : '☽'}
    </button>
  );
}
