# SmartRead AI

SmartRead AI is a lightweight Chrome extension that leverages Chrome's built-in AI capabilities (Summarizer and Translator) to extract concise summaries from web pages, translate them into many target languages, read summaries aloud, and save or export results — all from the browser for fast, privacy-friendly workflows.

Live repository: https://github.com/Kushanware/smartread-ai

---

## Features

- Smart Summarize: Extract a concise summary of the active web page with one click.
- Templates: Choose templates (product page, research article, job posting) to bias summary output for different content types.
- Translate: Translate summaries into dozens of target languages using Chrome's Translator API. The UI shows availability and model download progress.
- Read Aloud: Play summaries using the browser's text-to-speech capabilities.
- Save & Export: Save summaries locally in the extension and export them as Markdown for notes or sharing.
- Inline status and progress: A small status bar and progress indicator show download/translate status and helpful messages.
- Robust extraction: Defensive extraction avoids noisy runtime errors when a page disallows script access.

## Why use SmartRead AI

- Save time reading long articles and documentation.
- Share insights across languages quickly.
- Keep processing local when using Chrome's on-device models for added privacy and speed.

## Quick install (Developer / local testing)

1. Open Chrome and go to `chrome://extensions`.
2. Enable Developer mode (toggle in the top-right).
3. Click `Load unpacked` and select this repository folder (`smartread-ai`).
4. Open a normal web page (not `chrome://` or `file://`) and click the extension icon to open the popup.

Note: Translator and Summarizer behavior depends on the Chrome build and available on-device models. Some language models may require downloading and will show a small progress indicator.

## Usage

1. Open the page you want summarized.
2. Click the SmartRead AI extension icon to open the popup.
3. (Optional) Select a template to bias the summary format.
4. Click **Smart Summarize**. The summary appears in the popup.
5. To translate, pick a target language from the `Target language` dropdown, then click the globe icon. If a model needs to be downloaded, you will see progress.
6. Use the speaker icon to read the summary aloud.
7. Save summaries to the Recent Saves list, or use Export to download as Markdown.

## Files of interest

- `popup.html` — popup UI and the language dropdown.
- `popup.js` — core logic: summarization, translation flow (create/download/translate), UI wiring, save/export features.
- `advanced-features.js` — referenced by the popup; may add advanced capabilities.
- `manifest.json` — extension manifest (permissions and entry points).

## Privacy & Offline

- SmartRead AI uses Chrome's built-in Summarizer/Translator where available. Those on-device models process data locally which improves privacy and latency.
- If a model or API is unavailable in the browser, the extension falls back to a demo string to avoid sending content to external services.
- Saved summaries are stored locally in the extension storage (no external telemetry by default).

## Troubleshooting

- If translation shows a "downloadable" state but no progress, ensure the browser can fetch model assets (network access) and that you're on a Chrome build that supports Translator API.
- If summarize fails on a particular page, try another page — some internal or restricted pages block script extraction and will return a demo placeholder instead.
- After code changes, reload the extension via `chrome://extensions` and re-open the popup.

## Developer notes & next improvements

- Current helpful next steps you may want to implement:
  - Persist last-selected language in `chrome.storage.local` so the popup remembers user preference.
  - Auto-detect page language and wire Summarizer `outputLanguage` automatically.
  - Add a small UI legend explaining the meaning of labels like `(downloadable)` and `(not supported)`.

## Contributing

Contributions are welcome. Open issues or PRs on the GitHub repository: https://github.com/Kushanware/smartread-ai

## License

This repository does not include an explicit license file. If you want to publish under an open-source license, adding an `LICENSE` (for example, MIT) is recommended.

---

If you'd like, I can also add this as `README.md` (this file), add images/screenshots, or generate a short `README` tailored for your Devpost submission.
# SmartRead AI

A Chrome extension that helps you read and write smarter using on-device AI capabilities.

## Features

- 🧠 **Smart Summary**: Instantly summarize any webpage or selected text
- 🌍 **Instant Translation**: Translate summaries to 100+ languages
- ✍️ **Proofread Mode**: Fix grammar and clarity in any text field
- 💾 **Read-Later Mode**: Save summaries for offline access

## Installation

1. Open Chrome Extensions page (chrome://extensions/)
2. Enable "Developer mode" in the top right
3. Click "Load unpacked" and select the extension folder

## Usage

### Summarizing Content
- Click the SmartRead AI icon and press "Summarize Page" for full-page summary
- Select text, right-click and choose "Summarize Selection" for specific content

### Translation
1. Generate a summary
2. Select target language from dropdown
3. Click "Translate" to convert

### Proofreading
1. Focus on any editable text field (e.g., Gmail, LinkedIn)
2. Click "Proofread" in the extension popup
3. Or right-click and select "Proofread Selection"

### Offline Access
- Summaries are automatically saved locally
- Access them anytime from the "Saved Summaries" section

## Privacy

SmartRead AI runs entirely on your device using Chrome's built-in AI capabilities. No data is sent to external servers.

## Technical Details

- Built with Manifest V3
- Uses Chrome built-in AI APIs:
  - Summarizer API (global Summarizer)
  - Translator API (global Translator)
  - Language Detector API (global LanguageDetector in page context)
  - chrome.ai.proofreader (extension)
- No origin trial tokens required for extension context.
- Local storage for offline access
