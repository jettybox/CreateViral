import React, { useState, useEffect } from 'react';
import type { VideoFile } from '../types';
import { CATEGORIES } from '../constants';
import { XIcon, TagIcon, InfoIcon, CategoryIcon, EditIcon, CartIcon, CheckIcon, StarIcon, TrashIcon, WarningIcon } from './Icons';
import { getCachedVideoUrl } from '../services/videoCacheService';
import { Spinner } from './Spinner';

interface VideoPlayerModalProps {
  video: VideoFile;
  onClose: () => void;
  onVideoUpdate: (video: VideoFile) => void;
  onVideoDelete: (videoId: string) => void;
  onAddToCart: (videoId: string) => void;
  isInCart: boolean;
  isPurchased: boolean;
  isAdmin: boolean;
}

const formInputClass = "w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white disabled:opacity-50";
const formLabelClass = "block text-sm font-medium text-gray-300 mb-1";

export const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({ video, onClose, onVideoUpdate, onVideoDelete, onAddToCart, isInCart, isPurchased, isAdmin }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editableVideo, setEditableVideo] = useState<VideoFile>(video);
  const [keywordsInput, setKeywordsInput] = useState('');
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);
  const [isVideoLoading, setIsVideoLoading] = useState(true);
  const [videoError, setVideoError] = useState(false);

  useEffect(() => {
    setEditableVideo(video);
    setKeywordsInput(video.keywords.join(', '));
    setIsEditing(false);
    setVideoError(false); // Reset error state on new video
    
    setIsVideoLoading(true);
    let objectUrl: string | null = null;
    
    // Fetch from cache
    getCachedVideoUrl(video.url).then((url) => {
      objectUrl = url;
      setResolvedSrc(url);
      // We don't set loading to false here; we wait for the video element's
      // `onLoadedData` or `onError` event to fire.
    });

    // Cleanup function to revoke the object URL on component unmount or video change
    return () => {
      if (objectUrl && objectUrl.startsWith('blob:')) {
        URL.revokeObjectURL(objectUrl);
      }
    };

  }, [video]);

  const handleSave = () => {
    // Parse the keyword input string back into a clean array
    const finalKeywords = keywordsInput.split(',').map(kw => kw.trim()).filter(Boolean);
    const videoToSave = { ...editableVideo, keywords: finalKeywords };
    
    onVideoUpdate(videoToSave);
    setIsEditing(false);
  };
  
  const handleVideoError = () => {
    console.error("Failed to load video:", resolvedSrc);
    setVideoError(true);
    setIsVideoLoading(false);
  };

  const handleVideoLoaded = () => {
    setIsVideoLoading(false);
    setVideoError(false);
  };

  const handleCancel = () => {
    setEditableVideo(video);
    setKeywordsInput(video.keywords.join(', ')); // Reset keyword input as well
    setIsEditing(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
        const { checked } = e.target as HTMLInputElement;
        if (name === 'isFree' && checked) {
            setEditableVideo(prev => ({ ...prev, isFree: true, price: 0 }));
        } else {
            setEditableVideo(prev => ({ ...prev, [name]: checked }));
        }
    } else {
        setEditableVideo(prev => ({
          ...prev,
          [name]: name === 'price' ? parseFloat(value) || 0 :
                  name === 'commercialAppeal' ? parseInt(value, 10) || 0 :
                  value,
        }));
    }
  };
  
  const handleCategoryChange = (category: string) => {
    setEditableVideo(prev => {
        const currentCategories = prev.categories || [];
        const newCategories = currentCategories.includes(category)
            ? currentCategories.filter(c => c !== category)
            : [...currentCategories, category];
        return { ...prev, categories: newCategories };
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b border-gray-700">
          <div className="flex items-center gap-3 min-w-0">
            {video.isFeatured && !isEditing && <StarIcon className="w-6 h-6 text-yellow-400 flex-shrink-0" />}
            <h2 className="text-xl font-bold text-white truncate">{isEditing ? 'Editing Video' : video.title}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white flex-shrink-0 ml-4">
            <XIcon className="w-6 h-6" />
          </button>
        </div>
        <div className="flex flex-col lg:flex-row flex-grow overflow-hidden">
          <div className="w-full lg:w-2/3 bg-black flex items-center justify-center relative">
             {(isVideoLoading || videoError) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
                    {videoError ? (
                        <div className="text-center text-white">
                            <WarningIcon className="w-12 h-12 text-red-500 mx-auto" />
                            <h3 className="mt-4 text-lg font-bold">Video Not Found</h3>
                            <p className="mt-2 text-sm text-gray-400">
                                The video file could not be loaded. This usually means the URL is incorrect or the file is missing from the storage bucket.
                            </p>
                            {isAdmin && (
                                <p className="mt-4 text-xs bg-gray-700 p-2 rounded-md">
                                    <strong>Admin Tip:</strong> Check that the video URL in Firestore matches the exact path in your Backblaze B2 bucket.
                                </p>
                            )}
                        </div>
                    ) : (
                        <Spinner className="w-12 h-12" />
                    )}
                </div>
             )}
              {resolvedSrc && !videoError && (
                 <video 
                    src={resolvedSrc} 
                    controls 
                    playsInline 
                    className={`w-full h-full object-contain transition-opacity duration-300 ${isVideoLoading ? 'opacity-0' : 'opacity-100'}`} 
                    controlsList="nodownload" 
                    onLoadedData={handleVideoLoaded}
                    onError={handleVideoError}
                 />
              )}
          </div>
          <div className="w-full lg:w-1/3 p-6 flex flex-col bg-gray-800/50 overflow-hidden">
            <div className="flex-grow overflow-y-auto pr-2 space-y-4">
              {isEditing ? (
                <>
                  <div className="flex items-center justify-between bg-gray-700 p-3 rounded-lg">
                      <label htmlFor="isFeatured" className="font-medium text-white flex items-center gap-2">
                        <StarIcon className="w-5 h-5 text-yellow-400" />
                        Feature this video
                      </label>
                      <input
                          type="checkbox"
                          id="isFeatured"
                          name="isFeatured"
                          checked={editableVideo.isFeatured}
                          onChange={handleInputChange}
                          className="h-6 w-6 text-indigo-500 bg-gray-800 border-gray-500 rounded focus:ring-indigo-500 focus:ring-offset-gray-700 cursor-pointer"
                      />
                  </div>
                   <div className="flex items-center justify-between bg-gray-700 p-3 rounded-lg">
                      <label htmlFor="isFree" className="font-medium text-white flex items-center gap-2">
                        <span className="px-2 py-1 text-xs rounded-full bg-green-700 text-green-200">FREE</span>
                        Mark as Free
                      </label>
                      <input
                          type="checkbox"
                          id="isFree"
                          name="isFree"
                          checked={editableVideo.isFree}
                          onChange={handleInputChange}
                          className="h-6 w-6 text-indigo-500 bg-gray-800 border-gray-500 rounded focus:ring-indigo-500 focus:ring-offset-gray-700 cursor-pointer"
                      />
                  </div>
                  <div>
                    <label htmlFor="title" className={formLabelClass}>Title</label>
                    <input type="text" id="title" name="title" value={editableVideo.title} onChange={handleInputChange} className={formInputClass} />
                  </div>
                   <div>
                    <label htmlFor="price" className={formLabelClass}>Price ($)</label>
                    <input type="number" id="price" name="price" value={editableVideo.price} onChange={handleInputChange} className={formInputClass} min="0" step="0.01" disabled={editableVideo.isFree} />
                  </div>
                  <div>
                    <label htmlFor="commercialAppeal" className={formLabelClass}>Commercial Appeal (1-100)</label>
                    <input type="number" id="commercialAppeal" name="commercialAppeal" value={editableVideo.commercialAppeal} onChange={handleInputChange} className={formInputClass} min="1" max="100" />
                  </div>
                  <div>
                    <label htmlFor="description" className={formLabelClass}>Description</label>
                    <textarea id="description" name="description" value={editableVideo.description} onChange={handleInputChange} className={formInputClass} rows={4}></textarea>
                  </div>
                  <div>
                    <label htmlFor="categories" className={formLabelClass}>Categories</label>
                    <div id="categories" className="mt-1 space-y-2 p-3 bg-gray-700 border border-gray-600 rounded-md max-h-32 overflow-y-auto">
                        {CATEGORIES.map(cat => (
                            <div key={cat} className="flex items-center">
                                <input
                                    id={`cat-${cat}`}
                                    name={cat}
                                    type="checkbox"
                                    checked={editableVideo.categories.includes(cat)}
                                    onChange={() => handleCategoryChange(cat)}
                                    className="h-4 w-4 text-indigo-600 bg-gray-800 border-gray-500 rounded focus:ring-indigo-500 focus:ring-offset-gray-700"
                                />
                                <label htmlFor={`cat-${cat}`} className="ml-3 block text-sm font-medium text-gray-300">
                                    {cat}
                                </label>
                            </div>
                        ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Select all categories that apply.</p>
                  </div>
                  <div>
                    <label htmlFor="keywords" className={formLabelClass}>Keywords</label>
                    <input type="text" id="keywords" name="keywords" value={keywordsInput} onChange={(e) => setKeywordsInput(e.target.value)} className={formInputClass} />
                    <p className="text-xs text-gray-500 mt-1">Separate keywords with commas.</p>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <h3 className="text-lg font-semibold text-indigo-400 flex items-center gap-2">
                      <InfoIcon className="w-5 h-5" />
                      Description
                    </h3>
                    <p className="mt-2 text-gray-300 text-sm">{video.description}</p>
                  </div>

                  {isAdmin && (
                    <div>
                        <h3 className="text-lg font-semibold text-indigo-400 flex items-center gap-2 mt-4">
                        <TagIcon className="w-5 h-5" />
                        Keywords
                        </h3>
                        <div className="mt-2 flex flex-wrap gap-2">
                        {video.keywords.map((keyword) => (
                            <span key={keyword} className="px-2 py-1 bg-gray-700 text-xs text-gray-300 rounded-full">
                            {keyword}
                            </span>
                        ))}
                        </div>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="mt-auto pt-4 flex flex-col gap-2">
              {isEditing ? (
                <>
                  <button onClick={handleSave} className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors">
                    Save Changes
                  </button>
                  <button onClick={handleCancel} className="w-full py-2 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-lg transition-colors">
                    Cancel
                  </button>
                  <div className="relative py-4">
                      <div className="absolute inset-0 flex items-center" aria-hidden="true">
                          <div className="w-full border-t border-gray-600" />
                      </div>
                      <div className="relative flex justify-center">
                          <span className="bg-gray-800/50 px-2 text-sm text-red-400 uppercase">Danger Zone</span>
                      </div>
                  </div>
                  <button 
                    onClick={() => onVideoDelete(video.id)}
                    className="w-full flex items-center justify-center gap-2 py-2 bg-red-800 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
                  >
                    <TrashIcon className="w-5 h-5" />
                    Delete Video
                  </button>
                </>
              ) : (
                <>
                  {isAdmin && (
                    <button onClick={() => setIsEditing(true)} className="w-full py-2 mb-2 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2">
                      <EditIcon className="w-5 h-5" />
                      Edit Details
                    </button>
                  )}
                  <button 
                    onClick={() => onAddToCart(video.id)} 
                    disabled={isInCart || isPurchased}
                    className="w-full py-3 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed bg-indigo-600 hover:bg-indigo-700"
                  >
                    {isPurchased ? <><CheckIcon className="w-6 h-6" /> Owned</> : isInCart ? <><CheckIcon className="w-6 h-6" /> Added to Cart</> : <><CartIcon className="w-6 h-6" /> Add to Cart - {video.isFree ? 'Free' : `$${video.price.toFixed(2)}`}</>}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
