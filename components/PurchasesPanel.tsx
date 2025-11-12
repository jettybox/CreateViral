import React, { useState } from 'react';
import type { VideoFile } from '../types';
import { XIcon, DownloadIcon, CheckIcon, TrashIcon } from './Icons';
import { Spinner } from './Spinner';

interface PurchasesPanelProps {
  items: VideoFile[];
  onClose: () => void;
  downloadedVideoIds: string[];
  onVideoDownloaded: (videoId: string) => void;
  isAdmin?: boolean;
  onRemoveItem?: (videoId: string) => void;
}

export const PurchasesPanel: React.FC<PurchasesPanelProps> = ({ items, onClose, downloadedVideoIds, onVideoDownloaded, isAdmin, onRemoveItem }) => {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownload = async (video: VideoFile) => {
    if (downloadingId) return; // Prevent multiple concurrent downloads

    setDownloadingId(video.id);

    try {
      // Fetching the video as a blob is the most reliable cross-browser way
      // to force a "Save As" dialog and respect the filename, as it bypasses
      // cross-origin security restrictions on the anchor `download` attribute.
      const response = await fetch(video.url);

      if (!response.ok) {
        throw new Error(`Network response was not ok: ${response.status} ${response.statusText}`);
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      
      const filename = video.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      link.setAttribute('download', `${filename}.mp4`);
      
      document.body.appendChild(link);
      link.click();
      
      // Cleanup the DOM and revoke the blob URL to free up memory.
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);

      onVideoDownloaded(video.id);

    } catch (error: any) {
      console.error("Download failed:", error);
      alert(`Sorry, the download could not be started. Please try again. Error: ${error.message}`);
    } finally {
      setDownloadingId(null);
    }
  };


  return (
    <div className="fixed inset-0 z-50 overflow-hidden" aria-labelledby="slide-over-title" role="dialog" aria-modal="true">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-black bg-opacity-75 transition-opacity" onClick={onClose}></div>
        <div className="fixed inset-y-0 right-0 pl-10 max-w-full flex">
          <div className="w-screen max-w-md transform transition ease-in-out duration-500 sm:duration-700 translate-x-0">
            <div className="h-full flex flex-col bg-gray-800 shadow-xl overflow-y-scroll">
              <div className="flex-1 py-6 overflow-y-auto px-4 sm:px-6">
                <div className="flex items-start justify-between">
                  <h2 className="text-lg font-medium text-white" id="slide-over-title">My Downloads</h2>
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
                        {items.map((item) => {
                          const isDownloaded = downloadedVideoIds.includes(item.id);
                          return (
                            <li key={item.id} className="py-6 flex">
                              <div className="flex-shrink-0 w-24 h-14 border border-gray-700 rounded-md overflow-hidden bg-gray-900">
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
                                    <h3>{item.title}</h3>
                                  </div>
                                  <p className="mt-1 text-sm text-gray-400 truncate">{item.categories.join(', ')}</p>
                                </div>
                                <div className="flex-1 flex items-end justify-between text-sm">
                                  <div className="flex items-center gap-3">
                                      {isDownloaded && downloadingId !== item.id && (
                                        <div className="flex items-center gap-1 text-green-400">
                                            <CheckIcon className="w-4 h-4" />
                                            <span className="font-medium">Downloaded</span>
                                        </div>
                                      )}
                                      {isAdmin && onRemoveItem && (
                                          <button
                                              onClick={() => onRemoveItem(item.id)}
                                              type="button"
                                              className="font-medium text-red-500 hover:text-red-400 flex items-center gap-1 p-1 rounded-full hover:bg-gray-700 transition-colors"
                                              title={`Admin: Delete ${item.title}`}
                                              aria-label={`Admin: Delete ${item.title}`}
                                          >
                                              <TrashIcon className="w-4 h-4" />
                                          </button>
                                      )}
                                  </div>

                                  <button 
                                    onClick={() => handleDownload(item)} 
                                    type="button" 
                                    disabled={downloadingId !== null}
                                    className="font-medium text-indigo-400 hover:text-indigo-300 flex items-center gap-1 disabled:opacity-60 disabled:cursor-not-allowed"
                                  >
                                    {downloadingId === item.id ? (
                                      <>
                                        <Spinner className="w-4 h-4" /> Downloading...
                                      </>
                                    ) : (
                                      <>
                                        <DownloadIcon className="w-4 h-4" /> {isDownloaded ? 'Download Again' : 'Download'}
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <div className="text-center py-10">
                        <p className="text-gray-400">Your purchased and free items will appear here.</p>
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
