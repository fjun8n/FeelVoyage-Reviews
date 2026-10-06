/* FeelVoyage Reviews — conector minimal Firebase, aproape exclusiv CITIRE (recenziile se adaugă doar de pe
   site-ul principal, unde ai nevoie de cont) — singura excepție e submitBugReport, pentru butonul „Raportează
   un bug” din subsol, care nu cere cont pe niciunul din cele două site-uri. Folosește aceeași bază de date
   (același js/firebase-config.js, copiat din proiectul principal) — dacă actualizezi cheile Firebase pe
   site-ul principal, copiază din nou fișierul și aici. */
(function () {
    'use strict';
    const SDK_BASE = 'https://www.gstatic.com/firebasejs/12.19.0/';
    const cfg = window.FV_FIREBASE_CONFIG;
    const configured = cfg && cfg.apiKey && !/YOUR_|PASTE/i.test(cfg.apiKey);

    if (!configured) {
        console.info('[FeelVoyage Reviews] Firebase nu e configurat — copiază js/firebase-config.js de pe site-ul principal.');
        window.FVReviewsBackend = {
            onDestinationReviews: function (destId, cb) { cb([]); return function () {}; },
            onReviewStats: function (destId, cb) { cb({ avg: 5, count: 0 }); return function () {}; },
            submitBugReport: function () { return Promise.reject(new Error('unsupported')); }
        };
        return;
    }

    let db = null;
    let dbM = null;
    const ready = Promise.all([
        import(SDK_BASE + 'firebase-app.js'),
        import(SDK_BASE + 'firebase-database.js')
    ]).then(function (mods) {
        const appM = mods[0], dbMod = mods[1];
        const app = appM.initializeApp(cfg);
        dbM = dbMod;
        db = dbMod.getDatabase(app);
        return true;
    }).catch(function (e) {
        console.error('[FeelVoyage Reviews] Nu s-a putut încărca Firebase (internet oprit sau resursa blocată):', e);
        return false;
    });

    function onDestinationReviews(destId, cb) {
        let unsub = function () {}, cancelled = false;
        ready.then(function (ok) {
            if (!ok || cancelled || !db) { cb([]); return; }
            unsub = dbM.onValue(dbM.ref(db, 'reviews/' + destId), function (snap) {
                const v = snap.val() || {};
                const list = Object.keys(v).map(function (id) { return Object.assign({ id: id }, v[id]); });
                list.sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
                cb(list);
            }, function (err) { console.error('[FeelVoyage Reviews] onDestinationReviews:', err); cb([]); });
        });
        return function () { cancelled = true; unsub(); };
    }

    function onReviewStats(destId, cb) {
        let unsub = function () {}, cancelled = false;
        ready.then(function (ok) {
            if (!ok || cancelled || !db) { cb({ avg: 5, count: 0 }); return; }
            unsub = dbM.onValue(dbM.ref(db, 'reviewStats/' + destId), function (snap) {
                const v = snap.val();
                const sum = (v && typeof v.sum === 'number') ? v.sum : 5;
                const count = (v && typeof v.count === 'number') ? v.count : 1;
                cb({ avg: Math.round((sum / count) * 10) / 10, count: Math.max(0, count - 1) });
            }, function (err) { console.error('[FeelVoyage Reviews] onReviewStats:', err); cb({ avg: 5, count: 0 }); });
        });
        return function () { cancelled = true; unsub(); };
    }

    function onAllTopReviews(limit, cb) {
        let unsub = function () {}, cancelled = false;
        ready.then(function (ok) {
            if (!ok || cancelled || !db) { cb([]); return; }
            const q = dbM.query(dbM.ref(db, 'reviewsFeed'), dbM.orderByChild('createdAt'), dbM.limitToLast(500));
            unsub = dbM.onValue(q, function (snap) {
                const v = snap.val() || {};
                const list = Object.keys(v).map(function (id) { return Object.assign({ id: id }, v[id]); });
                list.sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
                cb(limit ? list.slice(0, limit) : list);
            }, function (err) { console.error('[FeelVoyage Reviews] onAllTopReviews:', err); cb([]); });
        });
        return function () { cancelled = true; unsub(); };
    }

    // Butonul „Raportează un bug” din subsol — funcționează fără cont (acest site nu are autentificare).
    function submitBugReport(report) {
        return ready.then(function (ok) {
            if (!ok || !db) throw new Error('network');
            const payload = { text: String(report.text || '').slice(0, 2000), status: 'nou', createdAt: dbM.serverTimestamp(), site: 'reviews', page: String((report.page || '').slice(0, 200)) };
            if (report.email) payload.email = String(report.email).slice(0, 120);
            const newRef = dbM.push(dbM.ref(db, 'bugReports'));
            return dbM.set(newRef, payload).then(function () { return newRef.key; });
        });
    }

    window.FVReviewsBackend = {
        onDestinationReviews: onDestinationReviews,
        onReviewStats: onReviewStats,
        onAllTopReviews: onAllTopReviews,
        submitBugReport: submitBugReport
    };
})();
