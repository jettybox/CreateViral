import React, { useState, useRef, useEffect } from 'react';
import type { VideoFile } from '../types';
import { PlayIcon, CartIcon, CheckIcon } from './Icons';
import { Spinner } from './Spinner';

interface VideoCardProps {
  video: VideoFile;
  onSelect: () => void;
  onAddToCart: () => void;
  isInCart: boolean;
}

export const VideoCard: React.FC<VideoCardProps> = ({ video, onSelect, onAddToCart, isInCart }) => {
  const [isHovering, setIsHovering] = useState(false);
  const [isGeneratingThumbnail, setIsGeneratingThumbnail] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hoverTimeoutRef = useRef<number | null>(null);
  const hasGeneratedThumbnail = useRef(false);

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
            videoElement.poster = canvas.toDataURL('image/jpeg');
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
    if (!isInCart) {
      onAddToCart();
    }
  };

  const displayKeywords = video.keywords
    .flatMap(kw => kw.split(/[,;]/))
    .map(k => k.trim())
    .filter(Boolean);

  return (
    <div 
      className="bg-gray-800 rounded-lg overflow-hidden shadow-lg cursor-pointer group transition-all duration-300 transform hover:scale-105 hover:shadow-indigo-500/30 h-full flex flex-col"
      onClick={onSelect}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="relative flex-grow bg-black aspect-video">
        <video
          ref={videoRef}
          src={video.url}
          onLoadedMetadata={handleMetadataLoaded}
          className={`w-full h-full object-cover transition-opacity duration-300 ${isGeneratingThumbnail ? 'opacity-0' : 'opacity-100'}`}
          loop
          muted
          playsInline
          preload="metadata"
          crossOrigin="anonymous" // Required for drawing remote video to canvas
        />
        
        {isGeneratingThumbnail && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                <Spinner className="w-8 h-8" />
            </div>
        )}
        
        <div className={`absolute inset-0 bg-black bg-opacity-40 group-hover:bg-opacity-60 transition-all duration-300 flex items-center justify-center ${isGeneratingThumbnail ? 'opacity-0' : 'opacity-100'}`}>
           <PlayIcon className={`w-12 h-12 text-white/80 transform transition-all duration-300 pointer-events-none ${isHovering ? 'opacity-0 scale-75' : 'opacity-100 group-hover:scale-110'}`} />
        </div>
        <div className="absolute top-2 right-2 bg-green-600/90 text-white text-sm font-bold px-3 py-1 rounded-full shadow-lg">
          ${video.price.toFixed(2)}
        </div>
        <button
          onClick={handleCartClick}
          className={`absolute bottom-2 right-2 p-2 rounded-full transition-all duration-300 opacity-0 group-hover:opacity-100 transform group-hover:scale-110
            ${isInCart 
              ? 'bg-green-500 cursor-default' 
              : 'bg-indigo-600 hover:bg-indigo-500'
            }`}
          aria-label={isInCart ? "Added to cart" : "Add to cart"}
        >
          {isInCart ? <CheckIcon className="w-5 h-5 text-white" /> : <CartIcon className="w-5 h-5 text-white" />}
        </button>
      </div>
      <div className="p-4">
        <h3 className="text-lg font-semibold text-white truncate">{video.title}</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {displayKeywords.slice(0, 3).map((keyword) => (
            <span key={keyword} className="px-2 py-1 bg-gray-700 text-xs text-gray-300 rounded-full">
              {keyword}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
