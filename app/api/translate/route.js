import { NextResponse } from 'next/server';
import { processEmailTranslation } from '@/lib/translator';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const jsonFile = formData.get('jsonFile');
    const htmlFile = formData.get('htmlFile');
    const targetLang = formData.get('targetLang')?.toString().trim().toUpperCase() || 'BEFR';
    const brandCode = formData.get('brandCode')?.toString().trim().toUpperCase() || 'AP';

    if (!jsonFile || !htmlFile) {
      return new Response('Missing required JSON or HTML files.', { status: 400 });
    }

    const jsonText = await jsonFile.text();
    const htmlText = await htmlFile.text();
    const translationData = JSON.parse(jsonText);

    const matchedLangKey = Object.keys(translationData).find(k => k.toUpperCase() === targetLang);
    const matchedSourceKey = Object.keys(translationData).find(k => k.toUpperCase() === 'EN' || k.toUpperCase() === 'BEFR' || k.toUpperCase() === 'GTINSIDERS');

    if (!matchedLangKey || !translationData[matchedLangKey]) {
      return new Response(`Target language "${targetLang}" not found in JSON data.`, { status: 400 });
    }
    if (!matchedSourceKey || !translationData[matchedSourceKey]) {
      return new Response('Source reference block key "EN" or "GTINSIDERS" not found in JSON data.', { status: 400 });
    }

    const targetDict = translationData[matchedLangKey];
    const sourceDict = translationData[matchedSourceKey];

    // CRITICAL: Await the response from the LLM engine processing loop
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
    return new Response(`Internal Engine Error: ${error.message}`, { status: 500 });
  }
}