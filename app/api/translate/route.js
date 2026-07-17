import { processEmailTranslation } from '@/lib/translator';

// FORCE VERCEL TO EXECUTE THIS ROUTE ON THE INFRASTRUCTURE EDGE LAYER
// This completely kills the 10-second FUNCTION_INVOCATION_TIMEOUT limit!
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    // Vercel Edge Runtime parses incoming multi-part payloads using Web API specifications
    const formData = await request.formData();
    const jsonFile = formData.get('jsonFile');
    const htmlFile = formData.get('htmlFile');
    const targetLang = formData.get('targetLang')?.toString().trim().toUpperCase() || 'BEFR';
    const brandCode = formData.get('brandCode')?.toString().trim().toUpperCase() || 'AP';

    if (!jsonFile || !htmlFile) {
      return new Response(
        JSON.stringify({ error: 'Missing required JSON or HTML files.' }), 
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const jsonText = await jsonFile.text();
    const htmlText = await htmlFile.text();
    const translationData = JSON.parse(jsonText);

    const matchedLangKey = Object.keys(translationData).find(k => k.toUpperCase() === targetLang);
    const matchedSourceKey = Object.keys(translationData).find(k => k.toUpperCase() === 'EN' || k.toUpperCase() === 'GTINSIDERS');

    if (!matchedLangKey || !translationData[matchedLangKey]) {
      return new Response(
        JSON.stringify({ error: `Target language "${targetLang}" not found in JSON data.` }), 
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (!matchedSourceKey || !translationData[matchedSourceKey]) {
      return new Response(
        JSON.stringify({ error: 'Source reference block key "EN" or "GTINSIDERS" not found in JSON data.' }), 
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const targetDict = translationData[matchedLangKey];
    const sourceDict = translationData[matchedSourceKey];

    // Fire the translation engine 
    const compiledHtmlOutput = await processEmailTranslation(htmlText, targetDict, sourceDict, brandCode, targetLang);

    return new Response(compiledHtmlOutput, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="${targetLang}_translated_email.html"`,
        'X-Content-Type-Options': 'nosniff'
      },
    });
  } catch (error) {
    console.error("Vercel Edge Execution Fault:", error);
    return new Response(
      JSON.stringify({ error: `Internal Engine Error: ${error.message}` }), 
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}