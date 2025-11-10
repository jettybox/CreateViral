import React, { useState, useEffect } from 'react';
import { collection, writeBatch, doc } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js';
import { db } from '../firebase-config';
import type { VideoFile } from '../types';
import { XIcon, UploadIcon, CheckIcon, SparklesIcon } from './Icons';
import { Spinner } from './Spinner';

interface UploadPanelProps {
  onClose: () => void;
}

type Status = 'idle' | 'processing' | 'error' | 'success';

export const UploadPanel: React.FC<UploadPanelProps> = ({ onClose }) => {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [b2UrlPrefix, setB2UrlPrefix] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [errorMessages, setErrorMessages] = useState<string[]>([]);

  useEffect(() => {
    // Load the saved prefix from local storage for convenience
    const savedPrefix = localStorage.getItem('b2UrlPrefix');
    if (savedPrefix) {
      setB2UrlPrefix(savedPrefix);
    }
  }, []);

  const handlePrefixChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPrefix = e.target.value;
    setB2UrlPrefix(newPrefix);
    // Save to local storage so the user doesn't have to re-enter it
    localStorage.setItem('b2UrlPrefix', newPrefix);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === 'text/csv') {
      setCsvFile(selectedFile);
      setErrorMessages([]);
    } else {
      setCsvFile(null);
      setErrorMessages(['Please select a valid .csv file.']);
    }
  };

  const parseCSV = (text: string): { header: string[], rows: Record<string, string>[] } => {
    const lines = text.trim().replace(/\r\n/g, '\n').split('\n');
    if (lines.length < 2) throw new Error("CSV file must have a header and at least one data row.");
    
    /**
     * A robust CSV line parser that handles quoted fields, allowing for commas and escaped quotes within data.
     * For example, it can correctly parse a field like: "This is a title, with a comma"
     * @param {string} line - A single line from a CSV file.
     * @returns {string[]} An array of strings representing the fields.
     */
    const parseCsvLine = (line: string): string[] => {
      const fields: string[] = [];
      let currentField = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (inQuotes) {
          if (char === '"') {
            // Check for an escaped double quote ("")
            if (i < line.length - 1 && line[i + 1] === '"') {
              currentField += '"';
              i++; // Skip the next quote
            } else {
              inQuotes = false; // End of quoted field
            }
          } else {
            currentField += char;
          }
        } else {
          if (char === ',') {
            fields.push(currentField);
            currentField = '';
          } else if (char === '"' && currentField.length === 0) {
            // A quote should only start a quoted field if it's the first character of the field
            inQuotes = true;
          } else {
            currentField += char;
          }
        }
      }
      fields.push(currentField); // Add the last field
      return fields;
    };

    const header = parseCsvLine(lines[0]).map(h => h.trim());
    const rows = lines.slice(1)
      .filter(line => line.trim() !== '') // Ignore empty lines
      .map((line, index) => {
        const values = parseCsvLine(line);
        
        if (values.length !== header.length) {
          throw new Error(`Row ${index + 2}: Column count mismatch. Expected ${header.length} columns, but found ${values.length}. This can happen if a text field contains an unclosed quote mark (").`);
        }

        const rowObject: Record<string, string> = {};
        header.forEach((key, i) => {
          rowObject[key] = values[i] || '';
        });
        return rowObject;
      });
      
    if (rows.length === 0) {
        throw new Error("CSV file contains a header but no data rows.");
    }

    return { header, rows };
  };

  const handleImport = async () => {
    if (!csvFile || !b2UrlPrefix.trim() || !db) {
      setErrorMessages(['Please provide a CSV file and a valid URL prefix.']);
      return;
    }

    setStatus('processing');
    setErrorMessages([]);
    setProgress({ current: 0, total: 0 });

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const { rows } = parseCSV(text);
        setProgress({ current: 0, total: rows.length });

        // Use Firestore Batched Writes for efficiency and atomicity.
        const batch = writeBatch(db);
        
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            
            if (!row.filename || !row.title) {
                console.warn(`Skipping row ${i + 2} due to missing 'filename' or 'title'.`);
                continue;
            }

            const videoDoc: Omit<VideoFile, 'id' | 'thumbnail'> & { thumbnail?: string } = {
              url: `${b2UrlPrefix.endsWith('/') ? b2UrlPrefix : b2UrlPrefix + '/'}${row.filename}`,
              title: row.title,
              description: row.description || 'No description available.',
              keywords: row.keywords ? row.keywords.split(/[,;]/).map(kw => kw.trim()).filter(Boolean) : [],
              categories: row.categories ? row.categories.split(/[,;]/).map(cat => cat.trim()).filter(Boolean) : [],
              price: parseFloat(row.price) || 5.00,
              commercialAppeal: parseInt(row.commercialAppeal, 10) || 75,
              isFeatured: row.isFeatured?.toLowerCase() === 'true',
              createdAt: Date.now() - i, // Add a slight offset to maintain order
              width: parseInt(row.width, 10) || 1920,
              height: parseInt(row.height, 10) || 1080,
            };
            
            const newVideoRef = doc(collection(db, "videos"));
            batch.set(newVideoRef, videoDoc);
            setProgress(prev => ({ ...prev, current: i + 1 }));
        }

        await batch.commit();
        setStatus('success');

      } catch (error: any) {
        console.error("Import failed:", error);
        setErrorMessages([error.message || 'An unknown error occurred during parsing or saving. Check console.']);
        setStatus('error');
      }
    };
    
    reader.onerror = () => {
        setErrorMessages(['Failed to read the selected file.']);
        setStatus('error');
    };
    
    reader.readAsText(csvFile);
  };

  const renderContent = () => {
    if (status === 'success') {
        return (
            <div className="text-center p-8">
                <CheckIcon className="w-16 h-16 text-green-400 mx-auto" />
                <h3 className="mt-4 text-2xl font-bold text-white">Import Complete!</h3>
                <p className="mt-2 text-gray-300">{progress.total} videos have been successfully added to your collection.</p>
                <button
                    onClick={onClose}
                    className="mt-6 w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors"
                >
                    Close
                </button>
            </div>
        );
    }
    
    if (status === 'processing') {
      return (
        <div className="text-center p-8 space-y-4">
          <Spinner className="w-12 h-12" />
          <p className="text-lg text-gray-300">Importing videos...</p>
          <p className="text-2xl font-mono text-indigo-400">{progress.current} / {progress.total}</p>
          <div className="w-full bg-gray-700 rounded-full h-2.5">
            <div className="bg-indigo-600 h-2.5 rounded-full" style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}></div>
          </div>
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
          <label htmlFor="b2UrlPrefix" className="block text-sm font-medium text-gray-300 mb-1">1. Backblaze B2 Public URL Prefix</label>
          <input
            id="b2UrlPrefix"
            type="text"
            placeholder="e.g., https://f005.backblazeb2.com/file/your-bucket/"
            className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white"
            value={b2UrlPrefix}
            onChange={handlePrefixChange}
          />
        </div>
        <div>
          <label htmlFor="file-upload" className="block text-sm font-medium text-gray-300 mb-1">2. Upload Metadata CSV</label>
          <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-600 border-dashed rounded-md">
            <div className="space-y-1 text-center">
              <UploadIcon className="mx-auto h-12 w-12 text-gray-500" />
              <div className="flex text-sm text-gray-400">
                <label htmlFor="file-upload" className="relative cursor-pointer bg-gray-800 rounded-md font-medium text-indigo-400 hover:text-indigo-300 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-gray-800 focus-within:ring-indigo-500">
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
        </div>
      </div>
    );
  };
  
  const renderFooter = () => {
    if (status === 'idle' || status === 'error') {
       return (
         <div className="p-4">
            {errorMessages.length > 0 && (
                <div className="bg-red-900/50 text-red-300 p-3 rounded-md mb-4 text-sm space-y-1">
                    {errorMessages.map((msg, i) => <p key={i}><strong>Error:</strong> {msg}</p>)}
                </div>
            )}
            <button
                onClick={handleImport}
                disabled={!csvFile || !b2UrlPrefix.trim()}
                className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                Start Import
            </button>
         </div>
      );
    }
    
    return null;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-4 border-b border-gray-700 flex-shrink-0">
          <h2 className="text-xl font-bold text-white">Bulk Video Importer</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <XIcon className="w-6 h-6" />
          </button>
        </div>
        
        <div className="overflow-y-auto">
            {renderContent()}
        </div>
        
        <div className="border-t border-gray-700 flex-shrink-0">
           {renderFooter()}
        </div>
      </div>
    </div>
  );
};
