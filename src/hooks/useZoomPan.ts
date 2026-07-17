// --- ZOOM GLOBALE (trackpad pinch + Ctrl/Cmd + rotella) ---
// I listener vanno su `document` con passive:false per intercettare il gesto
// PRIMA che il browser esegua lo zoom nativo della pagina.
// Copre: Chrome/Firefox/Zen (Ctrl+wheel) e Safari (Gesture Events).

import { useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';

export const ZOOM_MIN = 0.2;
export const ZOOM_MAX = 3;
export const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));

export const usePinchZoom = (setZoom: Dispatch<SetStateAction<number>>) => {
    useEffect(() => {
        const handleWheel = (e: WheelEvent) => {
            // Firefox/Chrome inviano il pinch del trackpad come Ctrl + Wheel
            if (e.ctrlKey) {
                e.preventDefault(); // Blocca lo zoom della pagina intera
                const sensitivity = 0.008;
                const delta = -e.deltaY * sensitivity;
                setZoom(prev => clampZoom(prev + delta));
            }
        };

        // Gestione specifica Safari (Gesture Events)
        const handleGestureStart = (e: any) => e.preventDefault();
        const handleGestureChange = (e: any) => {
            e.preventDefault();
            const sensitivity = 0.05;
            setZoom(prev => clampZoom(prev + (e.scale - 1) * sensitivity));
        };
        const handleGestureEnd = (e: any) => e.preventDefault();

        const options = { passive: false };
        document.addEventListener('wheel', handleWheel, options);
        document.addEventListener('gesturestart', handleGestureStart, options);
        document.addEventListener('gesturechange', handleGestureChange, options);
        document.addEventListener('gestureend', handleGestureEnd, options);

        return () => {
            document.removeEventListener('wheel', handleWheel);
            document.removeEventListener('gesturestart', handleGestureStart);
            document.removeEventListener('gesturechange', handleGestureChange);
            document.removeEventListener('gestureend', handleGestureEnd);
        };
    }, [setZoom]);
};
