import { GoogleGenAI, Type } from '@google/genai';
import { CATEGORIES } from '../constants';

// Assume process.env.API_KEY is configured in the environment
const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  // In a real app, you'd want to handle this more gracefully.
  // For this demo, we'll throw an error if the key is missing.
  throw new Error("API_KEY environment variable not set.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const model = 'gemini-2.5-flash';

// Define the expected JSON schema for the model's response
const responseSchema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: 'A short, compelling, SEO-friendly title for the video clip (max 10 words).',
    },
    description: {
      type: Type.STRING,
      description: 'A detailed, engaging description of the video content (2-3 sentences).',
    },
    keywords: {
      type: Type.ARRAY,
      items: {
        type: Type.STRING,
      },
      description: 'An array of 20 to 30 relevant, specific keywords or tags for searching.',
    },
    categories: {
      type: Type.ARRAY,
      description: 'An array of one or more appropriate categories from the provided list. Choose all that apply. Strive for consistency with visually similar content.',
      items: {
        type: Type.STRING,
        enum: CATEGORIES,
      }
    },
    price: {
        type: Type.NUMBER,
        description: 'Set the price for this stock video clip at 5 USD. The price should be a number, without a currency symbol.'
    },
    commercialAppeal: {
        type: Type.NUMBER,
        description: 'On a scale of 1 to 100, rate the commercial appeal of this video for general marketing or creative projects. Consider factors like visual quality, subject uniqueness, and potential use cases. 1 is very niche, 100 is highly versatile and popular.'
    }
  },
  required: ['title', 'description', 'keywords', 'categories', 'price', 'commercialAppeal'],
};

export async function analyzeVideoContent(base64Frames: string[]): Promise<{
  title: string;
  description: string;
  keywords: string[];
  categories: string[];
  price: number;
  commercialAppeal: number;
}> {
  const imageParts = base64Frames.map(frame => ({
    inlineData: {
      mimeType: 'image/jpeg',
      data: frame.split(',')[1], // Remove the 'data:image/jpeg;base64,' prefix
    },
  }));

  const prompt = `
    Analyze the following sequence of video frames. Act as a professional stock video cataloger.
    Your task is to generate metadata for this video clip. Analyze the core subject matter, style, and mood to ensure high accuracy. For visually similar videos, strive for consistent categorization.
    Based on the visual content, provide:
    1. A concise and accurate title.
    2. A detailed description.
    3. A list of 20 to 30 relevant keywords.
    4. Select one or more best fitting categories from the provided list.
    5. Set the price at $5.
    6. Provide a 'commercial appeal' score from 1-100, predicting its popularity.
    The response must be in JSON format matching the provided schema.

    Available Categories: ${CATEGORIES.join(', ')}
  `;
  
  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: {
          parts: [...imageParts, { text: prompt }],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
      },
    });

    const jsonString = response.text.trim();
    const parsedJson = JSON.parse(jsonString);
    
    // Ensure price is a valid number, defaulting to 5 if not.
    const finalPrice = typeof parsedJson.price === 'number' && !isNaN(parsedJson.price) ? parsedJson.price : 5;
    const commercialAppeal = typeof parsedJson.commercialAppeal === 'number' && !isNaN(parsedJson.commercialAppeal) ? parsedJson.commercialAppeal : 50;


    // Basic validation to ensure the response fits our expected structure
    if (
      !parsedJson.title ||
      !parsedJson.description ||
      !Array.isArray(parsedJson.keywords) ||
      !Array.isArray(parsedJson.categories)
    ) {
      throw new Error('Invalid JSON structure received from API.');
    }

    return { ...parsedJson, price: finalPrice, commercialAppeal: commercialAppeal };
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    throw new Error("Failed to analyze video content with Gemini API.");
  }
}

const searchResponseSchema = {
    type: Type.ARRAY,
    items: { type: Type.STRING },
    description: 'A list of semantically related search terms.'
};

export async function getEnhancedSearchTerms(query: string): Promise<string[]> {
    if (!query) return [];

    const prompt = `
        You are a semantic search assistant for a stock video website. The user has entered a search query.
        Your task is to generate a list of up to 10 related keywords, synonyms, and conceptually similar terms to broaden the search results.
        Include the original query in the list.
        For example, if the query is "lady", you might return ["lady", "woman", "female", "person", "portrait", "lifestyle"].
        Return the results as a JSON array of strings matching the schema.
        
        User's query: "${query}"
    `;

    try {
        const response = await ai.models.generateContent({
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