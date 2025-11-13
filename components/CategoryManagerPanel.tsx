import React, { useState, useMemo } from 'react';
import { writeBatch, doc, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js';
import { db } from '../firebase-config';
import type { VideoFile } from '../types';
import { XIcon, TagIcon, CheckIcon, SparklesIcon, WarningIcon, EyeIcon, EyeSlashIcon } from './Icons';
import { Spinner } from './Spinner';
import { categorizeVideo, isApiKeyAvailable } from '../services/geminiService';
import { CATEGORIES as BASE_CATEGORIES } from '../constants';

interface CategoryManagerPanelProps {
  videos: VideoFile[];
  hiddenCategories: string[];
  onClose: () => void;
}

type Status = 'idle' | 'scanning' | 'error' | 'success';

export const CategoryManagerPanel: React.FC<CategoryManagerPanelProps> = ({ videos, hiddenCategories, onClose }) => {
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDescription, setNewCategoryDescription] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState({ added: 0, skipped: 0 });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const allCategories = useMemo(() => {
    const dynamicCategories = new Set(videos.flatMap(v => v.categories));
    const combined = new Set([...BASE_CATEGORIES, ...dynamicCategories]);
    return Array.from(combined).sort();
  }, [videos]);

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
        // Use setDoc with merge to create/update the document without overwriting other fields.
        await setDoc(configDocRef, { hiddenCategories: newHidden }, { merge: true });
    } catch (error) {
        console.error("Failed to update hidden categories:", error);
        alert("An error occurred while saving your changes. Please try again.");
    }
  };

  const handleScanAndAdd = async () => {
    if (!newCategoryName.trim() || !newCategoryDescription.trim() || !db) {
      setErrorMessage('Please provide both a category name and a description.');
      return;
    }
    
    if (!isApiKeyAvailable()) {
      setErrorMessage('Gemini API key is not configured. Please set it in the Bulk Importer panel.');
      setStatus('error');
      return;
    }

    setStatus('scanning');
    setErrorMessage(null);
    setProgress({ current: 0, total: videos.length });
    setResults({ added: 0, skipped: 0 });

    const videosToUpdate: string[] = [];

    // Use a concurrent queue to speed up the process
    const CONCURRENT_LIMIT = 5;
    const queue = [...videos];
    
    const worker = async () => {
      while (queue.length > 0) {
        const video = queue.shift();
        if (!video) return;

        // Skip if the video already has this category
        if (video.categories.map(c => c.toLowerCase()).includes(newCategoryName.toLowerCase())) {
          setProgress(p => ({ ...p, current: p.current + 1 }));
          continue;
        }

        try {
          const { shouldAddCategory } = await categorizeVideo(
            { title: video.title, description: video.description, keywords: video.keywords },
            newCategoryName,
            newCategoryDescription
          );
          if (shouldAddCategory) {
            videosToUpdate.push(video.id);
          }
        } catch (error: any) {
          console.warn(`Could not categorize video ${video.id}: ${error.message}`);
          // We continue the process even if one video fails
        } finally {
          setProgress(p => ({ ...p, current: p.current + 1 }));
        }
      }
    };
    
    const workers = Array(CONCURRENT_LIMIT).fill(null).map(() => worker());
    await Promise.all(workers);

    // Now, batch-update the documents in Firestore
    if (videosToUpdate.length > 0) {
      const BATCH_SIZE = 500; // Firestore write batch limit
      for (let i = 0; i < videosToUpdate.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const chunk = videosToUpdate.slice(i, i + BATCH_SIZE);
        chunk.forEach(videoId => {
          const videoRef = doc(db, 'videos', videoId);
          // Get the original video to append the category
          const originalVideo = videos.find(v => v.id === videoId);
          if (originalVideo) {
              const newCategories = [...new Set([...originalVideo.categories, newCategoryName])];
              batch.update(videoRef, { categories: newCategories });
          }
        });
        await batch.commit();
      }
    }

    setResults({ added: videosToUpdate.length, skipped: videos.length - videosToUpdate.length });
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
              The category "<strong className="text-indigo-400">{newCategoryName}</strong>" was added to <strong className="text-white">{results.added}</strong> videos.
            </p>
            <p className="text-sm text-gray-500">{results.skipped} videos were skipped or already categorized.</p>
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
              <p className="text-lg text-gray-300">Scanning library for "<strong className="text-indigo-400">{newCategoryName}</strong>"</p>
              <p className="text-2xl font-mono text-indigo-400">{progress.current} / {progress.total}</p>
              <div className="w-full bg-gray-700 rounded-full h-2.5">
                <div className="bg-indigo-600 h-2.5 rounded-full" style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}></div>
              </div>
              <p className="text-xs text-gray-500 pt-2">
                This may take several minutes for a large library. You can safely close this window; the process will continue on the server.
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
                    onClick={() => setStatus('idle')}
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
                    <p className="text-sm text-gray-400">Define a new category, and AI will scan your entire library to find and tag matching videos.</p>
                </div>
                {errorMessage && <p className="text-sm text-red-400 text-center">{errorMessage}</p>}
                <div>
                  <label htmlFor="categoryName" className="block text-sm font-medium text-gray-300 mb-1">New Category Name</label>
                  <input
                    id="categoryName"
                    type="text"
                    placeholder="e.g., Cinematic Drone Shots"
                    className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="categoryDescription" className="block text-sm font-medium text-gray-300 mb-1">Category Description</label>
                  <textarea
                    id="categoryDescription"
                    placeholder="Describe what kind of videos belong in this category. e.g., 'Sweeping, high-altitude aerial footage, often smooth and scenic...'"
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
                <h3 className="text-lg font-semibold text-white mb-3">Manage Category Visibility</h3>
                <p className="text-sm text-gray-400 mb-4">
                    Hide categories from the main filter. This doesn't delete the category or remove it from videos.
                </p>
                <div className="max-h-48 overflow-y-auto pr-2 bg-gray-900/50 p-3 rounded-md border border-gray-600">
                    <ul className="space-y-2">
                        {allCategories.map(category => {
                            const isHidden = hiddenCategories.includes(category);
                            return (
                                <li key={category} className="flex justify-between items-center text-sm p-1 rounded-md hover:bg-gray-700/50">
                                    <span className={isHidden ? 'text-gray-500 italic' : 'text-gray-200'}>
                                        {category}
                                    </span>
                                    <button
                                        onClick={() => handleToggleVisibility(category)}
                                        className={`p-2 rounded-full transition-colors ${isHidden ? 'text-gray-500 hover:text-white' : 'text-gray-300 hover:text-white'}`}
                                        aria-label={isHidden ? `Show ${category}` : `Hide ${category}`}
                                        title={isHidden ? `Show ${category}` : `Hide ${category}`}
                                    >
                                        {isHidden ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            </div>
          </>
        );
    }
  };

  const renderFooter = () => {
      if (status !== 'idle' || !newCategoryName.trim() || !newCategoryDescription.trim()) {
        return null;
      }
      return (
         <div className="p-4 bg-gray-800/50 border-t border-gray-700">
            <button
                onClick={handleScanAndAdd}
                className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors disabled:opacity-50"
            >
                <SparklesIcon className="w-5 h-5" />
                Scan & Add New Category
            </button>
         </div>
      );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-4 border-b border-gray-700 flex-shrink-0">
          <h2 className="text-xl font-bold text-white">Manage Categories</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <XIcon className="w-6 h-6" />
          </button>
        </div>
        
        <div className="overflow-y-auto">
            {renderContent()}
        </div>
        
        {renderFooter()}
      </div>
    </div>
  );
};
