// Advanced AI Features for SmartRead AI Extension

// Utility to choose an output language acceptable to the model
function pickOutputLanguage(allowed = ['en','es','ja']) {
    try {
        const fromSelect = (typeof document !== 'undefined' && document.getElementById('langSelect')?.value) || '';
        const cand = (fromSelect || (typeof navigator !== 'undefined' ? navigator.language : 'en') || 'en').slice(0,2).toLowerCase();
        return allowed.includes(cand) ? cand : 'en';
    } catch { return 'en'; }
}

// Writer API - Generate original content
async function generateContent(prompt, tone = 'casual') {
    try {
        // Preferred: Writer API
        if ('Writer' in self) {
            const availability = await Writer.availability();
            if (availability !== 'available' && availability !== 'downloadable') {
                throw new Error(`Writer unavailable: ${availability}`);
            }
            const writer = await Writer.create({
                tone: tone, // 'formal', 'casual', 'neutral'
                length: 'medium',
                format: 'markdown',
                monitor(m) {
                    m.addEventListener('downloadprogress', (e) => {
                        console.log(`Writer model download: ${Math.round(e.loaded * 100)}%`);
                    });
                }
            });
            return await writer.write(prompt);
        }
        
        // Fallback: Prompt API (LanguageModel)
        if ('LanguageModel' in self) {
            const availability = await LanguageModel.availability();
            if (availability === 'unavailable') throw new Error('Prompt API unavailable');
            const session = await LanguageModel.create({
                outputLanguage: pickOutputLanguage(),
                initialPrompts: [{
                    role: 'system',
                    content: `You are a writing assistant. Write a concise, engaging response in ${tone} tone. Use markdown when helpful.`
                }],
                monitor(m) {
                    m.addEventListener('downloadprogress', (e) => {
                        console.log(`Language model download: ${Math.round(e.loaded * 100)}%`);
                    });
                }
            });
            return await session.prompt(prompt);
        }
        
        return { error: 'Writer API and Prompt API not supported' };
    } catch (error) {
        console.error('Writer error:', error);
        return { error: error.message };
    }
}

// Rewriter API - Improve existing text
async function rewriteText(text, options = {}) {
    try {
        // Preferred: Rewriter API
        if ('Rewriter' in self) {
            const availability = await Rewriter.availability();
            if (availability !== 'available' && availability !== 'downloadable') {
                throw new Error(`Rewriter unavailable: ${availability}`);
            }
            const rewriter = await Rewriter.create({
                tone: options.tone || 'as-is', // 'more-formal', 'more-casual', 'as-is'
                length: options.length || 'as-is', // 'shorter', 'longer', 'as-is'
                format: 'markdown',
                monitor(m) {
                    m.addEventListener('downloadprogress', (e) => {
                        console.log(`Rewriter model download: ${Math.round(e.loaded * 100)}%`);
                    });
                }
            });
            return await rewriter.rewrite(text);
        }
        
        // Fallback: Prompt API (LanguageModel)
        if ('LanguageModel' in self) {
            const availability = await LanguageModel.availability();
            if (availability === 'unavailable') throw new Error('Prompt API unavailable');
            const session = await LanguageModel.create({
                outputLanguage: pickOutputLanguage(),
                initialPrompts: [{
                    role: 'system',
                    content: `Rewrite the user's text with constraints. Tone: ${options.tone || 'as-is'}, Length: ${options.length || 'as-is'}. Preserve meaning; improve clarity and flow.`
                }],
                monitor(m) {
                    m.addEventListener('downloadprogress', (e) => {
                        console.log(`Language model download: ${Math.round(e.loaded * 100)}%`);
                    });
                }
            });
            const prompt = `Rewrite the following text accordingly:\n\n${text}`;
            return await session.prompt(prompt);
        }
        
        return { error: 'Rewriter API and Prompt API not supported' };
    } catch (error) {
        console.error('Rewriter error:', error);
        return { error: error.message };
    }
}

