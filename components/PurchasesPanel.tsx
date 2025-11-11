import React, { useState } from 'react';
import type { VideoFile } from '../types';
import { XIcon, DownloadIcon, CheckIcon } from './Icons';
import { Spinner } from './Spinner';

interface PurchasesPanelProps {
  items: VideoFile[];
  onClose: () => void;
  downloadedVideoIds: string[];
  onVideoDownloaded: (videoId: string) => void;
}

export const PurchasesPanel: React.FC<PurchasesPanelProps> = ({ items, onClose, downloadedVideoIds, onVideoDownloaded }) => {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownload = async (video: VideoFile) => {
    if (downloadingId === video.id) return; // Prevent multiple clicks while downloading

    setDownloadingId(video.id);
    try {
      // Fetch the video data. This bypasses the browser's default behavior of navigating to the URL.
      const response = await fetch(video.url);
      if (!response.ok) {
        throw new Error(`Failed to fetch video: ${response.statusText}`);
      }
      const blob = await response.blob();

      // Create a temporary local URL for the downloaded blob.
      const blobUrl = window.URL.createObjectURL(blob);

      // Create a temporary anchor element to trigger the download.
      const link = document.createElement('a');
      link.href = blobUrl;
      const filename = video.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      link.setAttribute('download', `${filename}.mp4`);
      
      // Append to the document, click to trigger download, and then remove.
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up the temporary blob URL to free up memory.
      window.URL.revokeObjectURL(blobUrl);

      // Notify parent component that the download is complete
      onVideoDownloaded(video.id);
      
      // Provide guidance for mobile users
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      if (isMobile) {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
        
        // Use a small timeout to allow the download to initiate before showing the alert
        setTimeout(() => {
          if (isIOS) {
            alert("Download Started!\n\nYour video has been saved to the 'Files' app on your iPhone/iPad. Look in the 'Downloads' folder. From there, you can save it to your Photos library.");
          } else { // Generic message for Android and other mobile OS
            alert("Download Started!\n\nCheck your device's 'Downloads' folder or your browser's download manager to find your video.");
          }
        }, 500);
      }

    } catch (error) {
      console.error("Download failed:", error);
      alert("Sorry, the download could not be completed. Please check the console for details.");
    } finally {
      setDownloadingId(null); // Reset the downloading state
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
                                  src={item.generatedThumbnail || item.thumbnail} 
                                  alt={item.title} 
                                  className="w-full h-full object-cover" 
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
                                  {isDownloaded && (
                                    <div className="flex items-center gap-1 text-green-400">
                                        <CheckIcon className="w-4 h-4" />
                                        <span className="font-medium">Downloaded</span>
                                    </div>
                                  )}
                                  <button 
                                    onClick={() => handleDownload(item)} 
                                    type="button" 
                                    className="font-medium text-indigo-400 hover:text-indigo-300 flex items-center gap-1 disabled:opacity-60 disabled:cursor-wait ml-auto"
                                    disabled={downloadingId === item.id}
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