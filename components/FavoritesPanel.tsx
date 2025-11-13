import React from 'react';
import type { VideoFile } from '../types';
import { XIcon, HeartIcon, CartIcon } from './Icons';

interface FavoritesPanelProps {
  items: VideoFile[];
  onClose: () => void;
  onRemoveItem: (videoId: string) => void;
  onAddToCart: (videoId: string) => void;
  onViewItem: (video: VideoFile) => void;
}

export const FavoritesPanel: React.FC<FavoritesPanelProps> = ({ items, onClose, onRemoveItem, onAddToCart, onViewItem }) => {
  return (
    <div className="fixed inset-0 z-50 overflow-hidden" aria-labelledby="slide-over-title" role="dialog" aria-modal="true">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-black bg-opacity-75 transition-opacity" onClick={onClose}></div>
        <div className="fixed inset-y-0 right-0 pl-10 max-w-full flex">
          <div className="w-screen max-w-md transform transition ease-in-out duration-500 sm:duration-700 translate-x-0">
            <div className="h-full flex flex-col bg-gray-800 shadow-xl overflow-y-scroll">
              <div className="flex-1 py-6 overflow-y-auto px-4 sm:px-6">
                <div className="flex items-start justify-between">
                  <h2 className="text-lg font-medium text-white flex items-center gap-2" id="slide-over-title">
                    <HeartIcon className="w-6 h-6 text-pink-400" />
                    My Favorites
                  </h2>
                  <div className="ml-3 h-7 flex items-center">
                    <button type="button" className="-m-2 p-2 text-gray-400 hover:text-white" onClick={onClose}>
                      <span className="sr-only">Close panel</span>
                      <XIcon className="h-6 w-6" />
                    </button>
                  </div>
                </div>

                <div className="mt-8">
                  <div className="flow-root">
                    {items.length > 0 ? (
                      <ul role="list" className="-my-6 divide-y divide-gray-700">
                        {items.map((item) => (
                          <li key={item.id} className="py-6 flex">
                            <div className="flex-shrink-0 w-24 h-14 border border-gray-700 rounded-md overflow-hidden bg-gray-900 cursor-pointer" onClick={() => onViewItem(item)}>
                              <img 
                                src={item.thumbnail || ''} 
                                alt={item.title} 
                                className="w-full h-full object-cover" 
                                referrerPolicy="no-referrer"
                                onError={(e) => (e.currentTarget.style.display = 'none')}
                              />
                            </div>
                            <div className="ml-4 flex-1 flex flex-col">
                              <div>
                                <div className="flex justify-between text-base font-medium text-white">
                                  <h3 className="cursor-pointer hover:underline" onClick={() => onViewItem(item)}>{item.title}</h3>
                                  <p className="ml-4">{item.isFree ? 'Free' : `$${item.price.toFixed(2)}`}</p>
                                </div>
                                <p className="mt-1 text-sm text-gray-400 truncate">{item.categories.join(', ')}</p>
                              </div>
                              <div className="flex-1 flex items-end justify-between text-sm">
                                <button
                                  onClick={() => onAddToCart(item.id)}
                                  type="button"
                                  className="font-medium text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                                >
                                  <CartIcon className="w-4 h-4" /> Add to Cart
                                </button>
                                <div className="flex">
                                  <button onClick={() => onRemoveItem(item.id)} type="button" className="font-medium text-gray-400 hover:text-white">
                                    Remove
                                  </button>
                                </div>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-center py-10">
                        <p className="text-gray-400">Click the heart icon on any video to save it here.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
