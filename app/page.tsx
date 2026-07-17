'use client';
import { useState, FormEvent, ChangeEvent } from 'react';
import * as XLSX from 'xlsx';

export default function TranslatorWorkspace() {
  const [targetLang, setTargetLang] = useState<string>('BEFR');
  const [brandCode, setBrandCode] = useState<string>('AP');
  const [status, setStatus] = useState<string>('Workspace status: Idle / Ready');
  const [loading, setLoading] = useState<boolean>(false);
  const [excelRows, setExcelRows] = useState<any[] | null>(null);

  // ==========================================
  // COMPONENT WORKFLOW 1: SHEET MATRIX PARSING TO NESTED JSON
  // ==========================================
  const handleExcelUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buffer = new Uint8Array(await file.arrayBuffer());
      const book = XLSX.read(buffer, { type: 'array' });
      const rows = XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { header: 1, defval: "", blankrows: false });
      setExcelRows(rows as any[]);
      setStatus('✔️ Excel Matrix loaded successfully. Ready to convert.');
    } catch (err: any) {
      setStatus(`❌ Matrix Loading Error: ${err.message}`);
    }
  };

  const convertExcelToJson = () => {
    if (!excelRows) return alert("Please upload an Excel configuration sheet first.");
    setStatus('⏳ Processing spreadsheet matrix mapping structures...');
    
    try {
      let headerRowIdx = -1;
      for (let i = 0; i < excelRows.length; i++) {
        const row = excelRows[i].map((c: any) => String(c).trim().toUpperCase());
        if (row.some((cell: string) => cell === "GTINSIDERS" || cell === "BEFR" || cell === "BENL" || cell === "EN")) {
          headerRowIdx = i;
          break;
        }
      }
      if (headerRowIdx === -1) headerRowIdx = 0;

      const headers = excelRows[headerRowIdx].map((h: any) => String(h).trim().toUpperCase());
      const languages = headers.slice(1).filter(Boolean);
      const result: any = {};
      languages.forEach((lang: string) => { result[lang] = {}; });

      let currentBlock = "GLOBAL";
      const counter: any = {};

      for (let i = headerRowIdx + 1; i < excelRows.length; i++) {
        const row = excelRows[i];
        const field = String(row[0] || "").trim();
        if (!field) continue;

        if (/^BLOCK\s*\d+/i.test(field) || /^BLOC\s*\d+/i.test(field)) {
          currentBlock = field.replace(/\s+/g, "").toUpperCase();
          counter[currentBlock] = {};
          continue;
        }

        if (!counter[currentBlock]) counter[currentBlock] = {};
        let cleanField = field.replace(/\s+/g, "").replace(/[^\w]/g, "");

        counter[currentBlock][cleanField] = (counter[currentBlock][cleanField] || 0) + 1;
        if (counter[currentBlock][cleanField] > 1) cleanField += counter[currentBlock][cleanField];

        const key = currentBlock === "GLOBAL" ? cleanField : `${currentBlock}_${cleanField}`;

        languages.forEach((lang: string) => {
          const colIdx = headers.indexOf(lang);
          if (colIdx !== -1) {
            result[lang][key] = String(row[colIdx] || "").trim();
          }
        });
      }

      const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "translations.json";
      a.click();
      setStatus('🚀 Success! translations.json built and downloaded perfectly.');
    } catch (err: any) {
      setStatus(`❌ Matrix Conversion Error: ${err.message}`);
    }
  };

  // ==========================================
  // COMPONENT WORKFLOW 2: REWRITE EMAIL VIA BACKEND SERVER ROUTE
  // ==========================================
  const executeTranslationSequence = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setStatus('⏳ Running server AST processing loop framework...');

    const jsonInput = document.getElementById('jsonUpload') as HTMLInputElement;
    const htmlInput = document.getElementById('htmlUpload') as HTMLInputElement;

    if (!jsonInput?.files?.[0] || !htmlInput?.files?.[0]) {
      setStatus('❌ Error: Both HTML and JSON files must be selected.');
      setLoading(false);
      return;
    }

    const formData = new FormData();
    formData.append('jsonFile', jsonInput.files[0]);
    formData.append('htmlFile', htmlInput.files[0]);
    formData.append('targetLang', targetLang);
    formData.append('brandCode', brandCode);

    try {
      const response = await fetch('/api/translate', { method: 'POST', body: formData });

      // FIX: Insulated error text extractor to isolate server-side string drops safely
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'The server failed processing the template transformation.';
        try {
          const parsedError = JSON.parse(errorText);
          errorMessage = parsedError.error || errorMessage;
        } catch {
          errorMessage = errorText || `Server error status: ${response.status}`;
        }
        throw new Error(errorMessage);
      }

      const fileBlob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(fileBlob);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.href = downloadUrl;
      downloadAnchor.download = `${targetLang}_translated_email.html`;
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      setStatus('🚀 Complete! Precise style-safe layout file generated without text shifting errors.');
    } catch (err: any) {
      setStatus(`❌ Optimization Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-start p-6 gap-6">
      {/* BRAND LOGO WRAPPER - PLACED DIRECTLY AT TOP OUTSIDE THE MAIN CARD */}
      <div className="w-full max-w-2xl flex justify-center mt-4">
        <div className="w-30 h-30 flex items-center justify-center overflow-hidden">
          <img 
            src="/assets/logo.png" 
            alt="Brand Logo" 
            className="w-full h-full object-contain p-2" 
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }} 
          />
          {/* <span className="text-white font-black text-2xl tracking-tight pointer-events-none select-none">Σ</span> */}
        </div>
      </div>
      <div className="max-w-2xl w-full bg-slate-900 border border-slate-800 shadow-2xl rounded-2xl p-8 mt-5">
        <div className="mb-6">
          <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-indigo-400 mb-1">
            📬 Email Localization Studio
          </h1>
          <p className="text-slate-400 text-xs">
            Upload your translation matrix, generate your localization data, and download a production-ready HTML in just 2 simple steps.
          </p>
        </div>

        {/* WORKFLOW PIPELINE 1: EXCEL PROCESSING MODULE */}
        <div className="bg-slate-950/40 p-5 rounded-xl border border-slate-800 mb-6">
          <h3 className="text-sm font-bold text-teal-400 mb-3 uppercase tracking-wider">Step 1: Convert Excel Sheet to JSON Map</h3>
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <input 
              type="file" 
              accept=".xlsx, .xls, .csv" 
              onChange={handleExcelUpload}
              className="w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 cursor-pointer" 
            />
            <button 
              type="button" 
              onClick={convertExcelToJson}
              className="w-full sm:w-auto shrink-0 bg-teal-600 hover:bg-teal-700 text-slate-50 text-xs uppercase tracking-wider font-bold py-2 px-4 rounded transition"
            >
              Convert Matrix
            </button>
          </div>
        </div>

        <hr className="border-slate-800 my-4" />

        {/* WORKFLOW PIPELINE 2: TRANSFORMATION EXECUTION FORM */}
        <form onSubmit={executeTranslationSequence} className="space-y-6">
          <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider">Step 2: Generate Safe Translated HTML Template</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800">
              <label className="block text-xs uppercase font-bold tracking-wider text-slate-400 mb-2">Upload translations.json</label>
              <input required id="jsonUpload" type="file" accept=".json" className="w-full text-xs text-slate-400 file:mr-4 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 cursor-pointer" />
            </div>
            <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800">
              <label className="block text-xs uppercase font-bold tracking-wider text-slate-400 mb-2">Upload Original HTML Template</label>
              <input required id="htmlUpload" type="file" accept=".html,.htm" className="w-full text-xs text-slate-400 file:mr-4 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 cursor-pointer" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase font-bold tracking-wider text-slate-400 mb-1">Target Language Key</label>
              <input type="text" value={targetLang} onChange={(e) => setTargetLang(e.target.value.toUpperCase())} className="w-full bg-slate-950 border border-slate-800 text-slate-200 p-2.5 text-sm rounded-lg focus:ring-2 focus:ring-teal-500 outline-none transition" />
            </div>
            <div>
              <label className="block text-xs uppercase font-bold tracking-wider text-slate-400 mb-1">Brand Tracking Identity Code</label>
              <input type="text" value={brandCode} onChange={(e) => setBrandCode(e.target.value.toUpperCase())} className="w-full bg-slate-950 border border-slate-800 text-slate-200 p-2.5 text-sm rounded-lg focus:ring-2 focus:ring-teal-500 outline-none transition" />
            </div>
          </div>

          <button type="submit" disabled={loading} className="w-full py-3 bg-gradient-to-r from-teal-500 to-indigo-600 text-white font-bold rounded-lg shadow-lg hover:brightness-110 active:scale-[0.99] transition disabled:opacity-50 text-sm uppercase tracking-wider cursor-pointer">
            {loading ? '⏳ Rendering Unified Layout Tree...' : '🚀 Localize HTML Content Layout'}
          </button>
        </form>

        <div className="mt-6 p-4 bg-slate-950 border border-slate-850 font-mono text-xs rounded-lg text-teal-400 whitespace-pre-line">
          {status}
        </div>
          {/* INSERT THE NOTICE BADGE COMPONENT CODE RIGHT HERE */}
        <div className="mt-4 p-4.5 bg-amber-950/30 border border-amber-800/40 rounded-xl flex items-start gap-3">
          <span className="text-xl shrink-0 select-none">⚠️</span>
          <div>
            <h4 className="text-amber-400 text-xs uppercase font-black tracking-wider mb-0.5">
              Production Quality Assurance Notice
            </h4>
            <p className="text-slate-300 text-xs leading-relaxed">
              Automated translation systems can occasionally introduce structural irregularities, missing phrase pairings, or text formatting shifts. **Always manually verify the translated HTML file layout inside your template testing environment before scheduling deployment channels.**
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}