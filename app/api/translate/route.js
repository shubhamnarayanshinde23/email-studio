import { NextResponse } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { textGroup, targetLang } = await request.json();

    if (!textGroup || textGroup.length === 0) {
      return NextResponse.json({ translatedGroup: [] }, { status: 200 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY is not configured on Vercel settings." }, { status: 500 });
    }

    const systemInstruction = `
You are an expert enterprise localization engine.
Translate the provided array of English strings into the target language (${targetLang}).
Return ONLY a raw JSON array of strings matching the exact same index order. Do not wrap in markdown or add notes.
`;

    const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const apiResponse = await fetch(geminiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: JSON.stringify(textGroup) }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] },
        generationConfig: {
          temperature: 0.0,
          responseMimeType: "application/json"
        }
      })
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      return NextResponse.json({ error: `Gemini API Error: ${errorText}` }, { status: 500 });
    }

    const responseData = await apiResponse.json();
    let rawText = responseData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "[]";

    if (rawText.startsWith('```json')) rawText = rawText.split('```json')[1].split('```')[0].trim();
    if (rawText.startsWith('```')) rawText = rawText.split('```')[1].split('```')[0].trim();

    const translatedGroup = JSON.parse(rawText);
    return NextResponse.json({ translatedGroup }, { status: 200 });

  } catch (error) {
    return NextResponse.json({ error: `Edge processing fault: ${error.message}` }, { status: 500 });
  }
}