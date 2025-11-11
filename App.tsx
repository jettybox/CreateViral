import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { collection, onSnapshot, doc, deleteDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-functions.js';
import { db, app, firebaseInitError } from './firebase-config';
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
  const [isDiscountBannerVisible, setIsDiscountBannerVisible] = useState(true);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [isVerifyingPurchase, setIsVerifyingPurchase] = useState(false);
  const isAdmin = useAdminMode();

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
          generatedThumbnail: data.generatedThumbnail,
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

  const handleSearch = useCallback(async (query: string) => {
    setSearchTerm(query);
    setCurrentPage(1);
    if (query.length > 2) {
      setIsSearching(true);
      const terms = await getEnhancedSearchTerms(query);
      setEnhancedSearchTerms(terms);
      setIsSearching(false);
    } else {
      setEnhancedSearchTerms([]);
    }
  }, []);

  const filteredAndSortedVideos = useMemo(() => {
    let filtered = videos;
    if (selectedCategory === 'Free') {
      filtered = filtered.filter(v => v.isFree);
    } else if (selectedCategory !== 'All') {
      filtered = filtered.filter(v => v.categories.includes(selectedCategory));
    }

    if (searchTerm.length > 0) {
      const searchTerms = [searchTerm, ...enhancedSearchTerms].map(t => t.toLowerCase());
      filtered = filtered.filter(v => 
        searchTerms.some(term => 
          v.title.toLowerCase().includes(term) ||
          v.keywords.some(kw => kw.toLowerCase().includes(term)) ||
          v.categories.some(cat => cat.toLowerCase().includes(term))
        )
      );
    }
    
    switch (sortBy) {
      case 'featured':
        return filtered.sort((a, b) => (b.isFeatured ? 1 : -1) - (a.isFeatured ? 1 : -1) || b.commercialAppeal - a.commercialAppeal);
      case 'popular':
        return filtered.sort((a, b) => b.commercialAppeal - a.commercialAppeal);
      case 'newest':
        return filtered.sort((a, b) => b.createdAt - a.createdAt);
      case 'price-asc':
        return filtered.sort((a, b) => a.price - b.price);
      case 'price-desc':
        return filtered.sort((a, b) => b.price - a.price);
      default:
        return filtered;
    }
  }, [videos, selectedCategory, searchTerm, enhancedSearchTerms, sortBy]);

  const totalPages = Math.ceil(filteredAndSortedVideos.length / VIDEOS_PER_PAGE);
  const paginatedVideos = useMemo(() => {
    const startIndex = (currentPage - 1) * VIDEOS_PER_PAGE;
    return filteredAndSortedVideos.slice(startIndex, startIndex + VIDEOS_PER_PAGE);
  }, [filteredAndSortedVideos, currentPage]);
  
  const cartItems = useMemo(() => videos.filter(v => cart.includes(v.id)), [videos, cart]);
  const purchasedItems = useMemo(() => {
      const allPurchasedIds = [...purchasedVideoIds, ...videos.filter(v => v.isFree).map(v => v.id)];
      return videos.filter(v => allPurchasedIds.includes(v.id)).sort((a,b) => b.createdAt - a.createdAt);
  }, [videos, purchasedVideoIds]);

  const handleAddToCart = useCallback((videoId: string) => {
    if (cart.includes(videoId) || purchasedVideoIds.includes(videoId)) return;
    setCart(prev => [...prev, videoId]);
    setIsCartOpen(true);
  }, [cart, purchasedVideoIds]);

  const handleRemoveFromCart = useCallback((videoId: string) => setCart(prev => prev.filter(id => id !== videoId)), []);
  const handleClearCart = useCallback(() => setCart([]), []);

  const handleVideoUpdate = useCallback(async (video: VideoFile) => {
    if (!db) return;
    const videoRef = doc(db, 'videos', video.id);
    await updateDoc(videoRef, { ...video });
    setSelectedVideo(null);
  }, []);

  const handleVideoDelete = useCallback(async (videoId: string) => {
    if (!db) return;
    if (window.confirm("Are you sure you want to permanently delete this video?")) {
      await deleteDoc(doc(db, 'videos', videoId));
      setSelectedVideo(null);
    }
  }, []);

  const handleThumbnailGenerated = useCallback((videoId: string, dataUrl: string) => {
      setVideos(prev => prev.map(v => v.id === videoId ? { ...v, generatedThumbnail: dataUrl } : v));
  }, []);

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
      
      const { data } = await createCheckoutSession({ cartItems: cart });
      const { url: checkoutUrl, sessionId } = data as { url: string; sessionId: string };

      if (!checkoutUrl || !sessionId) {
        throw new Error("Could not retrieve a checkout URL or Session ID from the backend.");
      }
      
      // Store session details to verify after redirect.
      localStorage.setItem('pendingCheckoutSession', JSON.stringify({ sessionId, cart }));
      
      // Open Stripe Checkout in a new tab.
      window.open(checkoutUrl, '_blank');
      
      // Close the cart, but DO NOT assume the purchase is complete yet.
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
        onGuidanceClick={() => setIsGuidanceOpen(true)}
        onTroubleshootingClick={() => setIsTroubleshootingOpen(true)}
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
            onSelectCategory={(cat) => { setSelectedCategory(cat); setCurrentPage(1); }}
          />
          <SortDropdown selected={sortBy} onSelect={(opt) => { setSortBy(opt); setCurrentPage(1); }} />
        </div>

        {isLoading && <div className="text-center py-20"><Spinner className="w-12 h-12" /></div>}
        
        {connectionError && (
          <div className="text-center py-20 bg-red-900/20 border border-red-500/30 rounded-lg p-8">
            <WarningIcon className="w-12 h-12 text-red-400 mx-auto" />
            <h2 className="mt-4 text-2xl font-bold text-red-300">Connection Error</h2>
            <p className="mt-2 text-red-300/80">{connectionError}</p>
          </div>
        )}

        {!isLoading && !connectionError && paginatedVideos.length === 0 && (
          <div className="text-center py-20 bg-gray-800/50 rounded-lg p-8">
            <FilmIcon className="w-12 h-12 text-gray-500 mx-auto" />
            <h2 className="mt-4 text-2xl font-bold text-gray-400">No Videos Found</h2>
            <p className="mt-2 text-gray-500">Try adjusting your search or category filters.</p>
          </div>
        )}

        {!isLoading && !connectionError && paginatedVideos.length > 0 && (
          <>
            <VideoGrid
              videos={paginatedVideos}
              onVideoSelect={setSelectedVideo}
              onAddToCart={handleAddToCart}
              cart={cart}
              purchasedVideoIds={purchasedItems.map(p => p.id)}
              onThumbnailGenerated={handleThumbnailGenerated}
              isAdmin={isAdmin}
            />
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </main>

      {isGuidanceOpen && <Guidance onClose={() => setIsGuidanceOpen(false)} />}
      {isTroubleshootingOpen && <Troubleshooting onClose={() => setIsTroubleshootingOpen(false)} />}
      {isUploadPanelOpen && <UploadPanel onClose={() => setIsUploadPanelOpen(false)} />}

      {selectedVideo && (
        <VideoPlayerModal
          video={selectedVideo}
          onClose={() => setSelectedVideo(null)}
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
        />
      )}
    </div>
  );
}