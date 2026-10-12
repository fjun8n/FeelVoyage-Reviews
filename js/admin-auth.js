/* FeelVoyage Reviews — autentificare DOAR pentru administrator.

   Acest site NU are conturi de vizitator: nu există înregistrare, iar recenziile se scriu tot de pe
   site-ul principal. Singura autentificare de aici e cea de administrator și se face cu un cont care
   EXISTĂ DEJA pe FeelVoyage.ro și care e marcat administrator în baza de date — adică exact
   „admins/<uid>: true”, pus manual din consola Firebase. Baza de date e aceeași pentru ambele site-uri,
   deci nu se ține nicio listă separată de administratori aici: contează doar identificatorul (uid) al
   contului. Dacă cineva se autentifică cu un cont obișnuit (parolă corectă, dar fără admins/<uid>),
   js/backend-reviews.js → login() îl deconectează imediat și primește mesajul „fără acces”.

   Ce apare după autentificare:
   • bara de administrator (sus-dreapta) cu eticheta „Administrator” și butonul de deconectare;
   • butonul „Jurnal” (js/logviewer.js) — jurnalul PROPRIU acestui site (reviewsLogs/);
   • mini chat bot-ul de administrator (js/chat-admin.js).
   Toate trei se montează ascultând evenimentul „fv:admin”, exact ca pe site-ul principal.

   Important: butoanele și ferestrele sunt doar interfață. Protecția reală e în regulile bazei de date
   (firebase-rules.json): fără admins/<uid> nu se poate citi jurnalul nici apelând funcțiile din consolă. */
