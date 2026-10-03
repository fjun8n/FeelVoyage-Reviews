# FeelVoyage Reviews

Site separat, **doar pentru citire**, cu recenziile reale lăsate de clienții [FeelVoyage](https://feelvoyage.ro) pentru fiecare destinație — stele, păreri și poze din vacanță. Nu poți lăsa o recenzie de aici; recenziile se adaugă exclusiv de pe site-ul principal, unde ai nevoie de cont.

## Cum funcționează

- **Aceeași bază de date Firebase** ca site-ul principal (`js/firebase-config.js`, copiat de acolo) — orice recenzie nouă scrisă pe FeelVoyage.ro apare aici automat, live, fără nimic de făcut manual.
- **Aceleași destinații** (`js/destinations.js`, copiat de pe site-ul principal) — dacă pe site-ul principal se adaugă destinații noi, copiază din nou acel fișier aici ca să rămână sincronizate 1-la-1. Nu există sincronizare automată între cele două foldere/repo-uri — e o copiere manuală, simplă (un singur fișier).
- **Aceleași 5 limbi** (RO/EN/IT/FR/ES), traduse din aceleași fișiere `translations*.js`, copiate de asemenea de pe site-ul principal.
- **Recenziile NU sunt traduse automat.** Fiecare recenzie apare exact cum a fost scrisă, cu o etichetă clară a limbii originale (ex. „🇬🇧 Scris în English”) dacă diferă de limba selectată pe site. O traducere automată reală ar necesita un serviciu plătit (ex. Google Cloud Translation, cu cheie API și cost recurent) — poate fi adăugată ulterior, dacă se dorește.

## Structură

```
reviews/
├── index.html              ← pagina principală (grilă de destinații + fereastră de recenzii)
├── css/
│   ├── tailwind.css        ← compilat, vezi mai jos cum se reconstruiește
│   └── styles.css          ← stiluri suplimentare, copiate de pe site-ul principal
├── js/
│   ├── destinations.js     ← copie din site-ul principal (sincronizare manuală)
│   ├── translations.js     ← copie din site-ul principal (EN + IT)
│   ├── translations-fr.js  ← copie din site-ul principal
│   ├── translations-es.js  ← copie din site-ul principal
│   ├── firebase-config.js  ← copie din site-ul principal (aceeași bază de date)
│   ├── backend-reviews.js  ← conector Firebase, DOAR CITIRE (specific acestui site)
│   └── app-reviews.js      ← toată logica site-ului (grilă, căutare, fereastră de recenzii, limbă)
├── tailwind.config.js
└── package.json
```

## Reconstruirea CSS-ului (dacă modifici `index.html` sau `app-reviews.js`)

Acest site folosește Tailwind **precompilat**, separat de site-ul principal — propriul `tailwind.config.js`/`package.json`, cu propriul `css/tailwind.css`. Dacă adaugi clase Tailwind noi în `index.html` sau în `js/app-reviews.js`, trebuie reconstruit din acest folder (nu din rădăcina proiectului principal):

```bash
cd reviews
npm install
npm run build:css
```

## Publicare pe GitHub Pages

Acest folder e gândit să devină propriul lui repo GitHub, separat de site-ul principal:

1. Creează un repo nou pe GitHub (ex. `feelvoyage-reviews`).
2. Urcă tot conținutul acestui folder (`reviews/`) ca rădăcină a acelui repo (nu ca subfolder).
3. Settings → Pages → Branch: `main` → Save.
4. Link-ul „Vezi mai multe recenzii” de pe site-ul principal trebuie actualizat să indice spre adresa reală a acestui site odată publicat (în prezent indică spre `reviews/index.html`, o cale relativă, validă doar dacă publici acest folder ca subfolder al site-ului principal, nu ca domeniu separat).

## Limitări cunoscute, asumate intenționat

- **Fără autentificare pe acest site** — nu e nevoie, de vreme ce nu se poate scrie nimic aici, doar citi.
- **Fără Firebase Storage** — pozele din recenzii sunt comprimate direct în browser (pe site-ul principal, la trimitere) și stocate direct în baza de date, nu într-un serviciu de fișiere separat.
