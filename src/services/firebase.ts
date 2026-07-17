// Funzione helper per pulire la configurazione Firebase incollata male
export const parseFirebaseConfig = (input: string) => {
    try {
        if (!input) return null;
        let cleaned = input.trim();

        // 1. Rimuove tutto ciò che precede la prima parentesi graffa aperta '{'
        // Questo elimina 'const firebaseConfig = ', 'export const config = ', ecc.
        const firstBrace = cleaned.indexOf('{');
        const lastBrace = cleaned.lastIndexOf('}');

        if (firstBrace === -1 || lastBrace === -1) {
            // Se non ci sono graffe, forse è già JSON puro o invalido
            return JSON.parse(cleaned);
        }

        cleaned = cleaned.substring(firstBrace, lastBrace + 1);

        // 2. Correzioni specifiche per trasformare JS Object in JSON

        // Se è già JSON valido non serve pulirlo (evita di corrompere i ":" negli URL)
        try { return JSON.parse(cleaned); } catch { /* continua con la pulizia */ }

        // Aggiunge virgolette alle chiavi (es. apiKey: -> "apiKey":)
        // Ancorata a "{" o "," così i ":" dentro i valori (es. https://) non vengono toccati
        cleaned = cleaned.replace(/([{,]\s*)(['"])?([a-zA-Z0-9_]+)(['"])?\s*:/g, '$1"$3":');

        // Sostituisce apici singoli con doppi per i valori stringa (es. 'valore' -> "valore")
        cleaned = cleaned.replace(/'/g, '"');

        // Rimuove virgole finali (trailing commas) prima di chiusure } o ]
        // Es. "key": "value", } -> "key": "value" }
        cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');

        return JSON.parse(cleaned);
    } catch (e) {
        console.error("Errore parsing config string:", e);
        // Fallback: prova a parsare direttamente se l'utente ha incollato JSON puro
        try { return JSON.parse(input); } catch (e2) { return null; }
    }
};

