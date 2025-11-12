import React, { useState, useEffect, useCallback } from 'react';
import { collection, writeBatch, doc } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js';
import { db } from '../firebase-config';
import type { VideoFile } from '../types';
import { XIcon, UploadIcon, CheckIcon, SparklesIcon, RefreshIcon, KeyIcon } from './Icons';
import { Spinner } from './Spinner';
import { enhanceVideoMetadata, isApiKeyAvailable, setApiKey as saveApiKeyToService } from '../services/geminiService';

interface UploadPanelProps {
  onClose: () => void;
}

type Status = 'idle' | 'file-selected' | 'processing' | 'enhancing' | 'error' | 'success';
type RowStatus = 'pending' | 'enhancing' | 'retrying' | 'enhanced' | 'error';

interface ParsedRow {
  original: Record<string, string>;
  enhanced: Partial<Omit<VideoFile, 'id' | 'url' | 'thumbnail'>>;
  status: RowStatus;
  errorMessage?: string;
}

// Map of Backblaze region codes to S3-compatible region names.
const B2_REGION_MAP: { [key: string]: string } = {
  '000': 'us-west-000',
  '001': 'us-west-001',
  '002': 'us-west-002',
  '003': 'eu-central-003',
  '004': 'us-west-004',
  '005': 'ap-southeast-005',
};

// Custom encoder for Backblaze B2 friendly URLs.
// B2 expects spaces to be encoded as '+' and preserves '/' for folders.
const encodeB2Filename = (filename: string): string => {
  return filename.split('/').map(segment => 
      encodeURIComponent(segment).replace(/%20/g, '+')
  ).join('/');
};

