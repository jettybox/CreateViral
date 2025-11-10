import React from 'react';
import { SparklesIcon, XIcon } from './Icons';

interface DiscountBannerProps {
  onDismiss: () => void;
}

export const DiscountBanner: React.FC<DiscountBannerProps> = ({ onDismiss }) => {
  return (
    <div className="relative bg-indigo-600/80 backdrop-blur-sm text-white rounded-lg p-4 mb-8 flex items-center gap-4 shadow-lg border border-indigo-500/50">
      <SparklesIcon className="w-8 h-8 text-yellow-300 flex-shrink-0" />
      <div>
        <h3 className="font-bold text-lg">Bundle & Save!</h3>
        <p className="text-sm">
          Get amazing discounts on bulk purchases. <strong>Buy 5 videos for $20</strong> (save $5) or <strong>10 videos for $35</strong> (save $15)!
        </p>
      </div>
      <button 
        onClick={onDismiss} 
        className="absolute top-2 right-2 p-1 text-indigo-200 hover:text-white rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-white"
        aria-label="Dismiss banner"
      >
        <XIcon className="w-5 h-5" />
      </button>
    </div>
  );
};
