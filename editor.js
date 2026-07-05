/*
 * Owner edit mode for sougatshekhar97-cpu.github.io/portfolio
 *
 * Activate: add #admin to the URL (or press Ctrl+Shift+E), then enter your passcode.
 * First use on a browser asks you to SET a passcode (stored hashed, in that browser only).
 *
 * How privacy works (honest version):
 *  - Edits are saved to localStorage of the browser you edit in. Visitors never see them.
 *  - The PUBLIC site only changes when the exported HTML is committed to the GitHub repo —
 *    and only the GitHub account owner can push. That is the real "only me" protection.
 *  - The passcode is a convenience lock for this browser, not server-side security.
 */
(function () {
  'use strict';

  var PAGE = /360/.test(location.pathname) ? '360' : 'index';
  var KEY_CONTENT = 'sgp:v1:content:' + PAGE;
  var KEY_HASH = 'sgp:v1:passhash';
  var site = null;
  var editing = false;
  var dirty = false;

  /* ---------- restore saved draft (owner's browser only) ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    site = document.getElementById('site');
    if (!site) return;
    try {
      var saved = localStorage.getItem(KEY_CONTENT);
      if (saved) site.innerHTML = saved;
    } catch (e) { /* storage unavailable — show the committed site */ }

    if (location.hash === '#admin') unlock();
    document.addEventListener('keydown', function (e) {
      if (e.ctrlKey && e.shiftKey && (e.key === 'E' || e.key === 'e')) {
        e.preventDefault();
        if (!editing) unlock();
      }
    });
  });

  /* ---------- passcode gate ---------- */
  function sha256(text) {
    if (!(window.crypto && crypto.subtle)) return Promise.resolve('plain:' + text);
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) {
        return b.toString(16).padStart(2, '0');
      }).join('');
    });
  }

  function unlock() {
    var stored = null;
    try { stored = localStorage.getItem(KEY_HASH); } catch (e) {}
    var firstTime = !stored;
    modalPrompt(
      firstTime ? 'Set an edit passcode for this browser' : 'Enter edit passcode',
      firstTime ? 'Choose a passcode you will remember. It only unlocks editing in this browser.' : '',
      function (value) {
        if (!value) return;
        sha256(value).then(function (hash) {
          if (firstTime) {
            try { localStorage.setItem(KEY_HASH, hash); } catch (e) {}
            enterEditMode();
          } else if (hash === stored) {
            enterEditMode();
          } else {
            toast('Wrong passcode.');
          }
        });
      }
    );
  }

  /* ---------- edit mode ---------- */
  function enterEditMode() {
    if (editing || !site) return;
    editing = true;
    injectStyles();
    document.body.classList.add('sgp-editing');

    site.querySelectorAll('[data-sec], [data-card]').forEach(attachControls);
    site.querySelectorAll('[data-sec]').forEach(function (el) {
      el.setAttribute('contenteditable', 'true');
      el.addEventListener('input', markDirty);
    });
    site.addEventListener('dblclick', imageSwapHandler);
    window.addEventListener('beforeunload', unloadGuard);
    buildToolbar();
    toast('Edit mode on. Click any text to edit it. Hover a component for controls.');
  }

  function exitEditMode() {
    if (dirty && !window.confirm('You have unsaved changes. Exit without saving?')) return;
    editing = false;
    dirty = false;
    document.body.classList.remove('sgp-editing');
    var bar = document.getElementById('sgp-toolbar');
    if (bar) bar.remove();
    stripEditorArtifacts(site);
    window.removeEventListener('beforeunload', unloadGuard);
    site.removeEventListener('dblclick', imageSwapHandler);
    if (location.hash === '#admin') history.replaceState(null, '', location.pathname);
  }

  function unloadGuard(e) {
    if (dirty) { e.preventDefault(); e.returnValue = ''; }
  }

  function markDirty() { dirty = true; }

  /* ---------- per-component controls ---------- */
  function attachControls(el) {
    if (el.querySelector(':scope > .sgp-ctl')) return;
    el.classList.add('sgp-rel');
    var name = el.getAttribute('data-name') || (el.hasAttribute('data-sec') ? 'Section' : 'Card');
    var ctl = document.createElement('div');
    ctl.className = 'sgp-ctl';
    ctl.setAttribute('contenteditable', 'false');
    ctl.innerHTML =
      '<span class="sgp-ctl-name">' + escapeHtml(name) + '</span>' +
      '<button data-act="up" title="Move up">↑</button>' +
      '<button data-act="down" title="Move down">↓</button>' +
      '<button data-act="dup" title="Duplicate">⧉</button>' +
      '<button data-act="hide" title="Hide / show on the site">👁</button>' +
      '<button data-act="del" title="Delete">✕</button>';
    ctl.addEventListener('click', function (e) {
      var btn = e.target.closest('button');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      componentAction(el, btn.getAttribute('data-act'));
    });
    el.appendChild(ctl);
  }

  function componentAction(el, act) {
    if (act === 'del') {
      if (window.confirm('Delete "' + (el.getAttribute('data-name') || 'this component') + '"? (You can still discard via Reset before saving.)')) {
        el.remove();
        markDirty();
      }
    } else if (act === 'hide') {
      var hidden = el.getAttribute('data-hidden') === 'true';
      if (hidden) el.removeAttribute('data-hidden');
      else el.setAttribute('data-hidden', 'true');
      markDirty();
      toast(hidden ? 'Component will show on the site.' : 'Component hidden from the site (ghosted here).');
    } else if (act === 'dup') {
      var clone = el.cloneNode(true);
      stripEditorArtifacts(clone);
      clone.removeAttribute('data-hidden');
      el.after(clone);
      attachControls(clone);
      if (clone.hasAttribute('data-sec')) clone.setAttribute('contenteditable', 'true');
      markDirty();
    } else if (act === 'up' || act === 'down') {
      var sib = act === 'up' ? el.previousElementSibling : el.nextElementSibling;
      while (sib && !(sib.hasAttribute && (sib.hasAttribute('data-sec') || sib.hasAttribute('data-card')))) {
        sib = act === 'up' ? sib.previousElementSibling : sib.nextElementSibling;
      }
      if (sib) {
        if (act === 'up') sib.before(el); else sib.after(el);
        markDirty();
      } else {
        toast('Nothing to swap with in this direction.');
      }
    }
  }

  function imageSwapHandler(e) {
    if (!editing) return;
    var img = e.target.closest('img');
    if (!img) return;
    e.preventDefault();
    modalPrompt('Replace image', 'Enter a new image path or URL (e.g. assets/photo.jpg):', function (v) {
      if (v) { img.src = v; markDirty(); }
    }, img.getAttribute('src'));
  }

  /* ---------- toolbar ---------- */
  function buildToolbar() {
    var bar = document.createElement('div');
    bar.id = 'sgp-toolbar';
    bar.setAttribute('contenteditable', 'false');
    bar.innerHTML =
      '<span class="sgp-badge">EDIT MODE</span>' +
      '<button data-act="save">💾 Save draft</button>' +
      '<button data-act="export">⬇ Export HTML</button>' +
      '<button data-act="addsec">＋ Add section</button>' +
      '<button data-act="reset">↺ Reset</button>' +
      '<button data-act="help">?</button>' +
      '<button data-act="exit">Exit</button>';
    bar.addEventListener('click', function (e) {
      var btn = e.target.closest('button');
      if (!btn) return;
      var act = btn.getAttribute('data-act');
      if (act === 'save') saveDraft();
      else if (act === 'export') exportHtml();
      else if (act === 'addsec') addSection();
      else if (act === 'reset') resetDraft();
      else if (act === 'help') showHelp();
      else if (act === 'exit') exitEditMode();
    });
    document.body.appendChild(bar);
  }

  function saveDraft() {
    try {
      localStorage.setItem(KEY_CONTENT, cleanedSiteHtml());
      dirty = false;
      toast('Saved in this browser. Visitors still see the published site — use Export HTML to publish.');
    } catch (e) {
      toast('Could not save (storage unavailable).');
    }
  }

  function resetDraft() {
    if (!window.confirm('Discard the local draft and reload the published version?')) return;
    try { localStorage.removeItem(KEY_CONTENT); } catch (e) {}
    dirty = false;
    location.reload();
  }

  function addSection() {
    var tpl = document.createElement('div');
    tpl.setAttribute('data-sec', '');
    tpl.setAttribute('data-name', 'New section');
    tpl.style.cssText = 'max-width:1240px; margin:0 auto; padding:90px 40px; display:flex; flex-direction:column; gap:24px';
    tpl.innerHTML =
      '<span style="font-family:\'JetBrains Mono\',monospace; font-size:12px; letter-spacing:0.16em; color:#1f3d7a">NEW — SECTION</span>' +
      '<h2 style="margin:0; font-size:clamp(40px,5vw,64px); font-weight:900; letter-spacing:-0.02em; line-height:1">New section title<span style="color:#1f3d7a">.</span></h2>' +
      '<p style="margin:0; font-size:18px; color:#54617e; max-width:640px">Click to edit this text. Use the controls in the corner to move, duplicate, hide, or delete this section.</p>';
    var contact = document.getElementById('contact');
    if (contact && contact.parentNode === site) site.insertBefore(tpl, contact);
    else site.appendChild(tpl);
    attachControls(tpl);
    tpl.setAttribute('contenteditable', 'true');
    tpl.addEventListener('input', markDirty);
    tpl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    markDirty();
  }

  function exportHtml() {
    var docClone = document.documentElement.cloneNode(true);
    var bar = docClone.querySelector('#sgp-toolbar');
    if (bar) bar.remove();
    docClone.querySelectorAll('.sgp-modal, .sgp-toast, #sgp-style').forEach(function (n) { n.remove(); });
    var siteClone = docClone.querySelector('#site');
    if (siteClone) siteClone.innerHTML = cleanedSiteHtml();
    docClone.querySelector('body').classList.remove('sgp-editing');
    var html = '<!DOCTYPE html>\n' + docClone.outerHTML;
    var blob = new Blob([html], { type: 'text/html' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = PAGE === '360' ? '360-analysis.html' : 'index.html';
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Exported. Replace this file in the GitHub repo to publish for everyone.');
  }

  function cleanedSiteHtml() {
    var clone = site.cloneNode(true);
    stripEditorArtifacts(clone);
    return clone.innerHTML;
  }

  function stripEditorArtifacts(root) {
    root.querySelectorAll('.sgp-ctl').forEach(function (n) { n.remove(); });
    root.querySelectorAll('[contenteditable]').forEach(function (n) { n.removeAttribute('contenteditable'); });
    root.querySelectorAll('.sgp-rel').forEach(function (n) { n.classList.remove('sgp-rel'); if (!n.className) n.removeAttribute('class'); });
  }

  function showHelp() {
    modalInfo('How editing works',
      '<b>Edit text:</b> click any text and type.<br>' +
      '<b>Replace an image:</b> double-click it.<br>' +
      '<b>Component controls</b> (hover, top-right): ↑↓ move · ⧉ duplicate · 👁 hide/show · ✕ delete.<br>' +
      '<b>Save draft:</b> keeps changes in <i>this browser only</i> — visitors do not see them.<br>' +
      '<b>Export HTML:</b> downloads the updated file. Publish by replacing it in the GitHub repo ' +
      '(github.com/sougatshekhar97-cpu/portfolio → open the file → edit/upload → commit), or ask Claude to do it.<br>' +
      '<b>Reset:</b> discards the local draft.<br><br>' +
      '<i>Note: the passcode is a convenience lock for this browser. The public site can only be changed ' +
      'by pushing to the GitHub repo — that is what keeps it yours alone.</i>');
  }

  /* ---------- small UI helpers (no native prompt(), automation-safe) ---------- */
  function modalPrompt(title, hint, cb, initial) {
    var m = baseModal(title, (hint ? '<p class="sgp-hint">' + hint + '</p>' : '') +
      '<input type="password" class="sgp-input" autocomplete="off">' +
      '<div class="sgp-row"><button class="sgp-ok">OK</button><button class="sgp-cancel">Cancel</button></div>');
    var input = m.querySelector('.sgp-input');
    if (initial) { input.type = 'text'; input.value = initial; }
    input.focus();
    function done(v) { m.remove(); cb(v); }
    m.querySelector('.sgp-ok').addEventListener('click', function () { done(input.value); });
    m.querySelector('.sgp-cancel').addEventListener('click', function () { done(null); });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') done(input.value); if (e.key === 'Escape') done(null); });
  }

  function modalInfo(title, html) {
    var m = baseModal(title, '<div class="sgp-hint" style="text-align:left">' + html + '</div>' +
      '<div class="sgp-row"><button class="sgp-ok">Close</button></div>');
    m.querySelector('.sgp-ok').addEventListener('click', function () { m.remove(); });
  }

  function baseModal(title, innerHtml) {
    injectStyles();
    var wrap = document.createElement('div');
    wrap.className = 'sgp-modal';
    wrap.setAttribute('contenteditable', 'false');
    wrap.innerHTML = '<div class="sgp-modal-box"><h3>' + escapeHtml(title) + '</h3>' + innerHtml + '</div>';
    document.body.appendChild(wrap);
    return wrap;
  }

  var toastTimer = null;
  function toast(msg) {
    injectStyles();
    var t = document.querySelector('.sgp-toast');
    if (!t) {
      t = document.createElement('div');
      t.className = 'sgp-toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('sgp-toast-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('sgp-toast-show'); }, 4200);
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function injectStyles() {
    if (document.getElementById('sgp-style')) return;
    var css =
      '.sgp-rel{position:relative}' +
      '.sgp-editing [data-sec]:hover,.sgp-editing [data-card]:hover{outline:2px dashed rgba(31,61,122,0.55);outline-offset:3px}' +
      '.sgp-editing [data-hidden="true"]{display:block !important;opacity:0.35;outline:2px dashed #b3543f !important}' +
      '.sgp-ctl{display:none;position:absolute;top:6px;right:6px;z-index:60;gap:4px;align-items:center;' +
        'background:#101c33;border-radius:8px;padding:4px 6px;font-family:"JetBrains Mono",monospace;font-size:11px}' +
      '.sgp-editing [data-sec]:hover>.sgp-ctl,.sgp-editing [data-card]:hover>.sgp-ctl{display:flex}' +
      '.sgp-ctl-name{color:#aebada;margin-right:4px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.sgp-ctl button{background:transparent;border:0;color:#f7f8fa;cursor:pointer;font-size:13px;padding:2px 5px;border-radius:5px}' +
      '.sgp-ctl button:hover{background:#1f3d7a}' +
      '#sgp-toolbar{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);z-index:100;display:flex;gap:8px;align-items:center;' +
        'background:#101c33;color:#f7f8fa;padding:10px 14px;border-radius:999px;box-shadow:0 10px 30px rgba(16,28,51,0.35);' +
        'font-family:"JetBrains Mono",monospace;font-size:13px}' +
      '#sgp-toolbar button{background:transparent;border:1px solid rgba(247,248,250,0.25);color:#f7f8fa;cursor:pointer;' +
        'padding:6px 12px;border-radius:999px;font-family:inherit;font-size:12px;white-space:nowrap}' +
      '#sgp-toolbar button:hover{background:#1f3d7a;border-color:#1f3d7a}' +
      '.sgp-badge{background:#1f3d7a;padding:4px 10px;border-radius:999px;font-weight:700;letter-spacing:0.08em;font-size:11px}' +
      '.sgp-modal{position:fixed;inset:0;z-index:200;background:rgba(16,28,51,0.45);display:flex;align-items:center;justify-content:center}' +
      '.sgp-modal-box{background:#f7f8fa;color:#101c33;border-radius:16px;padding:28px;max-width:440px;width:calc(100% - 48px);' +
        'font-family:"Archivo",sans-serif;box-shadow:0 20px 60px rgba(16,28,51,0.35)}' +
      '.sgp-modal-box h3{margin:0 0 10px;font-size:18px}' +
      '.sgp-hint{margin:0 0 14px;font-size:13.5px;line-height:1.6;color:#3a4763}' +
      '.sgp-input{width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid rgba(16,28,51,0.25);border-radius:8px;font-size:14px}' +
      '.sgp-row{display:flex;gap:8px;justify-content:flex-end;margin-top:14px}' +
      '.sgp-row button{cursor:pointer;padding:8px 18px;border-radius:999px;border:1px solid rgba(16,28,51,0.25);background:#ffffff;font-size:13px}' +
      '.sgp-row .sgp-ok{background:#1f3d7a;border-color:#1f3d7a;color:#f7f8fa;font-weight:700}' +
      '.sgp-toast{position:fixed;bottom:78px;left:50%;transform:translateX(-50%) translateY(8px);z-index:150;background:#101c33;color:#f7f8fa;' +
        'padding:10px 18px;border-radius:10px;font-family:"Archivo",sans-serif;font-size:13.5px;opacity:0;pointer-events:none;' +
        'transition:opacity .25s, transform .25s;max-width:min(560px, calc(100vw - 48px))}' +
      '.sgp-toast-show{opacity:1;transform:translateX(-50%) translateY(0)}';
    var style = document.createElement('style');
    style.id = 'sgp-style';
    style.textContent = css;
    document.head.appendChild(style);
  }
})();
