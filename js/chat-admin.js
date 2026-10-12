/* FeelVoyage Reviews — mini chat bot, DOAR pentru administrator.

   Bula de chat (colț dreapta-jos) NU există în pagină pentru nimeni altcineva: se creează abia la primirea
   evenimentului „fv:admin” cu admin: true (trimis de js/admin-auth.js, după ce contul a fost verificat în
   admins/<uid>) și dispare complet la deconectare. Un vizitator obișnuit nu vede butonul, nu descarcă
   modelul AI și nu poate deschide fereastra nici din consolă (vezi open(), care refuză și lasă urmă în jurnal).

   Răspunsurile vin de la js/ai-reviews.js (Gemini prin Firebase AI Logic, fără restricție de subiect pentru
   administrator). Mesajele trec prin filtrul de conținut indecent (js/moderation.js) înainte de a pleca.
   Textele refolosesc cheile de traducere chat.* existente. */
(function (root) {
    'use strict';
    var doc = root.document;
    var dock = null, win = null, msgs = null, input = null, sendBtn = null, form = null;
    var adminOn = false, open = false, busy = false, greeted = false;

    function trF(k, fb) { return (typeof root.tr === 'function') ? root.tr(k, fb) : fb; }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
    // limba curentă a interfeței: aceeași cheie de stocare folosită de js/app-reviews.js
    function lang() { try { return root.localStorage.getItem('feelvoyage_lang') || 'ro'; } catch (e) { return 'ro'; } }

    /* ------------------------------------------------------------ construcție */
    function build() {
        if (dock) return;
        dock = doc.createElement('div');
        dock.className = 'ra-chat-dock ra-hide';
        dock.id = 'reviewsChatDock';
        dock.innerHTML =
            '<div class="ra-chat-win ra-hide" id="raChatWin" role="dialog" aria-modal="false" aria-labelledby="raChatTitle">' +
                '<div class="ra-chat-head">' +
                    '<div style="flex:1 1 auto;min-width:0">' +
                        '<h4 id="raChatTitle">' + esc(trF('chat.headerTitle', 'Asistent FeelVoyage')) + '</h4>' +
                        '<p id="raChatStatus">' + esc(trF('chat.admin.status', 'Mod administrator • Fără restricții de subiect')) + '</p>' +
                    '</div>' +
                    '<button type="button" class="lv-x" id="raChatClose" aria-label="' + esc(trF('about.close', 'Închide')) + '"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>' +
                '</div>' +
                '<div class="ra-chat-msgs" id="raChatMsgs"></div>' +
                '<form class="ra-chat-form" id="raChatForm">' +
                    '<input type="text" class="ra-chat-input" id="raChatInput" autocomplete="off" placeholder="' + esc(trF('chat.admin.placeholder', 'Întreabă orice...')) + '">' +
                    '<button type="submit" class="ra-chat-send" id="raChatSend" aria-label="' + esc(trF('admin.broadcast.send', 'Trimite')) + '"><i class="fa-solid fa-paper-plane" aria-hidden="true"></i></button>' +
                '</form>' +
                '<p class="ra-chat-note">' + esc(trF('chat.admin.note', 'Mod administrator: răspunsuri AI, fără limită de subiect')) + '</p>' +
            '</div>' +
            '<button type="button" class="ra-chat-toggle" id="raChatToggle" aria-label="' + esc(trF('chat.headerTitle', 'Asistent FeelVoyage')) + '"><i class="fa-solid fa-robot" aria-hidden="true"></i></button>';
        doc.body.appendChild(dock);
        win = doc.getElementById('raChatWin');
        msgs = doc.getElementById('raChatMsgs');
        input = doc.getElementById('raChatInput');
        sendBtn = doc.getElementById('raChatSend');
        form = doc.getElementById('raChatForm');
        doc.getElementById('raChatToggle').addEventListener('click', toggle);
        doc.getElementById('raChatClose').addEventListener('click', function () { if (open) toggle(); });
        form.addEventListener('submit', onSubmit);
    }

    function destroy() {
        if (!dock) return;
        dock.remove();
        dock = win = msgs = input = sendBtn = form = null;
        open = false; greeted = false; busy = false;
        if (root.FVReviewsAI) root.FVReviewsAI.reset();   // conversația nu supraviețuiește deconectării
    }

    /* ------------------------------------------------------------ mesaje */
    function addMsg(html, kind) {
        if (!msgs) return;
        var d = doc.createElement('div');
        d.className = 'ra-msg ' + (kind || 'ra-msg-bot');
        d.innerHTML = html;
        msgs.appendChild(d);
        msgs.scrollTop = msgs.scrollHeight;
        return d;
    }
    function addText(text, kind) { return addMsg(esc(text).replace(/\n/g, '<br>'), kind); }

    function greet() {
        if (greeted) return;
        greeted = true;
        addText(trF('chat.admin.greeting', 'Salut, administratorule! 🛡️ Ai acces liber: îmi poți pune orice întrebare, nu doar despre site sau călătorii (cod, texte, idei, calcule...). Întreabă-mă ce vrei!'), 'ra-msg-bot');
    }

    function setBusy(on) {
        busy = !!on;
        if (input) input.disabled = busy;
        if (sendBtn) sendBtn.disabled = busy;
    }

    function errorFor(code) {
        if (code === 'indecent') return trF('mod.blockedChat', 'Mesajul conține un limbaj nepotrivit și nu a fost trimis.');
        return trF('chat.admin.aiDown', 'Asistentul AI nu e disponibil acum (detalii în consola browserului, F12).');
    }

    function onSubmit(e) {
        e.preventDefault();
        if (busy || !input) return;
        var text = String(input.value || '').trim();
        if (!text) return;
        input.value = '';
        addText(text, 'ra-msg-me');
        if (root.FVLog) root.FVLog.info('chat', 'message', { len: text.length, admin: true });   // jurnal: doar lungimea, niciodată textul

        if (!(root.FVReviewsAI && root.FVReviewsAI.enabled())) { addText(errorFor('disabled'), 'ra-msg-err'); return; }
        setBusy(true);
        var typing = addText('…', 'ra-msg-bot');
        root.FVReviewsAI.ask(text, { lang: lang() }).then(function (res) {
            if (typing) typing.innerHTML = root.FVReviewsAI.formatAIText(res.text);
            if (msgs) msgs.scrollTop = msgs.scrollHeight;
        }, function (err) {
            var code = (err && err.code) || 'failed';
            if (typing) { typing.className = 'ra-msg ra-msg-err'; typing.textContent = errorFor(code); }
        }).then(function () { setBusy(false); if (input) input.focus(); }, function () { setBusy(false); });
    }

    /* ------------------------------------------------------------ deschidere / închidere */
    function toggle() {
        if (!adminOn) { if (root.FVLog) root.FVLog.warn('admin', 'chat.denied'); return false; }
        build();
        open = !open;
        win.classList.toggle('ra-hide', !open);
        if (open) { greet(); if (input) input.focus(); if (root.FVLog) root.FVLog.info('chat', 'open', { admin: true }); }
        return open;
    }

    function setAdmin(flag) {
        adminOn = !!flag;
        if (adminOn) { build(); dock.classList.remove('ra-hide'); }
        else destroy();
    }
    doc.addEventListener('fv:admin', function (e) { setAdmin(e.detail && e.detail.admin); });
    doc.addEventListener('fv:language', function () {
        if (!dock) return;
        // limba s-a schimbat: refacem interfața, păstrând conversația de până acum
        var old = msgs ? msgs.innerHTML : '';
        var wasOpen = open;
        dock.remove(); dock = null; build();
        dock.classList.remove('ra-hide');
        if (msgs) msgs.innerHTML = old;
        if (wasOpen) { open = true; win.classList.remove('ra-hide'); }
    });

    root.FVReviewsChat = { toggle: toggle, isOpen: function () { return open; }, isAdmin: function () { return adminOn; } };
})(window);
