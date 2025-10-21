(() => {
    // Global state
    let currentSummary = '';
    let summarizerSession = null;
    let translatorSession = null;

    // Helper function to show status messages
    function showStatus(message, isError = false) {
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
            'ar': 'Arabic'
        };
        
        return `🔤 Demo Translation to ${langNames[targetLang] || targetLang.toUpperCase()}:\n\n[This would be the translated version of your summary in ${langNames[targetLang] || targetLang}]\n\n⚠️ This is a demo response - Chrome's Translation AI is not available`;
    }

    // Check if Summarizer API is available
    async function checkSummarizerAvailability() {
        try {
            if (!('Summarizer' in self)) {
                return { available: false, reason: 'Summarizer API not supported' };
            }
            
            const availability = await Summarizer.availability();
            console.log('Summarizer availability:', availability);
            
            return {
                available: availability === 'available' || availability === 'downloadable',
                status: availability,
                reason: availability === 'available' || availability === 'downloadable' ? null : `Status: ${availability}`
            };
        } catch (error) {
            console.error('Error checking Summarizer availability:', error);
            return { available: false, reason: error.message };
        }
    }

    // Check if Translator API is available
    async function checkTranslatorAvailability() {
        try {
            if (!('Translator' in self)) {
                return { available: false, reason: 'Translator API not supported' };
            }
            
            const availability = await Translator.availability({
                sourceLanguage: 'en',
                targetLanguage: 'es'
            });
            console.log('Translator availability:', availability);
            
            return {
                available: availability === 'available' || availability === 'downloadable',
                status: availability,
                reason: availability === 'available' || availability === 'downloadable' ? null : `Status: ${availability}`
            };
        } catch (error) {
            console.error('Error checking Translator availability:', error);
            return { available: false, reason: error.message };
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
            const [{ result: pageText }] = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                world: 'MAIN',
                func: () => {
                    const sel = window.getSelection?.();
                    if (sel && sel.toString().trim().length > 0) {
                        return sel.toString();
                    }
                    const text = document.body?.innerText || '';
                    return text.replace(/\s+/g, ' ').trim();
                }
            });
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
        return new Promise((resolve) => {
            chrome.storage.local.get({ summaries: [] }, (data) => {
                const summaries = data.summaries;
                summaries.unshift({
                    url,
                    summary,
                    date: new Date().toISOString()
                });
                chrome.storage.local.set({ summaries }, resolve);
            });
        });
    }

    // Load saved summaries (optional search query)
    function loadSavedSummaries(query = '') {
        chrome.storage.local.get({ summaries: [] }, (data) => {
            const savedList = document.getElementById('savedList');
            if (!savedList) return;
            savedList.innerHTML = '';

            const q = (query || '').trim().toLowerCase();
            const items = q
                ? data.summaries.filter(item =>
                    (item.url || '').toLowerCase().includes(q) ||
                    (item.summary || '').toLowerCase().includes(q)
                  )
                : data.summaries;

            if (items.length === 0) {
                const li = document.createElement('li');
                li.textContent = data.summaries.length === 0 ? 'No saved summaries yet.' : 'No matches.';
                savedList.appendChild(li);
                return;
            }

            items.forEach(item => {
                const li = document.createElement('li');
                const date = new Date(item.date).toLocaleDateString();
                li.innerHTML = `
          <div class="saved-date">${date}</div>
          <div class="saved-summary">${item.summary.slice(0, 100)}...</div>
        `;
                li.addEventListener('click', () => {
                    document.getElementById('summaryOutput').textContent = item.summary;
                    currentSummary = item.summary;
                });
                savedList.appendChild(li);
            });
        });
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
        loadSavedSummaries();

        // Search saved summaries
        const searchInput = document.getElementById('searchInput');
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
                loadSavedSummaries(searchInput.value);
            });

            // Extra handlers to cover cases where input events may not fire or focus is blocked
            searchInput.addEventListener('click', () => {
                try { searchInput.focus(); } catch (e) {}
            });
            searchInput.addEventListener('keyup', (e) => {
                // keep behavior consistent for keyboard interactions (including IME)
                loadSavedSummaries(searchInput.value);
            });

            // If saved items exist, ensure the current query is applied
            loadSavedSummaries(searchInput.value || '');
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
            try {
                summarizeBtn.disabled = true;
                translateBtn.disabled = true;
                saveBtn.disabled = true;
                showStatus('Reading page content...');

                const summary = await summarizePage();
                currentSummary = summary;
                showStatus(summary);

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

            try {
                translateBtn.disabled = true;
                showStatus('Translating...');

                const targetLang = document.getElementById('langSelect').value;
                const translated = await translateText(currentSummary, targetLang);
                currentSummary = translated;
                showStatus(translated);
            } catch (error) {
                console.error('Error:', error);
                showStatus('Error translating text. Please try again.', true);
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
            if (!currentSummary) {
                showStatus('Please generate a summary first.', true);
                return;
            }

            try {
                saveBtn.disabled = true;
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                await saveSummary(currentSummary, tab.url);
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
