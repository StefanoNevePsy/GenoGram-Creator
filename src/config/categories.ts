import { Home, Heart, User, Users, GraduationCap, BookOpen, Briefcase, Folder, HelpCircle, Tag, Baby, Star, Shield, Stethoscope, Scale, Brain, Flag } from 'lucide-react';

// --- CATEGORIE DI GENOGRAMMI ---
export interface CategoryDef { id: string; label: string; color: string; iconKey: string; custom?: boolean; }

export const ICON_MAP: Record<string, any> = {
    'home': Home, 'heart': Heart, 'user': User, 'users': Users, 'grad': GraduationCap, 'book': BookOpen,
    'briefcase': Briefcase, 'folder': Folder, 'help': HelpCircle, 'tag': Tag,
    'baby': Baby, 'star': Star, 'shield': Shield, 'stethoscope': Stethoscope, 'scale': Scale, 'brain': Brain, 'flag': Flag
};

// Colori proposti per le categorie nuove (tutti leggibili su chiaro e scuro)
export const CATEGORY_COLORS = ['#3b82f6', '#ec4899', '#10b981', '#f59e0b', '#6366f1', '#ef4444', '#14b8a6', '#8b5cf6', '#84cc16', '#64748b'];

/**
 * Aggiunge (o aggiorna) una categoria tenendo "Altro" in fondo: i genogrammi
 * con una categoria sconosciuta finiscono lì.
 */
export function withCategory(list: CategoryDef[], c: CategoryDef): CategoryDef[] {
    const others = list.filter(x => x.id !== c.id);
    const i = others.findIndex(x => x.id === 'other');
    if (list.some(x => x.id === c.id)) return list.map(x => x.id === c.id ? c : x);
    if (i < 0) return [...others, c];
    return [...others.slice(0, i), c, ...others.slice(i)];
}

export const DEFAULT_CATEGORIES: CategoryDef[] = [
    { id: 'family', label: 'Famiglie', color: '#3b82f6', iconKey: 'home' },
    { id: 'couple', label: 'Coppie', color: '#ec4899', iconKey: 'heart' },
    { id: 'individual', label: 'Individuali', color: '#10b981', iconKey: 'user' },
    { id: 'school', label: 'Scolastico', color: '#f59e0b', iconKey: 'grad' },
    { id: 'exercise', label: 'Esercitazioni', color: '#6366f1', iconKey: 'book' },
    { id: 'work', label: 'Lavoro/Org', color: '#64748b', iconKey: 'briefcase' },
    { id: 'other', label: 'Altro', color: '#94a3b8', iconKey: 'folder' }
];

