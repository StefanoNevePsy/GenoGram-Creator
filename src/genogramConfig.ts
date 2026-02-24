// Configurazione Standard Genogramma (McGoldrick/Gerson/Shellenberger)

export type RelationshipConfig = {
  label: string;
  color: string;
  lineStyle: 'solid' | 'dashed' | 'dotted' | 'zigzag'; 
  renderType: 
    | 'standard' 
    | 'double' 
    | 'triple' 
    | 'triple-zigzag'    // Odio: 3 linee + zigzag
    | 'arrow'            // Freccia fine
    | 'arrow-open'       // Freccia aperta fine
    | 'arrow-thick'      // Freccia spessa (Abuso fisico)
    | 'arrow-x-center'   // Freccia fine + X centro (Manipolativo)
    | 'arrow-box-center' // Freccia fine + Box centro (Controllante)
    | 'arrow-diamond-center' // Freccia fine + Rombo centro (Caregiver)
    | 'arrow-double-bar-center' // Freccia fine + Doppia barra centro (Abuso sessuale)
    | 'cutoff'           // Taglio perpendicolare
    | 'cutoff-double'    // Doppio taglio (Divorzio)
    | 'cutoff-circle'    // Taglio con cerchio (Riparato)
    | 'fusion-hostile'   // 3 linee + zigzag
    | 'double-zigzag'    // 2 linee + zigzag
    | 'zigzag-overlay'   // Linea base + zigzag
    | 'twin-link' 
    | 'twin-link-bar' 
    | 'two-circles-center' // Due cerchi centro
    | 'double-arrow-inward'; // Frecce che si guardano (Trascuratezza)
  decorator?: 'none';
};

