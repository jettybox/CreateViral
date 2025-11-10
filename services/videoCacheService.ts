const CACHE_NAME = 'video-asset-cache-v1';
const MAX_CACHE_SIZE_BYTES = 400 * 1024 * 1024; // 400MB

/**
 * Manages the video cache, ensuring it doesn't exceed the defined size limit.
 * It evicts the oldest entries (FIFO) if the cache size is exceeded.
 */
async function manageCache() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const requests = await cache.keys();
    let totalSize = 0;
    const entries: { request: Request; size: number }[] = [];

    // Calculate total size and gather entries with their sizes
    for (const request of requests) {
      const response = await cache.match(request);
      if (response) {
        const size = Number(response.headers.get('content-length') || 0);
        totalSize += size;
        entries.push({ request, size });
      }
    }

    // Evict oldest entries if total size exceeds the limit
    if (totalSize > MAX_CACHE_SIZE_BYTES) {
      console.log(`Cache size ${totalSize} exceeds limit ${MAX_CACHE_SIZE_BYTES}. Evicting old entries.`);
      // Entries are roughly in insertion order.
      for (const entry of entries) {
        if (totalSize <= MAX_CACHE_SIZE_BYTES) break;
        await cache.delete(entry.request);
        totalSize -= entry.size;
        console.log(`Evicted ${entry.request.url}. New size: ${totalSize}`);
      }
    }
  } catch (error) {
    console.error('Error managing video cache:', error);
  }
}

/**
 * Retrieves a video from the cache or fetches it from the network if not cached.
 * Returns a Blob URL for the video resource.
 *
 * @param {string} url The original URL of the video.
 * @returns {Promise<string>} A promise that resolves to a Blob URL.
 */
export async function getCachedVideoUrl(url: string): Promise<string> {
  if (!url) {
    return Promise.resolve('');
  }

  try {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(url);

    if (cachedResponse) {
      const blob = await cachedResponse.blob();
      return URL.createObjectURL(blob);
    }

    const networkResponse = await fetch(url);
    if (!networkResponse.ok) {
      throw new Error(`Failed to fetch video: ${networkResponse.statusText}`);
    }

    // Put a clone of the response into the cache.
    // Use `put` to store the request/response pair.
    cache.put(url, networkResponse.clone()).then(manageCache); // Manage cache size async

    const blob = await networkResponse.blob();
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error(`Failed to get or cache video from ${url}:`, error);
    // Fallback to the original URL on error, so the video still plays
    return url;
  }
}
