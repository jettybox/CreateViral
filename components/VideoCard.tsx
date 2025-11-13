import React, { useState, useRef, useEffect, useMemo } from 'react';
import type { VideoFile } from '../types';
import { PlayIcon, CartIcon, CheckIcon, DownloadIcon } from './Icons';
import { Spinner } from './Spinner';
import { getCachedVideoUrl } from '../services/videoCacheService';

interface VideoCardProps {
  video: VideoFile;
  onSelect: () => void;
  onAddToCart: () => void;
  onGetFreeItem: () => void;
  isInCart: boolean;
  isPurchased: boolean;
  isAdmin: boolean;
}

export const VideoCard: React.FC<VideoCardProps> = ({ video, onSelect, onAddToCart, onGetFreeItem, isInCart, isPurchased, isAdmin }) => {
  const [isHovering, setIsHovering] = useState(false);
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<number | null>(null);
  const isTouchDevice = useRef(typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0));

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
    const videoElement = videoRef.current;
    if (videoElement) {
      if (isHovering) {
        // Ensure playback starts from the beginning on each hover
        videoElement.currentTime = 0;
        const playPromise = videoElement.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            // This is a common browser policy, not a critical error.
            console.warn("Autoplay was prevented:", error.message);
          });
        }
      } else {
        // When hover ends, pause the video and call load() to reset it.
        // This forces the browser to display the poster image again,
        // rather than the first frame of the video.
        videoElement.pause();
        videoElement.load();
      }
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

  const handleActionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPurchased) return;

    if (video.isFree) {
      onGetFreeItem();
    } else {
      if (!isInCart) {
        onAddToCart();
      }
    }
  };


  const displayKeywords = video.keywords
    .flatMap(kw => kw.split(/[,;]/))
    .map(k => k.trim())
    .filter(Boolean);

  const renderActionButton = () => {
    if (isPurchased) {
      return {
        icon: <DownloadIcon className="w-5 h-5 text-white" />,
        label: "Owned",
        className: "bg-green-500 cursor-default",
        disabled: true,
      };
    }
    if (video.isFree) {
      return {
        icon: <DownloadIcon className="w-5 h-5 text-white" />,
        label: "Get for Free",
        className: "bg-indigo-600 hover:bg-indigo-500",
        disabled: false,
      };
    }
    if (isInCart) {
      return {
        icon: <CheckIcon className="w-5 h-5 text-white" />,
        label: "Added to cart",
        className: "bg-green-500 cursor-default",
        disabled: true,
      };
    }
    return {
      icon: <CartIcon className="w-5 h-5 text-white" />,
      label: "Add to cart",
      className: "bg-indigo-600 hover:bg-indigo-500",
      disabled: false,
    };
  };

  const actionButton = renderActionButton();

  return (
    <div 
      ref={cardRef}
      className="bg-gray-800 rounded-lg overflow-hidden shadow-lg cursor-pointer group transition-all duration-300 transform hover:scale-105 hover:shadow-xl hover:shadow-indigo-500/40 h-full flex flex-col"
      onClick={onSelect}
      onMouseEnter={isTouchDevice.current ? undefined : handleMouseEnter}
      onMouseLeave={isTouchDevice.current ? undefined : handleMouseLeave}
    >
      <div className="relative flex-grow bg-black aspect-video">
        {/* Layer 1: Thumbnail Image (Always present, used as poster) */}
        <img
          src={video.thumbnail || ''}
          alt={video.title}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${isHovering ? 'opacity-0' : 'opacity-100'}`}
          referrerPolicy="no-referrer"
          loading="lazy"
        />

        {/* Layer 2: Video Player (Hidden by default, revealed on hover on desktop) */}
        {resolvedSrc && (
          <video
            ref={videoRef}
            src={resolvedSrc}
            poster={video.thumbnail || ''}
            className="absolute inset-0 w-full h-full object-cover"
            loop
            muted
            playsInline
            preload="metadata"
          />
        )}
        
        {/* Layer 3: Loading Spinner Overlay */}
        {!resolvedSrc && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/70 text-white p-2 text-center">
                <Spinner className="w-8 h-8" />
            </div>
        )}
        
        {/* Layer 4: UI Overlay (Play icon, price, etc.) */}
        <div className="absolute inset-0 bg-black bg-opacity-40 group-hover:bg-opacity-20 transition-all duration-300 flex items-center justify-center">
           <PlayIcon className={`w-12 h-12 text-white/80 transform transition-all duration-300 pointer-events-none ${isHovering ? 'opacity-0 scale-75' : 'opacity-100 group-hover:scale-110'}`} />
        </div>
        <div className={`absolute top-2 right-2 text-sm font-bold px-3 py-1 rounded-full shadow-lg ${
            video.isFree 
            ? 'bg-yellow-400 text-gray-900' 
            : 'bg-gray-900/70 text-green-400'
        }`}>
          {video.isFree ? 'Free' : `$${video.price.toFixed(2)}`}
        </div>
        <button
          onClick={handleActionClick}
          disabled={actionButton.disabled}
          className={`absolute bottom-2 right-2 p-2 rounded-full transition-all duration-300 opacity-0 group-hover:opacity-100 transform group-hover:scale-110 ${actionButton.className}`}
          aria-label={actionButton.label}
        >
          {actionButton.icon}
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
