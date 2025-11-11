const CACHE_NAME = 'video-asset-cache-v1';
const MAX_CACHE_SIZE_BYTES = 400 * 1024 * 1024; // 400MB

let protectedUrls = new Set<string>();

// A map to convert Backblaze's internal region codes (from Friendly URLs)
// to the public S3 region names.
const B2_REGION_MAP: { [key: string]: string } = {
  '000': 'us-west-000',
  '001': 'us-west-001',
  '002': 'us-west-002',
  '003': 'eu-central-003',
  '004': 'us-west-004',
  '005': 'ap-southeast-005'
};


/**
 * Corrects a URL for Backblaze B2. This function is robust and handles two main issues:
 * 1. It transforms outdated "Friendly URLs" (e.g., f003.backblazeb2.com/file/...) into the modern,
 *    more reliable S3-compatible URL format (e.g., your-bucket.s3.region.backblazeb2.com/...).
 * 2. It correctly encodes spaces and other special characters in the filename for B2 compatibility.
 * @param url The original URL string from the database.
 * @returns The corrected, working URL string for B2.
 */
export const correctUrlForBackblaze = (url: string): string => {
  if (!url) return '';
  
  let correctedUrl = url;

  // Regex to detect and parse the old "Friendly URL" format.
  const friendlyUrlRegex = /^(https?:\/\/f(\d{3})\.backblazeb2\.com)\/file\/([^\/]+)\/(.*)$/;
  const match = url.match(friendlyUrlRegex);

  if (match) {
    // If it's a friendly URL, transform it to the S3 format.
    const regionCode = match[2]; // e.g., "003"
    const bucketName = match[3]; // e.g., "createviral-ai-videos"
    const filePath = match[4];   // e.g., "Halloween%202025%2012.mp4"
    const region = B2_REGION_MAP[regionCode];

    if (region) {
      correctedUrl = `https://${bucketName}.s3.${region}.backblazeb2.com/${filePath}`;
    }
  }

  // Now, apply the encoding fix to the (potentially transformed) URL using the URL API for robustness.
  try {
    const urlObject = new URL(correctedUrl);
    
    // Decode the pathname to normalize it from any existing encoding (handles %20, +, etc.)
    const decodedPathname = decodeURIComponent(urlObject.pathname);
    
    // Re-encode each path segment individually, preserving slashes and converting spaces to '+'
    const encodedSegments = decodedPathname
      .split('/')
      .filter(Boolean) // Remove empty segments that can result from a leading slash
      .map(segment => encodeURIComponent(segment).replace(/%20/g, '+'));
      
    urlObject.pathname = '/' + encodedSegments.join('/');
    return urlObject.toString();

  } catch (error) {
    console.error(`Failed to process URL with URL API, falling back to simple replace: ${correctedUrl}`, error);
    // A less robust fallback for safety, in case of an unexpected URL format.
    return correctedUrl.replace(/%20/g, '+').replace(/ /g, '+');
  }
};


/**
 * Informs the cache service which video URLs should be protected from eviction.
 * This is typically used for items in the shopping cart.
 * @param {string[]} urls - An array of video URLs to protect.
 */
export function setProtectedUrls(urls: string[]) {
  protectedUrls = new Set(urls);
}

/**
 * Manages the video cache, ensuring it doesn't exceed the defined size limit.
 * It evicts the oldest entries (FIFO) if the cache size is exceeded, but respects
 * a list of "protected" URLs that should not be evicted.
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
      // Filter out protected URLs before considering entries for eviction.
      // Entries are otherwise in rough insertion order.
      const evictableEntries = entries.filter(entry => !protectedUrls.has(entry.request.url));

      for (const entry of evictableEntries) {
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
  
  const correctedUrl = correctUrlForBackblaze(url);

  try {
    const cache = await caches.open(CACHE_NAME);
    // Use the corrected URL as the key for the cache to avoid storing duplicates.
    const cachedResponse = await cache.match(correctedUrl);

    if (cachedResponse) {
      const blob = await cachedResponse.blob();
      return URL.createObjectURL(blob);
    }

    const networkResponse = await fetch(correctedUrl);
    
    if (!networkResponse.ok) {
      throw new Error(`Failed to fetch video: ${networkResponse.statusText}`);
    }

    // Put a clone of the response into the cache, using the corrected URL as the key.
    cache.put(correctedUrl, networkResponse.clone()).then(manageCache);

    const blob = await networkResponse.blob();
    return URL.createObjectURL(blob);
  } catch (error) {
    // Log the corrected URL to make debugging much easier.
    console.error(`Failed to get or cache video from ${correctedUrl}:`, error);
    // Fallback to the corrected URL on error so the video still attempts to play.
    return correctedUrl;
  }
}
