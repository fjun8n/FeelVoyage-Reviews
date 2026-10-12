/* FeelVoyage Reviews — conector Firebase. Folosește aceeași bază de date (același js/firebase-config.js, copiat
   din proiectul principal — dacă actualizezi cheile Firebase pe site-ul principal, copiază din nou fișierul și aici).

   Acest site rămâne aproape exclusiv CITIRE pentru vizitatorii obișnuiți (recenziile se adaugă doar de pe
   FeelVoyage.ro, unde ai nevoie de cont) — singura excepție e submitBugReport, pentru butonul „Raportează un bug”.

   NOU: autentificare DOAR pentru administrator (js/admin-auth.js). Nu există înregistrare și nu există conturi
   de vizitator pe acest site — te poți conecta aici doar cu un cont care e deja administrator pe site-ul principal
   (admins/<uid>: true în baza de date, comună ambelor site-uri). Orice alt cont (sau parolă greșită) e refuzat
   și deconectat automat — vezi login() mai jos. O dată autentificat ca administrator, ai acces la jurnalul PROPRIU
   al acestui site (reviewsLogs/, separat de „logs/” de pe site-ul principal — vezi js/logviewer.js) și la mini
   chat bot-ul de administrator (js/ai-reviews.js, js/chat-admin.js). */
