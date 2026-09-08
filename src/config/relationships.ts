// --- CONFIGURAZIONE AVANZATA ---

export type RelationshipConfig = {
    label: string;
    color: string;
    lineStyle: 'solid' | 'dashed' | 'dotted' | 'zigzag' | 'zigzag-thick';
    renderType:
    | 'standard' | 'double' | 'triple' | 'triple-zigzag' | 'arrow' | 'arrow-open' | 'arrow-thick'
    | 'arrow-x-center' | 'arrow-box-center' | 'arrow-diamond-center' | 'arrow-double-bar-center'
    | 'arrow-end' | 'arrow-open-end' | 'arrow-open-center' | 'arrow-open-both'
    | 'cutoff' | 'cutoff-double' | 'cutoff-circle' | 'cutoff-repaired-circle'
    | 'fusion' | 'best-friend' | 'fusion-hostile' | 'double-zigzag' | 'triple-zigzag-center' | 'triple-zigzag-center-arrow'
    | 'zigzag-overlay' | 'twin-link' | 'twin-link-bar' | 'two-circles-center' | 'double-arrow-inward'
    | 'oblique' | 'oblique-double' | 'x-cross' | 'oblique-double-crossed'
    | 'triangle-up-center' | 'dashed-inner'
    | 'bars-center' | 'triangle-center' | 'dot-center';
    decorator?: string;
};

