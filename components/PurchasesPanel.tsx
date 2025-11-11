import React, { useState } from 'react';
import type { VideoFile } from '../types';
import { XIcon, DownloadIcon, CheckIcon } from './Icons';
import { Spinner } from './Spinner';
import { correctUrlForBackblaze } from '../services/videoCacheService';

interface PurchasesPanelProps {
  items: VideoFile[];
  onClose: () => void;
  downloadedVideoIds: string[];
  onVideoDownloaded: (videoId: string) => void;
}

export const PurchasesPanel: React.FC<PurchasesPanelProps> = ({ items, onClose, downloadedVideoIds, onVideoDownloaded }) => {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownload = async (video: VideoFile) => {
    if (downloadingId === video.id) return;

    setDownloadingId(video.id);
    const correctedUrl = correctUrlForBackblaze(video.url);

    try {
      // Fetch the video file as a blob using the corrected URL.
      const response = await fetch(correctedUrl);
      
      if (!response.ok) {
        throw new Error(`The video could not be fetched. Status: ${response.status} ${response.statusText}`);
      }
      
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      const filename = video.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      link.setAttribute('download', `${filename}.mp4`);
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      window.URL.revokeObjectURL(blobUrl);
      onVideoDownloaded(video.id);

    } catch (error: any) {
      console.error("Download failed:", error);
      // A 'TypeError' with 'Failed to fetch' is the classic browser indicator of a CORS or 'Not Found' error on cross-origin requests.
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        alert(
          "Download Failed: A security error occurred while trying to fetch the video file.\n\n" +
          "This is almost always caused by one of two issues:\n\n" +
          "1. INCORRECT CORS SETTINGS: Please go to your Backblaze B2 bucket settings and ensure CORS rules are set to 'Share everything in this bucket with every origin'.\n\n" +
          "2. INVALID VIDEO URL: The URL might be incorrect, leading to a 'File Not Found' error that the browser reports as a security issue. Please verify that the file exists at the following URL:\n" + correctedUrl
        );
      } else {
        alert(`Sorry, the download could not be completed. Error: ${error.message}`);
      }
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
                                  src={item.generatedThumbnail || item.thumbnail} 
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
                                        <Spinner className="w-4 h-4" /> Initiating...
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