(function () {
    'use strict';
    const SDK_BASE = 'https://www.gstatic.com/firebasejs/12.19.0/';
    const LOGS_PATH = 'reviewsLogs';   // jurnalul tehnic PROPRIU acestui site — complet separat de „logs/” (site-ul principal)
    const cfg = window.FV_FIREBASE_CONFIG;
    const configured = cfg && cfg.apiKey && !/YOUR_|PASTE/i.test(cfg.apiKey);

    function FVError(code, original) { const e = new Error(code); e.code = code; e.original = original; return e; }
    function noop() {}

    if (!configured) {
        console.info('[FeelVoyage Reviews] Firebase nu e configurat — copiază js/firebase-config.js de pe site-ul principal.');
        window.FVReviewsBackend = {
            mode: 'unsupported',
            onDestinationReviews: function (destId, cb) { cb([]); return noop; },
            onReviewStats: function (destId, cb) { cb({ avg: 5, count: 0 }); return noop; },
            onAllTopReviews: function (limit, cb) { cb([]); return noop; },
            submitBugReport: function () { return Promise.reject(FVError('unsupported')); },
            onAuth: function (cb) { Promise.resolve().then(function () { cb(null); }); return noop; },
            login: function () { return Promise.reject(FVError('unsupported')); },
            logout: function () { return Promise.resolve(); },
            submitLogs: function () { return Promise.resolve(0); },
            listLogs: function () { return Promise.reject(FVError('unsupported')); },
            pruneLogs: function () { return Promise.reject(FVError('unsupported')); },
            clearLogs: function () { return Promise.reject(FVError('unsupported')); },
            firebaseApp: function () { return Promise.resolve(null); },
            importSDK: function () { return Promise.reject(FVError('unsupported')); }
        };
        return;
    }

    let app = null, db = null, dbM = null;
    const ready = Promise.all([
        import(SDK_BASE + 'firebase-app.js'),
        import(SDK_BASE + 'firebase-database.js')
    ]).then(function (mods) {
        const appM = mods[0], dbMod = mods[1];
        app = appM.initializeApp(cfg);
        dbM = dbMod;
        db = dbMod.getDatabase(app);
        return true;
    }).catch(function (e) {
        console.error('[FeelVoyage Reviews] Nu s-a putut încărca Firebase (internet oprit sau resursa blocată):', e);
        return false;
    });

    function onDestinationReviews(destId, cb) {
        let unsub = noop, cancelled = false;
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
        let unsub = noop, cancelled = false;
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
        let unsub = noop, cancelled = false;
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

    // Butonul „Raportează un bug” din subsol — funcționează fără cont (ca și înainte).
    function submitBugReport(report) {
        return ready.then(function (ok) {
            if (!ok || !db) throw new Error('network');
            const payload = { text: String(report.text || '').slice(0, 2000), status: 'nou', createdAt: dbM.serverTimestamp(), site: 'reviews', page: String((report.page || '').slice(0, 200)) };
            if (report.email) payload.email = String(report.email).slice(0, 120);
            const newRef = dbM.push(dbM.ref(db, 'bugReports'));
            return dbM.set(newRef, payload).then(function () { return newRef.key; });
        });
    }

    /* ------------------------------------------------------------ autentificare ADMIN (singura folosire a Firebase Auth pe acest site) */
    // Modulul de autentificare (firebase-auth.js) se încarcă abia la nevoie (nimeni, în afară de administrator, nu-l folosește),
    // ca vizitatorii obișnuiți să nu descarce în plus acel fișier.
    let authM = null, auth = null;
    const authReady = ready.then(function (ok) {
        if (!ok) return false;
        return import(SDK_BASE + 'firebase-auth.js').then(function (mod) {
            authM = mod;
            auth = authM.getAuth(app);
            return true;
        }).catch(function (e) { console.error('[FeelVoyage Reviews] Nu s-a putut încărca modulul de autentificare:', e); return false; });
    });

    const authSubs = new Set();
    let session = null, resolved = false;

    function normalize(e) {
        const code = (e && e.code) || '';
        if (code === 'auth/invalid-credential' || code === 'auth/invalid-login-credentials' || code === 'auth/wrong-password' || code === 'auth/user-not-found') return FVError('invalid-credentials', e);
        if (code === 'auth/invalid-email') return FVError('invalid-email', e);
        if (code === 'auth/network-request-failed') return FVError('network', e);
        if (code === 'auth/too-many-requests') return FVError('too-many', e);
        return FVError('unknown', e);
    }

    // administrator = exact „admins/<uid>: true”, la fel ca pe site-ul principal (NU se creează niciun cont nou de aici — vezi js/admin-auth.js)
    function checkAdmin(uid) {
        return dbM.get(dbM.ref(db, 'admins/' + uid)).then(function (s) { return s.val() === true; }, function () { return false; });
    }

    async function refresh(user) {
        if (!user) { session = null; resolved = true; authSubs.forEach(function (cb) { cb(null); }); return null; }
        const admin = await checkAdmin(user.uid);
        session = { uid: user.uid, email: user.email || '', admin: admin };
        resolved = true;
        authSubs.forEach(function (cb) { cb(session); });
        return session;
    }

    authReady.then(function (ok) {
        if (!ok || !auth) { resolved = true; return; }
        authM.onAuthStateChanged(auth, function (user) { refresh(user); });
    });

    function onAuth(cb) {
        authSubs.add(cb);
        if (resolved) Promise.resolve().then(function () { cb(session); });
        return function () { authSubs.delete(cb); };
    }

    // Login DOAR pentru administrator: dacă acel cont nu e în „admins/”, îl deconectăm imediat și refuzăm —
    // acest site nu creează conturi noi și nu lasă pe nimeni altcineva autentificat, chiar dacă parola e corectă.
    async function login(email, password) {
        if (!(await authReady) || !auth) throw FVError('network');
        let cred;
        try { cred = await authM.signInWithEmailAndPassword(auth, String(email || '').trim(), password); }
        catch (e) { throw normalize(e); }
        const s = await refresh(cred.user);
        if (!s || !s.admin) {
            try { await authM.signOut(auth); } catch (e) { /* ignorat */ }
            session = null; authSubs.forEach(function (cb) { cb(null); });
            throw FVError('not-admin');
        }
        return s;
    }

    async function logout() {
        if (!auth) return;
        try { await authM.signOut(auth); } catch (e) { /* ignorat */ }
        await refresh(null);
    }

    /* ------------------------------------------------------------ jurnalul PROPRIU al acestui site (reviewsLogs/) */
    // Aceeași logică ca pe site-ul principal (js/backend.js), doar pe alt nod din baza de date — vezi firebase-rules.json.
    function withTimeout(promise, ms) {
        return new Promise(function (resolve, reject) {
            const timer = setTimeout(function () { reject(FVError('network')); }, ms);
            promise.then(function (v) { clearTimeout(timer); resolve(v); }, function (e) { clearTimeout(timer); reject(e); });
        });
    }
    async function submitLogs(entries) {
        if (!(await ready) || !db) return 0;
        const list = (entries || []).slice(0, 40);
        if (!list.length) return 0;
        const base = dbM.ref(db, LOGS_PATH);
        const updates = {};
        list.forEach(function (en) { updates[dbM.push(base).key] = Object.assign({}, en, { at: dbM.serverTimestamp() }); });
        await withTimeout(dbM.update(base, updates), 15000);
        return list.length;
    }
    async function listLogs(limit) {
        if (!session || !session.admin) throw FVError('forbidden');
        try {
            const q = dbM.query(dbM.ref(db, LOGS_PATH), dbM.orderByKey(), dbM.limitToLast(Math.max(1, Math.min(Number(limit) || 900, 1000))));
            const v = (await dbM.get(q)).val() || {};
            return Object.keys(v).map(function (id) { return Object.assign({ id: id }, v[id]); }).sort(function (a, b) { return (a.at || a.ts || 0) - (b.at || b.ts || 0); });
        } catch (e) {
            if (e && /permission/i.test(String(e.code || e.message))) throw FVError('forbidden', e);
            throw FVError('network', e);
        }
    }
    async function pruneLogs(cap) {
        if (!session || !session.admin) throw FVError('forbidden');
        const limit = Math.max(50, Math.min(Number(cap) || 1000, 5000));
        try {
            const v = (await dbM.get(dbM.ref(db, LOGS_PATH))).val() || {};
            const ids = Object.keys(v).sort(function (a, b) { return (v[a].at || v[a].ts || 0) - (v[b].at || v[b].ts || 0); });
            let excess = ids.length - limit;
            if (excess <= 0) return 0;
            const buckets = { info: [], warn: [], error: [] };
            ids.forEach(function (id) { const lvl = v[id] && v[id].l; if (buckets[lvl]) buckets[lvl].push(id); });
            const toRemove = [];
            ['info', 'warn', 'error'].forEach(function (lvl) {
                while (excess > 0 && buckets[lvl].length) { toRemove.push(buckets[lvl].shift()); excess--; }
            });
            if (toRemove.length) { const rm = {}; toRemove.forEach(function (k) { rm[k] = null; }); await withTimeout(dbM.update(dbM.ref(db, LOGS_PATH), rm), 15000); }
            return toRemove.length;
        } catch (e) {
            if (e && /permission/i.test(String(e.code || e.message))) throw FVError('forbidden', e);
            throw FVError('network', e);
        }
    }
    async function clearLogs() {
        if (!session || !session.admin) throw FVError('forbidden');
        try { await withTimeout(dbM.remove(dbM.ref(db, LOGS_PATH)), 15000); }
        catch (e) {
            if (e && /permission/i.test(String(e.code || e.message))) throw FVError('forbidden', e);
            throw FVError('network', e);
        }
    }

    window.FVReviewsBackend = {
        get mode() { return 'firebase'; },
        ready: ready,
        firebaseApp: function () { return ready.then(function () { return app; }); },
        importSDK: function (name) { return import(SDK_BASE + 'firebase-' + name + '.js'); },

        onDestinationReviews: onDestinationReviews,
        onReviewStats: onReviewStats,
        onAllTopReviews: onAllTopReviews,
        submitBugReport: submitBugReport,

        onAuth: onAuth,
        login: login,
        logout: logout,

        submitLogs: submitLogs,
        listLogs: listLogs,
        pruneLogs: pruneLogs,
        clearLogs: clearLogs
    };
})();
