// --- GESTIONE TEMI DEFINITIVA ---
export type AppTheme = {
    id: string;
    label: string;
    type: 'light' | 'dark';
    colors: {
        bgMain: string;      // Sfondo Canvas
        bgPanel: string;     // Sfondo Pannelli (Sidebar, Header, Modal)
        border: string;      // Colore Bordi
        text: string;        // Testo Principale
        textMuted: string;   // Testo Secondario
        accent: string;      // Colore Accento (Blu, Viola, ecc)
    }
};

// --- DEFINIZIONE PALETTE GLOBALI ---
// Inserisci questo blocco PRIMA di NOTE_BG_PALETTES

export const PASTEL_PALETTE = ['#bfdbfe', '#bbf7d0', '#fbcfe8', '#fde68a', '#ddd6fe', '#fed7aa', '#e2e8f0'];
export const VIVID_PALETTE = ['#3b82f6', '#22c55e', '#ec4899', '#f59e0b', '#8b5cf6', '#f97316', '#64748b'];
export const NEUTRAL_PALETTE = ['#ffffff', '#f3f4f6', '#d1d5db', '#9ca3af', '#4b5563', '#1f2937', '#000000'];
export const EARTH_PALETTE = ['#78350f', '#92400e', '#b45309', '#d97706', '#f59e0b', '#fcd34d', '#fffbeb'];
export const MONOCHROME_PALETTE = ['#f8fafc', '#e2e8f0', '#cbd5e1', '#94a3b8', '#64748b', '#475569', '#1e293b'];

// --- COSTANTI PER LE NOTE ---

// Raggruppo le palette esistenti (Ora le variabili sopra esistono!)
export const NOTE_BG_PALETTES = {
    'Classico': ['#fef3c7', '#d1fae5', '#dbeafe', '#fce7f3', '#f3f4f6', '#ffedd5', '#e0e7ff'],
    'Pastello': PASTEL_PALETTE,
    'Vivido': VIVID_PALETTE,
    'Terra': EARTH_PALETTE,
    'Monocromo': MONOCHROME_PALETTE
};

export const NOTE_TEXT_PALETTES: Record<string, string[]> = {
    'Neutri': ['#1f2937', '#000000', '#ffffff', '#dc2626', '#2563eb', '#16a34a', '#d97706', '#57534e'],
    'Pastello': PASTEL_PALETTE,
    'Vivido': VIVID_PALETTE,
    'Terra': EARTH_PALETTE,
    'Monocromo': MONOCHROME_PALETTE
};

export const NOTE_TEXT_COLORS = [
    '#1f2937', // Default Gray 800
    '#000000', // Black
    '#ffffff', // White
    '#dc2626', // Red
    '#2563eb', // Blue
    '#16a34a', // Green
    '#d97706', // Amber
    '#57534e', // Warm Gray
];

export const NOTE_FONTS = [
    { label: 'App Default', value: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }, // Font standard dell'app
    { label: 'Handwriting', value: '"Comic Sans MS", "Chalkboard SE", sans-serif' },
    { label: 'Sans Serif', value: 'ui-sans-serif, system-ui, sans-serif' },
    { label: 'Serif', value: 'ui-serif, Georgia, serif' },
    { label: 'Monospace', value: 'ui-monospace, monospace' },
];
// ----------------------------------------------------------
export const PRESET_THEMES: AppTheme[] = [
    // LIGHT THEMES
    {
        id: 'light', label: 'Light (Default)', type: 'light',
        colors: { bgMain: '#f9fafb', bgPanel: '#ffffff', border: '#e5e7eb', text: '#111827', textMuted: '#6b7280', accent: '#2563eb' }
    },
    {
        id: 'sepia', label: 'Vintage Sepia', type: 'light',
        colors: { bgMain: '#fdf6e3', bgPanel: '#eee8d5', border: '#d2b48c', text: '#433422', textMuted: '#93a1a1', accent: '#b58900' }
    },
    {
        id: 'nordic', label: 'Nordic Snow', type: 'light',
        colors: { bgMain: '#eceff4', bgPanel: '#e5e9f0', border: '#d8dee9', text: '#2e3440', textMuted: '#4c566a', accent: '#5e81ac' }
    },
    // DARK THEMES
    {
        id: 'dark', label: 'Dark (Classic)', type: 'dark',
        colors: { bgMain: '#111827', bgPanel: '#1f2937', border: '#374151', text: '#f9fafb', textMuted: '#9ca3af', accent: '#3b82f6' }
    },
    {
        id: 'onedark', label: 'One Dark Pro', type: 'dark',
        colors: { bgMain: '#282c34', bgPanel: '#21252b', border: '#3e4451', text: '#abb2bf', textMuted: '#5c6370', accent: '#61afef' }
    },
    {
        id: 'dracula', label: 'Dracula', type: 'dark',
        colors: { bgMain: '#282a36', bgPanel: '#44475a', border: '#6272a4', text: '#f8f8f2', textMuted: '#bd93f9', accent: '#ff79c6' }
    },
    {
        id: 'nightowl', label: 'Night Owl', type: 'dark',
        colors: { bgMain: '#011627', bgPanel: '#0b2942', border: '#5f7e97', text: '#d6deeb', textMuted: '#7e57c2', accent: '#82aaff' }
    },
    {
        id: 'forest', label: 'Forest Night', type: 'dark',
        colors: { bgMain: '#0d1117', bgPanel: '#161b22', border: '#30363d', text: '#c9d1d9', textMuted: '#8b949e', accent: '#238636' }
    }
];


