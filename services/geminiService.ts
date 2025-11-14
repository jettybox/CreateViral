import { GoogleGenAI, Type } from '@google/genai';
import type { VideoFile } from '../types';

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
        You are a semantic search assistant for a stock video website. Your goal is to increase search accuracy by providing precise synonyms.
        Generate a list of up to 5 direct synonyms or very closely related terms for the user's query.
        Do NOT include broad categories (like 'technology' or 'vfx') unless they are part of the original query.
        Focus on nouns and adjectives that describe the visual content.
        Include the original query in the list.
        For example, if the query is "robot", you should return terms like ["robot", "humanoid", "android", "cyborg", "automaton"].
        For "car driving", return ["car driving", "automobile moving", "vehicle in motion"].
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
    videoData: { title: string; keywords: string[] },
    allCategories: string[]
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
        ${allCategories.join(', ')}

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

const categorizationSchema = {
    type: Type.OBJECT,
    properties: {
        shouldAddCategory: {
            type: Type.BOOLEAN,
            description: "Whether the video fits the described category."
        },
        reasoning: {
            type: Type.STRING,
            description: "A brief, one-sentence explanation for the decision."
        }
    },
    required: ["shouldAddCategory", "reasoning"]
};

export async function categorizeVideo(
    videoInfo: { title: string; description: string; keywords: string[] },
    categoryName: string,
    categoryDescription: string
): Promise<{ shouldAddCategory: boolean; reasoning: string }> {
    const aiClient = getAiClient();
    if (!aiClient) {
        throw new Error("Cannot categorize video, Gemini API key is not configured.");
    }

    const prompt = `
        You are an expert video librarian. Your task is to determine if a specific video belongs in a new category based on its metadata and a clear description of the category.
        You MUST return a JSON object that strictly follows the provided schema.

        **Category to Evaluate:**
        - Name: "${categoryName}"
        - Description: "${categoryDescription}"

        **Video Metadata:**
        - Title: "${videoInfo.title}"
        - Description: "${videoInfo.description}"
        - Keywords: [${videoInfo.keywords.join(', ')}]

        **Your Task:**
        Based on all the provided information, does this video fit into the "${categoryName}" category?
        Provide a boolean response for 'shouldAddCategory' and a brief justification.
    `;

    try {
        const response = await aiClient.models.generateContent({
            model: model,
            contents: { parts: [{ text: prompt }] },
            config: {
                responseMimeType: 'application/json',
                responseSchema: categorizationSchema,
                temperature: 0.1 // Use low temperature for more deterministic, fact-based decisions.
            },
        });

        const jsonString = response.text.trim();
        const parsedJson = JSON.parse(jsonString);

        if (typeof parsedJson.shouldAddCategory === 'boolean' && typeof parsedJson.reasoning === 'string') {
            return parsedJson;
        } else {
            throw new Error("AI returned a JSON object with an unexpected structure.");
        }
    } catch (error: any) {
        console.error(`Error categorizing video for category "${categoryName}":`, error);
        throw new Error(error.message || "Failed to categorize video.");
    }
}


/**
 * Shuffles an array in place.
 * @param array The array to shuffle.
 * @returns The shuffled array.
 */
function shuffleArray<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// A simple list of common English "stop words" to ignore in title matching.
const STOP_WORDS = new Set(['a', 'an', 'and', 'the', 'is', 'in', 'on', 'of', 'for', 'to', 'with', 'by', 'on']);

/**
 * Finds related videos using a sophisticated local scoring algorithm.
 * It prioritizes title matches, uses categories and keywords, breaks ties
 * with commercial appeal, and includes a "discovery" mechanism.
 * @param sourceVideo The video to find related content for.
 * @param allVideos The entire library of videos to search through.
 * @returns An array of up to 5 related VideoFile objects, sorted by relevance.
 */
export function getRelatedVideos(sourceVideo: VideoFile, allVideos: VideoFile[]): VideoFile[] {
    if (!sourceVideo || allVideos.length < 2) {
        return [];
    }
    
    // Prepare source data for efficient matching
    const sourceKeywords = new Set(sourceVideo.keywords.map(k => k.toLowerCase()));
    const sourceCategories = new Set(sourceVideo.categories);
    const sourceTitleWords = new Set(
        sourceVideo.title
            .toLowerCase()
            .split(/\s+/)
            .filter(word => word.length > 2 && !STOP_WORDS.has(word))
    );

    const scoredVideos = allVideos
        // Exclude the source video itself from the recommendations
        .filter(video => video.id !== sourceVideo.id)
        .map(video => {
            let score = 0;
            
            // 1. Title Word Matching (Very high weight for strong relevance)
            const videoTitleWords = video.title.toLowerCase().split(/\s+/);
            for (const word of videoTitleWords) {
                if (sourceTitleWords.has(word)) {
                    score += 15;
                }
            }

            // 2. Shared Categories (High weight for thematic similarity)
            for (const category of video.categories) {
                if (sourceCategories.has(category)) {
                    score += 5;
                }
            }

            // 3. Shared Keywords (Medium weight for specific details)
            for (const keyword of video.keywords) {
                if (sourceKeywords.has(keyword.toLowerCase())) {
                    score += 2;
                }
            }

            return { video, score };
        })
        // Filter out videos with no shared characteristics
        .filter(item => item.score > 0);

    // Primary sort by score, secondary by commercial appeal for tie-breaking
    scoredVideos.sort((a, b) => {
        if (a.score !== b.score) {
            return b.score - a.score;
        }
        return b.video.commercialAppeal - a.video.commercialAppeal;
    });

    // --- New Selection Logic with "Discovery" Feature ---
    
    // Take the top 3 most relevant videos directly to ensure quality.
    const topResults = scoredVideos.slice(0, 3).map(item => item.video);

    // From the next 10 candidates, shuffle them to introduce variety.
    const discoveryCandidates = scoredVideos.slice(3, 13);
    const shuffledCandidates = shuffleArray(discoveryCandidates).map(item => item.video);

    // Take up to 2 from the shuffled discovery pool to fill the remaining slots.
    const discoveryResults = shuffledCandidates.slice(0, 2);

    // Combine the deterministic top results with the random discovery results.
    const finalResults = [...topResults, ...discoveryResults];

    // Ensure we return at most 5 videos.
    return finalResults.slice(0, 5);
}
