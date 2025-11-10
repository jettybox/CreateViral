import React, { useState, useCallback } from 'react';
import { collection, addDoc } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js';
import { db } from '../firebase-config';
import { useVideoProcessor } from '../hooks/useVideoProcessor';
import { analyzeVideoContent, isApiKeyAvailable } from '../services/geminiService';
import { VideoFile } from '../types';
import { CATEGORIES } from '../constants';
import { XIcon, UploadIcon, SparklesIcon, CheckIcon } from './Icons';
import { Spinner } from './Spinner';

interface UploadPanelProps {
  onClose: () => void;
}

type Status = 'idle' | 'extracting' | 'analyzing' | 'reviewing' | 'saving' | 'error' | 'success';

const formInputClass = "w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white disabled:opacity-50";
const formLabelClass = "block text-sm font-medium text-gray-300 mb-1";

export const UploadPanel: React.FC<UploadPanelProps> = ({ onClose }) => {
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [progressMessage, setProgressMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [videoData, setVideoData] = useState<Partial<VideoFile>>({});
  const [isKeyMissing] = useState(!isApiKeyAvailable());
  
  const { extractFrames } = useVideoProcessor();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleAnalyze = async () => {
    if (!file || !videoUrl) {
      setErrorMessage('Please provide both a video file and its public Backblaze URL.');
      setStatus('error');
      return;
    }
    
    // Reset state
    setErrorMessage('');
    setVideoData({});

    try {
      setStatus('extracting');
      setProgressMessage('Extracting 5 key frames from the video...');
      const { frames, width, height } = await extractFrames(file, 5);

      setStatus('analyzing');
      setProgressMessage('Frames extracted. Sending to Gemini AI for analysis...');
      const analysisResult = await analyzeVideoContent(frames);

      setVideoData({
        ...analysisResult,
        url: videoUrl,
        thumbnail: frames[0], // Use the first frame as a placeholder thumbnail
        width,
        height,
      });
      setStatus('reviewing');
    } catch (error: any) {
      console.error('Analysis failed:', error);
      setErrorMessage(error.message || 'An unknown error occurred during analysis.');
      setStatus('error');
    }
  };

  const handleSave = async () => {
    if (!db) {
      setErrorMessage("Database connection is not available.");
      setStatus('error');
      return;
    }
    
    setStatus('saving');
    setProgressMessage('Saving metadata to Firestore...');
    try {
      await addDoc(collection(db, "videos"), {
        ...videoData,
        isFeatured: false, // Default value
        createdAt: Date.now(),
      });
      setStatus('success');
    } catch (error: any) {
        console.error('Failed to save to Firestore:', error);
        setErrorMessage(error.message || 'Could not save the video data to the database.');
        setStatus('error');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setVideoData(prev => ({ ...prev, [name]: name === 'price' || name === 'commercialAppeal' ? parseFloat(value) : value }));
  };

  const handleKeywordsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const keywords = e.target.value.split(',').map(kw => kw.trim()).filter(Boolean);
    setVideoData(prev => ({ ...prev, keywords }));
  };

  const handleCategoryChange = (category: string) => {
    setVideoData(prev => {
        const currentCategories = prev.categories || [];
        const newCategories = currentCategories.includes(category)
            ? currentCategories.filter(c => c !== category)
            : [...currentCategories, category];
        return { ...prev, categories: newCategories };
    });
  };

  const renderContent = () => {
    if (status === 'success') {
        return (
            <div className="text-center p-8">
                <CheckIcon className="w-16 h-16 text-green-400 mx-auto" />
                <h3 className="mt-4 text-2xl font-bold text-white">Video Added!</h3>
                <p className="mt-2 text-gray-300">The new video has been successfully saved to your collection and is now live.</p>
                <button
                    onClick={onClose}
                    className="mt-6 w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors"
                >
                    Close
                </button>
            </div>
        );
    }
    
    if (status === 'extracting' || status === 'analyzing' || status === 'saving') {
      return (
        <div className="text-center p-8">
          <Spinner className="w-12 h-12" />
          <p className="mt-4 text-lg text-gray-300">{progressMessage}</p>
        </div>
      );
    }
    
    if (status === 'reviewing') {
      return (
         <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-150px)]">
            <h3 className="text-xl font-bold text-indigo-400">Review AI-Generated Data</h3>
            <p className="text-sm text-gray-400">The Gemini AI has analyzed your video. Review and edit the data below, then save it to your collection.</p>
            
            <div>
              <label htmlFor="title" className={formLabelClass}>Title</label>
              <input type="text" id="title" name="title" value={videoData.title || ''} onChange={handleInputChange} className={formInputClass} />
            </div>
            <div>
                <label htmlFor="url" className={formLabelClass}>Video URL</label>
                <input type="text" id="url" name="url" value={videoData.url || ''} onChange={handleInputChange} className={formInputClass} />
            </div>
            <div>
                <label htmlFor="price" className={formLabelClass}>Price ($)</label>
                <input type="number" id="price" name="price" value={videoData.price || 0} onChange={handleInputChange} className={formInputClass} min="0" step="0.01" />
            </div>
            <div>
                <label htmlFor="commercialAppeal" className={formLabelClass}>Commercial Appeal (1-100)</label>
                <input type="number" id="commercialAppeal" name="commercialAppeal" value={videoData.commercialAppeal || 50} onChange={handleInputChange} className={formInputClass} min="1" max="100" />
            </div>
            <div>
              <label htmlFor="description" className={formLabelClass}>Description</label>
              <textarea id="description" name="description" value={videoData.description || ''} onChange={handleInputChange} className={formInputClass} rows={4}></textarea>
            </div>
             <div>
                <label htmlFor="categories" className={formLabelClass}>Categories</label>
                <div id="categories" className="mt-1 space-y-2 p-3 bg-gray-700 border border-gray-600 rounded-md max-h-32 overflow-y-auto">
                    {CATEGORIES.map(cat => (
                        <div key={cat} className="flex items-center">
                            <input
                                id={`cat-upload-${cat}`}
                                type="checkbox"
                                checked={(videoData.categories || []).includes(cat)}
                                onChange={() => handleCategoryChange(cat)}
                                className="h-4 w-4 text-indigo-600 bg-gray-800 border-gray-500 rounded focus:ring-indigo-500 focus:ring-offset-gray-700"
                            />
                            <label htmlFor={`cat-upload-${cat}`} className="ml-3 block text-sm font-medium text-gray-300">{cat}</label>
                        </div>
                    ))}
                </div>
            </div>
            <div>
              <label htmlFor="keywords" className={formLabelClass}>Keywords</label>
              <input type="text" id="keywords" name="keywords" value={(videoData.keywords || []).join(', ')} onChange={handleKeywordsChange} className={formInputClass} />
              <p className="text-xs text-gray-500 mt-1">Separate keywords with commas.</p>
            </div>
         </div>
      );
    }

    return (
      <div className="p-6 space-y-4">
        <div className="text-center">
            <SparklesIcon className="w-12 h-12 text-indigo-400 mx-auto" />
            <h3 className="mt-2 text-xl font-bold text-white">Automate Your Workflow</h3>
            <p className="text-sm text-gray-400">This tool simulates your backend. It uses the local file for AI analysis and the URL for the final database entry.</p>
        </div>
        <div>
          <label htmlFor="videoUrl" className={formLabelClass}>1. Public Video URL</label>
          <input
            id="videoUrl"
            type="text"
            placeholder="Paste Backblaze 'Friendly URL' here..."
            className={formInputClass}
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="file-upload" className={formLabelClass}>2. Local Video File</label>
          <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-600 border-dashed rounded-md">
            <div className="space-y-1 text-center">
              <UploadIcon className="mx-auto h-12 w-12 text-gray-500" />
              <div className="flex text-sm text-gray-400">
                <label htmlFor="file-upload" className="relative cursor-pointer bg-gray-800 rounded-md font-medium text-indigo-400 hover:text-indigo-300 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-gray-800 focus-within:ring-indigo-500">
                  <span>Select a file</span>
                  <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleFileChange} accept="video/*" />
                </label>
                <p className="pl-1">or drag and drop</p>
              </div>
              {file ? (
                <p className="text-xs text-green-400">{file.name}</p>
              ) : (
                <p className="text-xs text-gray-500">MP4, MOV up to 50MB</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  const renderFooter = () => {
    if (status === 'reviewing') {
      return (
         <div className="p-4 flex gap-4">
            <button
                onClick={() => setStatus('idle')}
                className="w-full py-2 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-lg transition-colors"
            >
                Cancel
            </button>
            <button
                onClick={handleSave}
                className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors"
            >
                Save to Firestore
            </button>
         </div>
      );
    }
    
    if (status === 'idle' || status === 'error') {
       return (
         <div className="p-4">
            {status === 'error' && (
                <div className="bg-red-900/50 text-red-300 p-3 rounded-md mb-4 text-sm">
                    <strong>Error:</strong> {errorMessage}
                </div>
            )}
            <button
                onClick={handleAnalyze}
                disabled={!file || !videoUrl || isKeyMissing}
                className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <SparklesIcon className="w-5 h-5" />
                Analyze Video
            </button>
            {isKeyMissing && (
                <p className="text-xs text-yellow-400 text-center mt-2">
                    Analysis is disabled because the Gemini API key is not configured.
                </p>
            )}
         </div>
      );
    }
    
    return null;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">Upload & Analyze New Video</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <XIcon className="w-6 h-6" />
          </button>
        </div>
        
        {renderContent()}
        
        <div className="border-t border-gray-700">
           {renderFooter()}
        </div>
      </div>
    </div>
  );
};
