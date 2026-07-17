import { GoogleGenAI } from '@google/genai'; // Exact named export bracket structure
import * as cheerio from 'cheerio';

/**
 * Intelligent Gemini AI-Driven Style-Preserved Email Translation Engine
 */
export async function processEmailTranslation(htmlSource, targetDict, sourceDict, brandCode, targetLang) {
  if (!htmlSource) throw new Error("HTML source input is empty.");
  if (!targetDict || !sourceDict) throw new Error("Missing translation dictionaries.");

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not defined in your environment variables. Check your .env.local file.");
  }

  const ai = new GoogleGenAI({ apiKey });

  // 1. Pack translation entries into a clean reference string mapping array
  const translationContextDataset = [];
  Object.keys(targetDict).forEach(key => {
    const englishText = sourceDict[key];
    const targetText = targetDict[key];
    if (englishText && targetText && englishText.toLowerCase() !== 'nan' && englishText.toLowerCase() !== 'local link') {
      translationContextDataset.push({
        key: key,
        englishReference: englishText.trim(),
        targetTranslation: targetText.trim()
      });
    }
  });

  // 2. Build strict determinism system instructions for the LLM pipeline
  const systemInstruction = `
You are an expert enterprise localization engine designed to translate transactional marketing email templates.
Your absolute core instruction is to swap English text with its corresponding target language version (${targetLang}) using the provided dataset map.

CRITICAL OPERATIONAL MATRIX PRINCIPLES:
1. Translate the content ONLY. Do NOT modify, optimize, rewrite, or add any extra layout structures or text.
2. Use the provided JSON key-value mapping exclusively to determine what the English text should become in ${targetLang}.
3. Analyze the raw HTML template text visually and semantically. If an English sentence is split up or broken apart across inline layout tags (like <strong>, <span>, or <br />), map the whole phrase to its translation, replacing the text leaf contents accurately.
4. DO NOT change, drop, or alter any HTML tags, attributes, class names, image sources, table properties, or inline CSS style rules. Every tag structure must remain 100% identical. Only the text character values should swap.
5. Convert standard carriage newlines (\\n) present in the translation dataset values into proper HTML line breaks (<br />) to preserve line spacing.
6. Return only the clean modified HTML document stream. Do not write introductory prose or notes.
`;

  const userPrompt = `
--- TRANSLATION TARGET DATASET DATA ---
${JSON.stringify(translationContextDataset, null, 2)}

--- TARGET LANGUAGE ISO DIALECT KEY ---
${targetLang}

--- BRAND CODE IDENTITY ---
${brandCode}

--- RAW INPUT ENGLISH HTML TEMPLATE ---
${htmlSource}
`;

  // 3. Request translation processing using Gemini's optimal high-speed model context window
  const response = await ai.models.generateContent({
    model: 'gemini-3.5-flash', // FIX: Updated to the live GA release to resolve version endpoint errors
    contents: userPrompt,
    config: {
      systemInstruction: systemInstruction,
      temperature: 0.0, // Hard zero configuration ensures strict analytical consistency
    }
  });

  let translatedHtmlOutput = response.text;

  // 4. Post-Sanitize markdown code fences wrapper formatting if appended by the AI model response layout
  if (translatedHtmlOutput.includes('```html')) {
    translatedHtmlOutput = translatedHtmlOutput.split('```html')[1].split('```')[0].trim();
  } else if (translatedHtmlOutput.includes('```')) {
    translatedHtmlOutput = translatedHtmlOutput.split('```')[1].split('```')[0].trim();
  }

  // 5. RUN CHEERIO FOR SFMC COMPATIBILITY INJECTION TRACKING ALIASES
  const $ = cheerio.load(translatedHtmlOutput, { xmlMode: false, decodeEntities: false });
  
  let ctaCounter = 1;       // Increments only when a true text button/clickable CTA is encountered
  let activeCtaIndex = 1;   // The tracking index currently assigned to graphical/image layout assets
  let blockCounter = 1;
  let isFirstImage = true;

  // 1) Find text matching comments indicating browser view/mirror links and intercept their closest anchor element
  $('*').contents().each(function() {
    if (this.type === 'comment') {
      const commentText = (this.data || '').toLowerCase();
      if (commentText.includes('browser view link') || commentText.includes('mirror link')) {
        // Find the adjacent link layout node wrapper within this contextual branch zone
        const nearestAnchor = $(this).parent().find('a').first();
        if (nearestAnchor.length) {
          nearestAnchor.attr('alias', 'View In Browser');
          nearestAnchor.attr('href', '%%view_email_url%%');
          nearestAnchor.addClass('sfmc-mirror-processed');
        }
      }
    }
  });

  $('a').each(function() {
    const anchor = $(this);
    
    // Skip if already captured and resolved by the comment iteration pass block above
    if (anchor.hasClass('sfmc-mirror-processed')) {
      anchor.removeClass('sfmc-mirror-processed');
      return;
    }

    const img = anchor.find('img');
    const alt = img.length ? (img.attr('alt') || '').trim().toLowerCase() : '';

    // 3) Footer Social Media Configuration Map updates
    if (alt.includes('facebook') || alt.includes('fb')) {
      anchor.attr('alias', 'Facebook');
      anchor.attr('href', '%%=redirectto(@fb)=%%');
      return;
    } 
    if (alt.includes('instagram') || alt.includes('ig')) {
      anchor.attr('alias', 'Instagram');
      anchor.attr('href', '%%=redirectto(@ig)=%%');
      return;
    } 
    if (alt.includes('twitter') || alt.includes('x.com') || alt.includes('tw')) {
      anchor.attr('alias', 'Twitter');
      anchor.attr('href', '%%=redirectto(@tw)=%%');
      return;
    } 
    if (alt.includes('youtube') || alt.includes('yt')) {
      anchor.attr('alias', 'YouTube');
      anchor.attr('href', '%%=redirectto(@yt)=%%');
      return;
    } 
    if (alt.includes('linkedin') || alt.includes('ln') || alt.includes('in')) {
      anchor.attr('alias', 'LinkedIn');
      anchor.attr('href', '%%=redirectto(@li)=%%');
      return;
    } 
    if (alt.includes('pinterest') || alt.includes('pin')) {
      anchor.attr('alias', 'Pinterest');
      anchor.attr('href', '%%=redirectto(@pin)=%%');
      return;
    } 
    if (alt.includes('logo')) {
      anchor.attr('alias', 'Logo');
      anchor.attr('href', '%%=redirectto(@logo)=%%');
      return;
    } 

    // 2) Content CTA elements logic configuration adjustments loop
    if (img.length) {
      if (isFirstImage) {
        anchor.attr('alias', `Image_${brandCode}${targetLang}_Hero`);
        anchor.attr('href', `%%=redirectto(@cta${activeCtaIndex})=%%`);
        isFirstImage = false;
      } else {
        anchor.attr('alias', `Image_${brandCode}${targetLang}_Block${blockCounter}`);
        anchor.attr('href', `%%=redirectto(@cta${activeCtaIndex})=%%`);
        blockCounter++;
      }
    } else {
      // Independent or consecutive text button CTA block element tracking update loop
      anchor.attr('alias', `Button_${brandCode}${targetLang}_CTA${ctaCounter}`);
      anchor.attr('href', `%%=redirectto(@cta${ctaCounter})=%%`);
      
      // Update global sequence positions: graphical assets now align with this active link reference index
      ctaCounter++;
      activeCtaIndex = ctaCounter;
    }
  });

  return $.html();
}