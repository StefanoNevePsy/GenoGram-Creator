export type Gender = 'M' | 'F' | 'Pet' | 'Unknown' | 'Pregnancy' | 'Miscarriage' | 'Abortion' | 'Stillbirth' | 'TransWoman' | 'TransMan' | 'NonBinary';

export interface NoteItem { id: string; text: string; date: string; }
export interface GenNode {
    id: string; x: number; y: number; gender: Gender; name: string; label?: string;
    birthDate: string; deceased: boolean; deathDate?: string; indexPerson: boolean;
    substanceAbuse: boolean; mentalIssue: boolean; physicalIssue: boolean; recovery: boolean;
    behavioralAddiction?: boolean; eatingDisorder?: boolean; institutionalized?: boolean;
    profession?: string;
    gayLesbian: boolean;
    showAge?: boolean;
    notes: NoteItem[];
}
export interface RelationEdge { id: string; fromId: string; toId: string; type: string; color?: string; lineStyle?: string; decorator?: string; label: string; notes: NoteItem[]; fromAnchor?: number; toAnchor?: number; }
export interface NodeGroup { id: string; memberIds: string[]; type: 'household' | 'subsystem'; label: string; color: string; notes: NoteItem[]; labelPos?: { x: number, y: number }; customPadding?: number; showLabel?: boolean; }
export interface CustomPreset { id: string; name: string; type: 'relationship'; config: { color: string; lineStyle: string; renderType: string; decorator: string; } }
export interface GenogramMeta { id: string; title: string; category: string; lastModified: number; data: { nodes: GenNode[]; edges: RelationEdge[]; groups: NodeGroup[]; presets?: CustomPreset[]; stickyNotes?: any[]; } }
// --- AGGIUNGI SOTTO GLI ALTRI INTERFACE ---
// Modifica l'interfaccia esistente
export interface StickyNoteData {
    id: string;
    x: number;
    y: number;
    text: string;
    width: number;
    height: number;
    color: string;
    fontFamily: string;
    // NUOVE PROPRIETÀ
    opacity: number;    // 0.1 a 1.0
    textColor: string;
    variant?: 'classic' | 'label';
}

// --- UTILS ---

// --- AGGIORNAMENTO INTERFACCIA ---
export interface ReportOptions {
    onlyPeopleWithNotes: boolean;
    // Sostituiamo showPersonalDetails con le singole voci
    showGender: boolean;          // Genere (M/F)
    showBirthDate: boolean;       // Data di nascita
    showAge: boolean;             // Età calcolata

    showClinical: boolean;
    showGroups: boolean;
    showFamily: boolean;
    showRelations: boolean;
    showNotes: boolean;
}