(function (root) {
    'use strict';

    var doc = root.document;
    var session = null, modal = null, busy = false, bar = null, fab = null, hideTimer = null;

    function trF(k, fb) { return (typeof root.tr === 'function') ? root.tr(k, fb) : fb; }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
    function $(id) { return doc.getElementById(id); }
    function backend() { return root.FVReviewsBackend || null; }
    function usable() { var b = backend(); return !!(b && b.mode === 'firebase' && b.login); }

    function errorText(code) {
        switch (code) {
            case 'not-admin': return trF('admin.loginDenied', 'Acest cont nu are rol de administrator.');
            case 'invalid-credentials': return trF('auth.errorLogin', 'E-mail sau parolă incorectă.');
            case 'invalid-email': return trF('auth.errorInvalidEmail', 'Adresa de e-mail nu este validă.');
            case 'too-many': return trF('auth.errorTooMany', 'Prea multe încercări. Încearcă din nou peste câteva minute.');
            case 'network': return trF('auth.errorNetwork', 'Nu m-am putut conecta la server. Verifică internetul și încearcă din nou.');
            default: return trF('auth.errorGeneric', 'A apărut o eroare. Încearcă din nou.');
        }
    }

    /* ------------------------------------------------------------ butonul discret + bara de administrator */
    function mountFab() {
        if (fab || !usable()) return;
        fab = doc.createElement('button');
        fab.type = 'button';
        fab.id = 'reviewsAdminFab';
        fab.className = 'ra-fab';
        fab.innerHTML = '<i class="fa-solid fa-shield-halved" aria-hidden="true"></i>';
        fab.setAttribute('aria-label', trF('auth.tabLogin', 'Autentificare'));
        fab.setAttribute('title', 'Admin');
        fab.addEventListener('click', open);
        doc.body.appendChild(fab);
    }

    function mountBar() {
        if (!bar) {
            bar = doc.createElement('div');
            bar.id = 'reviewsAdminBar';
            bar.className = 'ra-bar ra-hide';
            bar.innerHTML =
                '<span class="ra-chip"><i class="fa-solid fa-shield-halved" aria-hidden="true"></i> <span id="raChipText"></span></span>' +
                '<span class="ra-tools" id="reviewsAdminTools"></span>' +
                '<button type="button" class="ra-out" id="raLogout"><i class="fa-solid fa-right-from-bracket" aria-hidden="true"></i></button>';
            doc.body.appendChild(bar);
            $('raLogout').addEventListener('click', function () {
                var b = backend();
                if (b) b.logout();
            });
        }
        $('raChipText').textContent = trF('auth.adminChip', 'Administrator');
        $('raLogout').setAttribute('aria-label', trF('auth.logoutBtn', 'Deconectare'));
        $('raLogout').setAttribute('title', trF('auth.logoutBtn', 'Deconectare'));
    }

    // Se apelează la fiecare schimbare de stare: arată bara DOAR administratorului, ascunde butonul discret cât e autentificat.
    function paint() {
        var admin = !!(session && session.admin);
        mountBar();
        bar.classList.toggle('ra-hide', !admin);
        if (fab) fab.classList.toggle('ra-hide', admin);
    }

    /* ------------------------------------------------------------ fereastra de autentificare */
    function isOpen() { return !!modal && !modal.classList.contains('hidden'); }

    function build() {
        var wasOpen = isOpen();
        if (!modal) {
            modal = doc.createElement('div');
            modal.id = 'reviewsAdminModal';
            modal.className = 'lv-modal hidden';
            modal.setAttribute('role', 'dialog');
            modal.setAttribute('aria-modal', 'true');
            modal.setAttribute('aria-labelledby', 'raTitle');
            doc.body.appendChild(modal);
            modal.addEventListener('click', function (e) {
                if (e.target === modal) close();
                var x = e.target.closest && e.target.closest('[data-ra="close"]');
                if (x) close();
            });
        }
        modal.innerHTML =
            '<div class="lv-panel" id="raPanel">' +
                '<div class="lv-head">' +
                    '<div class="lv-head-icon"><i class="fa-solid fa-shield-halved" aria-hidden="true"></i></div>' +
                    '<div class="lv-head-text">' +
                        '<h3 id="raTitle">' + esc(trF('auth.tabLogin', 'Autentificare')) + '</h3>' +
                        '<p>' + esc(trF('admin.loginHint', 'Doar pentru administratori. Folosește contul tău de pe FeelVoyage.ro.')) + '</p>' +
                    '</div>' +
                    '<button type="button" class="lv-x" data-ra="close" aria-label="' + esc(trF('about.close', 'Închide')) + '"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>' +
                '</div>' +
                '<div class="lv-body">' +
                    '<form class="ra-form" id="raForm" novalidate>' +
                        '<label class="ra-label" for="raEmail">' + esc(trF('auth.emailLabel', 'E-mail')) + '</label>' +
                        '<input class="lv-field" type="email" id="raEmail" autocomplete="username" required>' +
                        '<label class="ra-label" for="raPass">' + esc(trF('auth.passwordLabel', 'Parolă')) + '</label>' +
                        '<input class="lv-field" type="password" id="raPass" autocomplete="current-password" required>' +
                        '<p class="ra-err ra-hide" id="raError"></p>' +
                        '<button type="submit" class="ra-submit" id="raSubmit">' + esc(trF('auth.loginSubmit', 'Autentifică-te')) + '</button>' +
                    '</form>' +
                '</div>' +
            '</div>';
        $('raForm').addEventListener('submit', submit);
        if (wasOpen) { var p = $('raPanel'); if (p) p.classList.add('is-open'); }
    }

    function showError(msg) {
        var el = $('raError');
        if (!el) return;
        el.textContent = msg || '';
        el.classList.toggle('ra-hide', !msg);
    }

    function setBusy(on) {
        busy = !!on;
        var b = $('raSubmit');
        if (b) b.disabled = busy;
    }

    function submit(e) {
        e.preventDefault();
        if (busy) return;
        var email = ($('raEmail') || {}).value || '';
        var pass = ($('raPass') || {}).value || '';
        if (!email.trim() || !pass) { showError(errorText('invalid-credentials')); return; }
        showError('');
        setBusy(true);
        backend().login(email, pass).then(function () {
            setBusy(false);
            var p = $('raPass'); if (p) p.value = '';
            close();
            // starea reală vine din onAuth (mai jos), care montează bara și anunță celelalte module
        }, function (err) {
            setBusy(false);
            var code = (err && err.code) || 'unknown';
            showError(errorText(code));
            if (root.FVLog) root.FVLog.warn('admin', 'login.fail', { code: code });   // niciodată e-mailul sau parola
        });
    }

    function open() {
        if (!usable()) return false;
        build();
        clearTimeout(hideTimer);
        modal.classList.remove('hidden');
        requestAnimationFrame(function () {
            var p = $('raPanel'); if (p) p.classList.add('is-open');
            var em = $('raEmail'); if (em) em.focus();
        });
        return true;
    }
    function close() {
        if (!isOpen()) return;
        showError('');
        var p = $('raPanel'); if (p) p.classList.remove('is-open');
        hideTimer = setTimeout(function () { if (modal) modal.classList.add('hidden'); }, 200);
    }
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && isOpen()) { e.stopPropagation(); close(); } });

    /* ------------------------------------------------------------ starea contului */
    // Firebase ține minte autentificarea între vizite, deci la reîncărcare administratorul rămâne conectat.
    function apply(s) {
        var wasAdmin = !!(session && session.admin);
        session = s;
        var isAdmin = !!(s && s.admin);
        paint();
        if (isAdmin !== wasAdmin) {
            // același eveniment ca pe site-ul principal (js/auth.js): îl ascultă js/logviewer.js și js/chat-admin.js
            doc.dispatchEvent(new CustomEvent('fv:admin', { detail: { admin: isAdmin, helper: false } }));
            if (root.FVLog) root.FVLog.info('admin', isAdmin ? 'login.ok' : 'logout');
        }
    }

    doc.addEventListener('fv:language', function () { if (bar) mountBar(); if (fab) fab.setAttribute('aria-label', trF('auth.tabLogin', 'Autentificare')); if (isOpen()) build(); });

    root.FVReviewsAdmin = {
        open: open,
        close: close,
        isAdmin: function () { return !!(session && session.admin); },
        session: function () { return session; }
    };

    function start() {
        if (!usable()) return;   // Firebase neconfigurat: niciun buton, nicio autentificare
        mountFab();
        paint();
        backend().onAuth(apply);
    }
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start); else start();
})(window);
