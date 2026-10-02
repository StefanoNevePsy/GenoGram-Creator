// Icone Android di GenoGram Creator, generate da un'unica sagoma.
//
//   node scripts/icone-android.mjs
//
// Produce, in android/app/src/main/res:
// - icona adattiva (API 26+): sfondo a gradiente + sagoma bianca, in vettoriale;
// - livello monocromo per le icone a tema di Android 13+ (Material You /
//   Monet): il sistema lo colora con la tinta dello sfondo del telefono;
// - icone PNG classiche (quadrate e tonde) per Android 7 e per il launcher
//   che non usa le adattive;
// - splash per Android < 12 (da Android 12 il sistema usa l'icona adattiva).
// Il workflow Android lo esegue a ogni build, quindi le icone restano
// allineate a questa sagoma anche se qualcuno le modifica a mano.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const RES = 'android/app/src/main/res';
const BLU_ALTO = '#5B9BCB', BLU_BASSO = '#2B6698';

// La sagoma, sulla tela 108×108 delle icone adattive e dentro la zona sicura
// (cerchio di raggio 33 attorno al centro): due cerchi, due quadrati e i
// legami che li uniscono, come nel logo dell'app.
const LINEE = 'M38,38 L70,38 M38,70 L70,70 M38,38 L38,70 M70,38 L70,70 M38,38 L70,70 M38,70 L70,38';
const quadrato = (x, y) => `M${x + 3},${y} h10 a3,3 0 0 1 3,3 v10 a3,3 0 0 1 -3,3 h-10 a3,3 0 0 1 -3,-3 v-10 a3,3 0 0 1 3,-3 z`;
const FORME = [
    'M30,38 a8,8 0 1,0 16,0 a8,8 0 1,0 -16,0 z',
    'M30,70 a8,8 0 1,0 16,0 a8,8 0 1,0 -16,0 z',
    quadrato(62, 30),
    quadrato(62, 62),
];

const vettoriale = (corpo) => `<?xml version="1.0" encoding="utf-8"?>
<!-- Generato da scripts/icone-android.mjs: non modificare a mano. -->
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:aapt="http://schemas.android.com/aapt"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
${corpo}
</vector>
`;
const sagoma = (colore) => [
    `    <path android:strokeColor="${colore}" android:strokeWidth="3" android:strokeLineCap="round" android:pathData="${LINEE}" />`,
    ...FORME.map((d) => `    <path android:fillColor="${colore}" android:pathData="${d}" />`),
].join('\n');

const sfondo = `    <path android:pathData="M0,0h108v108h-108z">
        <aapt:attr name="android:fillColor">
            <gradient android:type="linear" android:startX="0" android:startY="0" android:endX="0" android:endY="108"
                android:startColor="#FF${BLU_ALTO.slice(1)}" android:endColor="#FF${BLU_BASSO.slice(1)}" />
        </aapt:attr>
    </path>`;

const adattiva = `<?xml version="1.0" encoding="utf-8"?>
<!-- Generato da scripts/icone-android.mjs. Il livello monochrome è quello che
     Android 13+ colora con la tinta Material You quando le icone a tema sono attive. -->
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@drawable/ic_launcher_background"/>
    <foreground android:drawable="@drawable/ic_launcher_foreground"/>
    <monochrome android:drawable="@drawable/ic_launcher_monochrome"/>
</adaptive-icon>
`;

// La stessa icona in SVG, per le bitmap. forma: 'quadrata' | 'tonda' | 'sagoma' (senza sfondo)
const svg = (lato, forma, scala = 1) => {
    const k = scala, c = 54;
    const t = `translate(${c - c * k} ${c - c * k}) scale(${k})`;
    const clip = forma === 'tonda' ? '<circle cx="54" cy="54" r="54"/>'
        : forma === 'quadrata' ? '<rect x="4" y="4" width="100" height="100" rx="22"/>'
        : '<rect width="108" height="108"/>';
    const fondo = forma === 'sagoma' ? '' : '<rect width="108" height="108" fill="url(#g)"/>';
    return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${lato}" height="${lato}" viewBox="0 0 108 108">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${BLU_ALTO}"/><stop offset="1" stop-color="${BLU_BASSO}"/></linearGradient>
  <clipPath id="c">${clip}</clipPath></defs>
  <g clip-path="url(#c)">${fondo}
  <g transform="${t}"><path d="${LINEE}" stroke="#fff" stroke-width="3" stroke-linecap="round" fill="none"/>${FORME.map((d) => `<path d="${d}" fill="#fff"/>`).join('')}</g></g>
</svg>`);
};

const scrivi = (file, testo) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, testo); };

// 1. Livelli vettoriali dell'icona adattiva
scrivi(`${RES}/drawable/ic_launcher_background.xml`, vettoriale(sfondo));
scrivi(`${RES}/drawable/ic_launcher_foreground.xml`, vettoriale(sagoma('#FFFFFFFF')));
scrivi(`${RES}/drawable/ic_launcher_monochrome.xml`, vettoriale(sagoma('#FFFFFFFF')));
scrivi(`${RES}/mipmap-anydpi-v26/ic_launcher.xml`, adattiva);
scrivi(`${RES}/mipmap-anydpi-v26/ic_launcher_round.xml`, adattiva);
// i vecchi livelli di Capacitor (la "X" azzurra) non devono più vincere sui nostri
for (const f of ['drawable-v24/ic_launcher_foreground.xml', ...['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'].map((d) => `mipmap-${d}/ic_launcher_foreground.png`)]) {
    fs.rmSync(`${RES}/${f}`, { force: true });
}
scrivi(`${RES}/values/ic_launcher_background.xml`, `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${BLU_BASSO}</color>\n</resources>\n`);

// 2. Bitmap classiche (sagoma ingrandita: qui non c'è il ritaglio adattivo)
const DPI = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
for (const [d, lato] of Object.entries(DPI)) {
    await sharp(svg(lato, 'quadrata', 1.2)).png().toFile(`${RES}/mipmap-${d}/ic_launcher.png`);
    await sharp(svg(lato, 'tonda', 1.1)).png().toFile(`${RES}/mipmap-${d}/ic_launcher_round.png`);
}

// 3. Splash per Android < 12: sfondo blu con la sagoma al centro
const splash = async (file, w, h) => {
    const lato = Math.round(Math.min(w, h) * 0.45);
    const icona = await sharp(svg(lato, 'sagoma', 1.3)).png().toBuffer();
    await sharp({ create: { width: w, height: h, channels: 4, background: BLU_BASSO } })
        .composite([{ input: icona, left: Math.round((w - lato) / 2), top: Math.round((h - lato) / 2) }])
        .png().toFile(file);
};
for (const dir of fs.readdirSync(RES).filter((d) => d.startsWith('drawable'))) {
    const f = `${RES}/${dir}/splash.png`;
    if (!fs.existsSync(f)) continue;
    const { width, height } = await sharp(f).metadata();
    await splash(f, width, height);
}
console.log('icone Android generate in', RES);
