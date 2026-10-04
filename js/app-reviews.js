/* FeelVoyage Reviews — site separat, DOAR pentru citirea recenziilor (nu poți scrie aici; recenziile se adaugă
   exclusiv de pe FeelVoyage.ro, unde ai nevoie de cont). Aceleași destinații (js/destinations.js, copiat din
   proiectul principal — sincronizează manual acest fișier dacă adaugi destinații noi acolo) și aceleași 5 limbi.

   Despre traducerea recenziilor: fiecare recenzie e afișată exact cum a fost scrisă, cu o etichetă care arată
   limba originală — nu traducem automat textul (ar necesita un serviciu de traducere plătit, cu cheie API). */
(function () {
    'use strict';

    const LANG_KEY = 'feelvoyage_lang';
    let currentLang = localStorage.getItem(LANG_KEY) || 'ro';
    const LANG_NAMES = { ro: 'Română', en: 'English', it: 'Italiano', fr: 'Français', es: 'Español' };
    const LANG_FLAGS = { ro: '🇷🇴', en: '🇬🇧', it: '🇮🇹', fr: '🇫🇷', es: '🇪🇸' };

    function tr(key, fallback) {
        if (currentLang === 'ro') return fallback !== undefined ? fallback : key;
        const dict = (typeof i18n !== 'undefined') ? i18n[currentLang] : null;
        if (dict && dict[key] !== undefined) return dict[key];
        return fallback !== undefined ? fallback : key;
    }
    function getDestinationText(item) {
        const prefix = 'dest.' + item.id + '.';
        return {
            title: tr(prefix + 'title', item.title),
            tagLabel: tr(prefix + 'tagLabel', item.tagLabel)
        };
    }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
    function initialsOf(name) {
        return String(name || 'FV').trim().split(/\s+/).filter(Boolean).map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase() || 'FV';
    }
    function starsHtml(n, size) {
        let html = '';
        for (let i = 1; i <= 5; i++) html += '<i class="fa-' + (i <= Math.round(n) ? 'solid' : 'regular') + ' fa-star ' + (size || '') + '"></i>';
        return html;
    }

    const UI_TEXT = {
        ro: { backMain: 'FeelVoyage.ro', heroBadge: 'Recenzii verificate', heroTitle: 'Ce spun călătorii noștri, despre fiecare destinație', heroSubtitle: 'Recenzii reale, lăsate doar de cei care au avut deja cont și au călătorit cu FeelVoyage — cu note, păreri și poze din vacanță.', searchPh: 'Caută o destinație...', empty: 'Nicio destinație nu se potrivește căutării tale.', noReviews: 'Nicio recenzie încă pentru această destinație.', reviews: 'recenzii', review1: 'recenzie', writtenIn: 'Scris în', positive: 'Ce i-a plăcut', negative: 'Ce nu i-a plăcut', extra: 'Alte observații' },
        en: { backMain: 'FeelVoyage.ro', heroBadge: 'Verified reviews', heroTitle: 'What our travelers say, for every destination', heroSubtitle: 'Real reviews, left only by people who already had an account and traveled with FeelVoyage — with ratings, opinions and trip photos.', searchPh: 'Search a destination...', empty: 'No destination matches your search.', noReviews: 'No reviews yet for this destination.', reviews: 'reviews', review1: 'review', writtenIn: 'Written in', positive: 'What they liked', negative: "What they didn't like", extra: 'Other notes' },
        it: { backMain: 'FeelVoyage.ro', heroBadge: 'Recensioni verificate', heroTitle: 'Cosa dicono i nostri viaggiatori, per ogni destinazione', heroSubtitle: 'Recensioni vere, lasciate solo da chi aveva già un account e ha viaggiato con FeelVoyage — con voti, opinioni e foto del viaggio.', searchPh: 'Cerca una destinazione...', empty: 'Nessuna destinazione corrisponde alla tua ricerca.', noReviews: 'Ancora nessuna recensione per questa destinazione.', reviews: 'recensioni', review1: 'recensione', writtenIn: 'Scritto in', positive: 'Cosa gli è piaciuto', negative: 'Cosa non gli è piaciuto', extra: 'Altre osservazioni' },
        fr: { backMain: 'FeelVoyage.ro', heroBadge: 'Avis vérifiés', heroTitle: 'Ce que disent nos voyageurs, pour chaque destination', heroSubtitle: 'De vrais avis, laissés uniquement par des personnes ayant déjà un compte et ayant voyagé avec FeelVoyage — avec notes, opinions et photos du voyage.', searchPh: 'Rechercher une destination...', empty: 'Aucune destination ne correspond à votre recherche.', noReviews: 'Aucun avis pour cette destination pour le moment.', reviews: 'avis', review1: 'avis', writtenIn: 'Écrit en', positive: 'Ce qu\u2019il a aimé', negative: 'Ce qu\u2019il n\u2019a pas aimé', extra: 'Autres remarques' },
        es: { backMain: 'FeelVoyage.ro', heroBadge: 'Reseñas verificadas', heroTitle: 'Lo que dicen nuestros viajeros, de cada destino', heroSubtitle: 'Reseñas reales, dejadas solo por personas que ya tenían cuenta y viajaron con FeelVoyage — con puntuaciones, opiniones y fotos del viaje.', searchPh: 'Buscar un destino...', empty: 'Ningún destino coincide con tu búsqueda.', noReviews: 'Aún no hay reseñas para este destino.', reviews: 'reseñas', review1: 'reseña', writtenIn: 'Escrito en', positive: 'Qué le gustó', negative: 'Qué no le gustó', extra: 'Otras notas' }
    };
    function ui(key) { return (UI_TEXT[currentLang] && UI_TEXT[currentLang][key]) || UI_TEXT.ro[key]; }

    function applyStaticText() {
        document.title = currentLang === 'ro' ? 'FeelVoyage Reviews — Recenzii reale de la călătorii noștri' : document.title;
        document.getElementById('langSwitch').value = currentLang;
        document.querySelector('[data-i18n="back.main"]').textContent = ui('backMain');
        document.querySelector('[data-i18n="hero.badge"]').textContent = ui('heroBadge');
        document.querySelector('[data-i18n="hero.title"]').textContent = ui('heroTitle');
        document.querySelector('[data-i18n="hero.subtitle"]').textContent = ui('heroSubtitle');
        document.getElementById('destSearch').setAttribute('placeholder', ui('searchPh'));
        document.querySelector('[data-i18n="search.empty"]').textContent = ui('empty');
        document.getElementById('footerYear').textContent = new Date().getFullYear();
    }

    /* ---------- grila de destinații ---------- */
    const grid = document.getElementById('destGrid');
    const emptyMsg = document.getElementById('destEmpty');
    const statsCache = {};   // id -> {avg, count} cel mai recent primit, ca sa putem re-randa rapid la schimbarea limbii/cautarii
    const statUnsubs = {};

    function destCardHtml(d) {
        const t = getDestinationText(d);
        const stats = statsCache[d.id] || { avg: 5, count: 0 };
        const img = (d.images && d.images[0]) || '';
        return '<button type="button" data-dest-id="' + esc(d.id) + '" class="dest-card text-left bg-white rounded-3xl overflow-hidden border border-slate-200 hover:border-brand-300 hover:shadow-xl transition-all group">' +
            '<div class="h-40 bg-slate-100 overflow-hidden"><img src="' + esc(img) + '" alt="" loading="lazy" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"></div>' +
            '<div class="p-4">' +
                '<p class="font-bold text-sm leading-snug mb-1.5">' + esc(t.title) + '</p>' +
                '<div class="flex items-center gap-1.5 text-xs">' +
                    '<span class="text-amber-500">' + starsHtml(stats.avg, 'text-[11px]') + '</span>' +
                    '<span class="font-bold">' + stats.avg.toFixed(1) + '</span>' +
                    '<span class="text-slate-400">(' + stats.count + ' ' + (stats.count === 1 ? ui('review1') : ui('reviews')) + ')</span>' +
                '</div>' +
            '</div>' +
        '</button>';
    }

    function renderGrid(filterText) {
        const q = (filterText || '').trim().toLowerCase();
        const list = destinations.filter(function (d) {
            if (!q) return true;
            const t = getDestinationText(d);
            return t.title.toLowerCase().indexOf(q) > -1;
        });
        emptyMsg.classList.toggle('hidden', list.length > 0);
        grid.innerHTML = list.map(destCardHtml).join('');
    }

    function watchAllStats() {
        destinations.forEach(function (d) {
            if (statUnsubs[d.id]) return;   // o singură dată
            statUnsubs[d.id] = window.FVReviewsBackend.onReviewStats(d.id, function (stats) {
                statsCache[d.id] = stats;
                const card = grid.querySelector('[data-dest-id="' + d.id.replace(/"/g, '') + '"]');
                if (card) card.outerHTML = destCardHtml(d);
            });
        });
    }

    document.getElementById('destSearch').addEventListener('input', function (e) { renderGrid(e.target.value); });

    /* ---------- fereastra cu recenziile unei destinații ---------- */
    const modal = document.getElementById('reviewsModal');
    const panel = document.getElementById('reviewsModalPanel');
    const titleEl = document.getElementById('reviewsModalTitle');
    const statsEl = document.getElementById('reviewsModalStats');
    const listEl = document.getElementById('reviewsModalList');
    const bannerEl = document.getElementById('reviewsModalBanner');
    let unsubReviews = null;

    function reviewCardHtml(r) {
        const dateStr = r.createdAt ? new Date(r.createdAt).toLocaleDateString(currentLang === 'ro' ? 'ro-RO' : currentLang) : '';
        const langTag = r.lang && r.lang !== currentLang ? '<span class="text-[10px] font-bold text-slate-400 uppercase tracking-wide">' + (LANG_FLAGS[r.lang] || '') + ' ' + ui('writtenIn') + ' ' + (LANG_NAMES[r.lang] || r.lang) + '</span>' : '';
        const photosJson = (r.photos && r.photos.length) ? esc(JSON.stringify(r.photos)) : '';
        const photosHtml = (r.photos && r.photos.length) ? '<div class="flex gap-2 mt-3 flex-wrap">' + r.photos.map(function (p, i) { return '<img src="' + esc(p) + '" data-photos="' + photosJson + '" data-idx="' + i + '" class="w-16 h-16 rounded-lg object-cover border border-slate-200 fv-photo-thumb" alt="">'; }).join('') + '</div>' : '';
        const block = function (label, text, colorClass) {
            if (!text) return '';
            return '<p class="mt-2"><span class="text-[11px] font-extrabold uppercase tracking-wide ' + colorClass + '">' + esc(label) + '</span><br><span class="text-sm text-slate-700">' + esc(text) + '</span></p>';
        };
        return '<div class="pb-5 border-b border-slate-100 last:border-0">' +
            '<div class="flex items-start justify-between gap-3">' +
                '<div class="flex items-center gap-3 min-w-0">' +
                    '<div class="w-9 h-9 rounded-full bg-gradient-to-tr from-brand-600 to-sunset-500 text-white flex items-center justify-center font-bold text-xs flex-shrink-0">' + esc(initialsOf(r.name)) + '</div>' +
                    '<div class="min-w-0"><p class="font-bold text-sm text-slate-800 truncate">' + esc(r.name || 'Călător FeelVoyage') + '</p><p class="text-[11px] text-slate-400">' + esc(dateStr) + '</p></div>' +
                '</div>' +
                '<div class="text-amber-500 text-xs shrink-0">' + starsHtml(r.rating) + '</div>' +
            '</div>' +
            block(ui('positive'), r.positive, 'text-emerald-700') +
            block(ui('negative'), r.negative, 'text-rose-700') +
            block(ui('extra'), r.extra, 'text-slate-500') +
            photosHtml +
            (langTag ? '<p class="mt-2">' + langTag + '</p>' : '') +
        '</div>';
    }

    function openReviews(destId) {
        const d = destinations.find(function (x) { return x.id === destId; });
        if (!d) return;
        const t = getDestinationText(d);
        titleEl.textContent = t.title;
        bannerEl.src = (d.images && d.images[0]) || '';
        bannerEl.alt = t.title;
        statsEl.innerHTML = '';
        listEl.innerHTML = '<p class="text-center text-slate-300 text-sm py-10"><i class="fa-solid fa-spinner fa-spin"></i></p>';
        modal.classList.remove('hidden');
        requestAnimationFrame(function () { panel.classList.remove('scale-95', 'opacity-0'); });
        document.body.classList.add('overflow-hidden');

        if (unsubReviews) { unsubReviews(); unsubReviews = null; }
        window.FVReviewsBackend.onReviewStats(destId, function (stats) {
            statsEl.innerHTML = '<span class="text-amber-500 text-sm">' + starsHtml(stats.avg, 'text-xs') + '</span><span class="font-bold text-slate-800">' + stats.avg.toFixed(1) + '</span><span class="text-slate-400">(' + stats.count + ' ' + (stats.count === 1 ? ui('review1') : ui('reviews')) + ')</span>';
        });
        unsubReviews = window.FVReviewsBackend.onDestinationReviews(destId, function (list) {
            listEl.innerHTML = list.length ? list.map(reviewCardHtml).join('') : '<p class="text-center text-slate-300 text-sm py-10">' + ui('noReviews') + '</p>';
        });
    }
    function closeReviews() {
        panel.classList.add('scale-95', 'opacity-0');
        document.body.classList.remove('overflow-hidden');
        setTimeout(function () { modal.classList.add('hidden'); if (unsubReviews) { unsubReviews(); unsubReviews = null; } }, 200);
    }
    grid.addEventListener('click', function (e) {
        const btn = e.target.closest('.dest-card');
        if (btn) openReviews(btn.getAttribute('data-dest-id'));
    });
    // click pe o poză dintr-o recenzie: o mărește, cu săgeți prin restul pozelor aceleiași recenzii (js/lightbox.js)
    listEl.addEventListener('click', function (e) {
        const pic = e.target.closest('[data-photos]');
        if (!pic || typeof window.fvOpenLightbox !== 'function') return;
        try { window.fvOpenLightbox(JSON.parse(pic.getAttribute('data-photos')), parseInt(pic.getAttribute('data-idx'), 10) || 0); } catch (err) { }
    });
    document.getElementById('closeReviewsModal').addEventListener('click', closeReviews);
    modal.addEventListener('click', function (e) { if (e.target === modal) closeReviews(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeReviews(); });

    /* ---------- limbă ---------- */
    document.getElementById('langSwitch').addEventListener('change', function (e) {
        currentLang = e.target.value;
        localStorage.setItem(LANG_KEY, currentLang);
        applyStaticText();
        renderGrid(document.getElementById('destSearch').value);
    });

    /* ---------- pornire ---------- */
    applyStaticText();
    renderGrid('');
    watchAllStats();
})();
