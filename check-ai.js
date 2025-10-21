// Function to check Chrome and built-in AI availability
function checkChromeAI() {
  console.log('Checking Chrome and AI Features...\n');

  // Check Chrome API
  console.log('1. Checking Chrome API:');
  if (typeof chrome === 'undefined') {
    console.log('❌ Chrome API not available');
    return;
  }
  console.log('✅ Chrome API available');

  // Check Chrome version (informational)
  console.log('\n2. Checking Chrome version:');
  const userAgent = navigator.userAgent;
  const chromeVersion = userAgent.match(/Chrome\/(\d+)/);
  if (chromeVersion) {
    console.log(`Chrome version: ${chromeVersion[1]}`);
  }

  // Check individual built-in AI APIs
  console.log('\n3. Checking built-in AI APIs:');

  // Summarizer (global)
  console.log('\nSummarizer:');
  if ('Summarizer' in self) {
    console.log('✅ Summarizer API present');
    Summarizer.availability().then((a) => console.log('Availability:', a)).catch(e => console.log('Error:', e.message));
  } else {
    console.log('❌ Summarizer API not available');
  }

  // Translator (global)
  console.log('\nTranslator:');
  if ('Translator' in self) {
    console.log('✅ Translator API present');
    Translator.availability({ sourceLanguage: 'en', targetLanguage: 'es' })
      .then((a) => console.log('Availability:', a))
      .catch(e => console.log('Error:', e.message));
  } else {
    console.log('❌ Translator API not available');
  }

  // Language Detector (global)
  console.log('\nLanguage Detector:');
  if ('LanguageDetector' in self) {
    console.log('✅ Language Detector API present');
    LanguageDetector.availability().then((a) => console.log('Availability:', a)).catch(e => console.log('Error:', e.message));
  } else {
    console.log('❌ Language Detector API not available');
  }

  // Proofreader (chrome.ai)
  console.log('\nProofreader:');
  if (chrome.ai?.proofreader) {
    console.log('✅ Proofreader API present');
    chrome.ai.proofreader.availability().then((a) => console.log('Availability:', a)).catch(e => console.log('Error:', e.message));
  } else {
    console.log('❌ Proofreader API not available');
  }
}

document.addEventListener('DOMContentLoaded', checkChromeAI);
