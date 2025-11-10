import React, { useState, useEffect } from 'react';
import type { VideoFile } from '../types';
import { CATEGORIES } from '../constants';
import { XIcon, TagIcon, InfoIcon, CategoryIcon, EditIcon, CartIcon, CheckIcon, StarIcon } from './Icons';

interface VideoPlayerModalProps {
  video: VideoFile;
  onClose: () => void;
  onVideoUpdate: (video: VideoFile) => void;
  onAddToCart: (videoId: string) => void;
  isInCart: boolean;
  isAdmin: boolean;
}

const formInputClass = "w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white";
const formLabelClass = "block text-sm font-medium text-gray-300 mb-1";

export const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({ video, onClose, onVideoUpdate, onAddToCart, isInCart, isAdmin }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editableVideo, setEditableVideo] = useState<VideoFile>(video);

  useEffect(() => {
    setEditableVideo(video);
    setIsEditing(false);
  }, [video]);

  const handleSave = () => {
    onVideoUpdate(editableVideo);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditableVideo(video);
    setIsEditing(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
        const { checked } = e.target as HTMLInputElement;
        setEditableVideo(prev => ({ ...prev, [name]: checked }));
    } else {
        setEditableVideo(prev => ({
          ...prev,
          [name]: name === 'price' ? parseFloat(value) || 0 : value,
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

  const handleKeywordsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const keywords = e.target.value.split(',').map(kw => kw.trim()).filter(Boolean);
    setEditableVideo(prev => ({ ...prev, keywords }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            {video.isFeatured && !isEditing && <StarIcon className="w-6 h-6 text-yellow-400" />}
            <h2 className="text-xl font-bold text-white truncate">{isEditing ? 'Editing Video' : video.title}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <XIcon className="w-6 h-6" />
          </button>
        </div>
        <div className="flex flex-col lg:flex-row flex-grow overflow-hidden">
          <div className="w-full lg:w-2/3 bg-black">
            <video src={video.url} controls autoPlay className="w-full h-full object-contain" />
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
                  <div>
                    <label htmlFor="title" className={formLabelClass}>Title</label>
                    <input type="text" id="title" name="title" value={editableVideo.title} onChange={handleInputChange} className={formInputClass} />
                  </div>
                   <div>
                    <label htmlFor="price" className={formLabelClass}>Price ($)</label>
                    <input type="number" id="price" name="price" value={editableVideo.price} onChange={handleInputChange} className={formInputClass} min="0" step="0.01" />
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
                    <input type="text" id="keywords" name="keywords" value={editableVideo.keywords.join(', ')} onChange={handleKeywordsChange} className={formInputClass} />
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
                    disabled={isInCart}
                    className="w-full py-3 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed bg-indigo-600 hover:bg-indigo-700"
                  >
                    {isInCart ? <><CheckIcon className="w-6 h-6" /> Added to Cart</> : <><CartIcon className="w-6 h-6" /> Add to Cart - ${video.price.toFixed(2)}</>}
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