export const UploadPanel: React.FC<UploadPanelProps> = ({ onClose }) => {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [b2UrlPrefix, setB2UrlPrefix] = useState('');
  const [prefixWarning, setPrefixWarning] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [errorMessages, setErrorMessages] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [isGeminiAvailable, setIsGeminiAvailable] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');

  useEffect(() => {
    const savedPrefix = localStorage.getItem('b2UrlPrefix');
    if (savedPrefix) setB2UrlPrefix(savedPrefix);
    setIsGeminiAvailable(isApiKeyAvailable());
  }, []);

  const handlePrefixChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPrefix = e.target.value;
    setB2UrlPrefix(newPrefix);
    
    // Auto-correction logic: If the user pastes a Friendly URL, convert it to the S3 URL.
    const friendlyUrlRegex = /^(https?:\/\/f(\d{3})\.backblazeb2\.com)\/file\/([^\/]+)\/?/;
    const match = newPrefix.trim().match(friendlyUrlRegex);

    if (match) {
        const regionCode = match[2];
        const bucketName = match[3];
        const region = B2_REGION_MAP[regionCode];
        if (region) {
            const s3Prefix = `https://${bucketName}.s3.${region}.backblazeb2.com/`;
            setB2UrlPrefix(s3Prefix);
            localStorage.setItem('b2UrlPrefix', s3Prefix);
            setPrefixWarning(`Friendly URL detected and auto-corrected to the required S3 URL format.`);
        } else {
            localStorage.setItem('b2UrlPrefix', newPrefix);
            setPrefixWarning(`Warning: This looks like a Friendly URL with an unknown region code. Please use the S3 URL from your bucket settings.`);
        }
    } else {
        localStorage.setItem('b2UrlPrefix', newPrefix);
        setPrefixWarning(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === 'text/csv') {
      setCsvFile(selectedFile);
      setStatus('file-selected');
      setErrorMessages([]);
    } else {
      setCsvFile(null);
      setStatus('idle');
      setErrorMessages(['Please select a valid .csv file.']);
    }
  };

  const parseCSV = (text: string): Record<string, string>[] => {
    const lines = text.trim().replace(/\r\n/g, '\n').split('\n');
    if (lines.length < 2) throw new Error("CSV file must have a header and at least one data row.");
    
    const parseCsvLine = (line: string): string[] => {
      const fields: string[] = [];
      let currentField = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (inQuotes) {
          if (char === '"') {
            if (i < line.length - 1 && line[i + 1] === '"') {
              currentField += '"'; i++;
            } else {
              inQuotes = false;
            }
          } else {
            currentField += char;
          }
        } else {
          if (char === ',') {
            fields.push(currentField); currentField = '';
          } else if (char === '"' && currentField.length === 0) {
            inQuotes = true;
          } else {
            currentField += char;
          }
        }
      }
      fields.push(currentField);
      return fields;
    };

    const header = parseCsvLine(lines[0]).map(h => h.trim());
    const rows = lines.slice(1)
      .filter(line => line.trim() !== '')
      .map((line, index) => {
        const values = parseCsvLine(line);
        if (values.length !== header.length) {
          throw new Error(`Row ${index + 2}: Column count mismatch. Expected ${header.length}, but found ${values.length}.`);
        }
        const rowObject: Record<string, string> = {};
        header.forEach((key, i) => {
          rowObject[key] = values[i] || '';
        });
        return rowObject;
      });
    if (rows.length === 0) throw new Error("CSV file contains a header but no data rows.");
    return rows;
  };

  const processFile = useCallback(() => {
    if (!csvFile) return;
    setStatus('processing');
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const rows = parseCSV(text);
        setParsedRows(rows.map(row => ({ original: row, enhanced: {}, status: 'pending' })));
        setProgress({ current: 0, total: rows.length });
      } catch (e: any) {
        setErrorMessages([e.message]);
        setStatus('error');
      }
    };
    reader.readAsText(csvFile);
  }, [csvFile]);

  useEffect(() => {
    if (status === 'file-selected') {
      processFile();
    }
  }, [status, processFile]);
  
  const handleSaveApiKey = () => {
    if (apiKeyInput.trim()) {
      saveApiKeyToService(apiKeyInput.trim());
      setIsGeminiAvailable(true); // Update UI to show the 'Enhance' button
      setApiKeyInput(''); // Clear the input field
    }
  };

  const handleEnhance = async () => {
    setStatus('enhancing');
    const itemsToProcess = parsedRows
      .map((_, index) => index)
      .filter(i => parsedRows[i].status !== 'enhanced');
    setProgress({ current: parsedRows.length - itemsToProcess.length, total: parsedRows.length });
    
    // Reduced concurrency to 2 to avoid overwhelming the API with requests.
    const CONCURRENT_LIMIT = 2;
    const queue = [...itemsToProcess];
  
    const worker = async () => {
      while (queue.length > 0) {
        const i = queue.shift();
        if (i === undefined) return;
  
        // 1. Set status to 'enhancing'
        setParsedRows(current => current.map((r, idx) => i === idx ? { ...r, status: 'enhancing', errorMessage: undefined } : r));
  
        try {
          const rowToProcess = parsedRows[i];
          const title = rowToProcess.original.title || rowToProcess.original.filename || '';
          const keywords = rowToProcess.original.keywords ? rowToProcess.original.keywords.split(/[,;]/).map(kw => kw.trim()).filter(Boolean) : [];
  
          if (!title) throw new Error("Missing 'title' or 'filename'.");
  
          let enhancedData;
          const maxRetries = 3;
          for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
              enhancedData = await enhanceVideoMetadata({ title, keywords });
              break; // Success
            } catch (error) {
              if (attempt === maxRetries) throw error; // Final attempt failed, re-throw
              
              // Increased delay with more backoff to handle rate limiting more gracefully.
              const delay = 2000 * Math.pow(2, attempt - 1) + Math.random() * 1000;
              // 2. Set status to 'retrying'
              setParsedRows(current => current.map((r, idx) => i === idx ? { ...r, status: 'retrying', errorMessage: `Retry ${attempt}/${maxRetries}` } : r));
              await new Promise(resolve => setTimeout(resolve, delay));
              // 3. Set status back to 'enhancing' for next attempt
              setParsedRows(current => current.map((r, idx) => i === idx ? { ...r, status: 'enhancing', errorMessage: undefined } : r));
            }
          }
  
          if (!enhancedData) throw new Error("Enhancement failed after all retries.");
          
          // 4. Set status to 'enhanced' on success
          setParsedRows(current => current.map((r, idx) => i === idx ? { ...r, status: 'enhanced', enhanced: enhancedData } : r));
        
        } catch (error: any) {
          // 5. Set status to 'error' on final failure
          setParsedRows(current => current.map((r, idx) => i === idx ? { ...r, status: 'error', errorMessage: error.message || "Unknown error" } : r));
        } finally {
          setProgress(p => ({ ...p, current: p.current + 1 }));
        }
      }
    };
  
    const workers = Array(CONCURRENT_LIMIT).fill(null).map(() => worker());
    await Promise.all(workers);
  
    setStatus('processing');
  };
  
  const handleRetryEnhance = async (index: number) => {
    // Set status to 'enhancing' for the specific row
    setParsedRows(current => current.map((r, idx) => index === idx ? { ...r, status: 'enhancing', errorMessage: undefined } : r));

    try {
      const rowToProcess = parsedRows[index];
      const title = rowToProcess.original.title || rowToProcess.original.filename || '';
      const keywords = rowToProcess.original.keywords ? rowToProcess.original.keywords.split(/[,;]/).map(kw => kw.trim()).filter(Boolean) : [];
      if (!title) throw new Error("Missing 'title' or 'filename'.");

      let enhancedData;
      const maxRetries = 3;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
              enhancedData = await enhanceVideoMetadata({ title, keywords });
              break;
          } catch (error) {
              if (attempt === maxRetries) throw error;
              // Increased delay with more backoff to handle rate limiting more gracefully.
              const delay = 2000 * Math.pow(2, attempt - 1) + Math.random() * 1000;
              setParsedRows(current => current.map((r, idx) => index === idx ? { ...r, status: 'retrying', errorMessage: `Retry ${attempt}/${maxRetries}` } : r));
              await new Promise(resolve => setTimeout(resolve, delay));
              setParsedRows(current => current.map((r, idx) => index === idx ? { ...r, status: 'enhancing', errorMessage: undefined } : r));
          }
      }
      
      if (!enhancedData) throw new Error("Enhancement failed after all retries.");

      setParsedRows(current => current.map((r, idx) => index === idx ? { ...r, status: 'enhanced', enhanced: enhancedData } : r));
    } catch (error: any) {
      setParsedRows(current => current.map((r, idx) => index === idx ? { ...r, status: 'error', errorMessage: error.message || "Unknown error" } : r));
    }
  };

  const handleImport = async () => {
    if (!parsedRows.length || !b2UrlPrefix.trim() || !db) {
      setErrorMessages(['Data is not ready or URL prefix is missing.']);
      setStatus('error');
      return;
    }

    setStatus('processing');
    setProgress({ current: 0, total: parsedRows.length });

    try {
      const batch = writeBatch(db);
      const urlPrefix = b2UrlPrefix.endsWith('/') ? b2UrlPrefix : b2UrlPrefix + '/';

      for (let i = 0; i < parsedRows.length; i++) {
        const { original, enhanced } = parsedRows[i];
        
        if (!original.filename) {
            console.warn(`Skipping row ${i + 2} due to missing 'filename'.`);
            continue;
        }

        const isFree = original.isFree?.toLowerCase() === 'true';
        const videoUrl = `${urlPrefix}${encodeB2Filename(original.filename)}`;

        // New robust thumbnail URL logic
        const videoFilenameWithoutExt = original.filename.substring(0, original.filename.lastIndexOf('.'));
        const thumbnailFilename = `thumbnails/${videoFilenameWithoutExt}.jpg`;
        const thumbnailUrl = `${urlPrefix}${encodeB2Filename(thumbnailFilename)}`;


        const videoDoc: Omit<VideoFile, 'id'> = {
          url: videoUrl,
          thumbnail: thumbnailUrl,
          title: original.title || enhanced.title || 'Untitled',
          description: enhanced.description || original.description || 'No description available.',
          keywords: enhanced.keywords || (original.keywords ? original.keywords.split(/[,;]/).map(kw => kw.trim()).filter(Boolean) : []),
          categories: enhanced.categories || (original.categories ? original.categories.split(/[,;]/).map(cat => cat.trim()).filter(Boolean) : []),
          price: isFree ? 0 : parseFloat(original.price) || 5.00,
          isFree: isFree,
          commercialAppeal: enhanced.commercialAppeal || parseInt(original.commercialAppeal, 10) || 75,
          isFeatured: original.isFeatured?.toLowerCase() === 'true',
          createdAt: Date.now() - i,
          width: parseInt(original.width, 10) || 1920,
          height: parseInt(original.height, 10) || 1080,
        };

        const newVideoRef = doc(collection(db, "videos"));
        batch.set(newVideoRef, videoDoc);
        setProgress(prev => ({ ...prev, current: i + 1 }));
      }

      await batch.commit();
      setStatus('success');
    } catch (error: any) {
      console.error("Import failed:", error);
      setErrorMessages([error.message || 'An unknown error occurred. Check console.']);
      setStatus('error');
    }
  };

  const renderContent = () => {
    if (status === 'success') {
      return (
        <div className="text-center p-8">
            <CheckIcon className="w-16 h-16 text-green-400 mx-auto" />
            <h3 className="mt-4 text-2xl font-bold text-white">Import Complete!</h3>
            <p className="mt-2 text-gray-300">{progress.total} videos have been successfully added.</p>
            <button
                onClick={onClose}
                className="mt-6 w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors"
            >
                Close
            </button>
        </div>
      );
    }
    
    if (status === 'processing' || status === 'enhancing') {
      if (parsedRows.length > 0 && status !== 'enhancing') {
        return (
          <div className="p-6">
            <h3 className="text-lg font-semibold text-white">Data Preview ({parsedRows.length} videos)</h3>
            <p className="text-sm text-gray-400 mb-4">Review your data below. Use the AI enhancer to automatically generate metadata.</p>
            <div className="max-h-80 overflow-y-auto bg-gray-900/50 rounded-md border border-gray-700">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-300 uppercase bg-gray-700 sticky top-0">
                  <tr>
                    <th scope="col" className="px-4 py-2">Title</th>
                    <th scope="col" className="px-4 py-2">Description</th>
                    <th scope="col" className="px-4 py-2">Categories</th>
                    <th scope="col" className="px-4 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.map((row, i) => (
                    <tr key={i} className="border-b border-gray-700">
                      <td className="px-4 py-2 truncate max-w-xs">{row.enhanced.title || row.original.title}</td>
                      <td className="px-4 py-2 truncate max-w-xs text-gray-400">{row.enhanced.description || row.original.description || ''}</td>
                      <td className="px-4 py-2 truncate max-w-xs text-gray-400">{(row.enhanced.categories || (row.original.categories ? row.original.categories.split(/[,;]/).map(c=>c.trim()) : [])).join(', ')}</td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          {row.status === 'pending' && (
                            <span className="text-xs text-gray-500 italic">Queued</span>
                          )}
                          {(row.status === 'enhancing' || row.status === 'retrying') && (
                            <>
                              <Spinner className="w-4 h-4" />
                              <span className="text-xs text-gray-400 italic">
                                {row.status === 'retrying' ? row.errorMessage || 'Retrying...' : 'Enhancing...'}
                              </span>
                            </>
                          )}
                          {row.status === 'enhanced' && (
                            <span className="px-2 py-1 text-xs rounded-full bg-green-800 text-green-300">
                              enhanced
                            </span>
                          )}
                          {row.status === 'error' && (
                            <>
                              <span 
                                className="px-2 py-1 text-xs rounded-full bg-red-800 text-red-300 cursor-help"
                                title={row.errorMessage}
                              >
                                failed
                              </span>
                              <button 
                                onClick={() => handleRetryEnhance(i)} 
                                className="p-1 text-gray-400 hover:text-white rounded-full hover:bg-gray-600 transition-colors" 
                                aria-label="Retry enhancement"
                                title="Retry enhancement"
                              >
                                <RefreshIcon className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      }
      return (
        <div className="text-center p-8 space-y-4">
          <Spinner className="w-12 h-12" />
          <p className="text-lg text-gray-300">{status === 'enhancing' ? 'Enhancing metadata with AI...' : 'Processing file...'}</p>
          <p className="text-2xl font-mono text-indigo-400">{progress.current} / {progress.total}</p>
          <div className="w-full bg-gray-700 rounded-full h-2.5">
            <div className="bg-indigo-600 h-2.5 rounded-full" style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}></div>
          </div>
           {status === 'enhancing' && (
            <p className="text-xs text-gray-500 pt-2">
              Processing in small batches to ensure reliability. This may take several minutes for large lists.
            </p>
          )}
        </div>
      );
    }

    return (
      <div className="p-6 space-y-4">
        <div className="text-center">
            <SparklesIcon className="w-12 h-12 text-indigo-400 mx-auto" />
            <h3 className="mt-2 text-xl font-bold text-white">Bulk Import from CSV</h3>
            <p className="text-sm text-gray-400">Upload your videos to Backblaze, then import their metadata here.</p>
        </div>
        <div>
          <label htmlFor="b2UrlPrefix" className="block text-sm font-medium text-gray-300 mb-1">1. Backblaze B2 S3 URL Prefix</label>
          <input
            id="b2UrlPrefix"
            type="text"
            placeholder="e.g., https://your-bucket.s3.us-west-002.backblazeb2.com/"
            className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white"
            value={b2UrlPrefix}
            onChange={handlePrefixChange}
          />
          {prefixWarning && (
            <p className="text-xs text-yellow-400 mt-1 p-2 bg-yellow-900/30 border border-yellow-500/30 rounded-md">{prefixWarning}</p>
          )}
           <p className="text-xs text-gray-400 mt-1">
            <strong>Important:</strong> In your B2 bucket details, copy the <strong>S3 URL</strong>, not the Friendly URL. The system will attempt to auto-correct it for you.
          </p>
        </div>
        <div>
          <label htmlFor="file-upload" className="block text-sm font-medium text-gray-300 mb-1">2. Upload Metadata CSV</label>
          <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-600 border-dashed rounded-md">
            <div className="space-y-1 text-center">
              <UploadIcon className="mx-auto h-12 w-12 text-gray-500" />
              <div className="flex text-sm text-gray-400">
                <label htmlFor="file-upload" className="relative cursor-pointer bg-gray-800 rounded-md font-medium text-indigo-400 hover:text-indigo-300">
                  <span>Select a CSV file</span>
                  <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleFileChange} accept=".csv,text/csv" />
                </label>
              </div>
              {csvFile ? (
                <p className="text-xs text-green-400">{csvFile.name}</p>
              ) : (
                <p className="text-xs text-gray-500">Must be a .csv file</p>
              )}
            </div>
          </div>
           <div className="text-xs text-gray-500 mt-2 p-3 bg-gray-900/50 rounded-md border border-gray-700">
            <p className="font-bold text-gray-400 mb-1">CSV Column Guide:</p>
            <p><strong>Required:</strong> <code>filename</code>, <code>title</code>.</p>
            <p><strong>Optional:</strong> <code>description</code>, <code>keywords</code>, <code>categories</code>, <code>price</code>, <code>width</code>, <code>height</code>, <code>isFeatured</code>, <code>isFree</code>.</p>
           </div>
        </div>
      </div>
    );
  };
  
  const renderFooter = () => {
    if (status === 'idle' || status === 'success' || status === 'enhancing') {
      return null;
    }

    if (status === 'processing' && parsedRows.length > 0) {
       return (
         <div className="p-4 bg-gray-800/50 border-t border-gray-700 grid grid-cols-2 gap-4">
            {isGeminiAvailable ? (
                <button
                    onClick={handleEnhance}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-gray-600 hover:bg-gray-500 text-white font-bold rounded-lg transition-colors group"
                >
                    <SparklesIcon className="w-5 h-5 text-indigo-300" />
                    Enhance with AI
                </button>
            ) : (
                <div className="p-3 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
                    <label htmlFor="api-key-input" className="block text-xs font-medium text-yellow-300 mb-1">Set Gemini API Key to Enhance</label>
                    <div className="flex gap-2">
                        <div className="relative flex-grow">
                             <KeyIcon className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                            <input
                                type="password"
                                id="api-key-input"
                                value={apiKeyInput}
                                onChange={(e) => setApiKeyInput(e.target.value)}
                                placeholder="Paste API key here"
                                className="w-full pl-8 pr-2 py-1.5 text-sm bg-gray-900/50 border border-yellow-500/50 rounded-md focus:outline-none focus:ring-1 focus:ring-yellow-400 text-white"
                            />
                        </div>
                        <button
                            onClick={handleSaveApiKey}
                            disabled={!apiKeyInput.trim()}
                            className="px-3 py-1.5 text-sm bg-yellow-500 text-gray-900 font-bold rounded-md hover:bg-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 disabled:opacity-50"
                        >
                            Save
                        </button>
                    </div>
                </div>
            )}

            <button
                onClick={handleImport}
                className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors"
            >
                Import to Collection
            </button>
         </div>
      );
    }
    
    return (
      <div className="p-4 border-t border-gray-700">
         {errorMessages.length > 0 && (
             <div className="bg-red-900/50 text-red-300 p-3 rounded-md mb-4 text-sm space-y-1">
                 {errorMessages.map((msg, i) => <p key={i}><strong>Error:</strong> {msg}</p>)}
             </div>
         )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-4 border-b border-gray-700 flex-shrink-0">
          <h2 className="text-xl font-bold text-white">Bulk Video Importer</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <XIcon className="w-6 h-6" />
          </button>
        </div>
        
        <div className="overflow-y-auto">
            {renderContent()}
        </div>
        
        <div>
           {renderFooter()}
        </div>
      </div>
    </div>
  );
};
