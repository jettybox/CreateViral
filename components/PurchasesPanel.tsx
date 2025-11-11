import React, { useState } from 'react';
import type { VideoFile } from '../types';
import { XIcon, DownloadIcon, CheckIcon, TrashIcon } from './Icons';
import { Spinner } from './Spinner';
import { correctUrlForBackblaze } from '../services/videoCacheService';

interface PurchasesPanelProps {
  items: VideoFile[];
  onClose: () => void;
  downloadedVideoIds: string[];
  onVideoDownloaded: (videoId: string) => void;
  isAdmin?: boolean;
  onRemoveItem?: (videoId: string) => void;
}

const DownloadGuidanceModal: React.FC<{
  video: VideoFile;
  isDownloading: boolean;
  onClose: () => void;
  onConfirm: () => void;
}> = ({ video, isDownloading, onClose, onConfirm }) => {
    // Fix: Cast window to any to access the non-standard MSStream property for legacy browser detection.
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isAndroid = /android/i.test(navigator.userAgent);

    let title = "Ready to Download";
    let instructions = "Click 'Start Download' below to begin.";

    if (isIOS) {
        title = "Download for iPhone/iPad";
        instructions = "Your video will open in a new tab. To save it, tap the 'Share' icon (a square with an arrow) and choose 'Save Video' or 'Save to Files'.";
    } else if (isAndroid) {
        title = "Download for Android";
        instructions = "Your video will be saved to your device's 'Downloads' folder. Check your notification bar for progress.";
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[60] p-4 animate-fade-in">
            <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-md">
                <div className="p-6">
                    <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
                    <p className="text-gray-300">{instructions}</p>
                </div>
                <div className="bg-gray-700/50 p-4 flex justify-end gap-4 rounded-b-lg">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white font-semibold rounded-lg transition-colors">
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isDownloading}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2 w-44 disabled:opacity-60 disabled:cursor-wait"
                    >
                        {isDownloading ? (
                            <>
                                <Spinner className="w-5 h-5" /> Starting...
                            </>
                        ) : (
                            <>
                                <DownloadIcon className="w-5 h-5" /> Start Download
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export const PurchasesPanel: React.FC<PurchasesPanelProps> = ({ items, onClose, downloadedVideoIds, onVideoDownloaded, isAdmin, onRemoveItem }) => {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadGuidanceVideo, setDownloadGuidanceVideo] = useState<VideoFile | null>(null);

  const executeDownload = () => {
    if (!downloadGuidanceVideo) return;
    if (downloadingId === downloadGuidanceVideo.id) return;

    setDownloadingId(downloadGuidanceVideo.id);

    try {
      const correctedUrl = correctUrlForBackblaze(downloadGuidanceVideo.url);
      const link = document.createElement('a');
      link.href = correctedUrl;
      
      const filename = downloadGuidanceVideo.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      link.setAttribute('download', `${filename}.mp4`);
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      onVideoDownloaded(downloadGuidanceVideo.id);

    } catch (error: any) {
      console.error("Download link creation failed:", error);
      alert(`Sorry, the download could not be started. Error: ${error.message}`);
    } finally {
      // Close the modal and reset states after a brief delay so the user sees the 'Starting...' message.
      setTimeout(() => {
          setDownloadGuidanceVideo(null);
          setDownloadingId(null);
      }, 500);
    }
  };


  return (
    <>
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
                            const correctedThumbnailUrl = item.thumbnail && !item.thumbnail.startsWith('data:')
                                ? correctUrlForBackblaze(item.thumbnail)
                                : item.thumbnail;
                            return (
                              <li key={item.id} className="py-6 flex">
                                <div className="flex-shrink-0 w-24 h-14 border border-gray-700 rounded-md overflow-hidden bg-gray-900">
                                  <img 
                                    src={item.generatedThumbnail || correctedThumbnailUrl || ''} 
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
                                        {isDownloaded && (
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
                                      onClick={() => setDownloadGuidanceVideo(item)} 
                                      type="button" 
                                      className="font-medium text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                                    >
                                      <DownloadIcon className="w-4 h-4" /> {isDownloaded ? 'Download Again' : 'Download'}
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
      {downloadGuidanceVideo && (
        <DownloadGuidanceModal
          video={downloadGuidanceVideo}
          isDownloading={downloadingId === downloadGuidanceVideo.id}
          onClose={() => setDownloadGuidanceVideo(null)}
          onConfirm={executeDownload}
        />
      )}
    </>
  );
};
