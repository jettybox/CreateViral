import React from 'react';
import { FilmIcon, SearchIcon, InfoIcon, CartIcon, UploadIcon, QuestionMarkCircleIcon, DownloadIcon } from './Icons';
import { Spinner } from './Spinner';

interface HeaderProps {
  onSearch: (term: string) => void;
  isSearching: boolean;
  onGuidanceClick: () => void;
  onTroubleshootingClick: () => void;
  cartItemCount: number;
  onCartClick: () => void;
  undownloadedItemCount: number;
  onPurchasesClick: () => void;
  isAdmin: boolean;
  onUploadClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({ 
  onSearch, 
  isSearching, 
  onGuidanceClick, 
  onTroubleshootingClick, 
  cartItemCount, 
  onCartClick,
  undownloadedItemCount,
  onPurchasesClick,
  isAdmin, 
  onUploadClick 
}) => {
  return (
    <header className="bg-gray-800/50 backdrop-blur-sm sticky top-0 z-40 shadow-lg">
      <div className="container mx-auto px-4 py-4 flex flex-col md:flex-row justify-between items-center">
        <div className="flex items-center gap-3 mb-4 md:mb-0">
          <FilmIcon className="w-10 h-10 text-indigo-400 flex-shrink-0" />
          <div>
            <h1 className="text-2xl font-bold text-white tracking-wider">
              CreateViral.ai
            </h1>
            <p className="text-xs text-gray-400 tracking-wide">AI-Powered Creative Assets</p>
          </div>
        </div>
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="relative flex-grow md:w-80">
            <input
              type="text"
              placeholder="Search assets..."
              className="w-full pl-10 pr-10 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              onChange={(e) => onSearch(e.target.value)}
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <SearchIcon className="w-5 h-5 text-gray-400" />
            </div>
             {isSearching && (
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                <Spinner className="h-5 w-5" />
              </div>
            )}
          </div>
          {isAdmin && (
             <button
                onClick={onUploadClick}
                className="flex-shrink-0 p-2 bg-indigo-600 hover:bg-indigo-500 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
                aria-label="Upload and analyze new video"
              >
                <UploadIcon className="w-6 h-6 text-white" />
              </button>
          )}
          <button
            onClick={onGuidanceClick}
            className="flex-shrink-0 p-2 bg-gray-700 hover:bg-gray-600 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="Show implementation guidance"
          >
            <InfoIcon className="w-6 h-6 text-gray-300" />
          </button>
           <button
            onClick={onTroubleshootingClick}
            className="flex-shrink-0 p-2 bg-gray-700 hover:bg-gray-600 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="Show troubleshooting guide"
          >
            <QuestionMarkCircleIcon className="w-6 h-6 text-gray-300" />
          </button>
           <button
            onClick={onCartClick}
            className="relative flex-shrink-0 p-2 bg-gray-700 hover:bg-gray-600 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="Open shopping cart"
          >
            <CartIcon className="w-6 h-6 text-gray-300" />
            {cartItemCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500 text-xs font-bold text-white">
                {cartItemCount}
              </span>
            )}
          </button>
          <button
            onClick={onPurchasesClick}
            className="relative flex-shrink-0 p-2 bg-gray-700 hover:bg-gray-600 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="Open my downloads"
          >
            <DownloadIcon className="w-6 h-6 text-gray-300" />
            {undownloadedItemCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-xs font-bold text-white">
                {undownloadedItemCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
