// Background service worker to handle context menu operations
(() => {
  // Check foundational model status
  async function checkModelStatus() {
    try {
      const modelInfo = {
        name: 'v3Nano',
        version: '2025.06.30.1229',
        backendType: 'GPU',
        vramRequired: 3000,
        vramDetected: 3964,
        features: {
          generalizedSafety: false,
          languageDetection: false,
          textSafety: false
        }
      };

      // Check if we're meeting hardware requirements
      const hardwareCheck = {
        vramSufficient: modelInfo.vramDetected >= modelInfo.vramRequired,
        gpuAcceleration: modelInfo.backendType === 'GPU',
        deviceCapable: true
      };

      if (!hardwareCheck.vramSufficient) {
        throw new Error(`Insufficient VRAM: ${modelInfo.vramDetected}MB < ${modelInfo.vramRequired}MB required`);
      }

      return {
        status: 'Ready',
        modelInfo,
        hardwareCheck,
        supplementaryModels: {
          OPTIMIZATION_TARGET_GENERALIZED_SAFETY: false,
          OPTIMIZATION_TARGET_LANGUAGE_DETECTION: true,
          OPTIMIZATION_TARGET_TEXT_SAFETY: true
        }
      };
    } catch (error) {
      console.error('Model status check failed:', error);
      return { status: 'Error', error: error.message };
    }
  }

  // Check if the Proofreader API is available (only what we actually need here)
  async function isAIAvailable() {
    try {
      if (!chrome?.ai?.proofreader) {
        return { available: false, error: 'Proofreader API not available' };
      }
      const availability = await chrome.ai.proofreader.availability();
      if (availability === 'available' || availability === 'downloadable') {
        return { available: true, status: availability };
      }
      return { available: false, error: `Proofreader unavailable (${availability})` };
    } catch (e) {
      console.error('Error checking Proofreader availability:', e);
      return { available: false, error: e.message };
    }
  }

  // Function to show a message to the user
  async function showMessage(tab, message, isError = false) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (msg, error) => {
          if (error) {
            console.error(msg);
          }
          alert(msg);
        },
        args: [message, isError]
      });
    } catch (e) {
      console.error('Failed to show message:', e);
    }
  }

  // Function to show an error message to the user
  async function showErrorMessage(tab, message) {
    return showMessage(tab, message, true);
  }

  // Function to replace text in the active element
  async function replaceSelectedText(tab, newText) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (text) => {
          const selection = window.getSelection();
          if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            range.deleteContents();
            range.insertNode(document.createTextNode(text));
          }
        },
        args: [newText]
      });
    } catch (e) {
      console.error('Failed to replace text:', e);
      throw e;
    }
  }

  // Map language code to readable English name (fallback to Intl.DisplayNames)
  function languageCodeToName(code) {
    const map = {
      af: 'Afrikaans', ar: 'Arabic', bn: 'Bengali', bg: 'Bulgarian', ca: 'Catalan', cs: 'Czech', da: 'Danish', de: 'German',
      el: 'Greek', en: 'English', es: 'Spanish', et: 'Estonian', fa: 'Persian', fi: 'Finnish', fr: 'French', he: 'Hebrew',
      hi: 'Hindi', hr: 'Croatian', hu: 'Hungarian', id: 'Indonesian', it: 'Italian', ja: 'Japanese', ko: 'Korean', lt: 'Lithuanian',
      lv: 'Latvian', ms: 'Malay', nl: 'Dutch', no: 'Norwegian', pl: 'Polish', pt: 'Portuguese', ro: 'Romanian', ru: 'Russian',
      sk: 'Slovak', sl: 'Slovenian', sr: 'Serbian', sv: 'Swedish', ta: 'Tamil', te: 'Telugu', th: 'Thai', tr: 'Turkish',
      uk: 'Ukrainian', ur: 'Urdu', vi: 'Vietnamese', zh: 'Chinese'
    };
    const lc = (code || '').toLowerCase();
    if (map[lc]) return map[lc];
    try {
      const dn = new Intl.DisplayNames(['en'], { type: 'language' });
      return dn.of(lc) || code.toUpperCase();
    } catch {
      return code.toUpperCase();
    }
  }

  // Detect text language (runs in the page context, since LanguageDetector isn't available in workers)
  async function detectLanguage(tabId, text) {
    try {
      if (!text || text.length < 10) {
        return { error: 'Text too short for reliable detection' };
      }
      const [res] = await chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        func: async (input) => {
          try {
            if (!('LanguageDetector' in self)) {
              return { error: 'Language Detector API not supported' };
            }
            const availability = await LanguageDetector.availability();
            if (availability === 'unavailable') {
              return { error: 'Language Detector unavailable' };
            }
            const detector = await LanguageDetector.create({
              monitor(m) {
                m.addEventListener('downloadprogress', (e) => {
                  console.log(`Language model download: ${Math.round(e.loaded * 100)}%`);
                });
              }
            });
            const results = await detector.detect(input);
            const top = results?.[0];
            if (!top) return { error: 'No detection result' };
            if (top.confidence > 0.7) {
              return { language: top.detectedLanguage, confidence: top.confidence };
            }
            return { error: 'Low confidence detection', language: top.detectedLanguage, confidence: top.confidence };
          } catch (err) {
            return { error: err.message };
          }
        },
        args: [text]
      });
      return res.result;
    } catch (error) {
      console.error('Language detection error:', error);
      return { error: error.message };
    }
  }

  // Helper to (re)build context menus based on availability
  function rebuildContextMenus() {
    chrome.contextMenus.removeAll(() => {
      if (chrome.runtime.lastError) {
        console.warn('contextMenus.removeAll:', chrome.runtime.lastError.message);
      }
      // Always add Detect Language
      chrome.contextMenus.create({
        id: "detectLanguage",
        title: "Detect Language",
        contexts: ["selection"]
      });
      // Add Proofread only if API exists
      if (chrome.ai?.proofreader?.create) {
        chrome.contextMenus.create({
          id: "proofreadText",
          title: "Proofread Text with SmartRead AI",
          contexts: ["selection"]
        });
      }
      // Compose actions
      chrome.contextMenus.create({ id: "summarizeSelection", title: "Summarize Selection", contexts: ["selection"] });
      chrome.contextMenus.create({ id: "rewriteSelection", title: "Rewrite Selection", contexts: ["selection"] });
    });
  }

  // Safe send to content script with auto-inject + url guard
  async function safeSendToContent(tab, message) {
    if (!tab?.id) return;
    const url = tab.url || '';
    if (!/^https?:\/\//i.test(url)) {
      console.warn('Unsupported tab URL for messaging:', url);
      return;
    }
    try {
      await chrome.tabs.sendMessage(tab.id, message);
    } catch (e) {
      try {
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['compose-overlay.js'] });
        await chrome.tabs.sendMessage(tab.id, message);
      } catch (e2) {
        console.warn('Failed to reach content script:', e2?.message || e2);
      }
    }
  }

  // Send message to popup with retry (popup may take time to initialize)
  async function sendToPopupWithRetry(message, attempts = 3, delayMs = 400) {
    for (let i = 0; i < attempts; i++) {
      try {
        return await chrome.runtime.sendMessage(message);
      } catch (e) {
        if (i === attempts - 1) throw e;
        await new Promise(r => setTimeout(r, delayMs));
      }
    }
  }

  // Create context menu items
  chrome.runtime.onInstalled.addListener(() => {
    rebuildContextMenus();
  });

  
  // Keyboard shortcuts -> open compose overlay
  chrome.commands?.onCommand.addListener(async (command) => {
    if (!['summarize-selection', 'rewrite-selection'].includes(command)) return;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    await safeSendToContent(tab, { type: 'open-compose-overlay', mode: command });
  });

  // Handle context menu clicks
  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === "detectLanguage") {
      const selectedText = info.selectionText;
      if (!selectedText) {
        await showErrorMessage(tab, 'No text selected for language detection.');
        return;
      }

      const result = await detectLanguage(tab.id, selectedText);
      if (result.error) {
        await showErrorMessage(tab, `Language detection error: ${result.error}`);
      } else {
        const confidence = Math.round(result.confidence * 100);
        const name = languageCodeToName(result.language).toLowerCase();
        await showMessage(tab, `Detected language: ${name} (${confidence}% confidence)`);
      }
      return;
    }

    if (info.menuItemId === "summarizeSelection" || info.menuItemId === "rewriteSelection") {
      await safeSendToContent(tab, { type: 'open-compose-overlay', mode: info.menuItemId });
      return;
    }

    if (info.menuItemId === "proofreadText") {
      try {
        const selectedText = info.selectionText;
        if (!selectedText) {
          await showErrorMessage(tab, 'No text selected for proofreading.');
          return;
        }

        if (chrome.ai?.proofreader?.create) {
          // Preferred: use proofreader in the service worker.
          const proofreader = await chrome.ai.proofreader.create({
            expectedInputLanguages: ["en"],
            monitor(m) {
              m.addEventListener("downloadprogress", e => {
                console.log(`Model download progress: ${Math.round(e.loaded * 100)}%`);
              });
            }
          });
          const result = await proofreader.proofread(selectedText);
          const corrected = result?.correction || result?.text || selectedText;
          await replaceSelectedText(tab, corrected);
          return;
        }

        // Fallback: open popup and delegate proofreading there.
        await chrome.action.openPopup();
        // Send to popup with retry to allow it time to initialize
        const response = await sendToPopupWithRetry({
          type: 'proofread-selection',
          text: selectedText,
          tabId: tab.id
        });
        if (!response?.ok) {
          throw new Error(response?.error || 'Delegated proofreading failed');
        }
      } catch (error) {
        console.error('Proofreading error:', error);
        await showErrorMessage(tab, 'Error proofreading text. Please try again.');
      }
    }
  });
})();
