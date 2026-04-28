export const THEMES = [
  {
    id: 'memoire',
    name: 'Memoire',
    description: 'Terracota quente — o look original',
    accentDefault: '#c4795a',
    vars: {
      '--ink':            '#1a1814',
      '--ink-soft':       '#3d3a35',
      '--ink-muted':      '#7a756d',
      '--ink-faint':      '#b8b2a8',
      '--paper':          '#faf8f5',
      '--paper-warm':     '#f4f0ea',
      '--paper-deep':     '#ede8e0',
      '--mv-accent':      '#c4795a',
      '--mv-accent-soft': '#d9957a',
      '--mv-accent-pale': '#f2e4dc',
      '--font-display':   "'Cormorant Garamond', Georgia, serif",
      '--font-body':      "'DM Sans', system-ui, sans-serif",
    },
    googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=DM+Sans:wght@300;400;500&display=swap',
  },
  {
    id: 'sepia',
    name: 'Sepia',
    description: 'Castanho envelhecido — memórias analógicas',
    accentDefault: '#9b5e3a',
    vars: {
      '--ink':            '#2c1810',
      '--ink-soft':       '#5c3b28',
      '--ink-muted':      '#8a6545',
      '--ink-faint':      '#c4a882',
      '--paper':          '#fdf8f0',
      '--paper-warm':     '#f7edd8',
      '--paper-deep':     '#eeddbe',
      '--mv-accent':      '#9b5e3a',
      '--mv-accent-soft': '#b8744f',
      '--mv-accent-pale': '#f5e8d8',
      '--font-display':   "'Playfair Display', Georgia, serif",
      '--font-body':      "'Lato', system-ui, sans-serif",
    },
    googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Lato:wght@300;400;700&display=swap',
  },
  {
    id: 'nordic',
    name: 'Nordic',
    description: 'Azul frio e cinza — claridade escandinava',
    accentDefault: '#4a8fa8',
    vars: {
      '--ink':            '#1a2430',
      '--ink-soft':       '#354a5e',
      '--ink-muted':      '#6b8099',
      '--ink-faint':      '#b0c4d6',
      '--paper':          '#f5f8fa',
      '--paper-warm':     '#edf3f7',
      '--paper-deep':     '#dce8ef',
      '--mv-accent':      '#4a8fa8',
      '--mv-accent-soft': '#6aaccb',
      '--mv-accent-pale': '#ddf0f7',
      '--font-display':   "'Libre Baskerville', Georgia, serif",
      '--font-body':      "'Inter', system-ui, sans-serif",
    },
    googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Inter:wght@300;400;500&display=swap',
  },
  {
    id: 'noir',
    name: 'Noir',
    description: 'Preto e dourado — drama e elegância',
    accentDefault: '#e8d5a8',
    vars: {
      '--ink':            '#f0ede8',
      '--ink-soft':       '#c8c2ba',
      '--ink-muted':      '#8a847c',
      '--ink-faint':      '#4a4642',
      '--paper':          '#111110',
      '--paper-warm':     '#1a1918',
      '--paper-deep':     '#252320',
      '--mv-accent':      '#e8d5a8',
      '--mv-accent-soft': '#f0e4c0',
      '--mv-accent-pale': 'rgba(232,213,168,0.12)',
      '--font-display':   "'IM Fell English', Georgia, serif",
      '--font-body':      "'Inter', system-ui, sans-serif",
    },
    googleFontsUrl: 'https://fonts.googleapis.com/css2?family=IM+Fell+English:ital@0;1&family=Inter:wght@300;400;500&display=swap',
  },
  {
    id: 'ocean',
    name: 'Ocean',
    description: 'Verde-água e areia — frescura costeira',
    accentDefault: '#2d8f7a',
    vars: {
      '--ink':            '#0f2338',
      '--ink-soft':       '#2a4a68',
      '--ink-muted':      '#587090',
      '--ink-faint':      '#9ab8cc',
      '--paper':          '#f4f9fc',
      '--paper-warm':     '#e8f3f8',
      '--paper-deep':     '#d4e8f0',
      '--mv-accent':      '#2d8f7a',
      '--mv-accent-soft': '#4aab96',
      '--mv-accent-pale': '#d4f0ea',
      '--font-display':   "'Crimson Pro', Georgia, serif",
      '--font-body':      "'Source Sans 3', system-ui, sans-serif",
    },
    googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,300;0,400;1,300;1,400&family=Source+Sans+3:wght@300;400;600&display=swap',
  },
  {
    id: 'rose',
    name: 'Rosé',
    description: 'Rosa empoado e creme — romantismo discreto',
    accentDefault: '#c4547a',
    vars: {
      '--ink':            '#2d1a24',
      '--ink-soft':       '#5c3a4c',
      '--ink-muted':      '#8a6878',
      '--ink-faint':      '#c4a8b4',
      '--paper':          '#fdf5f8',
      '--paper-warm':     '#f7e8ef',
      '--paper-deep':     '#eddde5',
      '--mv-accent':      '#c4547a',
      '--mv-accent-soft': '#d9728f',
      '--mv-accent-pale': '#f8d8e5',
      '--font-display':   "'Gilda Display', Georgia, serif",
      '--font-body':      "'Nunito', system-ui, sans-serif",
    },
    googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Gilda+Display&family=Nunito:wght@300;400;600&display=swap',
  },
];

export const THEME_IDS = THEMES.map((t) => t.id);

export function getTheme(id) {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

// Returns inline style object with CSS variable overrides for the viewer root
export function buildThemeVars(themeConfig) {
  if (!themeConfig) return {};
  const parsed = typeof themeConfig === 'string' ? JSON.parse(themeConfig) : themeConfig;
  const theme = getTheme(parsed.id);
  const vars = { ...theme.vars };
  if (parsed.accent) vars['--mv-accent'] = parsed.accent;
  return vars;
}
