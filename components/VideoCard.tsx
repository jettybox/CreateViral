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
  isAdmin: boolean;
}

export const VideoCard: React.FC<VideoCardProps> = ({ video, onSelect, onAddToCart, isInCart, isPurchased, isAdmin }) => {
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  
  // A reliable way to detect touch capabilities to avoid running hover effects.
  const isTouchDevice = useMemo(() => 
    typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0), 
  []);

  const correctedThumbnailUrl = useMemo(() => {
    if (video.thumbnail) {
      return correctUrlForBackblaze(video.thumbnail);
    }
    return '';
  }, [video.thumbnail]);

  // Lazy-load video when it comes into view
  useEffect(() => {
    let observer: IntersectionObserver;
    const currentCardRef = cardRef.current;

    if (currentCardRef) {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setIsLoading(true);
              getCachedVideoUrl(video.url).then((url) => {
                setResolvedSrc(url);
                // The video element's own events will handle turning off the spinner.
              });
              observer.unobserve(currentCardRef);
            }
          });
        },
        { rootMargin: '200px' } // Start loading when 200px away from the viewport
      );
      observer.observe(currentCardRef);
    }

    return () => {
      if (currentCardRef && observer) {
        observer.unobserve(currentCardRef);
      }
    };
  }, [video.url]);

  const handleMouseEnter = () => {
    if (isTouchDevice || !videoRef.current) return;
    videoRef.current?.play().catch(error => {
      // Autoplay was prevented, which is common. No need to log.
    });
  };

  const handleMouseLeave = () => {
    if (isTouchDevice || !videoRef.current) return;
    const videoEl = videoRef.current;
    videoEl.pause();
    // Calling load() is the most reliable way to reset the video element
    // back to its initial state, showing the poster image.
    videoEl.load();
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
        <video
          ref={videoRef}
          src={resolvedSrc ? `${resolvedSrc}#t=0.1` : ''}
          poster={correctedThumbnailUrl}
          className="absolute inset-0 w-full h-full object-cover"
          loop
          muted
          playsInline
          preload="metadata"
          crossOrigin="anonymous"
          onCanPlay={() => setIsLoading(false)}
          onLoadedData={() => setIsLoading(false)}
          onError={() => setIsLoading(false)} 
        />
        
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50">
            <Spinner className="w-8 h-8" />
          </div>
        )}
        
        <div className="absolute inset-0 bg-black bg-opacity-20 group-hover:bg-opacity-60 transition-all duration-300 flex items-center justify-center pointer-events-none">
           <PlayIcon className="w-12 h-12 text-white/80 transition-opacity duration-300 opacity-100 group-hover:opacity-0" />
        </div>

        {video.isFree && (
            <div className="absolute top-2 left-2 bg-yellow-400 text-gray-900 text-xs font-bold px-2 py-1 rounded-full shadow-lg z-10">
                FREE
            </div>
        )}

        <div className={`absolute top-2 right-2 bg-gray-900/70 text-sm font-bold px-3 py-1 rounded-full shadow-lg z-10 ${video.isFree ? 'text-white' : 'text-green-400'}`}>
          {video.isFree ? 'Free' : `$${video.price.toFixed(2)}`}
        </div>

        <button
          onClick={handleCartClick}
          disabled={isInCart || isPurchased}
          className={`absolute bottom-2 right-2 p-2 rounded-full transition-all duration-300 opacity-0 group-hover:opacity-100 transform group-hover:scale-110 z-10
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
