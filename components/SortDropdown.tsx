import React, { useState } from 'react';
import { SortAscendingIcon, CheckIcon } from './Icons';

export type SortOption = 'featured' | 'popular' | 'newest' | 'price-asc' | 'price-desc';

const sortOptions: { key: SortOption; label: string }[] = [
  { key: 'featured', label: 'Featured' },
  { key: 'popular', label: 'Popularity' },
  { key: 'newest', label: 'Newest' },
  { key: 'price-asc', label: 'Price: Low to High' },
  { key: 'price-desc', label: 'Price: High to Low' },
];

interface SortDropdownProps {
  selected: SortOption;
  onSelect: (option: SortOption) => void;
}

export const SortDropdown: React.FC<SortDropdownProps> = ({ selected, onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (option: SortOption) => {
    onSelect(option);
    setIsOpen(false);
  };

  const selectedLabel = sortOptions.find(opt => opt.key === selected)?.label;

  return (
    <div className="relative inline-block text-left">
      <div>
        <button
          type="button"
          className="inline-flex justify-center w-full rounded-md border border-gray-600 shadow-sm px-4 py-2 bg-gray-700 text-sm font-medium text-gray-300 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500"
          id="options-menu"
          aria-haspopup="true"
          aria-expanded="true"
          onClick={() => setIsOpen(!isOpen)}
        >
          <SortAscendingIcon className="w-5 h-5 mr-2" />
          {selectedLabel}
        </button>
      </div>

      {isOpen && (
        <div 
          className="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-gray-700 ring-1 ring-black ring-opacity-5 z-50"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="py-1" role="menu" aria-orientation="vertical" aria-labelledby="options-menu">
            {sortOptions.map((option) => (
              <a
                key={option.key}
                href="#"
                className={`flex justify-between items-center px-4 py-2 text-sm ${
                  selected === option.key ? 'font-bold text-white' : 'text-gray-300'
                } hover:bg-gray-600 hover:text-white`}
                role="menuitem"
                onClick={(e) => {
                  e.preventDefault();
                  handleSelect(option.key);
                }}
              >
                {option.label}
                {selected === option.key && <CheckIcon className="w-5 h-5 text-indigo-400" />}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};