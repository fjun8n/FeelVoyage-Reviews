# FeelVoyage Reviews

Site separat, **doar pentru citire**, cu recenziile reale lăsate de clienții [FeelVoyage](https://fjun8n.github.io/FeelVoyage/) pentru fiecare destinație — stele, păreri și poze din vacanță. Nu poți lăsa o recenzie de aici; recenziile se adaugă exclusiv de pe site-ul principal, unde ai nevoie de cont.

Același design, aceleași culori și același logo ca site-ul principal (cu „Reviews" adăugat lângă el), inclusiv comutator luminos/întunecat.

- Site principal: https://fjun8n.github.io/FeelVoyage/
- Acest site: https://fjun8n.github.io/FeelVoyage-Reviews/

## Cum funcționează

- **Aceeași bază de date Firebase** ca site-ul principal (`js/firebase-config.js`, copiat de acolo) — orice recenzie nouă scrisă pe FeelVoyage.ro apare aici automat, live, fără nimic de făcut manual.
- **Aceleași destinații** (`js/destinations.js`, copiat de pe site-ul principal) — dacă pe site-ul principal se adaugă destinații noi, copiază din nou acel fișier aici ca să rămână sincronizate 1-la-1. Nu există sincronizare automată între cele două foldere/repo-uri — e o copiere manuală, simplă (un singur fișier).
- **Poze locale** (`img/` și `img2/`): câteva destinații (Băile Herculane, Băile Săcelu, Constanța, Sovata, Cluj-Napoca, Craiova, Timișoara) au poze stocate local, nu pe Unsplash — sunt copiate și aici. Dacă adaugi poze locale noi pentru o destinație pe site-ul principal, copiază și folderul ei de poze aici.
- **Aceleași 5 limbi** (RO/EN/IT/FR/ES), traduse din aceleași fișiere `translations*.js`, copiate de asemenea de pe site-ul principal.
- **Comutator luminos/întunecat**, identic cu site-ul principal (`js/theme.js` + `css/dark.css`, copiate de acolo).
- **Recenziile NU sunt traduse automat.** Fiecare recenzie apare exact cum a fost scrisă, cu o etichetă clară a limbii originale (ex. „🇬🇧 Scris în English”) dacă diferă de limba selectată pe site. O traducere automată reală ar necesita un serviciu plătit (ex. Google Cloud Translation, cu cheie API și cost recurent) — poate fi adăugată ulterior, dacă se dorește.

## Structură

```
reviews/
├── index.html              ← pagina principală (grilă de destinații + fereastră de recenzii)
├── css/
│   ├── tailwind.css        ← compilat, vezi mai jos cum se reconstruiește
│   ├── styles.css          ← stiluri suplimentare, copiate de pe site-ul principal
│   └── dark.css            ← modul întunecat, copiat de pe site-ul principal
├── img/, img2/              ← poze locale ale câtorva destinații, copiate de pe site-ul principal
├── js/
│   ├── destinations.js     ← copie din site-ul principal (sincronizare manuală)
│   ├── translations.js     ← copie din site-ul principal (EN + IT)
│   ├── translations-fr.js  ← copie din site-ul principal
│   ├── translations-es.js  ← copie din site-ul principal
│   ├── firebase-config.js  ← copie din site-ul principal (aceeași bază de date)
│   ├── theme.js             ← copie din site-ul principal (modul luminos/întunecat)
│   ├── backend-reviews.js  ← conector Firebase, DOAR CITIRE (specific acestui site)
│   └── app-reviews.js      ← toată logica site-ului (grilă, căutare, fereastră de recenzii, limbă)
├── tailwind.config.js       ← identic la culori/fonturi cu cel principal
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

Acest folder e propriul lui repo GitHub (`FeelVoyage-Reviews`), separat de site-ul principal (`FeelVoyage`):

1. Urcă tot conținutul acestui folder ca rădăcină a repo-ului `FeelVoyage-Reviews`.
2. Settings → Pages → Branch: `main` → Save.
3. Dacă vreodată schimbi numele de utilizator/repo pe GitHub, actualizează URL-urile absolute din `index.html` (linkul „FeelVoyage.ro” de aici) și din site-ul principal (`viewAllReviewsBtn`, în `index.html`), ca să rămână sincronizate.

## Limitări cunoscute, asumate intenționat

- **Fără autentificare pe acest site** — nu e nevoie, de vreme ce nu se poate scrie nimic aici, doar citi.
- **Fără Firebase Storage** — pozele din recenzii sunt comprimate direct în browser (pe site-ul principal, la trimitere) și stocate direct în baza de date, nu într-un serviciu de fișiere separat.

**Actualizare sesiune curentă:** banner cu poza destinației în fereastra de recenzii (în loc de antet gol), lightbox pentru mărirea pozelor din recenzii, destinations.js sincronizat cu site-ul principal (include acum și cele 3 parcuri tematice + Băile Săcelu).