// Multimodal Prompt API - Analyze images with text
async function analyzeImageWithPrompt(imageUrl, prompt) {
    try {
        if (!('LanguageModel' in self)) {
            return { error: 'Prompt API not supported' };
        }
        
        const availability = await LanguageModel.availability();
        if (availability !== 'available' && availability !== 'downloadable') {
            return { error: `Prompt API unavailable: ${availability}` };
        }
        
        // Fetch and convert image to base64
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const reader = new FileReader();
        
        return new Promise((resolve, reject) => {
            reader.onloadend = async () => {
                try {
                    const base64 = reader.result.split(',')[1];
                    
                    const session = await LanguageModel.create({
                        outputLanguage: pickOutputLanguage(),
                        systemPrompt: "You are a helpful AI assistant that analyzes images and provides detailed insights.",
                        monitor(m) {
                            m.addEventListener('downloadprogress', (e) => {
                                console.log(`Prompt model download: ${Math.round(e.loaded * 100)}%`);
                            });
                        }
                    });
                    
                    // Multimodal input with image and text
                    const result = await session.prompt([
                        { type: 'image', data: base64 },
                        { type: 'text', text: prompt }
                    ]);
                    
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            };
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error('Multimodal analysis error:', error);
        return { error: error.message };
    }
}

// Smart context extraction for better summaries
async function extractPageContext() {
    const context = {
        title: document.title,
        meta: {},
        headings: [],
        images: [],
        links: [],
        structuredData: {}
    };
    
    // Extract meta tags
    document.querySelectorAll('meta').forEach(meta => {
        const name = meta.getAttribute('name') || meta.getAttribute('property');
        if (name) context.meta[name] = meta.getAttribute('content');
    });
    
    // Extract headings hierarchy
    ['h1', 'h2', 'h3'].forEach(tag => {
        document.querySelectorAll(tag).forEach(heading => {
            context.headings.push({
                level: tag,
                text: heading.innerText.trim()
            });
        });
    });
    
    // Extract important images
    document.querySelectorAll('img').forEach((img, idx) => {
        if (idx < 5 && img.src && img.width > 100) {
            context.images.push({
                src: img.src,
                alt: img.alt,
                title: img.title
            });
        }
    });
    
    // Extract structured data (JSON-LD)
    document.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
        try {
            const data = JSON.parse(script.textContent);
            Object.assign(context.structuredData, data);
        } catch {}
    });
    
    return context;
}

// Smart response formatting with structured output
async function generateStructuredSummary(text, context) {
    try {
        if (!('LanguageModel' in self)) {
            throw new Error('Prompt API not available');
        }
        
        const session = await LanguageModel.create({
            outputLanguage: pickOutputLanguage(),
            systemPrompt: "Generate a comprehensive summary with key insights, actionable points, and relevant metadata.",
            responseConstraint: {
                type: "object",
                properties: {
                    title: { type: "string" },
                    summary: { type: "string" },
                    keyPoints: {
                        type: "array",
                        items: { type: "string" },
                        maxItems: 5
                    },
                    sentiment: {
                        type: "string",
                        enum: ["positive", "negative", "neutral", "mixed"]
                    },
                    category: { type: "string" },
                    readingTime: { type: "number" },
                    actionItems: {
                        type: "array",
                        items: { type: "string" }
                    }
                },
                required: ["title", "summary", "keyPoints", "sentiment"]
            }
        });
        
        const prompt = `Analyze this content and provide a structured summary:
        
Title: ${context.title}
Content: ${text.slice(0, 3000)}
Meta Description: ${context.meta.description || 'N/A'}
Main Headings: ${context.headings.slice(0, 5).map(h => h.text).join(', ')}`;
        
        return await session.prompt(prompt);
    } catch (error) {
        console.error('Structured summary error:', error);
        // Fallback to regular summary
        return null;
    }
}

// Voice synthesis for accessibility
async function textToSpeech(text) {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        speechSynthesis.speak(utterance);
        return { success: true };
    }
    return { error: 'Speech synthesis not supported' };
}

// Export for use in popup.js and background.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        generateContent,
        rewriteText,
        analyzeImageWithPrompt,
        extractPageContext,
        generateStructuredSummary,
        textToSpeech
    };
}