export const BASE_REL_CONFIG: Record<string, RelationshipConfig> = {
    // 1. STRUTTURALI (Coppia e Relazioni)
    'marriage': { label: 'Matrimonio', color: '#000000', lineStyle: 'solid', renderType: 'standard' },
    'secret': { label: 'Relazione Segreta', color: '#000000', lineStyle: 'solid', renderType: 'triangle-up-center' },
    'cohabitation': { label: 'Convivenza', color: '#000000', lineStyle: 'dashed', renderType: 'standard' },
    'couple': { label: 'Relazione di Coppia', color: '#000000', lineStyle: 'dashed', renderType: 'standard' },
    'divorce-commit': { label: 'Divorzio Impegno Emot.', color: '#000000', lineStyle: 'solid', renderType: 'dashed-inner' },
    'separation': { label: 'Separazione', color: '#000000', lineStyle: 'solid', renderType: 'oblique' },
    'separation-repaired': { label: 'Separazione Riparata', color: '#000000', lineStyle: 'solid', renderType: 'x-cross' },
    'separation-cohab': { label: 'Separazione (Conv.)', color: '#000000', lineStyle: 'dashed', renderType: 'oblique' },
    'divorce': { label: 'Divorzio (2 Tagli)', color: '#000000', lineStyle: 'solid', renderType: 'oblique-double' },
    'divorce-repaired': { label: 'Divorzio Riparato', color: '#000000', lineStyle: 'solid', renderType: 'oblique-double-crossed' },
    're-marriage': { label: 'Risposati', color: '#000000', lineStyle: 'solid', renderType: 'standard' },
    'affair': { label: 'Relazione Extra/Amante', color: '#FFD700', lineStyle: 'dotted', renderType: 'standard' },
    'one-night': { label: 'Avventura', color: '#FFD700', lineStyle: 'dotted', renderType: 'standard' },
    'engagement': { label: 'Fidanzamento', color: '#0000FF', lineStyle: 'dashed', renderType: 'standard' },
    'engagement-cohab': { label: 'Fidanzati Conviventi', color: '#0000FF', lineStyle: 'dashed', renderType: 'dashed-inner' },

    // 2. FIGLI
    'child-bio': { label: 'Figlio Biologico', color: '#000000', lineStyle: 'solid', renderType: 'standard' },
    'child-adopted': { label: 'Adozione', color: '#0000FF', lineStyle: 'dotted', renderType: 'standard' },
    'child-foster': { label: 'Affido', color: '#000000', lineStyle: 'dashed', renderType: 'standard' },
    'twin-dizygotic': { label: 'Gemelli Dizigoti', color: '#000000', lineStyle: 'solid', renderType: 'twin-link' },
    'twin-monozygotic': { label: 'Gemelli Monozigoti', color: '#000000', lineStyle: 'solid', renderType: 'twin-link-bar' },
    'pregnancy': { label: 'Gravidanza', color: '#000000', lineStyle: 'solid', renderType: 'standard' },

    // 3. AFFETTI E INTERAZIONI
    'correlated': { label: 'Correlato/Collegamento', color: '#000000', lineStyle: 'solid', renderType: 'standard' },
    'harmony': { label: 'Armonia', color: '#008000', lineStyle: 'solid', renderType: 'standard' },
    'friendship': { label: 'Amicizia', color: '#008000', lineStyle: 'dashed', renderType: 'standard' },
    'best-friend': { label: 'Migliore Amico', color: '#008000', lineStyle: 'dotted', renderType: 'double' },
    'close': { label: 'Invischiamento/Molto Uniti', color: '#008000', lineStyle: 'solid', renderType: 'double' },
    'fusion': { label: 'Fusione', color: '#008000', lineStyle: 'solid', renderType: 'triple' },
    'in-love': { label: 'Innamorati', color: '#008000', lineStyle: 'solid', renderType: 'two-circles-center' },
    'fan': { label: 'Ammiratore', color: '#008000', lineStyle: 'dashed', renderType: 'arrow' },
    'spiritual': { label: 'Conn. Spirituale', color: '#800080', lineStyle: 'dashed', renderType: 'standard' },

    // 4. CONFLITTO E DISTANZA
    'distance': { label: 'Distanza', color: '#808080', lineStyle: 'dashed', renderType: 'standard' },
    'poor': { label: 'Povera', color: '#808080', lineStyle: 'dotted', renderType: 'standard' },
    'hostile': { label: 'Ostile', color: '#FF0000', lineStyle: 'zigzag', renderType: 'standard' },
    'close-hostile': { label: 'Vicini-Ostile', color: '#FF0000', lineStyle: 'solid', renderType: 'triple-zigzag-center' },
    'fusion-hostile': { label: 'Fusione & Conflitto', color: '#000000', lineStyle: 'solid', renderType: 'fusion-hostile' },
    'hate': { label: 'Odio', color: '#FF0000', lineStyle: 'solid', renderType: 'triple-zigzag' },
    'cutoff': { label: 'Rottura/Taglio (//)', color: '#FF0000', lineStyle: 'solid', renderType: 'cutoff' },
    'restored': { label: 'Relazione Ristabilita', color: '#008000', lineStyle: 'solid', renderType: 'cutoff-repaired-circle' },

    // 5. VIOLENZA, ABUSO E POTERE
    'violence-psychological': { label: 'Violenza Psicologica', color: '#FF0000', lineStyle: 'zigzag', renderType: 'arrow-open-end' },
    'violence-physical': { label: 'Violenza Fisica', color: '#FF0000', lineStyle: 'zigzag-thick', renderType: 'arrow-open-end' },
    'violence-sexual': { label: 'Violenza Sessuale', color: '#FF0080', lineStyle: 'solid', renderType: 'triple-zigzag-center-arrow' },
    'abuse-physical': { label: 'Abuso Fisico', color: '#800000', lineStyle: 'solid', renderType: 'arrow-thick' },
    'abuse-emotional': { label: 'Abuso Emotivo', color: '#800000', lineStyle: 'dashed', renderType: 'arrow' },
    'abuse-sexual': { label: 'Abuso Sessuale', color: '#FF0080', lineStyle: 'solid', renderType: 'arrow-double-bar-center' },
    'focused': { label: 'Focalizzato sul', color: '#0000FF', lineStyle: 'solid', renderType: 'arrow-end' },
    'focused-negative': { label: 'Focalizzato Negativamente', color: '#FF0000', lineStyle: 'zigzag', renderType: 'arrow-end' },
    'companions': { label: 'Accompagnatori', color: '#000000', lineStyle: 'solid', renderType: 'arrow-open-end' },
    'manipulative': { label: 'Manipolativo', color: '#FF0000', lineStyle: 'solid', renderType: 'arrow-x-center' },
    'controlling': { label: 'Controllante', color: '#800080', lineStyle: 'solid', renderType: 'arrow-box-center' },
    'keeper': { label: 'Custode/Caregiver', color: '#008080', lineStyle: 'solid', renderType: 'arrow-diamond-center' },
    'neglect': { label: 'Trascuratezza', color: '#808080', lineStyle: 'dashed', renderType: 'double-arrow-inward' },
    'violence-mutual': { label: 'Violenza Reciproca', color: '#FF0000', lineStyle: 'zigzag', renderType: 'arrow-open-both' },

    // --- ESPANSIONE SIMBOLI ---
    // Struttura / Coppia
    'civil-union': { label: 'Unione Civile', color: '#000000', lineStyle: 'solid', renderType: 'bars-center' },
    'annulment': { label: 'Annullamento', color: '#000000', lineStyle: 'solid', renderType: 'cutoff-double' },
    'dating': { label: 'Frequentazione', color: '#000000', lineStyle: 'dotted', renderType: 'standard' },

    // Figli
    'child-step': { label: 'Figlio Acquisito', color: '#7c3aed', lineStyle: 'dashed', renderType: 'standard' },
    'child-donor': { label: 'Concepito con Donazione', color: '#4f46e5', lineStyle: 'solid', renderType: 'dot-center' },
    'child-surrogacy': { label: 'Gestazione per Altri', color: '#4f46e5', lineStyle: 'dashed', renderType: 'dot-center' },
    'child-ward': { label: 'Tutela Legale', color: '#64748b', lineStyle: 'dotted', renderType: 'standard' },
    'twin-unknown': { label: 'Gemelli (zigosità ignota)', color: '#000000', lineStyle: 'solid', renderType: 'twin-link' },

    // Interazione / Affettive
    'ambivalent': { label: 'Ambivalente (amore-odio)', color: '#000000', lineStyle: 'solid', renderType: 'zigzag-overlay' },
    'parentified': { label: 'Genitorializzazione', color: '#b45309', lineStyle: 'solid', renderType: 'triangle-center' },
    'confidant': { label: 'Confidente', color: '#008000', lineStyle: 'solid', renderType: 'dot-center' },
    'mentor': { label: 'Mentore / Guida', color: '#008000', lineStyle: 'solid', renderType: 'arrow-end' },
    'dependency': { label: 'Dipendenza Affettiva', color: '#0891b2', lineStyle: 'solid', renderType: 'arrow-open-center' },
    'idealization': { label: 'Idealizzazione', color: '#0891b2', lineStyle: 'dashed', renderType: 'arrow-end' },
    'rivalry': { label: 'Rivalità', color: '#f59e0b', lineStyle: 'solid', renderType: 'double-arrow-inward' },

    // Conflitto e Distanza
    'indifferent': { label: 'Indifferenza', color: '#9ca3af', lineStyle: 'dotted', renderType: 'dot-center' },
    'mistrust': { label: 'Sfiducia / Sospetto', color: '#78716c', lineStyle: 'dashed', renderType: 'dot-center' },
    'contempt': { label: 'Disprezzo', color: '#dc2626', lineStyle: 'dashed', renderType: 'arrow-end' },
    'betrayal': { label: 'Tradimento', color: '#dc2626', lineStyle: 'solid', renderType: 'cutoff-double' },

    // Violenza, Abuso e Potere
    'stalking': { label: 'Stalking / Persecuzione', color: '#FF0000', lineStyle: 'dashed', renderType: 'arrow-thick' },
    'economic-abuse': { label: 'Violenza Economica', color: '#800000', lineStyle: 'solid', renderType: 'arrow-box-center' },
    'bullying': { label: 'Bullismo', color: '#FF0000', lineStyle: 'zigzag', renderType: 'arrow-end' },
    'overprotection': { label: 'Iperprotezione', color: '#7c3aed', lineStyle: 'solid', renderType: 'double-arrow-inward' },
    'emotional-blackmail': { label: 'Ricatto Affettivo', color: '#be123c', lineStyle: 'solid', renderType: 'arrow-diamond-center' },
    'abandonment': { label: 'Abbandono', color: '#78716c', lineStyle: 'dotted', renderType: 'arrow-end' },

    // Sociale / Contesto
    'colleague': { label: 'Collega', color: '#0369a1', lineStyle: 'solid', renderType: 'standard' },
    'neighbor': { label: 'Vicino di Casa', color: '#0369a1', lineStyle: 'dotted', renderType: 'standard' },
    'teacher-student': { label: 'Insegnante–Allievo', color: '#0369a1', lineStyle: 'dashed', renderType: 'arrow-end' },
    'therapeutic': { label: 'Rapporto Terapeutico', color: '#7c3aed', lineStyle: 'dashed', renderType: 'dot-center' },
    'legal-guardian': { label: 'Tutore Legale', color: '#0369a1', lineStyle: 'solid', renderType: 'arrow-end' },

    'custom': { label: 'Personalizzata', color: '#000000', lineStyle: 'solid', renderType: 'standard' }
};

