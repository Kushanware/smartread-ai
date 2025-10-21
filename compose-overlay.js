// compose-overlay.js
// Lightweight in-page overlay for summarizing/rewriting selected text
(function () {
  const ID = 'smartread-compose-overlay';
  if (document.getElementById(ID)) return;

  function getSelectionText() {
    const sel = window.getSelection();
    return sel && sel.toString() ? sel.toString() : '';
  }

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  function styles() {
    const s = document.createElement('style');
    s.textContent = `
      #${ID} { position: fixed; bottom: 20px; right: 20px; z-index: 2147483647; font-family: Inter, system-ui, sans-serif; }
      #${ID}, #${ID} * { color:#111827 !important; }
      #${ID} .card { width: 360px; background: #fff; border:1px solid #e5e7eb; border-radius: 12px; box-shadow: 0 8px 28px rgba(0,0,0,.12); overflow: hidden; }
      #${ID} .header { display:flex; align-items:center; justify-content:space-between; padding:10px 12px; background:#f9fafb; border-bottom:1px solid #eee; }
      #${ID} .title { font-size:14px; font-weight:600; }
      #${ID} .close { border:none; background:transparent; font-size:16px; cursor:pointer; }
      #${ID} .body { padding:12px; display:flex; flex-direction:column; gap:8px; }
      #${ID} textarea { width:100%; min-height:80px; padding:8px; border:1px solid #e5e7eb; border-radius:8px; font-size:13px; background:#fff; color:#111827; }
      #${ID} .actions { display:flex; gap:8px; }
      #${ID} .btn { flex:1; padding:10px; border:none; border-radius:8px; cursor:pointer; font-weight:600; }
      #${ID} .primary{ background:#6366f1; color:#fff !important; }
      #${ID} .secondary{ background:#eef2ff; color:#3730a3 !important; }
      #${ID} .output { max-height:160px; overflow:auto; border:1px solid #e5e7eb; border-radius:8px; padding:10px; font-size:13px; background:#fff; color:#111827; white-space:pre-wrap; }
    `;
    document.head.appendChild(s);
  }

  function chooseAllowedLanguage() {
    try {
      const cand = (document.documentElement.lang || navigator.language || 'en').slice(0,2).toLowerCase();
      return ['en','es','ja'].includes(cand) ? cand : 'en';
    } catch { return 'en'; }
  }

  function createOverlay() {
    styles();
    const root = el('div');
    root.id = ID;

    const card = el('div', 'card');
    const header = el('div', 'header');
    const title = el('div', 'title', 'SmartRead Compose');
    const close = el('button', 'close', '✕');
    close.onclick = () => root.remove();
    header.appendChild(title); header.appendChild(close);

    const body = el('div', 'body');
    const input = el('textarea');
    input.value = getSelectionText();
    const actions = el('div', 'actions');
    const summarizeBtn = el('button', 'btn primary', 'Summarize');
    const rewriteBtn = el('button', 'btn secondary', 'Rewrite');
    actions.appendChild(summarizeBtn); actions.appendChild(rewriteBtn);

    const output = el('div', 'output', '<em>Result will appear here…</em>');

    body.appendChild(input); body.appendChild(actions); body.appendChild(output);
    card.appendChild(header); card.appendChild(body); root.appendChild(card);
    document.documentElement.appendChild(root);

    summarizeBtn.onclick = async () => {
      const text = input.value.trim();
      if (!text) { output.innerHTML = '<em>Enter text first</em>'; return; }
      try {
        output.textContent = 'Summarizing…';
        if ('Summarizer' in self) {
          const avail = await Summarizer.availability();
          if (avail === 'unavailable') throw new Error('Summarizer unavailable');
          const s = await Summarizer.create({ type: 'key-points', format: 'markdown', length: 'medium' });
          const res = await s.summarize(text);
          output.textContent = res;
        } else if ('LanguageModel' in self) {
          const lm = await LanguageModel.create({ outputLanguage: chooseAllowedLanguage(), initialPrompts:[{ role:'system', content:'Summarize as concise bullet points.' }] });
          const res = await lm.prompt(text);
          output.textContent = res;
        } else {
          output.textContent = 'Summarizer not supported on this page.';
        }
      } catch (e) { output.textContent = 'Error: ' + e.message; }
    };

    rewriteBtn.onclick = async () => {
      const text = input.value.trim();
      if (!text) { output.innerHTML = '<em>Enter text first</em>'; return; }
      try {
        output.textContent = 'Rewriting…';
        if ('LanguageModel' in self) {
          const lm = await LanguageModel.create({ outputLanguage: chooseAllowedLanguage(), initialPrompts:[{ role:'system', content:'Rewrite to improve clarity and grammar while preserving meaning.' }] });
          const res = await lm.prompt(text);
          output.textContent = res;
        } else {
          output.textContent = 'Rewrite not supported on this page.';
        }
      } catch (e) { output.textContent = 'Error: ' + e.message; }
    };
  }

  // Listen for messages from background to open overlay
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === 'open-compose-overlay') {
      if (!document.getElementById(ID)) createOverlay();
      else document.getElementById(ID).querySelector('textarea').value = getSelectionText();
    }
  });
})();