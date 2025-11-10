import React, { useRef } from 'react';
import type { VideoFile } from '../types';
import { PlayIcon, CartIcon, CheckIcon } from './Icons';

interface VideoCardProps {
  video: VideoFile;
  onSelect: () => void;
  onAddToCart: () => void;
  isInCart: boolean;
}

export const VideoCard: React.FC<VideoCardProps> = ({ video, onSelect, onAddToCart, isInCart }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleMouseEnter = () => {
    videoRef.current?.play().catch(error => {
      console.warn("Video autoplay was prevented:", error);
    });
  };

  const handleMouseLeave = () => {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  const handleCartClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isInCart) {
      onAddToCart();
    }
  };

  // Defensively parse keywords. This handles cases where keywords might be a single string
  // inside an array, e.g., ["key1, key2, key3"]. It splits them into individual tags.
  const displayKeywords = video.keywords
    .flatMap(kw => kw.split(/[,;]/))
    .map(k => k.trim())
    .filter(Boolean);

  return (
    <div 
      className="bg-gray-800 rounded-lg overflow-hidden shadow-lg cursor-pointer group transition-all duration-300 transform hover:scale-105 hover:shadow-indigo-500/30 h-full flex flex-col"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="relative flex-grow bg-black" onClick={onSelect}>
        <video
          ref={videoRef}
          src={video.url}
          poster={video.thumbnail}
          className="w-full h-full object-cover"
          loop
          muted
          playsInline
        />
        <div className="absolute inset-0 bg-black bg-opacity-20 group-hover:bg-opacity-50 transition-all duration-300 flex items-center justify-center">
          <PlayIcon className="w-16 h-16 text-white opacity-0 group-hover:opacity-100 transform group-hover:scale-110 transition-all duration-300 pointer-events-none" />
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
      <div className="p-4" onClick={onSelect}>
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
