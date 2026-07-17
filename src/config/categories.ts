import { Home, Heart, User, Users, GraduationCap, BookOpen, Briefcase, Folder, HelpCircle, Tag } from 'lucide-react';

// --- CATEGORIE DI GENOGRAMMI ---
export interface CategoryDef { id: string; label: string; color: string; iconKey: string; }

export const ICON_MAP: Record<string, any> = {
    'home': Home, 'heart': Heart, 'user': User, 'users': Users, 'grad': GraduationCap, 'book': BookOpen,
    'briefcase': Briefcase, 'folder': Folder, 'help': HelpCircle, 'tag': Tag
};

export const DEFAULT_CATEGORIES: CategoryDef[] = [
    { id: 'family', label: 'Famiglie', color: '#3b82f6', iconKey: 'home' },
    { id: 'couple', label: 'Coppie', color: '#ec4899', iconKey: 'heart' },
    { id: 'individual', label: 'Individuali', color: '#10b981', iconKey: 'user' },
    { id: 'school', label: 'Scolastico', color: '#f59e0b', iconKey: 'grad' },
    { id: 'exercise', label: 'Esercitazioni', color: '#6366f1', iconKey: 'book' },
    { id: 'work', label: 'Lavoro/Org', color: '#64748b', iconKey: 'briefcase' },
    { id: 'other', label: 'Altro', color: '#94a3b8', iconKey: 'folder' }
];

