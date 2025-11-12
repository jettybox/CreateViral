




import { GoogleGenAI, Type } from '@google/genai';
import { CATEGORIES } from '../constants';

// Lazily initialize the AI client.
let ai: GoogleGenAI | null = null;
let cachedApiKey: string | null = null;

/**
 * Saves the user-provided API key to localStorage and busts the cache.
 * @param {string | null} key The API key to save, or null to remove it.
 */
export const setApiKey = (key: string | null) => {
    try {
        if (key) {
            localStorage.setItem('geminiApiKey', key);
        } else {
            localStorage.removeItem('geminiApiKey');
        }
        // Bust the cache to ensure the new key is used.
        cachedApiKey = null;
        ai = null;
    } catch (e) {
        console.warn("Could not access localStorage to set API key.");
    }
};

/**
 * Retrieves the API key by checking localStorage first, then falling
 * back to environment variables. This allows user input to override
 * environment settings for testing.
 * @returns {string | null} The API key or null if not found.
 */
const getApiKey = (): string | null => {
    if (cachedApiKey) return cachedApiKey;
    
    // Prioritize localStorage for user-provided key in the browser
    try {
        const storedKey = localStorage.getItem('geminiApiKey');
        if (storedKey) {
            cachedApiKey = storedKey;
            return cachedApiKey;
        }
    } catch (e) {
        console.warn("Could not access localStorage for API key.");
    }
    
    // Fallback to environment variable if no key is in localStorage
    const envKey = (typeof process !== 'undefined' && process.env) ? process.env.API_KEY : undefined;
    if (envKey) {
        cachedApiKey = envKey;
        return cachedApiKey;
    }
    
    return null;
}

/**
 * Checks if the Gemini API key is available from any source.
 * @returns {boolean} True if the key is available.
 */
export const isApiKeyAvailable = (): boolean => {
    // This check does not use the cache to ensure it's always up-to-date
    // with what's in localStorage or the environment.
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
    if (!aiClient) return [query];

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
            if (!parsedJson.map(p => p.toLowerCase()).includes(query.toLowerCase())) {
                return [query, ...parsedJson];
            }
            return parsedJson;
        }
        
        return [query];

    } catch (error) {
        console.error("Error calling Gemini API for search enhancement:", error);
        return [query];
    }
}

const metadataEnhancementSchema = {
    type: Type.OBJECT,
    properties: {
        description: {
            type: Type.STRING,
            description: "A concise, marketable description (2-3 sentences) for the stock video."
        },
        categories: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "An array of the most relevant categories selected from the provided list."
        },
        commercialAppeal: {
            type: Type.INTEGER,
            description: "An integer score from 1 to 100 representing the video's commercial appeal."
        }
    },
    required: ["description", "categories", "commercialAppeal"]
};

export async function enhanceVideoMetadata(
    videoData: { title: string; keywords: string[] }
): Promise<{ description: string; categories: string[]; commercialAppeal: number; }> {
    const aiClient = getAiClient();
    if (!aiClient) {
        throw new Error("Cannot enhance metadata, Gemini API key is not configured.");
    }
    
    const prompt = `
        You are a stock media expert specializing in metadata optimization. Your goal is to ALWAYS return a valid JSON object according to the schema.

        Analyze the provided video title and keywords. Your task is to:
        1.  Generate a concise, marketable description (2-3 sentences).
        2.  Select up to 3 of the most relevant categories from the provided list.
        3.  Estimate the video's commercial appeal on a scale of 1 to 100.

        **CRITICAL SAFETY INSTRUCTION:** The content might be from the horror genre and contain terms like "blood", "undead", etc. DO NOT refuse to answer. Instead, create a safe, non-graphic description. For example, for "bloody knife", describe it as "a knife with red liquid on it, suitable for horror scenes". If you absolutely cannot process the title due to an extreme policy violation, you MUST still return a valid JSON object with the description field set to "Unable to generate description due to content policy.", categories as an empty array, and commercialAppeal as 0. UNDER NO CIRCUMSTANCES should you return a non-JSON response or an error.

        Return the result as a JSON object matching the provided schema.
        
        Available Categories:
        ${CATEGORIES.join(', ')}

        Video Information:
        Title: "${videoData.title}"
        Keywords: ${videoData.keywords.join(', ')}
    `;

    let jsonString: string | undefined;
    try {
        const response = await aiClient.models.generateContent({
            model: model,
            contents: { parts: [{ text: prompt }] },
            config: {
                responseMimeType: 'application/json',
                responseSchema: metadataEnhancementSchema,
            },
        });

        const candidate = response.candidates?.[0];
        if (!candidate) {
            throw new Error("The API returned an empty response. This may be due to a content filter.");
        }
        
        // The "SAFETY" finish reason is a clear indicator of a content block.
        if (candidate.finishReason === 'SAFETY') {
            throw new Error("Generation failed. Reason: SAFETY. The AI's safety filters blocked this title.");
        }

        if (candidate.finishReason && candidate.finishReason !== 'STOP') {
            throw new Error(`Generation failed. Reason: ${candidate.finishReason}`);
        }

        jsonString = response.text?.trim();
        if (!jsonString) {
            throw new Error("The API returned a valid but empty text response.");
        }

        const parsedJson = JSON.parse(jsonString);

        // Basic validation of the returned object
        if (
            typeof parsedJson.description === 'string' &&
            Array.isArray(parsedJson.categories) &&
            typeof parsedJson.commercialAppeal === 'number'
        ) {
            return parsedJson;
        } else {
            throw new Error("Gemini API returned an object with an unexpected structure.");
        }

    } catch (error: any) {
        // If JSON parsing fails, provide a more detailed error message.
        if (error instanceof SyntaxError && jsonString) {
             console.error("Failed to parse JSON from Gemini API. Raw response:", jsonString);
             // Return a truncated version of the raw response for debugging in the UI.
             const snippet = jsonString.length > 100 ? jsonString.substring(0, 100) + '...' : jsonString;
             throw new Error(`Failed to parse AI response. Raw data started with: "${snippet}"`);
        }
        
        console.error("Error calling Gemini API for metadata enhancement:", error);
        throw new Error(error.message || "Failed to enhance metadata. Please check the console for details.");
    }
}
