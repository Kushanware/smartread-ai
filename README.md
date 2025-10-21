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
