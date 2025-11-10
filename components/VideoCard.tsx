import React, { useState, useRef, useEffect } from 'react';
import type { VideoFile } from '../types';
import { PlayIcon, CartIcon, CheckIcon, DownloadIcon } from './Icons';
import { Spinner } from './Spinner';
import { getCachedVideoUrl } from '../services/videoCacheService';

interface VideoCardProps {
  video: VideoFile;
  onSelect: () => void;
  onAddToCart: () => void;
  isInCart: boolean;
  isPurchased: boolean;
  onThumbnailGenerated: (dataUrl: string) => void;
  isAdmin: boolean;
}

export const VideoCard: React.FC<VideoCardProps> = ({ video, onSelect, onAddToCart, isInCart, isPurchased, onThumbnailGenerated, isAdmin }) => {
  const [isHovering, setIsHovering] = useState(false);
  const [isGeneratingThumbnail, setIsGeneratingThumbnail] = useState(true);
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<number | null>(null);
  const hasGeneratedThumbnail = useRef(false);

  // Lazy-load video when it comes into view
  useEffect(() => {
    let observer: IntersectionObserver;
    let objectUrl: string | null = null;
    const currentCardRef = cardRef.current;

    if (currentCardRef) {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              // Once it's visible, fetch from cache and set the src
              getCachedVideoUrl(video.url).then((url) => {
                objectUrl = url;
                setResolvedSrc(url);
              });
              // Stop observing once loaded
              observer.unobserve(currentCardRef);
            }
          });
        },
        { rootMargin: '200px' } // Preload videos 200px before they enter viewport
      );
      observer.observe(currentCardRef);
    }

    return () => {
      if (currentCardRef && observer) {
        observer.unobserve(currentCardRef);
      }
      // Revoke the Blob URL to prevent memory leaks
      if (objectUrl && objectUrl.startsWith('blob:')) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [video.url]);

  const handleMouseEnter = () => {
    hoverTimeoutRef.current = window.setTimeout(() => {
      setIsHovering(true);
    }, 300);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    setIsHovering(false);
  };

  useEffect(() => {
    if (isHovering && videoRef.current) {
      videoRef.current.play().catch(error => {
        console.warn("Autoplay was prevented:", error.message);
      });
    } else if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, [isHovering]);
  
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  const handleMetadataLoaded = () => {
    const videoElement = videoRef.current;
    if (videoElement && !hasGeneratedThumbnail.current) {
      hasGeneratedThumbnail.current = true; // Prevents this from running multiple times

      const captureFrame = () => {
        if (!videoElement) return;
        try {
          const canvas = document.createElement('canvas');
          canvas.width = videoElement.videoWidth;
          canvas.height = videoElement.videoHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg');
            videoElement.poster = dataUrl;
            onThumbnailGenerated(dataUrl);
          }
        } catch (error) {
          console.error("Error generating thumbnail from video:", error);
        } finally {
          setIsGeneratingThumbnail(false);
          // Clean up the event listener after it has run once.
          videoElement.removeEventListener('seeked', captureFrame);
        }
      };
      
      videoElement.addEventListener('seeked', captureFrame, { once: true });
      // Seek to the 1-second mark to capture a representative frame.
      videoElement.currentTime = 1;
    } else if (hasGeneratedThumbnail.current) {
      // If metadata loads again, ensure the spinner is hidden.
      setIsGeneratingThumbnail(false);
    }
  };


  const handleCartClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isInCart && !isPurchased) {
      onAddToCart();
    }
  };

  const displayKeywords = video.keywords
    .flatMap(kw => kw.split(/[,;]/))
    .map(k => k.trim())
    .filter(Boolean);

  return (
    <div 
      ref={cardRef}
      className="bg-gray-800 rounded-lg overflow-hidden shadow-lg cursor-pointer group transition-all duration-300 transform hover:scale-105 hover:shadow-indigo-500/30 h-full flex flex-col"
      onClick={onSelect}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="relative flex-grow bg-black aspect-video">
        {resolvedSrc ? (
          <video
            ref={videoRef}
            src={resolvedSrc}
            onLoadedMetadata={handleMetadataLoaded}
            className={`w-full h-full object-cover transition-opacity duration-300 ${isGeneratingThumbnail ? 'opacity-0' : 'opacity-100'}`}
            loop
            muted
            playsInline
            preload="metadata"
            crossOrigin="anonymous" // Required for drawing remote video to canvas
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-900">
             {/* Placeholder until IntersectionObserver triggers load */}
          </div>
        )}
        
        {isGeneratingThumbnail && resolvedSrc && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50">
                <Spinner className="w-8 h-8" />
            </div>
        )}
        
        <div className={`absolute inset-0 bg-black bg-opacity-40 group-hover:bg-opacity-60 transition-all duration-300 flex items-center justify-center ${isGeneratingThumbnail || !resolvedSrc ? 'opacity-0' : 'opacity-100'}`}>
           <PlayIcon className={`w-12 h-12 text-white/80 transform transition-all duration-300 pointer-events-none ${isHovering ? 'opacity-0 scale-75' : 'opacity-100 group-hover:scale-110'}`} />
        </div>
         {video.isFree && (
            <div className="absolute top-2 left-2 bg-yellow-400 text-gray-900 text-xs font-bold px-2 py-1 rounded-full shadow-lg z-10">
                FREE
            </div>
        )}
        <div className={`absolute top-2 right-2 bg-gray-900/70 text-sm font-bold px-3 py-1 rounded-full shadow-lg ${video.isFree ? 'text-white' : 'text-green-400'}`}>
          {video.isFree ? 'Free' : `$${video.price.toFixed(2)}`}
        </div>
        <button
          onClick={handleCartClick}
          disabled={isInCart || isPurchased}
          className={`absolute bottom-2 right-2 p-2 rounded-full transition-all duration-300 opacity-0 group-hover:opacity-100 transform group-hover:scale-110
            ${isInCart || isPurchased
              ? 'bg-green-500 cursor-default' 
              : 'bg-indigo-600 hover:bg-indigo-500'
            }`}
          aria-label={isPurchased ? "Owned" : isInCart ? "Added to cart" : "Add to cart"}
        >
          {isPurchased ? <DownloadIcon className="w-5 h-5 text-white" /> : isInCart ? <CheckIcon className="w-5 h-5 text-white" /> : <CartIcon className="w-5 h-5 text-white" />}
        </button>
      </div>
      <div className="p-4">
        <h3 className="text-lg font-semibold text-white truncate">{video.title}</h3>
        {isAdmin && displayKeywords.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
            {displayKeywords.slice(0, 3).map((keyword) => (
                <span key={keyword} className="px-2 py-1 bg-gray-700 text-xs text-gray-300 rounded-full">
                {keyword}
                </span>
            ))}
            </div>
        )}
      </div>
    </div>
  );
};
