// --- PERSISTENZA LOCALE (localStorage) ---
// Funzioni pure a parametri espliciti: il componente orchestra, qui si legge/scrive.
// Convenzioni chiavi: 'genopro_local_index' = solo metadati (id, title, category,
// lastModified); 'genopro_data_<id>' = genogramma completo.

import type { GenogramMeta } from '../types';
import { generateId } from '../utils/genogram';

export const readLocalIndex = (): GenogramMeta[] => {
    try {
        const s = localStorage.getItem('genopro_local_index');
        return s ? JSON.parse(s) : [];
    } catch { return []; }
};

export const writeLocalIndex = (list: GenogramMeta[]) => {
    localStorage.setItem('genopro_local_index', JSON.stringify(list));
};

// Recupera il genogramma completo: l'indice locale contiene solo metadati
export const readFullGenogram = (g: GenogramMeta): GenogramMeta => {
    try {
        const s = localStorage.getItem(`genopro_data_${g.id}`);
        if (s) return JSON.parse(s);
    } catch { /* usa la versione passata */ }
    return g;
};

// Salva draft completo + voce metadati nell'indice. Protetto: un QuotaExceededError
// non deve propagarsi e bloccare il sync cloud del chiamante.
export const saveDraftAndIndex = (
    meta: { id: string, title: string, category: string, lastModified: number },
    serialized: string
) => {
    try {
        localStorage.setItem(`genopro_data_${meta.id}`, serialized);
        const list = readLocalIndex();
        const idx = list.findIndex(x => x.id === meta.id);
        if (idx >= 0) list[idx] = meta as GenogramMeta;
        else list.push(meta as GenogramMeta);
        writeLocalIndex(list);
    } catch (err) {
        console.error("Errore salvataggio locale (quota?):", err);
    }
};

export const removeLocalGenogram = (id: string) => {
    localStorage.removeItem(`genopro_data_${id}`);
    writeLocalIndex(readLocalIndex().filter(x => x.id !== id));
};

// Persiste localmente una lista di genogrammi importati; rigenera gli id duplicati.
// Ritorna la lista effettivamente importata (con eventuali id/titoli nuovi).
export const persistImportedLocally = (items: GenogramMeta[], existingIds: Set<string>): GenogramMeta[] => {
    const imported = items
        .filter(it => it && it.id && it.data)
        .map(it => existingIds.has(it.id) ? { ...it, id: generateId(), title: `${it.title} (importato)` } : it);
    if (imported.length === 0) return [];
    try {
        const list = readLocalIndex();
        imported.forEach(g => {
            localStorage.setItem(`genopro_data_${g.id}`, JSON.stringify(g));
            list.push({ id: g.id, title: g.title, category: g.category, lastModified: g.lastModified || Date.now() } as GenogramMeta);
        });
        writeLocalIndex(list);
    } catch (err) { console.error("Errore persistenza import:", err); }
    return imported;
};

export const downloadJsonFile = (data: unknown, filename: string) => {
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
};
