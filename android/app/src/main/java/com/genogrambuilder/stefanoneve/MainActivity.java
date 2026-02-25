package com.genogrambuilder.stefanoneve;

import android.os.Bundle;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.util.Log;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.JSObject;

public class MainActivity extends BridgeActivity {

    // Flag per evitare di spammare eventi a React mentre muovi la penna col tasto premuto
    private boolean isButtonAlreadyPressed = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().setOverScrollMode(android.view.View.OVER_SCROLL_NEVER);
        }
    }

    // --- TENTATIVO 1: Intercettazione Tasti ---
    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        int keyCode = event.getKeyCode();

        // Logga solo se e' un tasto interessante per non intasare il log
        if (keyCode != KeyEvent.KEYCODE_VOLUME_UP && keyCode != KeyEvent.KEYCODE_VOLUME_DOWN) {
            Log.i("GENO_KEY", "Key: " + keyCode + " Action: " + event.getAction());
        }

        // Codici noti Samsung e Android standard
        boolean isStylusKey = (keyCode == 308 || keyCode == 259 || keyCode == 82
                || keyCode == KeyEvent.KEYCODE_STYLUS_BUTTON_PRIMARY);

        if (isStylusKey) {
            if (event.getAction() == KeyEvent.ACTION_DOWN) notifyReact("down");
            return true;
        }

        return super.dispatchKeyEvent(event);
    }

    // --- TENTATIVO 2: Intercettazione Movimento/Hover ---
    @Override
    public boolean dispatchGenericMotionEvent(MotionEvent event) {
        // Verifica se l'evento proviene da una Penna (Stylus)
        boolean isStylus = (event.getToolType(0) == MotionEvent.TOOL_TYPE_STYLUS);

        if (isStylus) {
            // Controlla lo stato dei bottoni
            // BUTTON_STYLUS_PRIMARY = Il tasto laterale della penna
            // BUTTON_SECONDARY = Spesso usato come sinonimo di tasto destro
            int buttonState = event.getButtonState();
            boolean isPressed = (buttonState & MotionEvent.BUTTON_STYLUS_PRIMARY) != 0
                    || (buttonState & MotionEvent.BUTTON_SECONDARY) != 0;

            if (isPressed && !isButtonAlreadyPressed) {
                // RILEVATO PRESSIONE (Start)
                Log.i("GENO_HIT", ">>> TASTO PENNA RILEVATO VIA MOTION! <<<");
                notifyReact("down");
                isButtonAlreadyPressed = true;
                return true; // Blocca l'evento (ferma il menu contestuale nativo o air command)
            } else if (!isPressed && isButtonAlreadyPressed) {
                // RILEVATO RILASCIO (End)
                isButtonAlreadyPressed = false;
                // Opzionale: notifyReact("up");
            }
        }

        return super.dispatchGenericMotionEvent(event);
    }

    private void notifyReact(String actionType) {
        if (this.bridge != null) {
            JSObject ret = new JSObject();
            ret.put("action", actionType);
            this.bridge.triggerWindowJSEvent("sPenNativeEvent", ret.toString());
        }
    }
}
