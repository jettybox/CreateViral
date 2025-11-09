import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Header } from './components/Header';
import { CategoryFilter } from './components/CategoryFilter';
import { VideoGrid } from './components/VideoGrid';
import { Guidance } from './components/Guidance';
import { VideoPlayerModal } from './components/VideoPlayerModal';
import { CartPanel } from './components/CartPanel';
import { SortDropdown, SortOption } from './components/SortDropdown';
import { Pagination } from './components/Pagination';
import type { VideoFile } from './types';
import { CATEGORIES } from './constants';
import { FilmIcon, SparklesIcon } from './components/Icons';
import { getEnhancedSearchTerms } from './services/geminiService';
import { useAdminMode } from './hooks/useAdminMode';

const VIDEOS_PER_PAGE = 24;

const DiscountBanner: React.FC = () => {
  return (
    <div className="bg-indigo-600/80 backdrop-blur-sm text-white rounded-lg p-4 mb-8 flex items-center gap-4 shadow-lg border border-indigo-500/50">
      <SparklesIcon className="w-8 h-8 text-yellow-300 flex-shrink-0" />
      <div>
        <h3 className="font-bold text-lg">Bundle & Save!</h3>
        <p className="text-sm">
          Get amazing discounts on bulk purchases. <strong>Buy 5 videos for $20</strong> (save $5) or <strong>10 videos for $35</strong> (save $15)!
        </p>
      </div>
    </div>
  );
};

export default function App() {
  const [videos, setVideos] = useState<VideoFile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [enhancedSearchTerms, setEnhancedSearchTerms] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortBy, setSortBy] = useState<SortOption>('featured');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedVideo, setSelectedVideo] = useState<VideoFile | null>(null);
  const [isGuidanceOpen, setIsGuidanceOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [cart, setCart] = useState<string[]>([]); // Array of video IDs
  const isAdmin = useAdminMode();

  useEffect(() => {
    // This is where you would fetch videos from your Firebase/Firestore database
    // For now, we'll keep it empty.
    // e.g., fetchVideosFromFirestore().then(setVideos);
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategory, sortBy]);

  // Effect for semantic search enhancement
  useEffect(() => {
    if (searchTerm.trim().length < 3) {
      setEnhancedSearchTerms(searchTerm.trim() ? [searchTerm.trim()] : []);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const handler = setTimeout(async () => {
      try {
        const terms = await getEnhancedSearchTerms(searchTerm);
        setEnhancedSearchTerms(terms);
      } catch (error) {
        console.error("Failed to get enhanced search terms, falling back to basic search.", error);
        setEnhancedSearchTerms([searchTerm]); // Fallback to exact match
      } finally {
        setIsSearching(false);
      }
    }, 500); // 500ms debounce

    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm]);

  const handleUpdateVideo = useCallback((updatedVideo: VideoFile) => {
    setVideos(currentVideos =>
      currentVideos.map(video =>
        video.id === updatedVideo.id ? updatedVideo : video
      )
    );
    setSelectedVideo(updatedVideo); // Also update the selected video to show changes immediately
  }, []);

  const handleAddToCart = useCallback((videoId: string) => {
    setCart(prevCart => {
      if (prevCart.includes(videoId)) return prevCart;
      return [...prevCart, videoId];
    });
  }, []);

  const handleRemoveFromCart = useCallback((videoId: string) => {
    setCart(prevCart => prevCart.filter(id => id !== videoId));
  }, []);
  
  const handleClearCart = useCallback(() => {
    setCart([]);
  }, []);

  const cartItems = useMemo(() => {
    return cart.map(id => videos.find(video => video.id === id)).filter(Boolean) as VideoFile[];
  }, [cart, videos]);

  const filteredAndSortedVideos = useMemo(() => {
    const filtered = videos
      .filter(video =>
        selectedCategory === 'All' || video.categories.includes(selectedCategory)
      )
      .filter(video => {
        if (searchTerm.trim().length === 0) return true;
        
        const termsToMatch = enhancedSearchTerms.length > 0 ? enhancedSearchTerms : [searchTerm];
        const videoText = `${video.title} ${video.description} ${video.keywords.join(' ')}`.toLowerCase();

        return termsToMatch.some(term => videoText.includes(term.toLowerCase()));
      });

    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'featured':
          if (a.isFeatured !== b.isFeatured) return b.isFeatured ? 1 : -1;
          return b.commercialAppeal - a.commercialAppeal; // Fallback to popularity
        case 'popular':
          return b.commercialAppeal - a.commercialAppeal;
        case 'newest':
          return b.createdAt - a.createdAt;
        case 'price-asc':
          return a.price - b.price;
        case 'price-desc':
          return b.price - a.price;
        default:
          return 0;
      }
    });
  }, [videos, selectedCategory, searchTerm, enhancedSearchTerms, sortBy]);

  const totalPages = Math.ceil(filteredAndSortedVideos.length / VIDEOS_PER_PAGE);
  const paginatedVideos = useMemo(() => {
    const startIndex = (currentPage - 1) * VIDEOS_PER_PAGE;
    return filteredAndSortedVideos.slice(startIndex, startIndex + VIDEOS_PER_PAGE);
  }, [filteredAndSortedVideos, currentPage]);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <Header 
        onSearch={setSearchTerm}
        isSearching={isSearching} 
        onGuidanceClick={() => setIsGuidanceOpen(true)}
        cartItemCount={cart.length}
        onCartClick={() => setIsCartOpen(true)}
      />

      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
          <CategoryFilter
            categories={['All', ...CATEGORIES]}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
          />
          <SortDropdown selected={sortBy} onSelect={setSortBy} />
        </div>
        
        {videos.length > 0 && <DiscountBanner />}

        {videos.length === 0 ? (
            <div className="text-center py-20 bg-gray-800/50 rounded-lg">
                <FilmIcon className="w-16 h-16 mx-auto text-gray-500" />
                <h2 className="mt-4 text-2xl font-bold text-gray-300">Your Collection is Empty</h2>
                <p className="text-gray-400 mt-2">
                  Videos added to your backend storage will appear here automatically after processing.
                </p>
            </div>
        ) : (
          <>
            <VideoGrid 
              videos={paginatedVideos} 
              onVideoSelect={setSelectedVideo}
              onAddToCart={handleAddToCart}
              cart={cart}
            />
            {totalPages > 1 && (
              <Pagination 
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            )}
          </>
        )}
      </main>
      
      {isGuidanceOpen && (
        <Guidance onClose={() => setIsGuidanceOpen(false)} />
      )}
      
      {isCartOpen && (
        <CartPanel 
          items={cartItems}
          onClose={() => setIsCartOpen(false)}
          onRemoveItem={handleRemoveFromCart}
          onClearCart={handleClearCart}
        />
      )}

      {selectedVideo && (
        <VideoPlayerModal
          video={selectedVideo}
          onClose={() => setSelectedVideo(null)}
          onVideoUpdate={handleUpdateVideo}
          onAddToCart={handleAddToCart}
          isInCart={cart.includes(selectedVideo.id)}
          isAdmin={isAdmin}
        />
      )}
    </div>
  );
}