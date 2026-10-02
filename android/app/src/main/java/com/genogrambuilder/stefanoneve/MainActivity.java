package com.genogrambuilder.stefanoneve;

import android.os.Build;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebView;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.JSObject;

/**
 * Attività principale di GenoGram Creator su Android.
 *
 * - Schermo intero immersivo: barra di stato e barra di navigazione nascoste;
 *   uno scorrimento dal bordo le mostra per un attimo sopra l'app, poi
 *   spariscono di nuovo. Il disegno arriva fin dentro il notch.
 * - Indietro: lo gestisce il plugin App di Capacitor (evento "backButton" in
 *   App.tsx), compreso il gesto indietro predittivo di Android 13+.
 * - S Pen: il tasto laterale apre il menu "Aggiungi" nel punto della penna,
 *   sia con la penna sospesa sopra lo schermo sia appoggiata. L'evento arriva
 *   al web come "sPenNativeEvent" con le coordinate già in pixel CSS.
 */
public class MainActivity extends BridgeActivity {

    /** Il tasto della penna è premuto (evita di ripetere l'evento mentre si muove). */
    private boolean tastoPenna = false;
    /** Gesto con la penna appoggiata e il tasto premuto: non arriva alla WebView. */
    private boolean gestoAssorbito = false;
    /** Tasto, movimento e tocco possono segnalare la stessa pressione: ne conta una. */
    private long ultimoAvviso = 0;
    private static final long PAUSA_AVVISI_MS = 300;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams lp = getWindow().getAttributes();
            lp.layoutInDisplayCutoutMode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
                    ? WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
                    : WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(lp);
        }
        WebView web = webView();
        if (web != null) {
            web.setOverScrollMode(View.OVER_SCROLL_NEVER);
            // niente selezione del testo, menu "copia/incolla" e vibrazione
            // quando si tiene premuto con la penna o col dito sul disegno
            web.setLongClickable(false);
            web.setOnLongClickListener(v -> true);
            web.setHapticFeedbackEnabled(false);
        }
        schermoIntero();
    }

    @Override
    public void onResume() {
        super.onResume();
        schermoIntero();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        // dopo una finestra di sistema (tastiera, condivisione, notifiche) le
        // barre tornano visibili: si rinascondono quando l'app riprende il fuoco
        if (hasFocus) schermoIntero();
    }

    private void schermoIntero() {
        WindowInsetsControllerCompat c = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        c.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        c.hide(WindowInsetsCompat.Type.systemBars());
    }

    private WebView webView() {
        return getBridge() != null ? getBridge().getWebView() : null;
    }

    // --- S Pen ---------------------------------------------------------------

    /** Tasto della penna come tasto vero (Android 14+, alcune penne Samsung). */
    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        int k = event.getKeyCode();
        boolean tasto = k == KeyEvent.KEYCODE_STYLUS_BUTTON_PRIMARY || k == 308 || k == 259;
        if (tasto) {
            if (event.getAction() == KeyEvent.ACTION_DOWN && event.getRepeatCount() == 0) avvisa(Float.NaN, Float.NaN);
            return true;
        }
        return super.dispatchKeyEvent(event);
    }

    /** Penna sospesa sopra lo schermo (hover) con il tasto premuto. */
    @Override
    public boolean dispatchGenericMotionEvent(MotionEvent e) {
        if (eStilo(e)) {
            boolean premuto = tastoPremuto(e);
            if (premuto && !tastoPenna) {
                tastoPenna = true;
                avvisa(e.getX(), e.getY());
                return true; // ferma il menu nativo
            }
            if (!premuto) tastoPenna = false;
        }
        return super.dispatchGenericMotionEvent(e);
    }

    /**
     * Penna appoggiata con il tasto premuto: apre il menu e assorbe tutto il
     * gesto, così non parte anche un trascinamento o una selezione a riquadro.
     */
    @Override
    public boolean dispatchTouchEvent(MotionEvent e) {
        int azione = e.getActionMasked();
        if (azione == MotionEvent.ACTION_DOWN && eStilo(e) && tastoPremuto(e)) {
            gestoAssorbito = true;
            avvisa(e.getX(), e.getY());
            return true;
        }
        if (gestoAssorbito) {
            if (azione == MotionEvent.ACTION_UP || azione == MotionEvent.ACTION_CANCEL) {
                gestoAssorbito = false;
                tastoPenna = false;
            }
            return true;
        }
        return super.dispatchTouchEvent(e);
    }

    private static boolean eStilo(MotionEvent e) {
        int t = e.getToolType(0);
        return t == MotionEvent.TOOL_TYPE_STYLUS || t == MotionEvent.TOOL_TYPE_ERASER;
    }

    private static boolean tastoPremuto(MotionEvent e) {
        int b = e.getButtonState();
        return (b & (MotionEvent.BUTTON_STYLUS_PRIMARY | MotionEvent.BUTTON_SECONDARY)) != 0;
    }

    /**
     * Manda "sPenNativeEvent" al web. x e y sono in pixel della finestra
     * (NaN se il tasto è arrivato senza posizione): diventano pixel CSS
     * relativi alla WebView; senza posizione il web usa l'ultima nota.
     */
    private void avvisa(float x, float y) {
        long ora = SystemClock.uptimeMillis();
        if (ora - ultimoAvviso < PAUSA_AVVISI_MS) return;
        ultimoAvviso = ora;
        WebView web = webView();
        if (getBridge() == null || web == null) return;
        JSObject dati = new JSObject();
        dati.put("action", "down");
        if (!Float.isNaN(x) && !Float.isNaN(y)) {
            int[] pos = new int[2];
            web.getLocationInWindow(pos);
            float densita = getResources().getDisplayMetrics().density;
            dati.put("x", (x - pos[0]) / densita);
            dati.put("y", (y - pos[1]) / densita);
        }
        getBridge().triggerWindowJSEvent("sPenNativeEvent", dati.toString());
    }
}
