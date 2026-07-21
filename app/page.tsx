'use client';
import { useState, FormEvent, ChangeEvent } from 'react';
import * as XLSX from 'xlsx';
import dynamic from 'next/dynamic';

function TranslatorWorkspace() {
  // Navigation Tab State
  const [activeTab, setActiveTab] = useState<'translator' | 'controlGroup'>('translator');

  // Existing Workspace States
  const [targetLang, setTargetLang] = useState<string>('BEFR');
  const [brandCode, setBrandCode] = useState<string>('AP');
  const [status, setStatus] = useState<string>('Workspace status: Idle / Ready');
  const [loading, setLoading] = useState<boolean>(false);
  const [excelRows, setExcelRows] = useState<any[] | null>(null);
  
  // Feature 1 Added States
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');

  // Control Group Automator States
  const [cgEmails, setCgEmails] = useState<string>('');
  const [cgBrand, setCgBrand] = useState<string>('AP');
  const [cgCountry, setCgCountry] = useState<string>('IT');
  const [cgStatus, setCgStatus] = useState<string>('');

  // ==========================================
  // COMPONENT WORKFLOW 1: AGNOSTIC SHEET MATRIX PARSING TO NESTED JSON
  // ==========================================
  const handleExcelUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buffer = new Uint8Array(await file.arrayBuffer());
      const book = XLSX.read(buffer, { type: 'array' });
      const rows = XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { header: 1, defval: "", blankrows: true });
      setExcelRows(rows as any[]);
      setStatus('✔️ Excel Matrix loaded successfully. Ready to convert.');
    } catch (err: any) {
      setStatus(`❌ Matrix Loading Error: ${err.message}`);
    }
  };

  const convertExcelToJson = () => {
    if (!excelRows || excelRows.length === 0) {
      return alert("Please upload an Excel configuration sheet first.");
    }
    setStatus('⏳ Running universal cell block matrix parser layout sequence...');
    
    try {
      let headerRowIdx = -1;
      for (let i = 0; i < excelRows.length; i++) {
        if (excelRows[i]) {
          const rowValues = excelRows[i].map((c: any) => String(c).trim().toUpperCase().replace(/\s+/g, ''));
          const hasLanguageIndicators = rowValues.some((v: string) => v === 'EN' || v === 'BEFR' || v === 'BENL' || v === 'LUFR' || v === 'LANGUAGE');
          if (hasLanguageIndicators) {
            headerRowIdx = i;
            break;
          }
        }
      }
      
      if (headerRowIdx === -1) headerRowIdx = 0;

      const rawHeaders = excelRows[headerRowIdx];
      const headers = rawHeaders.map((h: any) => String(h || "").trim());
      
      const languages = headers.slice(1).filter((lang: string) => lang.length > 0);

      if (languages.length === 0) {
        throw new Error("Could not detect translation columns (e.g. EN, BEFR) in the sheet's header row structure.");
      }

      const result: any = {};
      languages.forEach((lang: string) => { 
        const cleanKey = lang.toUpperCase().replace(/\s+/g, '');
        result[cleanKey] = {}; 
      });

      for (let i = headerRowIdx + 1; i < excelRows.length; i++) {
        const row = excelRows[i];
        if (!row) continue;

        const isRowCompletelyEmpty = row.every((cell: any) => String(cell).trim() === "");
        if (isRowCompletelyEmpty) continue;

        const rawFieldLabel = String(row[0] || "").trim();
        
        if (rawFieldLabel.toLowerCase() === 'language' || rawFieldLabel.toLowerCase() === 'segmentation') continue;

        const uniqueFieldKey = rawFieldLabel ? `[Row ${i}] ${rawFieldLabel}` : `[Row ${i}] UNNAMED_BLOCK`;

        languages.forEach((lang: string) => {
          const colIdx = headers.indexOf(lang);
          if (colIdx !== -1 && row[colIdx] !== undefined) {
            const cleanKey = lang.toUpperCase().replace(/\s+/g, '');
            const cellValue = String(row[colIdx]).trim();
            
            if (cellValue.toLowerCase() !== 'nan' && cellValue !== "") {
              result[cleanKey][uniqueFieldKey] = cellValue;
            }
          }
        });
      }

      const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "translations.json";
      a.click();
      
      const totalKeysParsed = Object.keys(result)[0] ? Object.keys(result[Object.keys(result)[0]]).length : 0;
      setStatus(`🚀 Universal Extraction Success! Securely captured ${totalKeysParsed} unique rows across target dialects: [${languages.join(', ')}]`);
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
    setStatus('⏳ Running server template localization engine...');
    setPreviewHtml(''); 

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
    
    const sanitizedLang = targetLang.trim().toUpperCase().replace(/\s+/g, '');
    formData.append('targetLang', sanitizedLang);
    formData.append('brandCode', brandCode.trim().toUpperCase());

    try {
      const response = await fetch('/api/translate', { method: 'POST', body: formData });

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

      const htmlTextOutput = await response.text();
      setPreviewHtml(htmlTextOutput);
      setStatus('🚀 Engine processing complete! Live layout rendering now.');
    } catch (err: any) {
      setStatus(`❌ Optimization Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const downloadProcessedTemplate = () => {
    if (!previewHtml) return;
    const sanitizedLang = targetLang.trim().toUpperCase().replace(/\s+/g, '');
    const blob = new Blob([previewHtml], { type: 'text/html; charset=utf-8' });
    const downloadUrl = window.URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.href = downloadUrl;
    downloadAnchor.download = `${sanitizedLang}_translated_email.html`;
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // ==========================================
  // COMPONENT WORKFLOW 3: CONTROL GROUP CSV GENERATOR
  // ==========================================
  const generateControlGroupCSV = () => {
    if (!cgEmails.trim()) {
      setCgStatus('❌ Please paste at least one email address.');
      return;
    }

    // Split text area by line breaks, commas, semicolons, or spaces
    const rawInputs = cgEmails
      .split(/[\n,;\s]+/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    const parsedData: any[] = [];

    rawInputs.forEach((rawItem) => {
      // 1. Clean out brackets, arrows, and extraneous symbols
      // Strips: < > [ ] ( ) { } " ' -> =>
      let cleaned = rawItem
        .replace(/[<>\[\](){}"']/g, '')
        .replace(/(->|=>)/g, '')
        .trim();

      // Skip non-emails or pasted table header strings
      if (!cleaned.includes('@') || cleaned.toLowerCase().includes('subscriberkey')) {
        return;
      }

      const cleanEmail = cleaned.toLowerCase();
      const emailLocalPart = cleanEmail.split('@')[0];

      let firstName = 'Subscriber';
      let lastName = '';

      // Parse structures like christine.stensel@ / christine,stensel@ / christine_stensel@
      const matchDelimiter = emailLocalPart.match(/[.,_-]/);
      if (matchDelimiter) {
        const parts = emailLocalPart.split(matchDelimiter[0]);
        firstName = parts[0] || 'Subscriber';
        lastName = parts[1] || '';
      } else {
        firstName = emailLocalPart;
      }

      // Proper Title Case formatting
      firstName = firstName.charAt(0).toUpperCase() + firstName.slice(1);
      lastName = lastName ? lastName.charAt(0).toUpperCase() + lastName.slice(1) : '';

      // TABLE COLUMN HEADERS ARE STRICTLY ALL CAPITAL LETTERS ONLY
      parsedData.push({
        'SUBSCRIBERKEY': cleanEmail,
        'EMAIL': cleanEmail,
        'FIRSTNAME': firstName,
        'LASTNAME': lastName,
        'BRAND': cgBrand,
        'COUNTRY': cgCountry,
        'EMAILOPTIN': 'True',
        'SEGMENTTYPE': 'CG',
      });
    });

    if (parsedData.length === 0) {
      setCgStatus('❌ No valid email addresses detected in the text area after cleaning.');
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(parsedData);
    const csvOutput = XLSX.utils.sheet_to_csv(worksheet);

    // Append UTF-8 BOM Byte Order Mark (\uFEFF) to guarantee Excel & SFMC character encoding compatibility
    const blob = new Blob(['\uFEFF' + csvOutput], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ControlGroup_${cgBrand}_${cgCountry}_DataExtension.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setCgStatus(`🚀 Success! Cleaned and encoded ${parsedData.length} Control Group email record(s) into UTF-8 CSV.`);
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-start p-6 gap-6 w-full">
      <div className="w-full max-w-5xl flex justify-center mt-4">
        {/* Custom CSS injected inline to create the 30-second rotation interval rule */}
        <style>{`
          @keyframes slowPeriodicRotate {
            0%, 93% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          .animate-slow-rotate {
            animation: slowPeriodicRotate 10s infinite cubic-bezier(0.65, 0, 0.35, 1);
          }
        `}</style>

        <div className="w-32 h-32 flex items-center justify-center overflow-hidden transition-all duration-700 hover:scale-105">
          <img 
            src="/assets/logo.png" 
            alt="Brand Logo" 
            className="w-full h-full object-contain p-2 animate-slow-rotate" 
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }} 
          />
        </div>
      </div>

      {/* NAVIGATION TAB BAR */}
      <div className="flex items-center gap-3 border-b border-slate-800 pb-3 w-full max-w-5xl">
        <button
          onClick={() => setActiveTab('translator')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition ${
            activeTab === 'translator'
              ? 'bg-gradient-to-r from-teal-500 to-indigo-600 text-white shadow-lg'
              : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          📬 Email Localization Studio
        </button>

        <button
          onClick={() => setActiveTab('controlGroup')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition ${
            activeTab === 'controlGroup'
              ? 'bg-gradient-to-r from-teal-500 to-indigo-600 text-white shadow-lg'
              : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          👥 Control Group Automator
        </button>
      </div>

      {/* TAB 1: LOCALIZATION WORKSPACE */}
      {activeTab === 'translator' && (
        <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT WORKSPACE MODULE (Controls Form) */}
          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 shadow-2xl rounded-2xl p-6 space-y-6">
            <div>
              <h1 className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-indigo-400 mb-1">📬 Email Localization</h1>
              <p className="text-slate-400 text-xs">
                Upload your translation matrix, generate clean components, and preview structural results instantly.
              </p>
            </div>

            {/* STEP 1 CONTROLS */}
            <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800 space-y-3">
              <h3 className="text-xs font-bold text-teal-400 uppercase tracking-wider">Step 1: Excel Sheet to JSON Map</h3>
              <input 
                type="file" 
                accept=".xlsx,.xlsm,.xls,.csv" 
                onChange={handleExcelUpload}
                className="w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 cursor-pointer" 
              />
              <button 
                type="button" 
                onClick={convertExcelToJson}
                className="w-full bg-teal-600 hover:bg-teal-700 text-slate-50 text-xs uppercase tracking-wider font-bold py-2 px-4 rounded transition"
              >
                Convert Matrix
              </button>
            </div>

            {/* STEP 2 CONTROLS */}
            <form onSubmit={executeTranslationSequence} className="space-y-4">
              <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Step 2: Translate HTML Layout Template</h3>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">Upload translations.json</label>
                  <input required id="jsonUpload" type="file" accept=".json" className="w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 cursor-pointer" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">Upload English HTML</label>
                  <input required id="htmlUpload" type="file" accept=".html,.htm" className="w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 cursor-pointer" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">Target Language</label>
                  <input type="text" value={targetLang} onChange={(e) => setTargetLang(e.target.value)} className="w-full bg-slate-950 border border-slate-800 text-slate-200 p-2 text-xs rounded-lg focus:ring-1 focus:ring-teal-500 outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">Brand Identity</label>
                  <input type="text" value={brandCode} onChange={(e) => setBrandCode(e.target.value)} className="w-full bg-slate-950 border border-slate-800 text-slate-200 p-2 text-xs rounded-lg focus:ring-1 focus:ring-teal-500 outline-none" />
                </div>
              </div>

              <button type="submit" disabled={loading} className="w-full py-2.5 bg-gradient-to-r from-teal-500 to-indigo-600 text-white font-bold rounded-lg shadow-lg hover:brightness-110 active:scale-[0.99] transition disabled:opacity-50 text-xs uppercase tracking-wider cursor-pointer">
                {loading ? '⏳ Generating Preview...' : '🚀 Render Live Localization'}
              </button>
            </form>

            <div className="p-3 bg-slate-950 border border-slate-850 font-mono text-[11px] rounded-lg text-teal-400 whitespace-pre-line">
              {status}
            </div>
          </div>

          {/* RIGHT PREVIEW MODULE (Feature 1 Visual Pane) */}
          <div className="lg:col-span-7 flex flex-col bg-slate-900 border border-slate-800 shadow-2xl rounded-2xl overflow-hidden h-[630px]">
            
            {/* HEADER NAV CONTROL STRIP */}
            <div className="bg-slate-950/80 p-3 border-b border-slate-800 flex items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                <span className="text-slate-400 text-xs font-mono ml-2 select-none">Live Canvas Sandbox Preview</span>
              </div>
              
              {previewHtml && !loading && (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setViewMode('desktop')} 
                    className={`px-2.5 py-1 rounded text-xs transition font-medium ${viewMode === 'desktop' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                  >
                    🖥️ Desktop
                  </button>
                  <button 
                    onClick={() => setViewMode('mobile')} 
                    className={`px-2.5 py-1 rounded text-xs transition font-medium ${viewMode === 'mobile' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                  >
                    📱 Mobile
                  </button>
                  <button 
                    onClick={downloadProcessedTemplate}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-1 px-3 rounded transition flex items-center gap-1"
                  >
                    📥 Export HTML
                  </button>
                </div>
              )}
            </div>

            {/* ACTIVE SANDBOX SCREEN CANVAS BLOCK */}
            <div className="flex-1 bg-slate-950 flex justify-center items-center overflow-auto p-4 pattern-grid position-relative">
              {loading ? (
                /* DYNAMIC NEON LOADER ANIMS PANE */
                <div className="flex flex-col items-center justify-center space-y-4 text-center">
                  <div className="relative w-16 h-16">
                    <div className="absolute inset-0 rounded-full border-4 border-indigo-500/20"></div>
                    <div className="absolute inset-0 rounded-full border-4 border-t-indigo-400 border-r-teal-400 animate-spin shadow-[0_0_15px_rgba(99,102,241,0.5)]"></div>
                    <div className="absolute top-2 right-2 bottom-2 left-2 rounded-full border-2 border-slate-800 border-b-teal-400 animate-[spin_1s_linear_infinite_reverse]"></div>
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-indigo-400 animate-pulse">
                      🏗️ Building your email structure...
                    </h4>
                    <p className="text-[10px] text-slate-500 font-mono">☕ Grab a coffee while we do the heavy lifting...</p>
                  </div>
                </div>
              ) : previewHtml ? (
                <div 
                  className="h-full bg-white rounded-lg shadow-xl overflow-hidden transition-all duration-300"
                  style={{ width: viewMode === 'desktop' ? '100%' : '375px' }}
                >
                  <iframe 
                    title="Localized Email Template Render Output"
                    srcDoc={previewHtml}
                    className="w-full h-full border-0 bg-white"
                    sandbox="allow-same-origin allow-popups"
                  />
                </div>
              ) : (
                <div className="text-center text-red-500 max-w-xs space-y-2">
                  <span className="text-4xl block select-none">🎨</span>
                  <h4 className="font-bold text-xs uppercase tracking-wider text-red-400">Visual Sandbox Empty</h4>
                  <p className="text-[11px] leading-relaxed text-red-500">
                    Run Step 1 and Step 2. Your localized template layout will instantly populate an interactively testable frame here.
                  </p>
                </div>
              )}
            </div>
            
            <div className="mt-4 p-4.5 bg-amber-950/30 border border-amber-800/40 rounded-xl flex items-start gap-3 m-4 shrink-0">
              <span className="text-xl shrink-0 select-none">⚠️</span>
              <div>
                <h4 className="text-amber-400 text-xs uppercase font-black tracking-wider mb-0.5">
                  Production Quality Assurance Notice
                </h4>
                <p className="text-slate-300 text-xs leading-relaxed">
                  Automated translation <span className='text-red-400'>systems can occasionally introduce structural irregularities, missing phrase pairings, or text formatting shifts. **Always manually verify the translated HTML file layout inside your template</span> testing environment before deployment channels.**
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CONTROL GROUP CSV AUTOMATOR */}
      {activeTab === 'controlGroup' && (
        <div className="max-w-2xl w-full bg-slate-900 border border-slate-800 shadow-2xl rounded-2xl p-6 space-y-6">
          <div>
            <h2 className="text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-indigo-400 mb-1">
              👥 Jira Control Group CSV Automator
            </h2>
            <p className="text-slate-400 text-xs">
              Paste Jira email comments, pick your brand and country, and generate standard Data Extension UTF-8 CSV exports.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">
                Paste Jira Control Group Emails
              </label>
              <textarea
                value={cgEmails}
                onChange={(e) => setCgEmails(e.target.value)}
                rows={8}
                placeholder="Paste email addresses from your Jira ticket here:&#10;Shubham.shinde@gmail.com&#10;john.doe@brand.com&#10;<alice_smith@company.org>"
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 p-3 font-mono text-xs rounded-xl focus:ring-1 focus:ring-teal-500 outline-none resize-y"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">
                  Select Brand
                </label>
                <select
                  value={cgBrand}
                  onChange={(e) => setCgBrand(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 p-2.5 text-xs rounded-xl focus:ring-1 focus:ring-teal-500 outline-none cursor-pointer"
                >
                  <option value="AP">AP</option>
                  <option value="AC">AC</option>
                  <option value="DS">DS</option>
                  <option value="OP">OP</option>
                  <option value="VX">VX</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">
                  Select Country Code
                </label>
                <select
                  value={cgCountry}
                  onChange={(e) => setCgCountry(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 p-2.5 text-xs rounded-xl focus:ring-1 focus:ring-teal-500 outline-none cursor-pointer"
                >
                  <option value="IT">IT</option>
                  <option value="AT">AT</option>
                  <option value="DE">DE</option>
                  <option value="GB">GB</option>
                  <option value="FR">FR</option>
                  <option value="PT">PT</option>
                  <option value="PL">PL</option>
                  <option value="ES">ES</option>
                  <option value="NL">NL</option>
                </select>
              </div>
            </div>

            <button
              onClick={generateControlGroupCSV}
              className="w-full py-3 bg-gradient-to-r from-teal-500 to-indigo-600 hover:brightness-110 text-white font-bold rounded-xl shadow-lg transition text-xs uppercase tracking-wider cursor-pointer"
            >
              🚀 Convert & Export UTF-8 CSV File
            </button>

            {cgStatus && (
              <div className="p-3 bg-slate-950 border border-slate-800 font-mono text-[11px] rounded-lg text-teal-400 whitespace-pre-line">
                {cgStatus}
              </div>
            )}
          </div>
        </div>
      )}

      {/* PORTFOLIO FOOTER */}
      <div className="mt-auto p-4 w-full flex flex-col items-center justify-center text-center shrink-0">
        <div className="flex items-center gap-2 bg-amber-950/20 border border-amber-850/40 px-4 py-2 rounded-xl backdrop-blur-sm">
          <span className="text-sm select-none animate-pulse">❤️</span>
          <span className="text-slate-400 font-mono text-[11px] tracking-wide">
            Made with love in India by <strong className="text-teal-400 font-semibold font-sans"><a target='_blank' href="https://shubhamshinde097.netlify.app/" title="portfolio">@ShUbHAm</a></strong>
          </span>
        </div>
      </div>
    </main>
  );
}

export default dynamic(() => Promise.resolve(TranslatorWorkspace), { ssr: false });