export const RELATION_CATEGORIES: Record<string, string[]> = {
    "Struttura / Coppia": [
        'marriage', 'secret', 'cohabitation', 'couple', 'divorce-commit',
        'separation', 'separation-repaired', 'separation-cohab',
        'divorce', 'divorce-repaired', 're-marriage',
        'engagement', 'engagement-cohab', 'affair', 'one-night',
        'civil-union', 'annulment', 'dating'
    ],
    "Figli": ['child-bio', 'child-adopted', 'child-foster', 'child-step', 'child-donor', 'child-surrogacy', 'child-ward',
        'twin-dizygotic', 'twin-monozygotic', 'twin-unknown', 'pregnancy'],
    "Interazione / Affettive": ['correlated', 'harmony', 'friendship', 'best-friend', 'close', 'fusion', 'in-love', 'fan', 'spiritual',
        'ambivalent', 'parentified', 'confidant', 'mentor', 'dependency', 'idealization', 'rivalry'],
    "Conflitto e Distanza": ['distance', 'poor', 'hostile', 'close-hostile', 'fusion-hostile', 'hate', 'cutoff', 'restored',
        'indifferent', 'mistrust', 'contempt', 'betrayal'],
    "Violenza, Abuso e Potere": [
        'violence-psychological', 'violence-physical', 'violence-sexual',
        'abuse-physical', 'abuse-emotional', 'abuse-sexual', 'neglect', 'violence-mutual',
        'focused', 'focused-negative', 'companions', 'manipulative', 'controlling', 'keeper',
        'stalking', 'economic-abuse', 'bullying', 'overprotection', 'emotional-blackmail', 'abandonment'
    ],
    "Sociale / Contesto": ['colleague', 'neighbor', 'teacher-student', 'therapeutic', 'legal-guardian'],
    "Altro": ['custom']
};

