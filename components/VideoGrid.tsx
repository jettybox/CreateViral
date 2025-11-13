import React from 'react';
import type { VideoFile } from '../types';
import { VideoCard } from './VideoCard';

interface VideoGridProps {
  videos: VideoFile[];
  onVideoSelect: (video: VideoFile) => void;
  onAddToCart: (videoId: string) => void;
  onGetFreeItem: (videoId: string) => void;
  cart: string[];
  purchasedVideoIds: string[];
  isAdmin: boolean;
}

export const VideoGrid: React.FC<VideoGridProps> = ({ videos, onVideoSelect, onAddToCart, onGetFreeItem, cart, purchasedVideoIds, isAdmin }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {videos.map((video) => {
        const isVertical = video.width && video.height && video.width < video.height;
        return (
          <div key={video.id} className={isVertical ? 'sm:row-span-2' : ''}>
            <VideoCard 
              video={video} 
              onSelect={() => onVideoSelect(video)} 
              onAddToCart={() => onAddToCart(video.id)}
              onGetFreeItem={() => onGetFreeItem(video.id)}
              isInCart={cart.includes(video.id)}
              isPurchased={purchasedVideoIds.includes(video.id)}
              isAdmin={isAdmin}
            />
          </div>
        );
      })}
    </div>
  );
};
