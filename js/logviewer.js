/* FeelVoyage Reviews — fereastra „Jurnal” a ACESTUI site (DOAR pentru administrator).

   Versiune mai mică a ferestrei de pe site-ul principal (js/logviewer.js), cu două file:
     • Acest dispozitiv — ce a scris js/logger.js în browserul de pe care ai deschis fereastra;
     • Server — jurnalul tuturor vizitatorilor acestui site, din Firebase (nodul reviewsLogs/, complet
       separat de „logs/” al site-ului principal). Citirea e permisă DOAR administratorului de regulile
       bazei de date (firebase-rules.json): un cont obișnuit primește PERMISSION_DENIED chiar dacă ar
       apela funcțiile din consolă.

   Nu are filele „Conturi” și „Rapoarte Bug”: conturile se administrează doar de pe site-ul principal, iar
   rapoartele de bug de pe ambele site-uri se văd tot acolo, într-o singură listă (au eticheta site: 'reviews').

   Butonul „Jurnal” se montează în bara de administrator creată de js/admin-auth.js (#reviewsAdminTools),
   la primirea evenimentului „fv:admin”. Textele refolosesc cheile de traducere log.* existente. */
(function (root) {
    'use strict';
    var doc = root.document;
    var modal = null, adminOn = false, src = 'device', filt = { level: 'all', cat: 'all', q: '' }, openIds = {};
    var cache = { server: null, serverErr: '', loading: false, pruned: false };

    function trF(k, fb) { return (typeof root.tr === 'function') ? root.tr(k, fb) : fb; }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
    function $(id) { return doc.getElementById(id); }
    function pad(n) { return n < 10 ? '0' + n : String(n); }
    function hhmmss(ms) { var d = new Date(ms); return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()); }
    function dayOf(ms) { var d = new Date(ms); return pad(d.getDate()) + '.' + pad(d.getMonth() + 1); }
    function backend() { return root.FVReviewsBackend || null; }
    function backendOk() { var b = backend(); return !!(b && b.mode === 'firebase' && b.listLogs); }

    /* ------------------------------------------------------------ datele afișate */
    function fromServer(r, i) {
        var d; if (r.d) { try { d = JSON.parse(r.d); } catch (e) { d = { raw: String(r.d).slice(0, 200) }; } }
        var e = { n: i + 1, t: r.ts || r.at || 0, s: r.s, l: r.l, c: r.c, e: r.e, r: r.r || 1 };
        if (r.a) e.acct = r.a;
        if (d !== undefined) e.d = d;
        return e;
    }
    function entries() { return src === 'server' ? (cache.server || []) : (root.FVLog ? root.FVLog.getAll() : []); }

    var CODE_TEXT = {
        'invalid-credentials': 'E-mail sau parolă greșite', 'not-admin': 'Cont fără rol de administrator',
        'too-many': 'Prea multe încercări — Firebase a limitat temporar cererile',
        'network': 'Fără legătură cu Firebase (offline sau resursă blocată)', 'forbidden': 'Acces respins de regulile bazei de date',
        'unsupported': 'Funcția nu e disponibilă (Firebase neconfigurat)', 'PERMISSION_DENIED': 'Acces respins de regulile Firebase',
        'unknown': 'Eroare necunoscută de pe Firebase (vezi detaliile de mai jos)'
    };
    // O propoziție scurtă pentru un eveniment „warn”/„error”, fără să fie nevoie să deschizi datele brute (JSON).
    function friendlyError(e) {
        if (e.l !== 'warn' && e.l !== 'error') return null;
        var d = e.d || {}, key = e.c + '.' + e.e, code = d.code, txt = CODE_TEXT[code];
        switch (key) {
            case 'js.error': return 'Eroare de cod: ' + (d.msg || '(fără mesaj)') + (d.file ? ' — ' + d.file + (d.line ? ':' + d.line : '') : '');
            case 'js.unhandledrejection': return 'Eroare neașteptată (promisiune respinsă): ' + (d.msg || txt || code || '(fără mesaj)');
            case 'console.error': case 'console.warn': return d.msg || '(fără mesaj în consolă)';
            case 'resource.fail': return 'Nu s-a încărcat o resursă: ' + (d.tag || '?') + ' de pe ' + (d.host || '?') + (d.file ? ' (' + d.file + ')' : '');
            case 'security.csp': return 'Blocat de regulile de securitate (CSP): ' + (d.directive || '?') + (d.blocked ? ' — ' + d.blocked : '');
            case 'perf.slow': return 'A durat prea mult: „' + (d.what || '?') + '” — ' + (d.ms != null ? d.ms + ' ms' : '?');
            case 'logremote.stopped': return 'Trimiterea jurnalului către server s-a oprit: ' + (txt || code || '(motiv necunoscut)');
            case 'admin.login.fail': return 'Autentificare de administrator respinsă: ' + (txt || code || '(motiv necunoscut)');
            case 'admin.log.denied': return 'Cineva fără rol de administrator a încercat să deschidă fereastra „Jurnal”';
        }
        if (/\.fail$/.test(e.e) || (e.c === 'ai' && e.e === 'ask' && d.ok === false)) return 'Eșuat: ' + (txt || code || '(fără cod de eroare)');
        if (code) return txt || ('Cod: ' + code);
        return null;
    }
    function acctOf(e) { return e.acct || (e.d && e.d.acct) || ''; }
    function statsOf(list) {
        var by = { debug: 0, info: 0, warn: 0, error: 0 }, cats = {}, sess = {};
        list.forEach(function (e) { var n = e.r || 1; by[e.l] = (by[e.l] || 0) + n; cats[e.c] = (cats[e.c] || 0) + n; sess[e.s] = 1; });
        return { total: list.length, levels: by, categories: cats, sessions: Object.keys(sess).length };
    }

    /* ------------------------------------------------------------ butonul din bara de administrator */
    function removeButton() { var b = $('reviewsLogBtn'); if (b) b.remove(); }
    function mountButton() {
        var row = $('reviewsAdminTools');   // creat de js/admin-auth.js
        if (!row || !adminOn) return;
        var b = $('reviewsLogBtn');
        if (!b) {
            b = doc.createElement('button');
            b.id = 'reviewsLogBtn'; b.type = 'button'; b.className = 'lv-btn';
            b.addEventListener('click', open);
            row.appendChild(b);
        }
        b.innerHTML = '<i class="fa-solid fa-clipboard-list" aria-hidden="true"></i><span>' + esc(trF('log.btn', 'Jurnal')) + '</span>';
        b.setAttribute('aria-label', trF('log.btn', 'Jurnal'));
    }

    function setAdmin(flag) {
        var was = adminOn;
        adminOn = !!flag;
        if (adminOn) {
            mountButton();
            // curățare: o dată pe sesiune, jurnalul serverului e redus la plafonul de 1000 de intrări —
            // se șterg mai întâi cele mai „neimportante” (info, apoi warn, apoi error), nu neapărat cele mai vechi
            if (backendOk() && !cache.pruned) {
                cache.pruned = true;
                backend().pruneLogs(1000).then(function (n) { if (root.FVLog) root.FVLog.info('admin', 'log.pruned', { n: n }); }, function () { });
            }
        } else {
            removeButton(); close();
            cache = { server: null, serverErr: '', loading: false, pruned: false };
            if (was && root.FVLog) root.FVLog.info('admin', 'log.access-removed');
        }
    }
    doc.addEventListener('fv:admin', function (e) { setAdmin(e.detail && e.detail.admin); });
    doc.addEventListener('fv:language', function () { if (adminOn) mountButton(); if (isOpen()) { build(); render(); } });

    /* ------------------------------------------------------------ fereastra */
    function isOpen() { return !!modal && !modal.classList.contains('hidden'); }

    function build() {
        var wasOpen = isOpen();
        if (!modal) {
            modal = doc.createElement('div');
            modal.id = 'reviewsLogModal'; modal.className = 'lv-modal hidden';
            modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true'); modal.setAttribute('aria-labelledby', 'rlvTitle');
            doc.body.appendChild(modal);
            modal.addEventListener('click', onClick);
            modal.addEventListener('input', function (e) {
                if (e.target.id === 'lvLevel') filt.level = e.target.value;
                else if (e.target.id === 'lvCat') filt.cat = e.target.value;
                else if (e.target.id === 'lvQ') filt.q = e.target.value;
                else return;
                renderList();
            });
        }
        var tabs = [['device', trF('log.tabDevice', 'Acest dispozitiv')], ['server', trF('log.tabServer', 'Server')]];
        modal.innerHTML =
            '<div class="lv-panel" id="lvPanel">' +
                '<div class="lv-head">' +
                    '<div class="lv-head-icon"><i class="fa-solid fa-clipboard-list" aria-hidden="true"></i></div>' +
                    '<div class="lv-head-text"><h3 id="rlvTitle">' + esc(trF('log.title', 'Jurnalul site-ului')) + ' — Reviews</h3><p>' + esc(trF('log.adminOnly', 'Doar pentru administrator. Fără date personale în jurnal; parolele nu se pot vedea.')) + '</p></div>' +
                    '<button type="button" class="lv-x" data-lv="close" aria-label="' + esc(trF('about.close', 'Închide')) + '"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>' +
                '</div>' +
                '<div class="lv-tabs" role="tablist">' + tabs.map(function (t) { return '<button type="button" role="tab" class="lv-tab' + (src === t[0] ? ' is-on' : '') + '" data-lv-tab="' + t[0] + '" aria-selected="' + (src === t[0]) + '">' + esc(t[1]) + '</button>'; }).join('') + '</div>' +
                '<div class="lv-body" id="lvBody"></div>' +
            '</div>';
        if (wasOpen) { var p0 = $('lvPanel'); if (p0) p0.classList.add('is-open'); }
    }

    function logView() {
        return '<div id="lvNote" class="lv-note hidden"></div>' +
            '<div id="lvStats" class="lv-stats"></div>' +
            '<div id="lvPerf" class="lv-perf"></div>' +
            '<div class="lv-tools">' +
                '<select id="lvLevel" class="lv-field" aria-label="' + esc(trF('log.level', 'Nivel')) + '"></select>' +
                '<select id="lvCat" class="lv-field" aria-label="' + esc(trF('log.category', 'Categorie')) + '"></select>' +
                '<input id="lvQ" type="search" class="lv-field lv-q" autocomplete="off" placeholder="' + esc(trF('log.search', 'Caută în jurnal…')) + '" value="' + esc(filt.q) + '">' +
            '</div>' +
            '<div class="lv-actions">' +
                '<button type="button" class="lv-act" data-lv="refresh"><i class="fa-solid fa-rotate" aria-hidden="true"></i> ' + esc(trF('log.refresh', 'Actualizează')) + '</button>' +
                '<button type="button" class="lv-act" data-lv="json"><i class="fa-solid fa-download" aria-hidden="true"></i> JSON</button>' +
                '<button type="button" class="lv-act" data-lv="csv"><i class="fa-solid fa-file-csv" aria-hidden="true"></i> CSV</button>' +
                (src === 'server'
                    ? '<button type="button" class="lv-act lv-danger" data-lv="prune"><i class="fa-solid fa-broom" aria-hidden="true"></i> ' + esc(trF('log.pruneOld', 'Reduce la 1000')) + '</button>' +
                      '<button type="button" class="lv-act lv-danger" data-lv="clear-server"><i class="fa-solid fa-trash" aria-hidden="true"></i> ' + esc(trF('log.clearServer', 'Șterge tot de pe server')) + '</button>'
                    : '<button type="button" class="lv-act lv-danger" data-lv="clear"><i class="fa-solid fa-trash" aria-hidden="true"></i> ' + esc(trF('log.clear', 'Șterge')) + '</button>') +
            '</div>' +
            '<p id="lvCount" class="lv-count"></p>' +
            '<div id="lvList" class="lv-list" role="list"></div>';
    }

    /* ------------------------------------------------------------ randare */
    function render(keepScroll) {
        if (!modal) return;
        var body = $('lvBody');
        var sc = keepScroll && $('lvList') ? $('lvList').scrollTop : 0;
        body.innerHTML = logView();
        var note = $('lvNote');
        if (src === 'server') {
            var msg = cache.loading ? trF('log.loading', 'Se încarcă de pe server…') : (cache.serverErr ? errText(cache.serverErr) : '');
            if (msg) { note.textContent = msg; note.classList.remove('hidden'); if (cache.serverErr) note.classList.add('lv-note-bad'); }
        }
        renderStats(); renderList();
        if (keepScroll && $('lvList')) $('lvList').scrollTop = sc;
    }

    function errText(code) {
        return ({
            forbidden: trF('log.forbidden', 'Acces respins de Firebase. Dacă ești sigur că ești logat ca administrator, cel mai probabil regulile din Firebase Console nu au fost încă actualizate cu conținutul curent din firebase-rules.json.'),
            unsupported: trF('log.unsupported', 'Serverul (Firebase) nu este configurat: jurnalul rămâne doar pe dispozitiv.'),
            network: trF('log.networkErr', 'Nu am putut citi de pe server. Verifică internetul și regulile Firebase (firebase-rules.json).')
        })[code] || trF('log.networkErr', 'Nu am putut citi de pe server. Verifică internetul și regulile Firebase (firebase-rules.json).');
    }

    function renderStats() {
        var list = entries(), s = statsOf(list);
        $('lvStats').innerHTML =
            '<div class="lv-stat"><b>' + s.total + '</b><span>' + esc(trF('log.events', 'evenimente')) + '</span></div>' +
            '<div class="lv-stat lv-e"><b>' + (s.levels.error || 0) + '</b><span>' + esc(trF('log.errors', 'erori')) + '</span></div>' +
            '<div class="lv-stat lv-w"><b>' + (s.levels.warn || 0) + '</b><span>' + esc(trF('log.warnings', 'avertismente')) + '</span></div>' +
            '<div class="lv-stat"><b>' + s.sessions + '</b><span>' + esc(trF('log.sessions', 'vizite')) + '</span></div>';
        var perf = list.filter(function (e) { return e.c === 'perf' && (e.e === 'summary' || e.e === 'final') && e.d; }).pop();
        var html = '<div class="lv-perf-title"><i class="fa-solid fa-gauge-high" aria-hidden="true"></i> ' + esc(trF('log.perf', 'Performanță')) + '</div>';
        if (perf) {
            var d = perf.d, v = d.verdict === 'bun' ? 'ok' : (d.verdict === 'slab' ? 'bad' : 'mid');
            var cell = function (k, val) { return '<div class="lv-cell"><span>' + k + '</span><b>' + val + '</b></div>'; };
            html += '<div class="lv-perf-grid">' +
                cell('LCP', d.lcp != null ? d.lcp + ' ms' : '—') + cell('FCP', d.fcp != null ? d.fcp + ' ms' : '—') + cell('CLS', d.cls != null ? d.cls : '—') +
                cell('TBT', (d.tbt != null ? d.tbt : '—') + ' ms') + cell(esc(trF('log.longTasks', 'Sarcini lungi')), d.longTasks != null ? d.longTasks : '—') +
                cell(esc(trF('log.verdict', 'Verdict')), '<span class="lv-v lv-v-' + v + '">' + esc(d.verdict || '—') + '</span>') + '</div>';
        } else html += '<p class="lv-muted">' + esc(trF('log.perfWait', 'Rezumatul apare la 4 secunde după încărcarea paginii.')) + '</p>';
        $('lvPerf').innerHTML = html;
        var lv = $('lvLevel'), ct = $('lvCat');
        lv.innerHTML = ['all', 'error', 'warn', 'info', 'debug'].map(function (l) { return '<option value="' + l + '"' + (filt.level === l ? ' selected' : '') + '>' + esc(l === 'all' ? trF('log.allLevels', 'Toate nivelurile') : l) + '</option>'; }).join('');
        var cats = Object.keys(s.categories).sort();
        if (filt.cat !== 'all' && cats.indexOf(filt.cat) === -1) filt.cat = 'all';
        ct.innerHTML = '<option value="all">' + esc(trF('log.allCats', 'Toate categoriile')) + '</option>' + cats.map(function (c) { return '<option value="' + esc(c) + '"' + (filt.cat === c ? ' selected' : '') + '>' + esc(c) + ' (' + s.categories[c] + ')</option>'; }).join('');
    }

    function renderList() {
        var all = entries().slice().reverse();
        var q = filt.q.trim().toLowerCase();
        var rows = all.filter(function (e) {
            if (filt.level !== 'all' && e.l !== filt.level) return false;
            if (filt.cat !== 'all' && e.c !== filt.cat) return false;
            if (q && (e.c + '.' + e.e + ' ' + (e.d ? JSON.stringify(e.d) : '')).toLowerCase().indexOf(q) === -1) return false;
            return true;
        });
        $('lvCount').textContent = rows.length + ' / ' + all.length + ' ' + trF('log.events', 'evenimente');
        var shown = rows.slice(0, 120);
        $('lvList').innerHTML = shown.length ? shown.map(function (e) {
            var isOpenRow = !!openIds[e.n + src], ac = acctOf(e);
            var friendly = friendlyError(e);
            return '<div class="lv-row lv-l-' + esc(e.l) + '" role="listitem">' +
                '<button type="button" class="lv-row-head" data-lv="row" data-n="' + e.n + '" aria-expanded="' + isOpenRow + '">' +
                    '<span class="lv-time">' + esc(dayOf(e.t) + ' ' + hhmmss(e.t)) + '</span>' +
                    '<span class="lv-chip">' + esc(e.l) + '</span>' +
                    '<span class="lv-name">' + esc(e.c + '.' + e.e) + '</span>' +
                    (ac ? '<span class="lv-acct" title="' + esc(ac) + '">' + esc('…' + ac.slice(-6)) + '</span>' : '') +
                    (e.r > 1 ? '<span class="lv-rep">×' + e.r + '</span>' : '') +
                '</button>' +
                (friendly ? '<p class="lv-friendly lv-friendly-' + esc(e.l) + '"><i class="fa-solid ' + (e.l === 'error' ? 'fa-circle-exclamation' : 'fa-triangle-exclamation') + '" aria-hidden="true"></i> ' + esc(friendly) + '</p>' : '') +
                (e.d !== undefined ? '<pre class="lv-data' + (isOpenRow ? ' is-open' : '') + '">' + esc(JSON.stringify(e.d, null, isOpenRow ? 2 : 0)) + '</pre>' : '') +
            '</div>';
        }).join('') + (rows.length > shown.length ? '<p class="lv-muted">… ' + esc(trF('log.older', 'mai vechi: exportă JSON / CSV pentru tot jurnalul')) + '</p>' : '') : '<p class="lv-muted">' + esc(trF('log.empty', 'Niciun eveniment pentru filtrele alese.')) + '</p>';
    }

    /* ------------------------------------------------------------ încărcare din server */
    function loadServer(force) {
        if (!adminOn) return Promise.resolve();
        if (!backendOk()) { cache.serverErr = 'unsupported'; render(); return Promise.resolve(); }
        if (cache.loading) return Promise.resolve();
        if (!force && cache.server) { render(); return Promise.resolve(); }
        cache.loading = true; cache.serverErr = ''; render();
        return backend().listLogs(1000).then(function (list) {
            cache.server = list.map(fromServer);
        }, function (e) {
            cache.serverErr = (e && e.code) || 'network'; cache.server = [];
        }).then(function () {
            cache.loading = false;
            if (!cache.pruned && !cache.serverErr) {
                cache.pruned = true;
                backend().pruneLogs(1000).then(function (n) { if (root.FVLog) root.FVLog.info('admin', 'log.pruned', { n: n }); }, function () { });
            }
            if (isOpen()) render();
        });
    }

    /* ------------------------------------------------------------ acțiuni */
    function onClick(e) {
        if (e.target === modal) return close();
        var tab = e.target.closest && e.target.closest('[data-lv-tab]');
        if (tab) { src = tab.getAttribute('data-lv-tab'); filt = { level: 'all', cat: 'all', q: '' }; build(); if (src === 'device') render(); else loadServer(false); return; }
        var t = e.target.closest && e.target.closest('[data-lv]');
        if (!t) return;
        var a = t.getAttribute('data-lv');
        if (a === 'close') close();
        else if (a === 'json' || a === 'csv') { if (root.FVLog) root.FVLog.download(a, entries(), src === 'server' ? 'reviews-server' : 'reviews-dispozitiv'); }
        else if (a === 'refresh') { if (src === 'device') render(); else loadServer(true); }
        else if (a === 'clear') { if (root.confirm(trF('log.confirmClear', 'Ștergi tot jurnalul de pe acest dispozitiv?'))) { if (root.FVLog) root.FVLog.clear(); openIds = {}; render(); } }
        else if (a === 'prune') {
            if (!root.confirm(trF('log.confirmPrune', 'Reduci jurnalul serverului la cele mai recente 1000 de intrări? (se șterg mai întâi cele mai puțin importante: info, apoi warn, apoi error)'))) return;
            backend().pruneLogs(1000).then(function (n) { note(trF('log.pruned', 'Șterse: {n}').replace('{n}', n)); loadServer(true); }, function (er) { note(errText(er && er.code)); });
        }
        else if (a === 'clear-server') {
            if (!root.confirm(trF('log.confirmClearServer', 'Ștergi TOT jurnalul de pe server (toți vizitatorii)?'))) return;
            backend().clearLogs().then(function () { cache.server = []; note(trF('log.serverCleared', 'Jurnalul de pe server a fost șters.')); render(); }, function (er) { note(errText(er && er.code)); });
        }
        else if (a === 'row') { var n = t.getAttribute('data-n') + src; openIds[n] = !openIds[n]; render(true); }
    }
    // acest site nu are fvToast (ca site-ul principal): mesajele scurte apar în bara de note a ferestrei
    function note(msg) {
        var el = $('lvNote');
        if (!el) return;
        el.textContent = msg; el.classList.remove('hidden');
    }

    var hideTimer = null;
    function open() {
        // doar administratorul: butonul apare doar pentru el, iar cine apelează funcția din consolă fără să fie administrator primește un refuz (și o urmă în jurnal)
        if (!adminOn || !root.FVLog) { if (root.FVLog) root.FVLog.warn('admin', 'log.denied'); return false; }
        build(); render();
        clearTimeout(hideTimer);
        modal.classList.remove('hidden');
        requestAnimationFrame(function () { var p = $('lvPanel'); if (p) p.classList.add('is-open'); });
        root.FVLog.info('admin', 'log.open', { tab: src });
        if (src !== 'device') loadServer(false);
        return true;
    }
    function close() {
        if (!isOpen()) return;
        var p = $('lvPanel'); if (p) p.classList.remove('is-open');
        hideTimer = setTimeout(function () { if (modal) modal.classList.add('hidden'); }, 200);
    }
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && isOpen()) { e.stopPropagation(); close(); } });

    root.FVReviewsLogView = { open: open, close: close, isOpen: isOpen, isAdmin: function () { return adminOn; } };
})(window);
