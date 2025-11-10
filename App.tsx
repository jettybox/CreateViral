import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { collection, onSnapshot, doc, deleteDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js';
import { db, firebaseInitError } from './firebase-config';
import { Header } from './components/Header';
import { CategoryFilter } from './components/CategoryFilter';
import { VideoGrid } from './components/VideoGrid';
import { Guidance } from './components/Guidance';
import { VideoPlayerModal } from './components/VideoPlayerModal';
import { CartPanel } from './components/CartPanel';
import { PurchasesPanel } from './components/PurchasesPanel';
import { UploadPanel } from './components/UploadPanel';
import { SortDropdown, SortOption } from './components/SortDropdown';
import { Pagination } from './components/Pagination';
import type { VideoFile } from './types';
import { CATEGORIES } from './constants';
import { FilmIcon, WarningIcon } from './components/Icons';
import { getEnhancedSearchTerms, isApiKeyAvailable } from './services/geminiService';
import { setProtectedUrls } from './services/videoCacheService';
import { useAdminMode } from './hooks/useAdminMode';
import { Spinner } from './components/Spinner';
import { ApiKeyBanner } from './components/ApiKeyBanner';
import { Troubleshooting } from './components/Troubleshooting';
import { DiscountBanner } from './components/DiscountBanner';

const VIDEOS_PER_PAGE = 24;

export default function App() {
  const [videos, setVideos] = useState<VideoFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [enhancedSearchTerms, setEnhancedSearchTerms] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortBy, setSortBy] = useState<SortOption>('featured');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedVideo, setSelectedVideo] = useState<VideoFile | null>(null);
  const [isGuidanceOpen, setIsGuidanceOpen] = useState(false);
  const [isTroubleshootingOpen, setIsTroubleshootingOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isPurchasesOpen, setIsPurchasesOpen] = useState(false);
  const [isUploadPanelOpen, setIsUploadPanelOpen] = useState(false);
  const [cart, setCart] = useState<string[]>([]); // Array of video IDs
  const [purchasedVideoIds, setPurchasedVideoIds] = useState<string[]>([]);
  const [downloadedVideoIds, setDownloadedVideoIds] = useState<string[]>([]);
  const [isApiKeyMissing, setIsApiKeyMissing] = useState(false);
  const [isDiscountBannerVisible, setIsDiscountBannerVisible] = useState(true);
  const isAdmin = useAdminMode();

  // Effect to initialize Firebase and fetch data.
  useEffect(() => {
    // Check if the Gemini API key is available from any source.
    setIsApiKeyMissing(!isApiKeyAvailable());

    // Check if Firebase failed to initialize at startup.
    if (firebaseInitError) {
      setConnectionError(firebaseInitError);
      setIsLoading(false);
      return;
    }

    // If db is not available (should be caught by the error above, but for safety).
    if (!db) {
        setConnectionError("A fatal error occurred: The database instance is not available.");
        setIsLoading(false);
        return;
    }
    
    // Set up a real-time listener to the 'videos' collection in Firestore.
    const unsubscribe = onSnapshot(collection(db, "videos"), (snapshot) => {
      // Sanitize data from Firestore to prevent runtime errors from malformed records.
      const videosData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          url: data.url || '',
          thumbnail: data.thumbnail || '',
          title: data.title || 'Untitled Video',
          description: data.description || 'No description available.',
          keywords: Array.isArray(data.keywords) ? data.keywords : [],
          categories: Array.isArray(data.categories) ? data.categories : [],
          price: typeof data.price === 'number' ? data.price : 0.00,
          commercialAppeal: typeof data.commercialAppeal === 'number' ? data.commercialAppeal : 50,
          isFeatured: typeof data.isFeatured === 'boolean' ? data.isFeatured : false,
          isFree: typeof data.isFree === 'boolean' ? data.isFree : false,
          createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now(),
          width: data.width,
          height: data.height,
        } as VideoFile;
      });
      setVideos(videosData);
      setIsLoading(false);
    }, (error: any) => {
      console.error("Error fetching videos from Firestore: ", error);
      let errorMessage = "Could not connect to the database. Please check the browser console for details and ensure your `firebase-config.ts` file is correct.";
      if (error.code === 'permission-denied') {
        errorMessage = "Permission Denied: Could not read from the 'videos' collection. Please check your Firestore Security Rules in the Firebase Console.";
      }
      setConnectionError(errorMessage);
      setIsLoading(false); // Stop loading even if there's an error
    });

    // Clean up the listener when the component unmounts.
    return () => unsubscribe();
  }, []); // Empty dependency array ensures this runs only once on mount.

  // Effect to load purchased videos from localStorage on startup.
  useEffect(() => {
    try {
      const storedPurchases = localStorage.getItem('purchasedVideoIds');
      if (storedPurchases) {
        setPurchasedVideoIds(JSON.parse(storedPurchases));
      }
      const storedDownloads = localStorage.getItem('downloadedVideoIds');
      if (storedDownloads) {
        setDownloadedVideoIds(JSON.parse(storedDownloads));
      }
    } catch (e) {
      console.error("Failed to load user data from localStorage", e);
    }
  }, []);

  // Effect to save purchased videos to localStorage whenever they change.
  useEffect(() => {
    try {
      localStorage.setItem('purchasedVideoIds', JSON.stringify(purchasedVideoIds));
    } catch (e) {
      console.error("Failed to save purchased videos to localStorage", e);
    }
  }, [purchasedVideoIds]);

  // Effect to save downloaded video IDs to localStorage whenever they change.
  useEffect(() => {
    try {
      localStorage.setItem('downloadedVideoIds', JSON.stringify(downloadedVideoIds));
    } catch (e) {
      console.error("Failed to save downloaded videos to localStorage", e);
    }
  }, [downloadedVideoIds]);


  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategory, sortBy]);

  // Effect for semantic search enhancement
  useEffect(() => {
    if (isApiKeyMissing || searchTerm.trim().length < 3) {
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
  }, [searchTerm, isApiKeyMissing]);
  
  // Effect to update protected URLs for the video cache when the cart changes.
  useEffect(() => {
    const protectedVideoUrls = cart
      .map(id => videos.find(v => v.id === id))
      .filter((v): v is VideoFile => !!v)
      .map(v => v.url);
    
    setProtectedUrls(protectedVideoUrls);
  }, [cart, videos]);

  const handleUpdateVideo = useCallback(async (updatedVideo: VideoFile) => {
    if (!db) {
      alert("Database connection is not available. Cannot save changes.");
      return;
    }
    try {
      // Create a reference to the specific document in Firestore.
      const videoRef = doc(db, "videos", updatedVideo.id);
      // Create a plain object from the updatedVideo state, excluding the 'id'.
      const { id, ...videoData } = updatedVideo;
      // Update the document in Firestore with the new data.
      await updateDoc(videoRef, videoData);
      
      // OPTIONAL: Update local state immediately for a responsive UI.
      // Firestore's onSnapshot listener would eventually update this, but doing it
      // manually provides a faster user experience.
      setVideos(currentVideos =>
        currentVideos.map(video =>
          video.id === updatedVideo.id ? updatedVideo : video
        )
      );
      // Also update the selected video to show changes immediately in the modal.
      setSelectedVideo(updatedVideo);
    } catch (error) {
      console.error("Error updating video in Firestore: ", error);
      alert('Failed to save changes to the database. Please check the console for more details.');
    }
  }, []);
  
  const handleThumbnailGenerated = useCallback((videoId: string, thumbnailDataUrl: string) => {
    setVideos(currentVideos =>
      currentVideos.map(video =>
        video.id === videoId 
        ? { ...video, generatedThumbnail: thumbnailDataUrl } 
        : video
      )
    );
  }, []);

  const handleDeleteVideo = useCallback(async (videoId: string) => {
    if (!db) {
        alert("Database connection is not available.");
        return;
    }
    // Simple browser confirmation to prevent accidental deletion.
    if (window.confirm('Are you sure you want to permanently delete this video? This action cannot be undone.')) {
        try {
            await deleteDoc(doc(db, "videos", videoId));
            setSelectedVideo(null); // Close the modal after successful deletion.
        } catch (error) {
            console.error("Error deleting video from Firestore: ", error);
            alert('Failed to delete video. Please check the console for more details.');
        }
    }
  }, []);

  const handleAddToCart = useCallback((videoId: string) => {
    setCart(prevCart => {
      if (prevCart.includes(videoId) || purchasedVideoIds.includes(videoId)) return prevCart;
      return [...prevCart, videoId];
    });
  }, [purchasedVideoIds]);

  const handleRemoveFromCart = useCallback((videoId: string) => {
    setCart(prevCart => prevCart.filter(id => id !== videoId));
  }, []);
  
  const handleClearCart = useCallback(() => {
    setCart([]);
  }, []);

  const handleCheckout = useCallback(() => {
    const itemsToCheckout = cart.map(id => videos.find(v => v.id === id)).filter(Boolean) as VideoFile[];
    const total = itemsToCheckout.reduce((acc, item) => acc + (item.price || 0), 0);

    if (total > 0) {
      alert(`Checkout for ${itemsToCheckout.length} item(s) totaling $${total.toFixed(2)}.
      
This is where you would integrate a payment processor like Stripe.

Upon successful payment, the items would be added to the user's "My Downloads" list.`);
      // In a real app, you would only proceed to the next step after a successful payment.
      // For this demo, we'll add them to the purchased list to show the functionality.
    }
    
    // Add cart items to the purchased list, preventing duplicates.
    setPurchasedVideoIds(prev => [...new Set([...prev, ...cart])]);
    // Clear the cart.
    setCart([]);
    // Close the cart panel.
    setIsCartOpen(false);
    // Automatically open the purchases panel to show the new items.
    setIsPurchasesOpen(true);
  }, [cart, videos]);

  const handleVideoDownloaded = useCallback((videoId: string) => {
    setDownloadedVideoIds(prev => [...new Set([...prev, videoId])]);
  }, []);

  const handleSaveApiKey = useCallback((key: string) => {
    try {
      localStorage.setItem('gemini_api_key', key);
      // Reload the page to ensure the geminiService is re-initialized everywhere with the new key.
      window.location.reload();
    } catch (e) {
      alert("Failed to save API key. Your browser might be in private mode or has storage disabled.");
    }
  }, []);

  const cartItems = useMemo(() => {
    return cart.map(id => videos.find(video => video.id === id)).filter(Boolean) as VideoFile[];
  }, [cart, videos]);

  const purchasedItems = useMemo(() => {
    return purchasedVideoIds.map(id => videos.find(video => video.id === id)).filter(Boolean) as VideoFile[];
  }, [purchasedVideoIds, videos]);

  const filteredAndSortedVideos = useMemo(() => {
    const filtered = videos
      .filter(video => {
        if (selectedCategory === 'All') return true;
        if (selectedCategory === 'Free') return video.isFree;
        return video.categories.includes(selectedCategory);
      })
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
  
  const renderContent = () => {
    if (isLoading) {
        return (
            <div className="text-center py-20">
                <Spinner className="h-12 w-12" />
                <p className="mt-4 text-gray-400">Connecting to database...</p>
            </div>
        );
    }

    if (connectionError) {
      return (
        <div className="text-center py-12 px-4 bg-red-900/20 border border-red-500/30 rounded-lg">
          <WarningIcon className="w-16 h-16 mx-auto text-red-400" />
          <h2 className="mt-4 text-2xl font-bold text-red-300">Application Error</h2>
          <p className="text-red-400 mt-2 max-w-lg mx-auto">{connectionError}</p>
          <div className="text-gray-400 mt-4 text-sm max-w-lg mx-auto text-left space-y-2">
            <p>
                This error can occur for a few reasons:
                <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>The credentials in your <strong>firebase-config.ts</strong> file are incorrect or incomplete.</li>
                    <li>Your Firebase project is not properly configured to allow connections from this website's domain.</li>
                    <li>If the error mentions "Permission Denied", your Firestore Security Rules are blocking access.</li>
                </ul>
            </p>
            <p>
                For public read access, your <strong>Firestore Rules</strong> should be set to:
            </p>
          </div>
          <pre className="text-xs bg-gray-900 p-3 mt-3 rounded-md block max-w-md mx-auto text-left overflow-x-auto">
            <code>
{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow anyone to read from the 'videos' collection
    match /videos/{videoId} {
      allow read: if true;
      allow write: if false; // Protect your data
    }
  }
}`}
            </code>
          </pre>
        </div>
      );
    }

    if (videos.length === 0 && !isApiKeyMissing) {
        return (
            <div className="text-center py-20 bg-gray-800/50 rounded-lg">
                <FilmIcon className="w-16 h-16 mx-auto text-gray-500" />
                <h2 className="mt-4 text-2xl font-bold text-gray-300">Your Collection is Empty</h2>
                <p className="text-gray-400 mt-2 max-w-md mx-auto">
                  It looks like the connection to Firebase was successful, but there are no videos in your 'videos' collection yet. Videos added to your backend will appear here automatically.
                </p>
            </div>
        );
    }

    return (
      <>
        {isDiscountBannerVisible && <DiscountBanner onDismiss={() => setIsDiscountBannerVisible(false)} />}
        <VideoGrid 
          videos={paginatedVideos} 
          onVideoSelect={setSelectedVideo}
          onAddToCart={handleAddToCart}
          cart={cart}
          purchasedVideoIds={purchasedVideoIds}
          onThumbnailGenerated={handleThumbnailGenerated}
          isAdmin={isAdmin}
        />
        {totalPages > 1 && (
          <Pagination 
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        )}
      </>
    );
  };


  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <Header 
        onSearch={setSearchTerm}
        isSearching={isSearching} 
        onGuidanceClick={() => setIsGuidanceOpen(true)}
        onTroubleshootingClick={() => setIsTroubleshootingOpen(true)}
        cartItemCount={cart.length}
        onCartClick={() => setIsCartOpen(true)}
        purchasedItemCount={purchasedItems.length}
        onPurchasesClick={() => setIsPurchasesOpen(true)}
        isAdmin={isAdmin}
        onUploadClick={() => setIsUploadPanelOpen(true)}
      />

      <main className="container mx-auto px-4 py-8">
        {isApiKeyMissing && isAdmin && <ApiKeyBanner onSaveKey={handleSaveApiKey} />}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
          <CategoryFilter
            categories={['All', 'Free', ...CATEGORIES]}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
          />
          <SortDropdown selected={sortBy} onSelect={setSortBy} />
        </div>
        
        {renderContent()}
      </main>
      
      {isGuidanceOpen && (
        <Guidance onClose={() => setIsGuidanceOpen(false)} />
      )}

      {isTroubleshootingOpen && (
        <Troubleshooting onClose={() => setIsTroubleshootingOpen(false)} />
      )}
      
      {isCartOpen && (
        <CartPanel 
          items={cartItems}
          onClose={() => setIsCartOpen(false)}
          onRemoveItem={handleRemoveFromCart}
          onClearCart={handleClearCart}
          onCheckout={handleCheckout}
        />
      )}
      
      {isPurchasesOpen && (
        <PurchasesPanel
          items={purchasedItems}
          onClose={() => setIsPurchasesOpen(false)}
          downloadedVideoIds={downloadedVideoIds}
          onVideoDownloaded={handleVideoDownloaded}
        />
      )}

      {selectedVideo && (
        <VideoPlayerModal
          video={selectedVideo}
          onClose={() => setSelectedVideo(null)}
          onVideoUpdate={handleUpdateVideo}
          onVideoDelete={handleDeleteVideo}
          onAddToCart={handleAddToCart}
          isInCart={cart.includes(selectedVideo.id)}
          isPurchased={purchasedVideoIds.includes(selectedVideo.id)}
          isAdmin={isAdmin}
        />
      )}

      {isAdmin && isUploadPanelOpen && (
        <UploadPanel onClose={() => setIsUploadPanelOpen(false)} />
      )}
    </div>
  );
}
