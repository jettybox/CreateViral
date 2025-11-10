import { GoogleGenAI, Type } from '@google/genai';

// Lazily initialize the AI client and cache the key.
let ai: GoogleGenAI | null = null;
let cachedApiKey: string | null = null;

/**
 * Retrieves the API key by checking environment variables first,
 * then falling back to localStorage. This supports both production
 * environments and interactive web IDEs with persistence.
 * @returns {string | null} The API key or null if not found.
 */
const getApiKey = (): string | null => {
    if (cachedApiKey) return cachedApiKey;
    
    // Priority 1: Environment variables (for production/CI/CD)
    const envKey = (typeof process !== 'undefined' && process.env) ? process.env.API_KEY : undefined;
    // Real Gemini keys are 39 characters long. This check is a safeguard.
    if (envKey && envKey.trim().length > 30) {
        cachedApiKey = envKey;
        return cachedApiKey;
    }
    
    // Priority 2: Local storage (for web IDEs and demos)
    try {
        const storedKey = localStorage.getItem('gemini_api_key');
        if (storedKey && storedKey.trim().length > 30) {
            cachedApiKey = storedKey;
            return cachedApiKey;
        }
    } catch (e) {
        // This can happen in some environments or private browsing modes.
        console.warn("Could not access localStorage.");
    }
    
    return null;
}

/**
 * Checks if the Gemini API key is available from any source.
 * @returns {boolean} True if the key is available.
 */
export const isApiKeyAvailable = (): boolean => {
    return getApiKey() !== null;
};


/**
 * Gets the GoogleGenAI client instance.
 * Returns null and logs a warning if the API key is not configured.
 * This prevents the frontend from crashing and allows it to function
 * with AI features disabled.
 */
const getAiClient = (): GoogleGenAI | null => {
  if (ai) {
    return ai;
  }
  
  const API_KEY = getApiKey();
  
  if (!API_KEY) {
    console.warn("Gemini API key not found. AI features are disabled.");
    return null;
  }
  
  ai = new GoogleGenAI({ apiKey: API_KEY });
  return ai;
};


const model = 'gemini-2.5-flash';

const searchResponseSchema = {
    type: Type.ARRAY,
    items: { type: Type.STRING },
    description: 'A list of semantically related search terms.'
};

export async function getEnhancedSearchTerms(query: string): Promise<string[]> {
    if (!query) return [];

    const aiClient = getAiClient();
    // If the client isn't available (no API key on frontend), gracefully fall back to basic search.
    if (!aiClient) {
        return [query];
    }

    const prompt = `
        You are a semantic search assistant for a stock video website. The user has entered a search query.
        Your task is to generate a list of up to 10 related keywords, synonyms, and conceptually similar terms to broaden the search results.
        Include the original query in the list.
        For example, if the query is "lady", you might return ["lady", "woman", "female", "person", "portrait", "lifestyle"].
        Return the results as a JSON array of strings matching the schema.
        
        User's query: "${query}"
    `;

    try {
        const response = await aiClient.models.generateContent({
            model: model,
            contents: { parts: [{ text: prompt }] },
            config: {
                responseMimeType: 'application/json',
                responseSchema: searchResponseSchema,
            },
        });

        const jsonString = response.text.trim();
        const parsedJson = JSON.parse(jsonString);

        if (Array.isArray(parsedJson) && parsedJson.every(item => typeof item === 'string')) {
            // Ensure the original query is in the list
            if (!parsedJson.map(p => p.toLowerCase()).includes(query.toLowerCase())) {
                return [query, ...parsedJson];
            }
            return parsedJson;
        }
        
        // Fallback if the response is not as expected
        return [query];

    } catch (error) {
        console.error("Error calling Gemini API for search enhancement:", error);
        // On error, just return the original query to allow for basic search
        return [query];
    }
}