export const BASE_REL_CONFIG: Record<string, RelationshipConfig> = {
    // 1. STRUTTURALI
    'marriage': { label: 'Matrimonio', color: '#000000', lineStyle: 'solid', renderType: 'standard' },
    'cohabitation': { label: 'Convivenza', color: '#000000', lineStyle: 'dashed', renderType: 'standard' },
    'separation': { label: 'Separazione', color: '#000000', lineStyle: 'solid', renderType: 'cutoff' },
    'separation-cohab': { label: 'Separazione (Conv.)', color: '#000000', lineStyle: 'dashed', renderType: 'cutoff' },
    'divorce': { label: 'Divorzio', color: '#000000', lineStyle: 'solid', renderType: 'cutoff-double' },
    're-marriage': { label: 'Risposati', color: '#000000', lineStyle: 'solid', renderType: 'standard' }, 
    'affair': { label: 'Relazione Extra/Amante', color: '#FFD700', lineStyle: 'dotted', renderType: 'standard' },
    'one-night': { label: 'Avventura', color: '#FFD700', lineStyle: 'dotted', renderType: 'standard' },
    'engagement': { label: 'Fidanzamento', color: '#0000FF', lineStyle: 'dashed', renderType: 'standard' },

    // 2. FIGLI
    'child-bio': { label: 'Figlio Biologico', color: '#000000', lineStyle: 'solid', renderType: 'standard' },
    'child-adopted': { label: 'Adozione', color: '#0000FF', lineStyle: 'dotted', renderType: 'standard' },
    'child-foster': { label: 'Affido', color: '#000000', lineStyle: 'dashed', renderType: 'standard' },
    'twin-dizygotic': { label: 'Gemelli Dizigoti', color: '#000000', lineStyle: 'solid', renderType: 'twin-link' }, 
    'twin-monozygotic': { label: 'Gemelli Monozigoti', color: '#000000', lineStyle: 'solid', renderType: 'twin-link-bar' }, 
    'pregnancy': { label: 'Gravidanza', color: '#000000', lineStyle: 'solid', renderType: 'standard' },

    // 3. AFFETTIVE (Verde/Blu)
    'harmony': { label: 'Armonia', color: '#008000', lineStyle: 'solid', renderType: 'standard' },
    'friendship': { label: 'Amicizia', color: '#008000', lineStyle: 'dashed', renderType: 'standard' },
    'best-friend': { label: 'Migliore Amico', color: '#008000', lineStyle: 'dotted', renderType: 'double' },
    'close': { label: 'Molto Uniti', color: '#008000', lineStyle: 'solid', renderType: 'double' },
    'fusion': { label: 'Invischiamento (Fusione)', color: '#008000', lineStyle: 'solid', renderType: 'triple' },
    'in-love': { label: 'Innamorati', color: '#008000', lineStyle: 'solid', renderType: 'two-circles-center' },
    'fan': { label: 'Ammiratore', color: '#008000', lineStyle: 'dashed', renderType: 'arrow' },
    'spiritual': { label: 'Conn. Spirituale', color: '#800080', lineStyle: 'dashed', renderType: 'standard' },

    // 4. CONFLITTO (Rosso/Misto)
    'hostile': { label: 'Ostilità', color: '#FF0000', lineStyle: 'dotted', renderType: 'standard' }, 
    'conflict': { label: 'Conflitto', color: '#FF0000', lineStyle: 'zigzag', renderType: 'standard' },
    'fusion-hostile': { label: 'Fusione & Conflitto', color: '#000000', lineStyle: 'solid', renderType: 'fusion-hostile' }, 
    'close-hostile': { label: 'Uniti & Conflittuali', color: '#000000', lineStyle: 'solid', renderType: 'double-zigzag' },
    'distant-hostile': { label: 'Distante & Ostile', color: '#FF0000', lineStyle: 'dotted', renderType: 'zigzag-overlay' },
    'hate': { label: 'Odio', color: '#FF0000', lineStyle: 'solid', renderType: 'triple-zigzag' }, 
    'violence': { label: 'Violenza', color: '#FF0000', lineStyle: 'solid', renderType: 'arrow-thick' },

    // 5. ABUSO E POTERE (Direzionali)
    'abuse-physical': { label: 'Abuso Fisico', color: '#800000', lineStyle: 'solid', renderType: 'arrow-thick' }, 
    'abuse-emotional': { label: 'Abuso Emotivo', color: '#800000', lineStyle: 'dashed', renderType: 'arrow' },
    'abuse-sexual': { label: 'Abuso Sessuale', color: '#FF0080', lineStyle: 'solid', renderType: 'arrow-double-bar-center' }, 
    'neglect': { label: 'Trascuratezza', color: '#808080', lineStyle: 'dashed', renderType: 'double-arrow-inward' },
    
    // 6. CONTROLLO
    'focused': { label: 'Focalizzata Su', color: '#0000FF', lineStyle: 'solid', renderType: 'arrow-open' }, 
    'manipulative': { label: 'Manipolativo', color: '#FF0000', lineStyle: 'solid', renderType: 'arrow-x-center' }, 
    'controlling': { label: 'Controllante', color: '#800080', lineStyle: 'solid', renderType: 'arrow-box-center' }, 
    'keeper': { label: 'Custode/Caregiver', color: '#008080', lineStyle: 'solid', renderType: 'arrow-diamond-center' }, 

    // 7. DISTANZA
    'distant': { label: 'Distante', color: '#808080', lineStyle: 'dotted', renderType: 'standard' },
    'poor': { label: 'Povera', color: '#808080', lineStyle: 'solid', renderType: 'standard' }, 
    'cutoff': { label: 'Taglio', color: '#000000', lineStyle: 'solid', renderType: 'cutoff' }, 
    'cutoff-repaired': { label: 'Taglio Riparato', color: '#000000', lineStyle: 'solid', renderType: 'cutoff-circle' }, 
    
    'custom': { label: 'Personalizzata', color: '#000000', lineStyle: 'solid', renderType: 'standard' }
};

export const RELATION_CATEGORIES: Record<string, string[]> = {
    "Struttura": ['marriage', 'cohabitation', 'separation', 'separation-cohab', 'divorce', 're-marriage', 'engagement', 'affair', 'one-night'],
    "Figli": ['child-bio', 'child-adopted', 'child-foster', 'twin-dizygotic', 'twin-monozygotic', 'pregnancy'],
    "Legami Affettivi": ['harmony', 'friendship', 'best-friend', 'close', 'fusion', 'in-love', 'fan', 'spiritual'],
    "Conflitto/Distanza": ['hostile', 'conflict', 'fusion-hostile', 'close-hostile', 'distant-hostile', 'hate', 'distant', 'poor', 'cutoff', 'cutoff-repaired'],
    "Abuso/Potere": ['abuse-physical', 'abuse-emotional', 'abuse-sexual', 'neglect', 'violence', 'manipulative', 'controlling', 'focused', 'keeper'],
    "Altro": ['custom']
};