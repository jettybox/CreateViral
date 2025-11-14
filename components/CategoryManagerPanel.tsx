import React, { useState, useMemo, useRef, useEffect } from 'react';
import { writeBatch, doc, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js';
import { db } from '../firebase-config';
import type { VideoFile } from '../types';
import { XIcon, TagIcon, CheckIcon, SparklesIcon, WarningIcon, EyeIcon, EyeSlashIcon, RefreshIcon, KeyIcon } from './Icons';
import { Spinner } from './Spinner';
import { categorizeVideo, isApiKeyAvailable, setApiKey as saveApiKeyToService } from '../services/geminiService';

interface CategoryManagerPanelProps {
  videos: VideoFile[];
  allCategories: string[];
  hiddenCategories: string[];
  onClose: () => void;
}

type Status = 'idle' | 'scanning' | 'error' | 'success';

export const CategoryManagerPanel: React.FC<CategoryManagerPanelProps> = ({ videos, allCategories, hiddenCategories, onClose }) => {
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDescription, setNewCategoryDescription] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState({ added: 0, skipped: 0 });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isGeminiAvailable, setIsGeminiAvailable] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');

  const descriptionInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setIsGeminiAvailable(isApiKeyAvailable());
  }, []);

  const isExistingCategory = useMemo(() => {
    return allCategories.map(c => c.toLowerCase()).includes(newCategoryName.trim().toLowerCase());
  }, [allCategories, newCategoryName]);

  const handleToggleVisibility = async (category: string) => {
    if (!db) {
        alert("Database connection is not available.");
        return;
    }
    const isHidden = hiddenCategories.includes(category);
    const newHidden = isHidden
        ? hiddenCategories.filter(c => c !== category)
        : [...hiddenCategories, category];
    
    try {
        const configDocRef = doc(db, 'site_config', 'main');
        await setDoc(configDocRef, { hiddenCategories: newHidden }, { merge: true });
    } catch (error) {
        console.error("Failed to update hidden categories:", error);
        alert("An error occurred while saving your changes. Please try again.");
    }
  };
  
  const handleInitiateRescan = (category: string) => {
    setNewCategoryName(category);
    setNewCategoryDescription('');
    setStatus('idle');
    // Scroll to top and focus the description field to guide the user
    descriptionInputRef.current?.parentElement?.parentElement?.parentElement?.scrollTo(0, 0);
    setTimeout(() => descriptionInputRef.current?.focus(), 100);
  };

  const handleSaveApiKey = () => {
    if (apiKeyInput.trim()) {
      saveApiKeyToService(apiKeyInput.trim());
      setIsGeminiAvailable(true);
      setApiKeyInput('');
    }
  };

  const startCategorizationProcess = async () => {
    const categoryNameToProcess = newCategoryName.trim();

    if (!categoryNameToProcess || !newCategoryDescription.trim() || !db) {
      setErrorMessage('Please provide both a category name and a description.');
      return;
    }
    
    if (!isApiKeyAvailable()) {
      setErrorMessage('Gemini API key is not configured. Please set it in the form below to enable this feature.');
      setStatus('error');
      return;
    }

    setStatus('scanning');
    setErrorMessage(null);
    setResults({ added: 0, skipped: 0 });
    
    // --- PHASE 0: Save New Category to Master List ---
    // This makes the category permanent before we even scan videos.
    const newMasterList = [...new Set([...allCategories, categoryNameToProcess])].sort();
    try {
        const configDocRef = doc(db, 'site_config', 'main');
        // We use merge:true to avoid overwriting hiddenCategories
        await setDoc(configDocRef, { allCategories: newMasterList }, { merge: true });
    } catch (error) {
        console.error("Failed to update master category list:", error);
        setErrorMessage("A critical error occurred while saving the new category. The process has been stopped.");
        setStatus('error');
        return;
    }

    const videosToUpdate = new Set<string>();

    // --- PHASE 1: Rule-Based Instant Match ---
    // Fast, cheap, and guarantees direct matches are included.
    const lowerCaseCategory = categoryNameToProcess.toLowerCase();
    videos.forEach(video => {
        if (video.categories.map(c => c.toLowerCase()).includes(lowerCaseCategory)) {
            return; // Already has the category
        }
        const searchableText = `${video.title.toLowerCase()} ${video.keywords.join(' ').toLowerCase()}`;
        if (searchableText.includes(lowerCaseCategory)) {
            videosToUpdate.add(video.id);
        }
    });

    // --- PHASE 2: AI-Powered Semantic Match ---
    // Slower, more expensive, but finds related content without exact keywords.
    const videosForAI = videos.filter(v => 
        !v.categories.map(c => c.toLowerCase()).includes(lowerCaseCategory) && !videosToUpdate.has(v.id)
    );
    setProgress({ current: 0, total: videosForAI.length });

    const CONCURRENT_LIMIT = 5;
    const queue = [...videosForAI];
    
    const worker = async () => {
      while (queue.length > 0) {
        const video = queue.shift();
        if (!video) return;

        try {
          const { shouldAddCategory } = await categorizeVideo(
            { title: video.title, description: video.description, keywords: video.keywords },
            categoryNameToProcess,
            newCategoryDescription
          );
          if (shouldAddCategory) {
            videosToUpdate.add(video.id);
          }
        } catch (error: any) {
          console.warn(`Could not categorize video ${video.id}: ${error.message}`);
        } finally {
          setProgress(p => ({ ...p, current: p.current + 1 }));
        }
      }
    };
    
    const workers = Array(CONCURRENT_LIMIT).fill(null).map(() => worker());
    await Promise.all(workers);

    // --- PHASE 3: Commit to Database ---
    const updateList = Array.from(videosToUpdate);
    if (updateList.length > 0) {
      const BATCH_SIZE = 500; // Firestore write batch limit
      for (let i = 0; i < updateList.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const chunk = updateList.slice(i, i + BATCH_SIZE);
        chunk.forEach(videoId => {
          const videoRef = doc(db, 'videos', videoId);
          const originalVideo = videos.find(v => v.id === videoId);
          if (originalVideo) {
              const newCategories = [...new Set([...originalVideo.categories, categoryNameToProcess])];
              batch.update(videoRef, { categories: newCategories });
          }
        });
        await batch.commit();
      }
    }

    const totalAdded = updateList.length;
    setResults({ added: totalAdded, skipped: videos.length - totalAdded });
    setStatus('success');
  };
  
  const renderContent = () => {
    switch (status) {
      case 'success':
        return (
          <div className="text-center p-8">
            <CheckIcon className="w-16 h-16 text-green-400 mx-auto" />
            <h3 className="mt-4 text-2xl font-bold text-white">Process Complete!</h3>
            <p className="mt-2 text-gray-300">
              The category "<strong className="text-indigo-400">{newCategoryName}</strong>" was applied to <strong className="text-white">{results.added}</strong> videos.
            </p>
            <button
                onClick={onClose}
                className="mt-6 w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors"
            >
                Close
            </button>
          </div>
        );
      case 'scanning':
         return (
            <div className="text-center p-8 space-y-4">
              <Spinner className="w-12 h-12" />
              <p className="text-lg text-gray-300">Analyzing videos for "<strong className="text-indigo-400">{newCategoryName}</strong>"</p>
              <p className="text-2xl font-mono text-indigo-400">{progress.current} / {progress.total}</p>
              <div className="w-full bg-gray-700 rounded-full h-2.5">
                <div className="bg-indigo-600 h-2.5 rounded-full" style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}></div>
              </div>
              <p className="text-xs text-gray-500 pt-2">
                This may take several minutes. You can safely close this window; the process will continue.
              </p>
            </div>
          );
      case 'error':
        return (
          <div className="p-6">
             <div className="bg-red-900/50 text-red-300 p-4 rounded-md text-center">
                <WarningIcon className="w-10 h-10 mx-auto mb-2" />
                 <h3 className="font-bold text-lg">An Error Occurred</h3>
                 <p className="text-sm mt-1">{errorMessage}</p>
                 <button
                    onClick={() => { setStatus('idle'); setErrorMessage(null); }}
                    className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors"
                >
                    Try Again
                </button>
             </div>
          </div>
        );
      case 'idle':
      default:
        return (
          <>
            <div className="p-6 space-y-4">
                <div className="text-center">
                    <TagIcon className="w-12 h-12 text-indigo-400 mx-auto" />
                    <h3 className="mt-2 text-xl font-bold text-white">AI-Powered Category Manager</h3>
                    <p className="text-sm text-gray-400">Define a new category, and the AI will scan your library to find and tag matching videos.</p>
                </div>
                {errorMessage && <p className="text-sm text-red-400 text-center">{errorMessage}</p>}
                <div>
                  <label htmlFor="categoryName" className="block text-sm font-medium text-gray-300 mb-1">Category Name</label>
                  <input
                    id="categoryName"
                    type="text"
                    placeholder="e.g., Halloween"
                    className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="categoryDescription" className="block text-sm font-medium text-gray-300 mb-1">Category Description</label>
                  <textarea
                    id="categoryDescription"
                    ref={descriptionInputRef}
                    placeholder="Describe videos in this category. e.g., 'Spooky, autumnal, or scary themes, often featuring pumpkins, ghosts, or costumes.'"
                    className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white"
                    value={newCategoryDescription}
                    onChange={(e) => setNewCategoryDescription(e.target.value)}
                    rows={3}
                  />
                   <p className="text-xs text-gray-400 mt-1">A good description is crucial for accurate AI results.</p>
                </div>
            </div>

            <div className="border-t border-gray-600 my-4"></div>

            <div className="px-6 pb-6">
                <h3 className="text-lg font-semibold text-white mb-3">Manage Categories</h3>
                <p className="text-sm text-gray-400 mb-4">
                    Toggle visibility on the main filter or re-scan a category to include newly uploaded videos.
                </p>
                <div className="max-h-48 overflow-y-auto pr-2 bg-gray-900/50 p-3 rounded-md border border-gray-600">
                    <ul className="space-y-1">
                        {allCategories.sort().map(category => (
                          <li key={category} className="flex items-center justify-between p-2 rounded-md hover:bg-gray-700/50">
                            <span className="text-white font-medium">{category}</span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleToggleVisibility(category)}
                                    className="p-1 rounded-full text-gray-400 hover:text-white hover:bg-gray-600 transition-colors"
                                    title={hiddenCategories.includes(category) ? 'Show category' : 'Hide category'}
                                >
                                    {hiddenCategories.includes(category) ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                                </button>
                                <button
                                    onClick={() => handleInitiateRescan(category)}
                                    className="p-1 rounded-full text-gray-400 hover:text-white hover:bg-gray-600 transition-colors"
                                    title={`Re-scan library for "${category}"`}
                                >
                                    <RefreshIcon className="w-5 h-5" />
                                </button>
                            </div>
                          </li>
                        ))}
                    </ul>
                </div>
            </div>
          </>
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-4 border-b border-gray-700 flex-shrink-0">
          <h2 className="text-xl font-bold text-white">AI Category Manager</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <XIcon className="w-6 h-6" />
          </button>
        </div>
        
        <div className="overflow-y-auto">
            {renderContent()}
        </div>
        
        {status !== 'scanning' && status !== 'success' && (
          <div className="p-4 bg-gray-800/50 border-t border-gray-700 flex-shrink-0">
              {isGeminiAvailable ? (
                  <button
                      onClick={startCategorizationProcess}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors disabled:opacity-50"
                      // FIX: Removed redundant `status === 'scanning'` check which is impossible in this branch, causing a TS error.
                      disabled={!newCategoryName.trim() || !newCategoryDescription.trim()}
                  >
                      <SparklesIcon className="w-5 h-5" />
                      {isExistingCategory ? 'Re-scan Category' : 'Create & Scan'}
                  </button>
              ) : (
                  <div className="p-3 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
                      <label htmlFor="api-key-input-cat-manager" className="block text-xs font-medium text-yellow-300 mb-1">Set Gemini API Key to Scan</label>
                      <div className="flex gap-2">
                          <div className="relative flex-grow">
                               <KeyIcon className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                              <input
                                  type="password"
                                  id="api-key-input-cat-manager"
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
          </div>
        )}
      </div>
    </div>
  );
};
