(() => {
    // Global state
    let currentSummary = '';
    let summarizerSession = null;
    let translatorSession = null;

    // Debug logging toggle
    const DEBUG_LOG = true;
    function dbg(...args) {
        if (!DEBUG_LOG) return;
        try {
            console.debug('[SmartRead]', new Date().toISOString(), ...args);
        } catch (e) { /* noop */ }
    }

    // Helper function to show status messages
    function showStatus(message, isError = false) {
        try { dbg('showStatus', { message, isError }); } catch (e) {}
        const output = document.getElementById('summaryOutput');
        if (output) {
            if (typeof message === 'string') {
                output.textContent = message;
            } else {
                output.innerHTML = message;
            }
            output.style.color = isError ? '#d32f2f' : '#333';
        }
        
        const statusText = document.getElementById('statusText');
        const bar = document.getElementById('statusBar');
        if (statusText) {
            const text = typeof message === 'string' ? message : 'Processing...';
            statusText.textContent = text.length > 160 ? text.slice(0, 160) + '…' : text;
        }
        if (bar) {
            bar.classList.toggle('error', !!isError);
            const isProgress = /Reading|Generating|Downloading|Translating|Saving|Analyzing|Rewriting/i.test(message);
            bar.classList.toggle('progress', isProgress && !isError);
        }
    }

    // In-memory cache for saved summaries to avoid repeated storage IO
    let cachedSummaries = null;

    // Demo responses for when AI is not available
    function getDemoSummary(text) {
        const medicalTerms = ['medical', 'health', 'doctor', 'patient', 'treatment', 'diagnosis', 'therapy', 'medicine', 'clinical', 'hospital'];
        const hasMedicalTerms = medicalTerms.some(term => text.toLowerCase().includes(term));
        
        if (hasMedicalTerms) {
            return "📋 Medical Summary (Demo Mode):\n\n• This content appears to be medical-related\n• Key topics may include health information and treatments\n• For accurate medical information, consult healthcare professionals\n\n⚠️ This is a demo response - Chrome's AI model is not available";
        }
        
        return "📄 Content Summary (Demo Mode):\n\n• This page contains textual content that would be analyzed\n• Key points and main topics would be identified\n• Important information would be highlighted\n• Content would be condensed for easier reading\n\n⚠️ This is a demo response - Chrome's AI model is not available";
    }

    function getDemoTranslation(text, targetLang) {
        const langNames = {
            'en': 'English',
            'hi': 'Hindi',
            'es': 'Spanish',
            'fr': 'French',
            'ar': 'Arabic',
            'zh': 'Chinese (Simplified)',
            'zh-TW': 'Chinese (Traditional)',
            'de': 'German',
            'pt': 'Portuguese',
            'pt-BR': 'Portuguese (Brazil)',
            'ru': 'Russian',
            'ja': 'Japanese',
            'ko': 'Korean',
            'it': 'Italian',
            'nl': 'Dutch',
            'tr': 'Turkish',
            'vi': 'Vietnamese',
            'id': 'Indonesian',
            'ms': 'Malay',
            'th': 'Thai',
            'sv': 'Swedish',
            'no': 'Norwegian',
            'da': 'Danish',
            'fi': 'Finnish',
            'pl': 'Polish',
            'uk': 'Ukrainian',
            'ro': 'Romanian',
            'hu': 'Hungarian',
            'cs': 'Czech',
            'sk': 'Slovak',
            'el': 'Greek',
            'bg': 'Bulgarian',
            'hr': 'Croatian',
            'sr': 'Serbian',
            'sl': 'Slovenian',
            'lt': 'Lithuanian',
            'lv': 'Latvian',
            'et': 'Estonian',
            'he': 'Hebrew',
            'fa': 'Persian (Farsi)',
            'ur': 'Urdu',
            'bn': 'Bengali',
            'pa': 'Punjabi',
            'mr': 'Marathi',
            'gu': 'Gujarati',
            'ta': 'Tamil',
            'te': 'Telugu',
            'kn': 'Kannada',
            'ml': 'Malayalam',
            'si': 'Sinhala',
            'ne': 'Nepali',
            'km': 'Khmer',
            'lo': 'Lao',
            'my': 'Burmese',
            'am': 'Amharic',
            'sw': 'Swahili',
            'af': 'Afrikaans',
            'sq': 'Albanian',
            'mk': 'Macedonian',
            'bn-IN': 'Assamese',
            'or': 'Odia'
        };

        const name = langNames[targetLang] || langNames[targetLang.toLowerCase()] || targetLang.toUpperCase();
        return `🔤 Demo Translation to ${name}:\n\n[This would be the translated version of your summary in ${name}]\n\n⚠️ This is a demo response - Chrome's Translation AI is not available`;
    }

    // Check if Summarizer API is available
    async function checkSummarizerAvailability() {
        try {
            try { dbg('checkSummarizerAvailability start'); } catch (e) {}
            if (!('Summarizer' in self)) {
                try { dbg('Summarizer not in self'); } catch (e) {}
                return { available: false, reason: 'Summarizer API not supported' };
            }
            
            const availability = await Summarizer.availability();
            try { dbg('Summarizer availability', availability); } catch (e) {}
            console.log('Summarizer availability:', availability);
            
            return {
                available: availability === 'available' || availability === 'downloadable',
                status: availability,
                reason: availability === 'available' || availability === 'downloadable' ? null : `Status: ${availability}`
            };
        } catch (error) {
            try { dbg('checkSummarizerAvailability error', error); } catch (e) {}
            console.error('Error checking Summarizer availability:', error);
            return { available: false, reason: error.message };
        }
    }

    // Check if Translator API is available for a specific language pair
    // Returns an object { available: bool, status: string, reason: string|null }
    async function checkTranslatorAvailability(sourceLanguage = 'en', targetLanguage = 'es') {
        try {
            try { dbg('checkTranslatorAvailability start', { sourceLanguage, targetLanguage }); } catch (e) {}
            if (!('Translator' in self)) {
                try { dbg('Translator not in self'); } catch (e) {}
                return { available: false, status: 'api-missing', reason: 'Translator API not supported' };
            }

            const availability = await Translator.availability({ sourceLanguage, targetLanguage });
            try { dbg('Translator availability', { sourceLanguage, targetLanguage, availability }); } catch (e) {}

            return {
                available: availability === 'available' || availability === 'downloadable',
                status: availability,
                reason: availability === 'available' || availability === 'downloadable' ? null : `Status: ${availability}`
            };
        } catch (error) {
            try { dbg('checkTranslatorAvailability error', error); } catch (e) {}
            console.error('Error checking Translator availability:', error);
            return { available: false, status: 'error', reason: error.message };
        }
    }

    // Summarizer function with proper API usage
    async function summarizePage() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        try {
            // Guard: forbidden schemes (Chrome Web Store, chrome://, edge://, file:// without permission)
            const url = tab.url || '';
            if (/^chrome:\/\//i.test(url) || /chrome.google.com\/webstore/.test(url) || /^edge:\/\//i.test(url)) {
                showStatus('Cannot access this page. Open a regular https page and try again.', true);
                return '⚠️ Unsupported page context.';
            }

            showStatus('Extracting page content...');
            let pageText = '';
            try {
                const res = await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    world: 'MAIN',
                    func: () => {
                        try {
                            const sel = window.getSelection?.();
                            if (sel && sel.toString().trim().length > 0) {
                                return sel.toString();
                            }
                            const text = document.body?.innerText || '';
                            return text.replace(/\s+/g, ' ').trim();
                        } catch (e) {
                            // If page access throws inside the page, propagate a clear message
                            return '';
                        }
                    }
                });
                if (Array.isArray(res) && res[0] && typeof res[0].result === 'string') {
                    pageText = res[0].result;
                } else if (res && res.result && typeof res.result === 'string') {
                    pageText = res.result;
                } else {
                    pageText = '';
                }
            } catch (execError) {
                console.warn('Content extraction failed:', execError);
                showStatus('Cannot read page content (maybe restricted). Using demo summary.', true);
                return getDemoSummary('');
            }
            if (!pageText || pageText.trim().length < 20) {
                showStatus('No readable text found on this page.', true);
                return '⚠️ No readable text found.';
            }

            // Check if Summarizer API is available
            const summarizerCheck = await checkSummarizerAvailability();
            if (!summarizerCheck.available) {
                console.log('Summarizer not available, using demo mode:', summarizerCheck.reason);
                return getDemoSummary(pageText.slice(0, 1000));
            }

            if (!navigator.userActivation?.isActive) {
                showStatus('Click the button to start summarization.', true);
                return '⚠️ User activation required.';
            }

            showStatus('Preparing summarizer...');
            // Create summarizer session if not exists
                if (!summarizerSession) {
                const tpl = (document.getElementById('templateSelect')?.value) || 'default';
                const sharedContext = tpl === 'product' ? 'Summarize as product highlights: features, pros/cons, price, comparisons.'
                  : tpl === 'job' ? 'Summarize role: responsibilities, qualifications, location, compensation (if present).'
                  : tpl === 'research' ? 'Summarize research: problem, method, key findings, limitations.'
                  : undefined;
                // Ensure outputLanguage is set to avoid Summarizer API warnings.
                summarizerSession = await Summarizer.create({
                    type: 'key-points',
                    format: 'markdown',
                    length: 'medium',
                    outputLanguage: 'en',
                    ...(sharedContext ? { sharedContext } : {}),
                    monitor(m) {
                        m.addEventListener('downloadprogress', (e) => {
                            showStatus(`Downloading summarizer model: ${Math.round(e.loaded * 100)}%`);
                        });
                    }
                });
            }

            // Fit input to quota if available
            let text = pageText.slice(0, 4000);
            try {
                const quota = summarizerSession.inputQuota ?? 4000;
                text = pageText.slice(0, Math.min(quota, 4000));
            } catch {}

            showStatus('Generating summary...');

            // Try standard summarization, fallback to chunked size and streaming
            try {
                return await summarizerSession.summarize(text);
            } catch (e1) {
                console.warn('summarize() failed, retrying smaller input:', e1);
                const sizes = [2500, 1500, 800];
                for (const size of sizes) {
                    try {
                        return await summarizerSession.summarize(pageText.slice(0, size));
                    } catch {}
                }
                // Streaming fallback
                try {
                    let result = '';
                    const stream = await summarizerSession.summarizeStreaming(pageText.slice(0, 2000));
                    for await (const chunk of stream) { result = chunk; }
                    return result || getDemoSummary(pageText.slice(0, 1000));
                } catch (e2) {
                    console.error('Streaming summarization failed:', e2);
                    return getDemoSummary(pageText.slice(0, 1000));
                }
            }
        } catch (error) {
            console.error('Error generating summary:', error);
            // Fallback to demo mode on error
            return getDemoSummary('');
        }
    }

    // Translator function with proper API usage
    async function translateText(text, targetLang = "hi") {
        try {
            // Check if Translator API is available
            const translatorCheck = await checkTranslatorAvailability();
            if (!translatorCheck.available) {
                console.log('Translator not available, using demo mode:', translatorCheck.reason);
                return getDemoTranslation(text, targetLang);
            }

            // Create translator session for the specific language pair
            const translator = await Translator.create({
                sourceLanguage: 'en',
                targetLanguage: targetLang,
                monitor(m) {
                    m.addEventListener('downloadprogress', (e) => {
                        console.log(`Translation model download: ${e.loaded * 100}%`);
                        showStatus(`Downloading translation model: ${Math.round(e.loaded * 100)}%`);
                    });
                }
            });

            showStatus('Translating...');
            const result = await translator.translate(text);
            return result;

        } catch (error) {
            console.error('Error translating text:', error);
            return getDemoTranslation(text, targetLang);
        }
    }

    // Proofreading function
    async function proofreadInput(text) {
        if (!chrome.ai?.proofreader?.create) {
            throw new Error('Proofreader API not available');
        }
        const proofreader = await chrome.ai.proofreader.create({
            expectedInputLanguages: ['en'],
            monitor(m) {
                m.addEventListener('downloadprogress', (e) => {
                    showStatus(`Downloading proofreader model: ${Math.round(e.loaded * 100)}%`);
                });
            }
        });
        const result = await proofreader.proofread(text);
        // Prefer correction if available, otherwise fall back.
        return result.correction || result.text || text;
    }

    // Save summary function
    function saveSummary(summary, url) {
        try { dbg('saveSummary called', { url, length: (summary||'').length }); } catch (e) {}
        return new Promise((resolve) => {
            // Update in-memory cache first
            try {
                cachedSummaries = cachedSummaries || [];
                cachedSummaries.unshift({ url, summary, date: new Date().toISOString() });
            } catch (e) { cachedSummaries = [{ url, summary, date: new Date().toISOString() }]; }
            // Persist to storage asynchronously
            chrome.storage.local.set({ summaries: cachedSummaries }, resolve);
        });
    }

    // Debounce helper to limit frequent calls (search, etc.)
    function debounce(fn, wait) {
        let t = null;
        return function (...args) {
            clearTimeout(t);
            t = setTimeout(() => fn.apply(this, args), wait);
        };
    }

    // Global simple, safe formatter: converts plaintext with asterisks and newlines into basic HTML
    function formatSummary(text) {
        if (!text) return '';
        // Basic sanitize: escape HTML
        const esc = (s) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        const lines = esc(String(text)).split(/\r?\n/).map(l => l.trim());

        // Detect bullet blocks (lines starting with '*' or '-')
        let html = '';
        let inList = false;
        for (const line of lines) {
            if (!line) {
                if (inList) { html += '</ul>'; inList = false; }
                html += '<p></p>';
                continue;
            }
            const m = line.match(/^([\*\-])\s+(.*)$/);
            if (m) {
                if (!inList) { html += '<ul>'; inList = true; }
                html += `<li>${m[2]}</li>`;
            } else {
                if (inList) { html += '</ul>'; inList = false; }
                html += `<p>${line}</p>`;
            }
        }
        if (inList) html += '</ul>';
        return html;
    }

    // Load saved summaries (optional search query) - uses in-memory cache for speed
    function loadSavedSummaries(query = '') {
        try { dbg('loadSavedSummaries called', { query }); } catch (e) {}
        const savedList = document.getElementById('savedList');
        if (!savedList) return;

        // If we don't have cachedSummaries yet, get them once and cache
        const render = (items, totalCount) => {
            savedList.innerHTML = '';
            if (!items || items.length === 0) {
                const li = document.createElement('li');
                li.textContent = totalCount === 0 ? 'No saved summaries yet.' : 'No matches.';
                savedList.appendChild(li);
                return;
            }

            const frag = document.createDocumentFragment();
            for (const item of items) {
                const li = document.createElement('li');
                const date = new Date(item.date).toLocaleDateString();
                li.innerHTML = `
          <div class="saved-date">${date}</div>
          <div class="saved-summary">${(item.summary||'').slice(0, 100)}...</div>
        `;
                li.addEventListener('click', () => {
                    const out = document.getElementById('summaryOutput');
                    if (out) {
                        out.innerHTML = formatSummary(item.summary);
                    }
                    currentSummary = item.summary;
                });
                frag.appendChild(li);
            }
            savedList.appendChild(frag);
        };

        if (cachedSummaries === null) {
            chrome.storage.local.get({ summaries: [] }, (data) => {
                cachedSummaries = data.summaries || [];
                try { dbg('loaded summaries from storage', cachedSummaries.length); } catch (e) {}
                const q = (query || '').trim().toLowerCase();
                const items = q
                    ? cachedSummaries.filter(item =>
                        (item.url || '').toLowerCase().includes(q) ||
                        (item.summary || '').toLowerCase().includes(q)
                      )
                    : cachedSummaries;
                render(items, cachedSummaries.length);
            });
            return;
        }

        const q = (query || '').trim().toLowerCase();
        const items = q
            ? cachedSummaries.filter(item =>
                (item.url || '').toLowerCase().includes(q) ||
                (item.summary || '').toLowerCase().includes(q)
              )
            : cachedSummaries;
        render(items, cachedSummaries.length);
    }

    // Initialize the extension
    document.addEventListener('DOMContentLoaded', async () => {
        // Tab switching logic
        const tabButtons = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');
        
        tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetTab = btn.dataset.tab;
                
                // Update active button
                tabButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // Show corresponding content
                tabContents.forEach(content => {
                    content.style.display = 'none';
                });
                const targetContent = document.getElementById(`${targetTab}-tab`);
                if (targetContent) {
                    targetContent.style.display = 'block';
                }
            });
        });

    // Load saved summaries
    dbg('DOMContentLoaded - calling initial loadSavedSummaries');
    loadSavedSummaries();

        // Search saved summaries (debounced)
        const searchInput = document.getElementById('searchInput');
        const debouncedLoad = debounce((val) => loadSavedSummaries(val), 160);
        if (searchInput) {
            // Defensive: ensure the input is enabled and focusable in case styles or other scripts made it inert
            try {
                searchInput.disabled = false;
            } catch (e) {}
            try {
                searchInput.tabIndex = searchInput.tabIndex || 0;
            } catch (e) {}

            // Primary input listener
            searchInput.addEventListener('input', () => {
                try { dbg('searchInput input', searchInput.value); } catch (e) {}
                debouncedLoad(searchInput.value);
            });

            // Extra handlers to cover cases where input events may not fire or focus is blocked
            searchInput.addEventListener('click', () => {
                try { dbg('searchInput click'); } catch (e) {}
                try { searchInput.focus(); } catch (e) {}
            });
            searchInput.addEventListener('keyup', (e) => {
                // keep behavior consistent for keyboard interactions (including IME)
                try { dbg('searchInput keyup', e.key); } catch (e) {}
                loadSavedSummaries(searchInput.value);
            });

            // If saved items exist, ensure the current query is applied
            loadSavedSummaries(searchInput.value || '');
        }

        // Prewarm local sessions (summarizer/translator) to reduce first-run latency
        async function prewarmSessions() {
            try {
                // Touch availability checks so models start downloading if needed
                dbg('prewarmSessions starting');
                checkSummarizerAvailability().then(av => {
                    if (av.available && !summarizerSession) {
                        // attempt to create a light session in background to warm model caches
                        // include outputLanguage to avoid Summarizer warnings and catch errors
                        Summarizer?.create?.({ type: 'key-points', format: 'short', length: 'short', outputLanguage: 'en' })
                            .then(s => { summarizerSession = s; console.debug('summarizer prewarmed'); })
                            .catch(()=>{});
                    }
                }).catch(()=>{});

                checkTranslatorAvailability().then(av => {
                    if (av.available && !translatorSession) {
                        Translator?.create?.({ sourceLanguage: 'en', targetLanguage: 'hi' })
                            .then(t => { translatorSession = t; console.debug('translator prewarmed'); })
                            .catch(()=>{});
                    }
                }).catch(()=>{});
            } catch (e) { /* noop */ }
        }

        // Kick off prewarm but don't block the UI
        setTimeout(prewarmSessions, 300);

        // Annotate language options with availability information so users know which
        // targets are supported by the built-in Translator API. Runs async and won't
        // block UI. If the Translator API is missing entirely, mark all options as
        // API-unavailable (demo mode).
        async function annotateLangSupport() {
            try {
                const select = document.getElementById('langSelect');
                if (!select) return;

                // Helper to strip previous annotations from an option's text
                const stripAnnotation = (text) => text.replace(/\s*\((API unavailable|not supported|unsupported|Not supported|Unavailable)\)\s*$/i, '').trim();

                // If Translator API is not present, mark all options as unavailable for API
                if (!('Translator' in self)) {
                    for (const opt of Array.from(select.options)) {
                        opt.dataset.supported = 'false';
                        opt.text = stripAnnotation(opt.text) + ' (API unavailable)';
                    }
                    // Informative status for the popup
                    showStatus('Translator API not available — translation will use demo placeholders');
                    return;
                }

                // Otherwise, query availability for each language. Keep UI responsive by
                // checking sequentially with short delay to avoid spamming heavy checks.
                for (const opt of Array.from(select.options)) {
                    const code = opt.value;
                    // reset text first
                    opt.text = stripAnnotation(opt.text);
                    try {
                        // Treat English (target === 'en') as supported by default since
                        // translating to the same language isn't necessary and availability
                        // checks may return unexpected values for identical source/target.
                        if (code === 'en') {
                            opt.dataset.supported = 'true';
                            opt.dataset.availability = 'available';
                            // leave label unchanged for English
                            await new Promise(r => setTimeout(r, 30));
                            continue;
                        }

                        const availability = await Translator.availability({ sourceLanguage: 'en', targetLanguage: code });
                        // Store raw availability string to data attribute for later decisions
                        opt.dataset.availability = availability;
                        if (availability === 'available') {
                            opt.dataset.supported = 'true';
                            // leave label unchanged for available
                        } else if (availability === 'downloadable') {
                            opt.dataset.supported = 'true';
                            opt.text = stripAnnotation(opt.text) + ' (downloadable)';
                        } else {
                            opt.dataset.supported = 'false';
                            opt.text = stripAnnotation(opt.text) + ' (not supported)';
                        }
                    } catch (e) {
                        // On error, conservatively mark unsupported
                        opt.dataset.supported = 'false';
                        opt.dataset.availability = 'error';
                        opt.text = stripAnnotation(opt.text) + ' (not supported)';
                    }
                    // Small pause to avoid overwhelming possible model availability checks
                    await new Promise(r => setTimeout(r, 60));
                }
            } catch (e) {
                console.warn('annotateLangSupport failed', e);
            }
        }

    // Start annotation shortly after prewarm so the UI is interactive quickly
    setTimeout(() => { annotateLangSupport(); }, 800);

    // Ensure translate availability state is updated once annotations complete.
    // annotateLangSupport sets dataset attributes; call update once a bit later
    setTimeout(() => { try { updateTranslateAvailability(); } catch (e) {} }, 1400);

        // Helper to update Translate button enabled/disabled state based on
        // selected language and API availability. Also shows a short tooltip
        // via status when user picks an unsupported language.
        function updateTranslateAvailability() {
            try {
                const langSelect = document.getElementById('langSelect');
                const translateBtnEl = document.getElementById('translateBtn');
                if (!langSelect || !translateBtnEl) return;
                const selected = langSelect.options[langSelect.selectedIndex];
                const apiPresent = ('Translator' in self);
                // If API missing, allow Translate (we will use demo fallback)
                if (!apiPresent) {
                    translateBtnEl.disabled = false;
                    return;
                }
                // If target language is English, consider it supported (no translation needed)
                if (selected?.value === 'en') {
                    translateBtnEl.disabled = false;
                    showStatus('Ready');
                    return;
                }
                const supported = selected?.dataset?.supported === 'true';
                translateBtnEl.disabled = !supported;
                if (!supported) {
                    // show brief hint in status bar (non-blocking)
                    showStatus('Selected language currently not available locally. Select another or click Translate to use demo.', true);
                } else {
                    showStatus('Ready');
                }
            } catch (e) { /* noop */ }
        }

        // Wire change handler so selections immediately enable/disable Translate
        const langSelectEl = document.getElementById('langSelect');
        if (langSelectEl) {
            langSelectEl.addEventListener('change', () => updateTranslateAvailability());
        }

        // Get button elements
        const summarizeBtn = document.getElementById('summarizeBtn');
        const translateBtn = document.getElementById('translateBtn');
        const saveBtn = document.getElementById('saveBtn');
        const copyBtn = document.getElementById('copyBtn');
        const exportBtn = document.getElementById('exportBtn');
        const summarizeAllBtn = document.getElementById('summarizeAllBtn');
        const proofreadBtn = document.getElementById('proofreadBtn');

        // Hide proofreader UI if not supported in this Chrome
        if (!chrome.ai?.proofreader?.create && proofreadBtn) {
            proofreadBtn.style.display = 'none';
        }

        // Built-in AI availability is checked per feature when used.

        // Summarize button handler
        summarizeBtn.addEventListener('click', async () => {
            dbg('summarizeBtn clicked');
            try {
                summarizeBtn.disabled = true;
                translateBtn.disabled = true;
                saveBtn.disabled = true;
                showStatus('Reading page content...');

                const summary = await summarizePage();
                currentSummary = summary;
                showStatus(summary);

                dbg('summarizeBtn: summary length', (summary||'').length);

                translateBtn.disabled = false;
                saveBtn.disabled = false;
                if (copyBtn) copyBtn.disabled = false;
            } catch (error) {
                console.error('Error:', error);
                showStatus('Error generating summary. Please try again.', true);
            } finally {
                summarizeBtn.disabled = false;
            }
        });

        // Translate button handler
        translateBtn.addEventListener('click', async () => {
            if (!currentSummary) {
                showStatus('Please generate a summary first.', true);
                return;
            }

            const targetLang = document.getElementById('langSelect').value;
            translateBtn.disabled = true;
            try {
                showStatus('Checking translator availability...');

                if (!('Translator' in self)) {
                    showStatus('Translator API not available — using demo translation', true);
                    const demo = getDemoTranslation(currentSummary, targetLang);
                    currentSummary = demo;
                    showStatus(demo);
                    return;
                }

                // If the target language is English, skip translation (already English)
                if (targetLang === 'en') {
                    showStatus('Target language is English — no translation needed.');
                    return;
                }

                // Query availability for the desired pair directly
                const av = await checkTranslatorAvailability('en', targetLang);
                try { dbg('translate availability', av); } catch (e) {}

                if (!av.available) {
                    // Not available for this pair — show demo fallback
                    showStatus(`Translation not supported for ${targetLang}. Using demo fallback.`, true);
                    const demo = getDemoTranslation(currentSummary, targetLang);
                    currentSummary = demo;
                    showStatus(demo);
                    return;
                }

                // Create a translator — if model needs download the monitor will report progress
                showStatus('Preparing translator...');
                const translator = await Translator.create({
                    sourceLanguage: 'en',
                    targetLanguage: targetLang,
                    monitor(m) {
                                m.addEventListener('downloadprogress', (e) => {
                                    try {
                                        const pct = Math.round((e.loaded || 0) * 100);
                                        showStatus(`Downloading translation model: ${pct}%`);
                                        const p = document.getElementById('translateProgress');
                                        if (p) { p.style.display = 'inline'; p.textContent = `⏳ ${pct}%`; }
                                    } catch (e) {}
                                });
                    }
                });

                showStatus('Translating...');
                const pEl = document.getElementById('translateProgress');
                if (pEl) { pEl.style.display = 'inline'; pEl.textContent = '🔁 Translating…'; }
                const result = await translator.translate(currentSummary);
                currentSummary = result;
                showStatus(result);
                if (pEl) { pEl.style.display = 'none'; }

            } catch (error) {
                console.error('Error:', error);
                // Fallback to demo translation
                const demo = getDemoTranslation(currentSummary, targetLang);
                currentSummary = demo;
                showStatus(demo);
                const pElErr = document.getElementById('translateProgress');
                if (pElErr) { pElErr.style.display = 'none'; }
            } finally {
                translateBtn.disabled = false;
            }
        });

        // Copy button handler
        copyBtn.addEventListener('click', async () => {
            if (!currentSummary) { showStatus('Nothing to copy. Generate a summary first.', true); return; }
            try {
                await navigator.clipboard.writeText(currentSummary);
                showStatus('Copied summary to clipboard.');
            } catch (e) {
                showStatus('Copy failed. Grant clipboard permission and try again.', true);
            }
        });

        // Export button handler (Markdown)
        if (exportBtn) {
            exportBtn.addEventListener('click', async () => {
                if (!currentSummary) { showStatus('Nothing to export. Generate a summary first.', true); return; }
                const md = `# SmartRead Summary\n\n${currentSummary}`;
                const blob = new Blob([md], { type: 'text/markdown' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = 'summary.md'; a.click();
                URL.revokeObjectURL(url);
                showStatus('Exported as Markdown');
            });
        }

        // Save button handler
        saveBtn.addEventListener('click', async () => {
            dbg('saveBtn clicked');
            if (!currentSummary) {
                showStatus('Please generate a summary first.', true);
                return;
            }

            try {
                saveBtn.disabled = true;
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                await saveSummary(currentSummary, tab.url);
                dbg('saveBtn: saved to storage, refreshing list');
                showStatus('Summary saved!');
                loadSavedSummaries(document.getElementById('searchInput')?.value || '');
            } catch (error) {
                console.error('Error:', error);
                showStatus('Error saving summary. Please try again.', true);
            } finally {
                saveBtn.disabled = false;
            }
        });

        // Proofread button handler
        proofreadBtn.addEventListener('click', async () => {
            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                const result = await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: () => {
                        const el = document.activeElement;
                        if (!el) return null;
                        const isTextInput = el.tagName === 'INPUT' && ['text','search','email','url','tel','number'].includes((el.type || '').toLowerCase());
                        const isTextarea = el.tagName === 'TEXTAREA';
                        const isEditable = el.isContentEditable === true || el.contentEditable === 'true';
                        if (isTextInput || isTextarea) return el.value || '';
                        if (isEditable) return el.textContent || '';
                        return null;
                    }
                });

                const text = result[0].result;
                if (!text) {
                    showStatus('Please focus on an editable text field first', true);
                    return;
                }

                const corrected = await proofreadInput(text);

                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: (correctedText) => {
                        const activeElement = document.activeElement;
                        if (activeElement.tagName === 'TEXTAREA') {
                            activeElement.value = correctedText;
                        } else if (activeElement.contentEditable === 'true') {
                            activeElement.textContent = correctedText;
                        }
                    },
                    args: [corrected]
                });
                showStatus('Text proofread successfully!');
            } catch (error) {
                console.error('Error:', error);
                showStatus('Error proofreading text. Please try again.', true);
            }
        });

        // Writer Tab - Generate Content
        const generateBtn = document.getElementById('generateBtn');
        if (generateBtn) {
            generateBtn.addEventListener('click', async () => {
                const prompt = document.getElementById('writePrompt').value;
                const tone = document.getElementById('writeTone').value;
                const output = document.getElementById('writeOutput').querySelector('.output-content');
                
                if (!prompt) {
                    output.innerHTML = '<p class="placeholder">Please enter what you want to write about</p>';
                    return;
                }
                
                try {
                    generateBtn.disabled = true;
                    output.innerHTML = '<p class="loading">Generating content...</p>';
                    
                    // Check Writer API or fallback
                    if (typeof generateContent !== 'undefined') {
                        const result = await generateContent(prompt, tone);
                        if (result.error) {
                            output.innerHTML = `<p style="color:red;">Error: ${result.error}</p>`;
                        } else {
                            output.textContent = result;
                        }
                    } else {
                        // Fallback demo
                        output.innerHTML = `<p><strong>Generated Content (Demo):</strong></p>
                        <p>${prompt}</p>
                        <p><em>Note: Writer API not available. This is a demo response.</em></p>`;
                    }
                } catch (error) {
                    output.innerHTML = `<p style="color:red;">Error: ${error.message}</p>`;
                } finally {
                    generateBtn.disabled = false;
                }
            });
        }

        // Improve Tab - Rewrite Text
        const rewriteBtn = document.getElementById('rewriteBtn');
        if (rewriteBtn) {
            rewriteBtn.addEventListener('click', async () => {
                const text = document.getElementById('improveText').value;
                const tone = document.getElementById('rewriteTone').value;
                const length = document.getElementById('rewriteLength').value;
                const output = document.getElementById('improveOutput').querySelector('.output-content');
                
                if (!text) {
                    output.innerHTML = '<p class="placeholder">Please enter text to improve</p>';
                    return;
                }
                
                try {
                    rewriteBtn.disabled = true;
                    output.innerHTML = '<p class="loading">Rewriting text...</p>';
                    
                    // Check Rewriter API or fallback
                    if (typeof rewriteText !== 'undefined') {
                        const result = await rewriteText(text, { tone, length });
                        if (result.error) {
                            output.innerHTML = `<p style="color:red;">Error: ${result.error}</p>`;
                        } else {
                            output.textContent = result;
                        }
                    } else {
                        // Fallback demo
                        output.innerHTML = `<p><strong>Improved Text (Demo):</strong></p>
                        <p>${text}</p>
                        <p><em>Note: Rewriter API not available. This is a demo response.</em></p>`;
                    }
                } catch (error) {
                    output.innerHTML = `<p style="color:red;">Error: ${error.message}</p>`;
                } finally {
                    rewriteBtn.disabled = false;
                }
            });
        }

        // Analyze Tab - Image Analysis
        const uploadImageBtn = document.getElementById('uploadImageBtn');
        const imageInput = document.getElementById('imageInput');
        const analyzeImageBtn = document.getElementById('analyzeImageBtn');
        
        if (uploadImageBtn && imageInput) {
            uploadImageBtn.addEventListener('click', () => {
                imageInput.click();
            });
            
            imageInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    document.getElementById('imageName').textContent = file.name;
                    analyzeImageBtn.disabled = false;
                }
            });
        }
        
        if (analyzeImageBtn) {
            analyzeImageBtn.addEventListener('click', async () => {
                const file = imageInput.files[0];
                const prompt = document.getElementById('imagePrompt').value || 'What is in this image?';
                const output = document.getElementById('analyzeOutput').querySelector('.output-content');
                
                if (!file) {
                    output.innerHTML = '<p class="placeholder">Please select an image first</p>';
                    return;
                }
                
                try {
                    analyzeImageBtn.disabled = true;
                    output.innerHTML = '<p class="loading">Analyzing image...</p>';
                    
                    // Convert to data URL
                    const reader = new FileReader();
                    reader.onload = async (e) => {
                        try {
                            if (typeof analyzeImageWithPrompt !== 'undefined') {
                                const result = await analyzeImageWithPrompt(e.target.result, prompt);
                                if (result.error) {
                                    output.innerHTML = `<p style="color:red;">Error: ${result.error}</p>`;
                                } else {
                                    output.innerHTML = `<p><strong>Analysis:</strong></p><p>${result}</p>`;
                                }
                            } else {
                                // Fallback demo
                                output.innerHTML = `<p><strong>Image Analysis (Demo):</strong></p>
                                <p>Image: ${file.name}</p>
                                <p>Question: ${prompt}</p>
                                <p><em>Note: Multimodal Prompt API not available. This is a demo response.</em></p>`;
                            }
                        } catch (error) {
                            output.innerHTML = `<p style="color:red;">Error: ${error.message}</p>`;
                        } finally {
                            analyzeImageBtn.disabled = false;
                        }
                    };
                    reader.readAsDataURL(file);
                } catch (error) {
                    output.innerHTML = `<p style="color:red;">Error: ${error.message}</p>`;
                    analyzeImageBtn.disabled = false;
                }
            });
        }

        // Speak button
        const speakBtn = document.getElementById('speakBtn');
        if (speakBtn) {
            speakBtn.addEventListener('click', () => {
                if (currentSummary && typeof textToSpeech !== 'undefined') {
                    textToSpeech(currentSummary);
                    showStatus('Reading summary aloud...');
                } else if (currentSummary && 'speechSynthesis' in window) {
                    const utterance = new SpeechSynthesisUtterance(currentSummary);
                    speechSynthesis.speak(utterance);
                    showStatus('Reading summary aloud...');
                } else {
                    showStatus('Generate a summary first or speech not supported', true);
                }
            });
        }

        // Helper: summarize arbitrary text (used for batch mode)
        async function summarizeText(inputText) {
            try {
                const summarizerCheck = await checkSummarizerAvailability();
                if (!summarizerCheck.available) {
                    return getDemoSummary((inputText || '').slice(0, 1000));
                }

                // Use global formatSummary for rendering
                if (!navigator.userActivation?.isActive) {
                    // In batch mode, rely on prior user click to grant activation; continue anyway.
                }
                if (!summarizerSession) {
                    const tpl = (document.getElementById('templateSelect')?.value) || 'default';
                    const sharedContext = tpl === 'product' ? 'Summarize as product highlights: features, pros/cons, price, comparisons.'
                      : tpl === 'job' ? 'Summarize role: responsibilities, qualifications, location, compensation (if present).'
                      : tpl === 'research' ? 'Summarize research: problem, method, key findings, limitations.'
                      : undefined;
                    summarizerSession = await Summarizer.create({
                        type: 'key-points',
                        format: 'markdown',
                        length: 'medium',
                        ...(sharedContext ? { sharedContext } : {}),
                        monitor(m) {
                            m.addEventListener('downloadprogress', (e) => {
                                showStatus(`Downloading summarizer model: ${Math.round(e.loaded * 100)}%`);
                            });
                        }
                    });
                }
                let text = (inputText || '').slice(0, 4000);
                try {
                    const quota = summarizerSession.inputQuota ?? 4000;
                    text = (inputText || '').slice(0, Math.min(quota, 4000));
                } catch {}
                try {
                    return await summarizerSession.summarize(text);
                } catch (e1) {
                    const sizes = [2500, 1500, 800];
                    for (const size of sizes) {
                        try { return await summarizerSession.summarize((inputText || '').slice(0, size)); } catch {}
                    }
                    try {
                        let result = '';
                        const stream = await summarizerSession.summarizeStreaming((inputText || '').slice(0, 2000));
                        for await (const chunk of stream) { result = chunk; }
                        return result || getDemoSummary((inputText || '').slice(0, 1000));
                    } catch (e2) {
                        console.error('Streaming summarization failed:', e2);
                        return getDemoSummary((inputText || '').slice(0, 1000));
                    }
                }
            } catch (error) {
                console.error('summarizeText error:', error);
                return getDemoSummary((inputText || '').slice(0, 1000));
            }
        }

        // Summarize all tabs
        if (summarizeAllBtn) {
            summarizeAllBtn.addEventListener('click', async () => {
                try {
                    summarizeAllBtn.disabled = true;
                    showStatus('Summarizing all tabs...');
                    const tabs = await chrome.tabs.query({ currentWindow: true });
                    const results = [];
                    for (const t of tabs) {
                        if (!t.id || !/^https?:/.test(t.url || '')) continue;
                        const [{ result: text }] = await chrome.scripting.executeScript({ target: { tabId: t.id }, world: 'MAIN', func: () => document.body?.innerText?.slice(0, 4000) || '' });
                        if (!text) continue;
                        const summary = await summarizeText(text);
                        results.push(`## ${t.title || t.url}\n\n${summary}\n`);
                    }
                    currentSummary = results.join('\n');
                    document.getElementById('summaryOutput').innerHTML = currentSummary.replace(/\n/g,'<br>');
                    showStatus('Finished batch summarization');
                } catch (e) {
                    console.error(e); showStatus('Error summarizing tabs', true);
                } finally { summarizeAllBtn.disabled = false; }
            });
        }

        // Structured Summary button
        const structuredBtn = document.getElementById('structuredBtn');
        if (structuredBtn) {
            structuredBtn.addEventListener('click', async () => {
                try {
                    structuredBtn.disabled = true;
                    showStatus('Generating structured summary...');
                    
                    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                    
                    // Extract page context
                    const [contextResult] = await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        world: 'MAIN',
                        func: extractPageContext
                    });
                    
                    const context = contextResult?.result || {};
                    
                    // Get page text
                    const [textResult] = await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        world: 'MAIN',
                        func: () => document.body?.innerText || ''
                    });
                    
                    const text = textResult?.result || '';
                    
                    if (typeof generateStructuredSummary !== 'undefined') {
                        const result = await generateStructuredSummary(text, context);
                        let structured = null;
                        if (result && typeof result === 'object' && (result.summary || result.keyPoints)) {
                            structured = result;
                        } else if (typeof result === 'string') {
                            structured = { title: 'Summary', summary: result, keyPoints: [], sentiment: 'neutral' };
                        }

                        if (structured) {
                            const formatted = `
                                <strong>${structured.title || 'Summary'}</strong>
                                <p>${structured.summary || ''}</p>
                                <strong>Key Points:</strong>
                                <ul>${(structured.keyPoints || []).map(p => `<li>${p}</li>`).join('')}</ul>
                                <strong>Sentiment:</strong> ${structured.sentiment || 'neutral'}
                            `;
                            document.getElementById('summaryOutput').innerHTML = formatted;
                            currentSummary = structured.summary || '';
                        } else {
                            // Fallback to regular summary
                            const summary = await summarizePage();
                            currentSummary = summary;
                            showStatus(summary);
                        }
                    } else {
                        // Fallback
                        const summary = await summarizePage();
                        currentSummary = summary;
                        showStatus(summary);
                    }
                } catch (error) {
                    console.error('Structured summary error:', error);
                    showStatus('Error generating structured summary', true);
                } finally {
                    structuredBtn.disabled = false;
                }
            });
        }

        // Clear saves button
        const clearSavesBtn = document.getElementById('clearSavesBtn');
        if (clearSavesBtn) {
            clearSavesBtn.addEventListener('click', () => {
                if (confirm('Clear all saved summaries?')) {
                    chrome.storage.local.set({ summaries: [] }, () => {
                        loadSavedSummaries(document.getElementById('searchInput')?.value || '');
                        showStatus('Saved summaries cleared');
                    });
                }
            });
        }

        // Initialize button states
        translateBtn.disabled = true;
        saveBtn.disabled = true;
        if (copyBtn) copyBtn.disabled = true;

        // Handle delegated proofreading from background when popup is opened programmatically
        chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
            (async () => {
                if (msg?.type === 'proofread-selection') {
                    try {
                        showStatus('Proofreading selection...');
                        const corrected = await proofreadInput(msg.text);
                        await chrome.scripting.executeScript({
                            target: { tabId: msg.tabId },
                            func: (newText) => {
                                const sel = window.getSelection();
                                if (sel && sel.rangeCount > 0) {
                                    const range = sel.getRangeAt(0);
                                    range.deleteContents();
                                    range.insertNode(document.createTextNode(newText));
                                }
                            },
                            args: [corrected]
                        });
                        showStatus('Text proofread successfully!');
                        sendResponse({ ok: true });
                    } catch (e) {
                        console.error(e);
                        showStatus('Error proofreading via popup.', true);
                        sendResponse({ ok: false, error: e.message });
                    }
                }
            })();
            return true; // Keep the message channel open for async response
        });
    });
})();
