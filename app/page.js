'use client';
import { useState } from 'react';

export default function TranslatorWorkspace() {
  const [targetLang, setTargetLang] = useState('BEFR');
  const [brandCode, setBrandCode] = useState('AP');
  const [status, setStatus] = useState('Workspace status: Idle / Ready');
  const [loading, setLoading] = useState(false);

  const readFileAsText = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => resolve(event.target.result);
      reader.onerror = (error) => reject(error);
      reader.readAsText(file);
    });
  };

  const executeTranslationSequence = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus('⏳ Reading file inputs locally in browser context...');

    try {
      const jsonFile = document.getElementById('jsonUpload').files[0];
      const htmlFile = document.getElementById('htmlUpload').files[0];

      const rawJsonText = await readFileAsText(jsonFile);
      const rawHtmlContent = await readFileAsText(htmlFile);

      const parsedMatrix = JSON.parse(rawJsonText);
      
      // Safety checks to locate target dictionary frames inside translations.json
      const targetDict = parsedMatrix.targetDict || parsedMatrix;
      const sourceDict = parsedMatrix.sourceDict || parsedMatrix;

      const keys = Object.keys(targetDict);
      const totalKeys = keys.length;
      
      setStatus(`📦 Found ${totalKeys} translation strings. Processing sequential serverless micro-batches...`);

      // We process the HTML template file content sequentially in tiny chunks
      let currentHtmlState = rawHtmlContent;
      const batchSize = 10; 

      for (let i = 0; i < totalKeys; i += batchSize) {
        const batchKeys = keys.slice(i, i + batchSize);
        const dynamicTargetDict = {};
        const dynamicSourceDict = {};

        batchKeys.forEach(key => {
          dynamicTargetDict[key] = targetDict[key];
          dynamicSourceDict[key] = sourceDict[key];
        });

        const progressPercent = Math.min(100, Math.round(((i + batchKeys.length) / totalKeys) * 100));
        setStatus(`⏳ Running micro-batch ${Math.floor(i / batchSize) + 1} (${progressPercent}%) - Bypassing serverless limits...`);

        // Send short, fast JSON requests that resolve safely in 1-2 seconds
        const response = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            htmlSource: currentHtmlState,
            targetDict: dynamicTargetDict,
            sourceDict: dynamicSourceDict,
            brandCode,
            targetLang
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'The serverless worker failed to translate batch fragment.');
        }

        const data = await response.json();
        currentHtmlState = data.translatedHtml; // Carry the updated HTML state into the next batch iteration pass
      }

      // Convert final fully processed HTML string data back to a client-side file download object trigger
      const fileBlob = new Blob([currentHtmlState], { type: 'text/html;charset=utf-8;' });
      const downloadUrl = window.URL.createObjectURL(fileBlob);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.href = downloadUrl;
      downloadAnchor.download = `${targetLang}_translated_email.html`;
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      setStatus('🚀 Success! Email template successfully translated and downloaded via browser orchestrated pipeline.');
    } catch (err) {
      setStatus(`❌ Optimization Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-6">
      <div className="max-w-2xl w-full bg-slate-900 border border-slate-800 shadow-2xl rounded-2xl p-8">
        
        <div className="mb-6">
          <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-indigo-400 mb-2">
            📬 Next.js Email Translator
          </h1>
          <p className="text-slate-400 text-xs">
            Fullstack Node.js Processing Workflow: Parses HTML structures into structural AST objects to securely swap out textual targets while keeping responsive rules safe.
          </p>
        </div>

        <form onSubmit={executeTranslationSequence} className="space-y-6">
          {/* FILE ATTACHMENT HUB */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800">
              <label className="block text-xs uppercase font-bold tracking-wider text-slate-400 mb-2">
                1. Upload translations.json
              </label>
              <input 
                required 
                id="jsonUpload" 
                type="file" 
                accept=".json" 
                className="w-full text-xs text-slate-400 file:mr-4 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 cursor-pointer" 
              />
            </div>
            
            <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800">
              <label className="block text-xs uppercase font-bold tracking-wider text-slate-400 mb-2">
                2. Upload English HTML Template
              </label>
              <input 
                required 
                id="htmlUpload" 
                type="file" 
                accept=".html,.htm" 
                className="w-full text-xs text-slate-400 file:mr-4 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 cursor-pointer" 
              />
            </div>
          </div>

          {/* ATTRIBUTE METADATA CRITERIA */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase font-bold tracking-wider text-slate-400 mb-1">
                Target Language Dialect Key
              </label>
              <input 
                type="text" 
                value={targetLang} 
                onChange={(e) => setTargetLang(e.target.value.toUpperCase())} 
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 p-2.5 text-sm rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition" 
                placeholder="e.g. BEFR, BENL, LUFR"
              />
            </div>
            
            <div>
              <label className="block text-xs uppercase font-bold tracking-wider text-slate-400 mb-1">
                Brand Identity Code
              </label>
              <input 
                type="text" 
                value={brandCode} 
                onChange={(e) => setBrandCode(e.target.value.toUpperCase())} 
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 p-2.5 text-sm rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition" 
                placeholder="e.g. AP"
              />
            </div>
          </div>

          {/* RUN LOGIC TRIGGER */}
          <button 
            type="submit" 
            disabled={loading} 
            className="w-full py-3 bg-gradient-to-r from-emerald-500 to-indigo-600 text-white font-bold rounded-lg shadow-lg hover:brightness-110 active:scale-[0.99] transition disabled:opacity-50 cursor-pointer text-sm uppercase tracking-wider"
          >
            {loading ? '⏳ Processing Batch Arrays...' : '🚀 Generate Translated Email Layout'}
          </button>
        </form>

        {/* LOG SYSTEM INPUT MONITOR */}
        <div className="mt-6 p-4 bg-slate-950 border border-slate-850 font-mono text-xs rounded-lg text-emerald-400 whitespace-pre-line">
          {status}
        </div>
      </div>
    </main>
  );
}