import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { collection, onSnapshot, doc, deleteDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-functions.js';
import { db, app, firebaseInitError } from './firebase-config';
import { Header } from './components/Header';
import { CategoryFilter } from './components/CategoryFilter';
import { VideoGrid } from './components/VideoGrid';
import { VideoPlayerModal } from './components/VideoPlayerModal';
import { CartPanel } from './components/CartPanel';
import { PurchasesPanel } from './components/PurchasesPanel';
import { UploadPanel } from './components/UploadPanel';
import { SortDropdown, SortOption } from './components/SortDropdown';
import type { VideoFile } from './types';
import { CATEGORIES } from './constants';
import { FilmIcon, WarningIcon } from './components/Icons';
import { getEnhancedSearchTerms } from './services/geminiService';
import { setProtectedUrls } from './services/videoCacheService';
import { useAdminMode } from './hooks/useAdminMode';
import { Spinner } from './components/Spinner';
import { DiscountBanner } from './components/DiscountBanner';
import { AboutModal } from './components/AboutModal';
import { LicenseModal } from './components/LicenseModal';

const VIDEOS_PER_PAGE = 20;

export default function App() {
  const [videos, setVideos] = useState<VideoFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [enhancedSearchTerms, setEnhancedSearchTerms] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortBy, setSortBy] = useState<SortOption>('featured');
  const [pagesLoaded, setPagesLoaded] = useState(1);
  const [selectedVideo, setSelectedVideo] = useState<VideoFile | null>(null);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
  const [isLicenseModalOpen, setIsLicenseModalOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isPurchasesOpen, setIsPurchasesOpen] = useState(false);
  const [isUploadPanelOpen, setIsUploadPanelOpen] = useState(false);
  const [cart, setCart] = useState<string[]>(() => {
    // Initialize state from localStorage to persist across sessions.
    try {
      const saved = localStorage.getItem('cart');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Could not load cart from local storage", e);
      return [];
    }
  });
  const [purchasedVideoIds, setPurchasedVideoIds] = useState<string[]>(() => {
    // Initialize state from localStorage to persist across sessions.
    try {
      const saved = localStorage.getItem('purchasedVideoIds');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Could not load purchased videos from local storage", e);
      return [];
    }
  });
  const [downloadedVideoIds, setDownloadedVideoIds] = useState<string[]>(() => {
    // Initialize state from localStorage to persist across sessions.
    try {
      const saved = localStorage.getItem('downloadedVideoIds');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Could not load downloaded videos from local storage", e);
      return [];
    }
  });
  const [isDiscountBannerVisible, setIsDiscountBannerVisible] = useState(true);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [isVerifyingPurchase, setIsVerifyingPurchase] = useState(false);
  const isAdmin = useAdminMode();
  const debounceTimeout = useRef<number | null>(null);

  // Effect to initialize Firebase and fetch data.
  useEffect(() => {
    if (firebaseInitError) {
      setConnectionError(firebaseInitError);
      setIsLoading(false);
      return;
    }
    if (!db) {
        setConnectionError("A fatal error occurred: The database instance is not available.");
        setIsLoading(false);
        return;
    }
    const unsubscribe = onSnapshot(collection(db, "videos"), (snapshot) => {
      const videosData: VideoFile[] = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          url: data.url || '',
          thumbnail: data.thumbnail || '',
          title: data.title || 'Untitled',
          description: data.description || '',
          keywords: Array.isArray(data.keywords) ? data.keywords : [],
          categories: Array.isArray(data.categories) ? data.categories : [],
          price: typeof data.price === 'number' ? data.price : 0,
          commercialAppeal: data.commercialAppeal || 0,
          isFeatured: data.isFeatured || false,
          isFree: data.isFree || false,
          createdAt: data.createdAt || 0,
          width: data.width,
          height: data.height,
        };
      });
      setVideos(videosData);
      setIsLoading(false);
      setConnectionError(null);
    }, (error) => {
      console.error("Firebase connection error:", error);
      setConnectionError("Failed to connect to the video database. Please check your internet connection and Firebase configuration.");
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Effect to handle verification after Stripe redirect.
  useEffect(() => {
    const verifyPurchase = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const checkoutStatus = urlParams.get('checkout');
      const sessionIdFromUrl = urlParams.get('session_id');

      if (checkoutStatus === 'success' && sessionIdFromUrl) {
        setIsVerifyingPurchase(true);
        const pendingSessionRaw = localStorage.getItem('pendingCheckoutSession');
        
        // Clean up URL and local storage regardless of outcome
        window.history.replaceState({}, document.title, window.location.pathname);
        localStorage.removeItem('pendingCheckoutSession');

        if (pendingSessionRaw) {
          const pendingSession = JSON.parse(pendingSessionRaw);
          if (pendingSession.sessionId === sessionIdFromUrl) {
            try {
              if (!app) throw new Error("Firebase app is not initialized.");
              const functions = getFunctions(app);
              const verifyCheckoutSession = httpsCallable(functions, 'verifyCheckoutSession');
              
              const { data } = await verifyCheckoutSession({ sessionId: sessionIdFromUrl });
              const { purchasedVideoIds: verifiedIds } = data as { purchasedVideoIds: string[] };

              if (verifiedIds && verifiedIds.length > 0) {
                 setPurchasedVideoIds(prev => [...new Set([...prev, ...verifiedIds])]);
                 setCart(prev => prev.filter(id => !verifiedIds.includes(id)));
                 setIsPurchasesOpen(true);
                 alert('Thank you for your purchase! Your downloads are now available.');
              } else {
                 throw new Error("Verification succeeded, but no purchased items were returned.");
              }

            } catch (error: any) {
              console.error("Purchase verification failed:", error);
              alert(`There was a problem verifying your purchase. Please contact support if you have been charged. Error: ${error.message}`);
            } finally {
              setIsVerifyingPurchase(false);
            }
          } else {
            console.warn("Mismatched session ID on return. Aborting verification.");
            setIsVerifyingPurchase(false);
          }
        }
      } else if (checkoutStatus === 'cancel') {
          alert("Your checkout session was cancelled. Your cart has been saved.");
          window.history.replaceState({}, document.title, window.location.pathname);
      }
    };
    verifyPurchase();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app]); // Dependency on `app` to ensure Firebase is ready.

  // Effect to protect cart items from cache eviction.
  useEffect(() => {
    const cartItems = videos.filter(v => cart.includes(v.id));
    setProtectedUrls(cartItems.map(item => item.url));
  }, [cart, videos]);
  
  // Effect to persist the cart to localStorage.
  useEffect(() => {
    try {
      localStorage.setItem('cart', JSON.stringify(cart));
    } catch (e) {
      console.error("Could not save cart to local storage", e);
    }
  }, [cart]);

  // Effect to persist the list of purchased video IDs to localStorage.
  useEffect(() => {
    try {
      localStorage.setItem('purchasedVideoIds', JSON.stringify(purchasedVideoIds));
    } catch (e) {
      console.error("Could not save purchased videos to local storage", e);
    }
  }, [purchasedVideoIds]);

  // Effect to persist the list of downloaded video IDs to localStorage.
  useEffect(() => {
    try {
      localStorage.setItem('downloadedVideoIds', JSON.stringify(downloadedVideoIds));
    } catch (e) {
      console.error("Could not save downloaded videos to local storage", e);
    }
  }, [downloadedVideoIds]);

  // Handler for selecting a video and updating the URL for deep linking.
  const handleOpenVideo = useCallback((video: VideoFile | null) => {
    // If the same video is selected, do nothing.
    if (video && selectedVideo && video.id === selectedVideo.id) {
        return;
    }
      
    setSelectedVideo(video);
    const url = new URL(window.location.href);

    // Don't manipulate history if we are just switching between videos in the modal.
    const isSwitching = selectedVideo && video;

    if (video) {
      url.searchParams.set('video', video.id);
      if (isSwitching) {
          window.history.replaceState({ videoId: video.id }, '', url.toString());
      } else {
          window.history.pushState({ videoId: video.id }, '', url.toString());
      }
    } else {
      url.searchParams.delete('video');
      window.history.replaceState({ videoId: null }, '', url.toString());
    }
  }, [selectedVideo]);

  // Effect to handle initial page load with a video ID in the URL.
  useEffect(() => {
    if (videos.length > 0) {
      const urlParams = new URLSearchParams(window.location.search);
      const videoIdFromUrl = urlParams.get('video');
      
      if (videoIdFromUrl && !selectedVideo) {
        const videoToOpen = videos.find(v => v.id === videoIdFromUrl);
        if (videoToOpen) {
          // Set state directly; don't call handleOpenVideo to avoid a history push.
          setSelectedVideo(videoToOpen);
        }
      }
    }
  }, [videos, selectedVideo]);

  // Effect to handle browser back/forward navigation.
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const urlParams = new URLSearchParams(window.location.search);
      const videoIdFromUrl = urlParams.get('video');
      const videoToOpen = videos.find(v => v.id === videoIdFromUrl) || null;
      setSelectedVideo(videoToOpen);
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [videos]);

  // Updates search term on input, but debounces the actual API call.
  const handleSearch = useCallback((query: string) => {
    setSearchTerm(query);
    setPagesLoaded(1);
  }, []);

  // Effect to handle debounced AI search enhancement.
  useEffect(() => {
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }

    if (searchTerm.length > 2) {
      setIsSearching(true);
      debounceTimeout.current = window.setTimeout(async () => {
        const terms = await getEnhancedSearchTerms(searchTerm);
        setEnhancedSearchTerms(terms);
        setIsSearching(false);
      }, 500); // 500ms debounce delay
    } else {
      setEnhancedSearchTerms([]);
      setIsSearching(false);
    }

    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    };
  }, [searchTerm]);

  const filteredAndSortedVideos = useMemo(() => {
    let filtered = videos;
    if (selectedCategory === 'Free') {
      filtered = filtered.filter(v => v.isFree);
    } else if (selectedCategory !== 'All') {
      filtered = filtered.filter(v => v.categories.includes(selectedCategory));
    }

    if (searchTerm.length > 0) {
      // The phrases to test are the user's original query plus the AI-enhanced phrases.
      const phrasesToTest = [searchTerm, ...enhancedSearchTerms];

      filtered = filtered.filter(v => {
        // For each video, create a searchable string of its title and keywords.
        // Categories are excluded to improve search precision.
        const searchableText = [
          v.title,
          ...v.keywords
        ].join(' ').toLowerCase();

        // A video is a match if it satisfies the "AND" condition for *at least one* of the phrases.
        return phrasesToTest.some(phrase => {
          // For each phrase, split it into individual words.
          const wordsInPhrase = phrase.toLowerCase().split(/\s+/).filter(Boolean);
          if (wordsInPhrase.length === 0) {
            return false; // Skip empty phrases.
          }
          // The video is a match for this phrase if it contains *all* the words from it.
          return wordsInPhrase.every(word => searchableText.includes(word));
        });
      });
    }
    
    switch (sortBy) {
      case 'featured':
        return filtered.sort((a, b) => (b.isFeatured ? 1 : -1) - (a.isFeatured ? 1 : -1) || b.commercialAppeal - a.commercialAppeal);
      case 'popular':
        return filtered.sort((a, b) => b.commercialAppeal - a.commercialAppeal);
      case 'newest':
        return filtered.sort((a, b) => b.createdAt - a.createdAt);
      case 'price-asc':
        return filtered.sort((a, b) => a.price - a.price);
      case 'price-desc':
        return filtered.sort((a, b) => b.price - a.price);
      default:
        return filtered;
    }
  }, [videos, selectedCategory, searchTerm, enhancedSearchTerms, sortBy]);

  const visibleVideos = useMemo(() => {
    return filteredAndSortedVideos.slice(0, pagesLoaded * VIDEOS_PER_PAGE);
  }, [filteredAndSortedVideos, pagesLoaded]);
  
  const hasMoreVideos = visibleVideos.length < filteredAndSortedVideos.length;
  
  const cartItems = useMemo(() => videos.filter(v => cart.includes(v.id)), [videos, cart]);
  const purchasedItems = useMemo(() => {
      // Free items are no longer automatically owned.
      // The user must add them to the cart and "checkout" for free.
      return videos.filter(v => purchasedVideoIds.includes(v.id)).sort((a,b) => b.createdAt - a.createdAt);
  }, [videos, purchasedVideoIds]);

  const handleAddToCart = useCallback((videoId: string) => {
    if (cart.includes(videoId) || purchasedVideoIds.includes(videoId)) return;
    setCart(prev => [...prev, videoId]);
    setIsCartOpen(true);
  }, [cart, purchasedVideoIds]);

  const handleRemoveFromCart = useCallback((videoId: string) => setCart(prev => prev.filter(id => id !== videoId)), []);
  const handleClearCart = useCallback(() => setCart([]), []);

  const handleRemoveFromPurchases = useCallback((videoId: string) => {
    if (window.confirm("Admin: Are you sure you want to remove this item from the purchases list? This is for testing and cannot be undone.")) {
      setPurchasedVideoIds(prev => prev.filter(id => id !== videoId));
    }
  }, []);

  const handleVideoUpdate = useCallback(async (video: VideoFile) => {
    if (!db) return;
    const videoRef = doc(db, 'videos', video.id);
    try {
      await updateDoc(videoRef, { ...video });
      // Update local state for immediate UI feedback. The onSnapshot listener will
      // also fire, but this prevents a noticeable delay for the admin.
      setVideos(prev => prev.map(v => v.id === video.id ? video : v));
      handleOpenVideo(null);
    } catch (error) {
      console.error("Failed to update video:", error);
      alert("An error occurred while saving. Please check the console and try again.");
    }
  }, [handleOpenVideo]);

  const handleVideoDelete = useCallback(async (videoId: string) => {
    if (!db) return;
    if (window.confirm("Are you sure you want to permanently delete this video?")) {
      await deleteDoc(doc(db, 'videos', videoId));
      handleOpenVideo(null);
    }
  }, [handleOpenVideo]);

  const handleCheckout = useCallback(async () => {
    setIsCheckingOut(true);
    const currentCartItems = videos.filter(v => cart.includes(v.id));
    const hasPaidItems = currentCartItems.some(item => !item.isFree);

    // This logic handles free items.
    if (!hasPaidItems && currentCartItems.length > 0) {
      setPurchasedVideoIds(prev => [...new Set([...prev, ...cart])]);
      setCart([]);
      setIsCartOpen(false);
      setIsPurchasesOpen(true);
      setIsCheckingOut(false);
      return;
    }
    
    if (currentCartItems.length === 0) {
        setIsCheckingOut(false);
        return;
    }

    try {
      if (!app) throw new Error("Firebase app is not initialized.");

      const functions = getFunctions(app);
      const createCheckoutSession = httpsCallable(functions, 'createCheckoutSession');
      
      // The backend is now the single source of truth for all video data including
      // price and thumbnails. The client only needs to send the video IDs.
      const cartPayload = currentCartItems.map(item => ({
        id: item.id,
      }));

      const { data } = await createCheckoutSession({ cartItems: cartPayload });
      const { url: checkoutUrl, sessionId } = data as { url: string; sessionId: string };

      if (!checkoutUrl || !sessionId) {
        throw new Error("Could not retrieve a checkout URL or Session ID from the backend.");
      }
      
      // Store session details to verify after redirect.
      localStorage.setItem('pendingCheckoutSession', JSON.stringify({ sessionId, cart }));
      
      // Redirect to Stripe. This is more reliable than window.open() in Safari.
      window.location.href = checkoutUrl;
      
      // The code below will not be reached after redirection.
      // Verification will happen when the user is redirected back.
      setIsCartOpen(false);

    } catch (error: any) {
      console.error("Error creating checkout session:", error);
      alert(`Could not initiate checkout. Please ensure your backend function is deployed correctly. Error: ${error.message}`);
    } finally {
      setIsCheckingOut(false);
    }
  }, [cart, videos, app]);

  return (
    <div className="min-h-screen bg-gray-900">
      {isVerifyingPurchase && (
        <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm flex flex-col items-center justify-center z-[100]">
          <Spinner className="w-16 h-16" />
          <h2 className="mt-4 text-2xl font-bold text-white">Verifying your purchase...</h2>
          <p className="mt-2 text-gray-300">Please do not close or refresh this page.</p>
        </div>
       )}
      <Header
        onSearch={handleSearch}
        isSearching={isSearching}
        onLicenseClick={() => setIsLicenseModalOpen(true)}
        onAboutClick={() => setIsAboutModalOpen(true)}
        cartItemCount={cart.length}
        onCartClick={() => setIsCartOpen(true)}
        undownloadedItemCount={purchasedItems.filter(p => !downloadedVideoIds.includes(p.id)).length}
        onPurchasesClick={() => setIsPurchasesOpen(true)}
        isAdmin={isAdmin}
        onUploadClick={() => setIsUploadPanelOpen(true)}
      />

      <main className="container mx-auto px-4 py-8">
        {isDiscountBannerVisible && <DiscountBanner onDismiss={() => setIsDiscountBannerVisible(false)} />}
        
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <CategoryFilter
            categories={['All', 'Free', ...CATEGORIES]}
            selectedCategory={selectedCategory}
            onSelectCategory={(cat) => { setSelectedCategory(cat); setPagesLoaded(1); }}
          />
          <SortDropdown selected={sortBy} onSelect={(opt) => { setSortBy(opt); setPagesLoaded(1); }} />
        </div>

        {isLoading && <div className="text-center py-20"><Spinner className="w-12 h-12" /></div>}
        
        {connectionError && (
          <div className="text-center py-20 bg-red-900/20 border border-red-500/30 rounded-lg p-8">
            <WarningIcon className="w-12 h-12 text-red-400 mx-auto" />
            <h2 className="mt-4 text-2xl font-bold text-red-300">Connection Error</h2>
            <p className="mt-2 text-red-300/80">{connectionError}</p>
          </div>
        )}

        {!isLoading && !connectionError && visibleVideos.length === 0 && (
          <div className="text-center py-20 bg-gray-800/50 rounded-lg p-8">
            <FilmIcon className="w-12 h-12 text-gray-500 mx-auto" />
            <h2 className="mt-4 text-2xl font-bold text-gray-400">No Videos Found</h2>
            <p className="mt-2 text-gray-500">Try adjusting your search or category filters.</p>
          </div>
        )}

        {!isLoading && !connectionError && visibleVideos.length > 0 && (
          <>
            <VideoGrid
              videos={visibleVideos}
              onVideoSelect={handleOpenVideo}
              onAddToCart={handleAddToCart}
              cart={cart}
              purchasedVideoIds={purchasedItems.map(p => p.id)}
              isAdmin={isAdmin}
            />
            {hasMoreVideos && (
              <div className="text-center mt-12">
                <button
                  onClick={() => setPagesLoaded(prev => prev + 1)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900"
                >
                  View More
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {isAboutModalOpen && <AboutModal onClose={() => setIsAboutModalOpen(false)} />}
      {isLicenseModalOpen && <LicenseModal onClose={() => setIsLicenseModalOpen(false)} />}
      {isUploadPanelOpen && <UploadPanel onClose={() => setIsUploadPanelOpen(false)} />}

      {selectedVideo && (
        <VideoPlayerModal
          video={selectedVideo}
          allVideos={videos}
          onClose={() => handleOpenVideo(null)}
          onVideoSelect={handleOpenVideo}
          onVideoUpdate={handleVideoUpdate}
          onVideoDelete={handleVideoDelete}
          onAddToCart={handleAddToCart}
          isInCart={cart.includes(selectedVideo.id)}
          isPurchased={purchasedItems.some(p => p.id === selectedVideo.id)}
          isAdmin={isAdmin}
        />
      )}
      
      {isCartOpen && (
        <CartPanel
          items={cartItems}
          onClose={() => setIsCartOpen(false)}
          onRemoveItem={handleRemoveFromCart}
          onClearCart={handleClearCart}
          onCheckout={handleCheckout}
          isCheckingOut={isCheckingOut}
        />
      )}
      
      {isPurchasesOpen && (
        <PurchasesPanel
          items={purchasedItems}
          onClose={() => setIsPurchasesOpen(false)}
          downloadedVideoIds={downloadedVideoIds}
          onVideoDownloaded={(id) => setDownloadedVideoIds(prev => [...new Set([...prev, id])])}
          isAdmin={isAdmin}
          onRemoveItem={handleRemoveFromPurchases}
        />
      )}
    </div>
  );
}
