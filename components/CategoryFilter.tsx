import React from 'react';

interface CategoryFilterProps {
  categories: string[];
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
}

export const CategoryFilter: React.FC<CategoryFilterProps> = ({
  categories,
  selectedCategory,
  onSelectCategory,
}) => {
  return (
    <div className="flex flex-wrap gap-2">
      {categories.map((category) => (
        <button
          key={category}
          onClick={() => onSelectCategory(category)}
          className={`px-4 py-2 text-sm font-medium rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black ${
            selectedCategory === category
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg focus:ring-amber-400'
              : 'bg-white/10 text-gray-300 hover:bg-white/20 focus:ring-gray-500'
          }`}
        >
          {category}
        </button>
      ))}
    </div>
  );
};
