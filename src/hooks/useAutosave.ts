// --- AUTOSAVE (localStorage + Firestore) ---
// Debounce 1.5s su ogni modifica. Il round-trip JSON rimuove le chiavi con
// valore undefined (Firestore le rifiuta). Il salvataggio locale è quota-safe
// e non blocca mai il sync cloud.

import { useEffect } from 'react';
import type { MutableRefObject, Dispatch, SetStateAction } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import type { GenNode, RelationEdge, NodeGroup, StickyNoteData, StructuralMap, CustomPreset } from '../types';
import { saveDraftAndIndex } from '../services/storage';

export type SyncStatus = 'synced' | 'syncing' | 'error' | 'offline';

interface AutosaveDeps {
    view: string;
    currentGenId: string | null;
    metaTitle: string;
    metaCategory: string;
    nodes: GenNode[]; edges: RelationEdge[]; groups: NodeGroup[];
    stickyNotes: StickyNoteData[]; structuralMaps: StructuralMap[]; customPresets: CustomPreset[];
    historyIndex: number;
    isRemoteUpdate: MutableRefObject<boolean>;
    user: any; db: any; appId: string; customUser: string;
    setSyncStatus: Dispatch<SetStateAction<SyncStatus>>;
}

export const useAutosave = ({
    view, currentGenId, metaTitle, metaCategory, nodes, edges, groups, stickyNotes, structuralMaps,
    customPresets, historyIndex, isRemoteUpdate, user, db, appId, customUser, setSyncStatus
}: AutosaveDeps) => {
    useEffect(() => {
        if (view !== 'editor' || !currentGenId) return;

        // Non salvare grafi vuoti al primo avvio
        if (nodes.length === 0 && edges.length === 0 && historyIndex <= 0) return;

        // Se è un aggiornamento remoto, non ri-salvare (evita loop)
        if (isRemoteUpdate.current) {
            isRemoteUpdate.current = false;
            return;
        }

        const timer = setTimeout(async () => {
            const dataToSave = {
                id: currentGenId,
                title: metaTitle,
                category: metaCategory,
                lastModified: Date.now(),
                data: { nodes, edges, groups, presets: customPresets, stickyNotes, structuralMaps }
            };
            const serialized = JSON.stringify(dataToSave);
            const sanitized = JSON.parse(serialized);

            saveDraftAndIndex({ id: currentGenId, title: metaTitle, category: metaCategory, lastModified: dataToSave.lastModified }, serialized);

            if (user && db) {
                const pathPart = customUser ? customUser : user.uid;
                if (!pathPart) { setSyncStatus('error'); return; }

                setSyncStatus('syncing');
                try {
                    const docRef = doc(db, 'artifacts', appId, 'users', pathPart, 'genograms', currentGenId);
                    await setDoc(docRef, sanitized, { merge: true });
                    setSyncStatus('synced');
                } catch (err) {
                    console.error("Errore Salvataggio:", err);
                    setSyncStatus('error');
                }
            } else {
                setSyncStatus('offline');
            }
        }, 1500);

        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nodes, edges, groups, stickyNotes, structuralMaps, metaTitle, metaCategory, customPresets, customUser, user, db, view, currentGenId]);
};
