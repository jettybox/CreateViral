import React, { useState, useRef, useEffect, useMemo } from 'react';
import type { VideoFile } from '../types';
import { PlayIcon, CartIcon, CheckIcon, DownloadIcon } from './Icons';
import { Spinner } from './Spinner';
import { getCachedVideoUrl, correctUrlForBackblaze } from '../services/videoCacheService';

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
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);
  const [isGeneratingThumbnail, setIsGeneratingThumbnail] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<number | null>(null);
  const hasGeneratedThumbnail = useRef(false);
  const isTouchDevice = useRef(typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0));

  const correctedThumbnailUrl = useMemo(() => {
    if (video.thumbnail && !video.thumbnail.startsWith('data:')) {
      return correctUrlForBackblaze(video.thumbnail);
    }
    return video.thumbnail;
  }, [video.thumbnail]);

  // The final source for the image tag. Prioritize the permanent generated thumbnail, then the remote URL.
  const displayThumbnailSrc = video.generatedThumbnail || correctedThumbnailUrl;

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
              getCachedVideoUrl(video.url).then((url) => {
                objectUrl = url;
                setResolvedSrc(url);
              });
              observer.unobserve(currentCardRef);
            }
          });
        },
        { rootMargin: '200px' }
      );
      observer.observe(currentCardRef);
    }

    return () => {
      if (currentCardRef && observer) {
        observer.unobserve(currentCardRef);
      }
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
  
  // Effect to play/pause video on hover, but only on non-touch devices
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
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  // This function runs when the video element has loaded enough data to capture a frame.
  // It's triggered only when `isGeneratingThumbnail` is true.
  const handleDataLoaded = () => {
    const videoElement = videoRef.current;
    
    if (isGeneratingThumbnail && videoElement && !hasGeneratedThumbnail.current) {
      hasGeneratedThumbnail.current = true; // Prevents re-running in the same session

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
            // Notify the parent component to save this thumbnail to the database.
            onThumbnailGenerated(dataUrl);
          }
        } catch (error) {
          console.error("Error generating thumbnail from video:", error);
        } finally {
          // The generation attempt is complete. This will hide the spinner.
          setIsGeneratingThumbnail(false);
        }
      };
      
      videoElement.addEventListener('seeked', captureFrame, { once: true });
      videoElement.currentTime = 1; // Seek to the 1-second mark.
    }
  };

  // This is the trigger for the self-healing process.
  const handleThumbnailError = () => {
    // If the primary thumbnail URL (from the CSV) fails AND we don't already have
    // a generated one from the database, kick off the generation process.
    if (!video.generatedThumbnail) {
      console.warn(`Thumbnail for ${video.id} failed. Generating fallback.`);
      setIsGeneratingThumbnail(true);
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
      onMouseEnter={isTouchDevice.current ? undefined : handleMouseEnter}
      onMouseLeave={isTouchDevice.current ? undefined : handleMouseLeave}
    >
      <div className="relative flex-grow bg-black aspect-video">
        {/* Layer 1: Thumbnail Image (Always present, used as poster) */}
        <img
          src={displayThumbnailSrc || ''}
          alt={video.title}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${isHovering ? 'opacity-0' : 'opacity-100'}`}
          referrerPolicy="no-referrer"
          loading="lazy"
          onError={handleThumbnailError}
        />

        {/* Layer 2: Video Player (Hidden by default, revealed on hover on desktop) */}
        {resolvedSrc && (
          <video
            ref={videoRef}
            src={resolvedSrc}
            onLoadedData={handleDataLoaded}
            className="absolute inset-0 w-full h-full object-cover"
            loop
            muted
            playsInline
            preload="metadata"
            crossOrigin="anonymous" // Required for drawing remote video to canvas
          />
        )}
        
        {/* Layer 3: Loading/Generating Spinner Overlay */}
        {(isGeneratingThumbnail || !resolvedSrc) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/70 text-white p-2 text-center">
                <Spinner className="w-8 h-8" />
                {isGeneratingThumbnail && (
                  <p className="mt-2 text-sm font-semibold">Generating thumbnail...</p>
                )}
            </div>
        )}
        
        {/* Layer 4: UI Overlay (Play icon, price, etc.) */}
        <div className="absolute inset-0 bg-black bg-opacity-40 group-hover:bg-opacity-60 transition-all duration-300 flex items-center justify-center">
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
