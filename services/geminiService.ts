
import { GoogleGenAI, Type, Modality, Chat, GenerateContentResponse } from "@google/genai";
import { BookInsight, Category, QuizQuestion } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

const GENERIC_BOOK_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    author: { type: Type.STRING },
    category: { type: Type.STRING },
    oneSentenceTakeaway: { type: Type.STRING },
    summary: { type: Type.STRING },
    keyInsights: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    },
    actionableSteps: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    },
    readingTimeMinutes: { 
      type: Type.NUMBER,
      description: "Estimated time in minutes to read the generated summary, insights, and steps (NOT the original book). Assume 250 words per minute."
    },
    rating: { type: Type.NUMBER, description: "A rating from 1 to 5 based on the book's critical acclaim and value." }
  },
  required: ["title", "author", "category", "oneSentenceTakeaway", "summary", "keyInsights", "actionableSteps", "readingTimeMinutes", "rating"]
};

const RECOMMENDATION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    recommendations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          author: { type: Type.STRING },
          description: { type: Type.STRING },
        },
        required: ["title", "author", "description"]
      }
    }
  },
  required: ["recommendations"]
};

const QUIZ_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING },
          options: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Array of 4 possible answers."
          },
          correctAnswerIndex: { type: Type.NUMBER, description: "Index (0-3) of the correct answer in the options array." },
          explanation: { type: Type.STRING, description: "Short explanation of why the correct answer is right." }
        },
        required: ["question", "options", "correctAnswerIndex", "explanation"]
      }
    }
  },
  required: ["questions"]
};

/**
 * Searches the web using Google Search tool to find a direct URL for the book's cover.
 */
const searchWebForCover = async (title: string, author: string): Promise<string | null> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview', // upgraded for search tool support
      contents: `Find a direct URL to a high-quality front cover image for the book "${title}" by ${author}. 
      The URL must be a direct link to an image file (ending in .jpg, .png, or .webp).
      Prioritize finding the official cover on Amazon, Goodreads, or a publisher's site.
      Return ONLY the URL string.`,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });

    const text = response.text?.trim() || '';
    
    const imageRegex = /https?:\/\/[^\s"<>]+?\.(?:jpg|jpeg|png|webp)/i;
    const match = text.match(imageRegex);
    
    if (match) {
        return match[0];
    }

    if (text.includes('media-amazon.com') || text.includes('images-na.ssl-images-amazon.com')) {
        const amazonMatch = text.match(/https?:\/\/[^\s"<>]+/);
        if (amazonMatch && (amazonMatch[0].includes('.jpg') || amazonMatch[0].includes('.png'))) {
            return amazonMatch[0];
        }
    }
  } catch (error) {
    console.warn("Error searching web for cover:", error);
  }
  return null;
};

const fetchGoogleBooksCover = async (title: string, author: string): Promise<string | null> => {
  try {
    let query = encodeURIComponent(`intitle:${title}${author ? ` inauthor:${author}` : ''}`);
    let response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=3&printType=books`);
    
    if (!response.ok) return null;

    let data = await response.json();
    
    if (!data.items || data.items.length === 0) {
        query = encodeURIComponent(`${title} ${author || ''}`);
        response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=3&printType=books`);
        if (!response.ok) return null;
        data = await response.json();
    }
    
    if (data.items && data.items.length > 0) {
      for (const item of data.items) {
        const imageLinks = item.volumeInfo?.imageLinks;
        if (imageLinks) {
          let url = imageLinks.extraLarge || 
                    imageLinks.large || 
                    imageLinks.medium || 
                    imageLinks.thumbnail || 
                    imageLinks.smallThumbnail;
          if (url) {
            return url.replace('http://', 'https://');
          }
        }
      }
    }
  } catch (error) {
    // Silent fail for fallback
  }
  return null;
};

const fetchOpenLibraryCover = async (title: string, author: string): Promise<string | null> => {
  try {
    const query = encodeURIComponent(`${title} ${author || ''}`);
    const response = await fetch(`https://openlibrary.org/search.json?q=${query}&limit=1`);
    if (!response.ok) return null;
    const data = await response.json();
    
    if (data.docs && data.docs.length > 0) {
      const doc = data.docs[0];
      if (doc.cover_i) {
        return `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
      }
    }
  } catch (error) {
    // Silent fail
  }
  return null;
};

export const fetchRealCover = async (title: string, author: string): Promise<string> => {
  const booksApiUrl = await fetchGoogleBooksCover(title, author);
  if (booksApiUrl) return booksApiUrl;

  const openLibUrl = await fetchOpenLibraryCover(title, author);
  if (openLibUrl) return openLibUrl;

  const searchUrl = await searchWebForCover(title, author);
  if (searchUrl) return searchUrl;

  return `https://ui-avatars.com/api/?name=${encodeURIComponent(title)}&background=f97316&color=fff&size=600&bold=true`;
};

// --- Core AI Features ---

export const summarizeBook = async (title: string, author?: string): Promise<BookInsight> => {
  const prompt = `
    Analyze the non-fiction book "${title}" ${author ? `by ${author}` : ''}.
    
    1. **Summary**: Write a robust, multi-paragraph summary (approx. 350-500 words) covering the core thesis, major arguments, and the author's conclusion.
    2. **Key Insights**: Provide 8-12 key insights. Each insight should be a **concise paragraph** (approx. 2-3 sentences) capturing the core concept clearly without being overly wordy.
    3. **Actionable Steps**: Provide 6-8 practical steps. Each step MUST be strictly limited to a maximum of 2 sentences.
    4. **One Sentence Takeaway**: A single, punchy, memorable sentence capturing the essence of the book.

    Ensure the output matches the JSON schema provided.
    The 'category' should be one of: Psychology, Productivity, Business, Technology, Philosophy, Health, Biography, Other.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: GENERIC_BOOK_SCHEMA
    }
  });

  const data = JSON.parse(response.text || '{}');
  const coverUrl = await fetchRealCover(data.title || title, data.author || author || '');

  return {
    id: Math.random().toString(36).substr(2, 9),
    title: data.title || title,
    author: data.author || author || 'Unknown',
    category: data.category || 'Other',
    oneSentenceTakeaway: data.oneSentenceTakeaway || 'No takeaway available.',
    summary: data.summary || 'No summary available.',
    keyInsights: data.keyInsights || [],
    actionableSteps: data.actionableSteps || [],
    coverImageUrl: coverUrl,
    rating: data.rating || 0,
    readingTimeMinutes: data.readingTimeMinutes || 5,
    addedAt: new Date().toISOString(),
    status: 'Want to Read'
  };
};

export const summarizePdf = async (base64Data: string): Promise<BookInsight> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        { inlineData: { mimeType: 'application/pdf', data: base64Data } },
        { text: `Analyze this document as a non-fiction book. 
        
        1. **Summary**: Write a detailed summary (350+ words).
        2. **Key Insights**: Provide 8-12 insights. Each insight should be a concise paragraph (2-3 sentences).
        3. **Actionable Steps**: Provide 6-8 specific instructions. Each step MUST be strictly limited to a maximum of 2 sentences.
        
        Follow the JSON schema.` }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: GENERIC_BOOK_SCHEMA
    }
  });

  const data = JSON.parse(response.text || '{}');
  
  return {
    id: Math.random().toString(36).substr(2, 9),
    title: data.title || "Uploaded Document",
    author: data.author || "Unknown Author",
    category: data.category || 'Other',
    oneSentenceTakeaway: data.oneSentenceTakeaway || 'No takeaway available.',
    summary: data.summary || 'No summary available.',
    keyInsights: data.keyInsights || [],
    actionableSteps: data.actionableSteps || [],
    coverImageUrl: 'https://placehold.co/600x800/orange/white?text=PDF',
    rating: data.rating || 0,
    readingTimeMinutes: data.readingTimeMinutes || 5,
    addedAt: new Date().toISOString(),
    status: 'Finished',
    pdfData: base64Data // Store PDF for reference
  };
};

export const generateDetailedSummary = async (book: BookInsight): Promise<string> => {
  const prompt = `
    Create a deep-dive "Masterclass" summary for the book "${book.title}" by ${book.author}.
    
    Structure the output in Markdown format with:
    1. Introduction
    2. detailed chapters/sections (use ## for headers)
    3. deep analysis of core concepts
    4. conclusion.
    
    Use bolding (**text**) for emphasis.
    The content should be extensive enough for a 15-minute read.
    Base it on the following brief context but expand using your general knowledge of the book:
    ${book.summary}
    ${book.keyInsights.join('\n')}
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview', // Stronger model for writing
    contents: prompt
  });

  return response.text || "Failed to generate detailed summary.";
};

export const generateAudioSummary = async (book: BookInsight, type: 'short' | 'long'): Promise<string> => {
  const textToSay = type === 'short' 
    ? `Here is your summary of ${book.title}. ${book.oneSentenceTakeaway}. ${book.summary}`
    : `Welcome to the deep dive of ${book.title} by ${book.author}. Let's explore the key insights. ${book.keyInsights.join('. ')}. Now, here is how you can apply this. ${book.actionableSteps.join('. ')}`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: textToSay }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) throw new Error("No audio generated");
  return base64Audio;
};

export const getAIRecommendations = async (userBooks: BookInsight[]) => {
  if (userBooks.length === 0) return [];
  
  const booksList = userBooks.map(b => `"${b.title}" by ${b.author} (${b.category})`).join(', ');
  
  const prompt = `
    Based on the user's library: ${booksList}, recommend 6 similar non-fiction books they haven't read.
    Return strictly JSON with an array of objects containing title, author, and a 1-sentence description.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: RECOMMENDATION_SCHEMA
    }
  });

  const data = JSON.parse(response.text || '{}');
  const recs = data.recommendations || [];

  // Hydrate with covers
  const hydratedRecs = await Promise.all(recs.map(async (rec: any) => ({
    ...rec,
    coverUrl: await fetchRealCover(rec.title, rec.author)
  })));

  return hydratedRecs;
};

export const generateBookQuiz = async (book: BookInsight): Promise<QuizQuestion[]> => {
  const prompt = `
    Create a short multiple-choice quiz (3 questions) to test the user's understanding of the book "${book.title}".
    
    Use the following context to generate the questions:
    Summary: ${book.summary}
    Insights: ${book.keyInsights.join('\n')}

    The questions should be conceptual and test comprehension, not just trivia.
    Return the result as a JSON object containing an array of questions.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: QUIZ_SCHEMA
    }
  });

  const data = JSON.parse(response.text || '{}');
  return data.questions || [];
};

// --- Utility to convert PCM to WAV for browser playback ---
export const base64PCMToWavBlob = (base64PCM: string): Blob => {
  const binaryString = atob(base64PCM);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Gemini 2.5 Flash TTS returns 24kHz mono PCM 16-bit usually.
  // WAV Header construction
  const wavHeader = new ArrayBuffer(44);
  const view = new DataView(wavHeader);

  const sampleRate = 24000;
  const numChannels = 1;
  const bitsPerSample = 16;

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + len, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true);
  view.setUint16(32, numChannels * (bitsPerSample / 8), true);
  view.setUint16(34, bitsPerSample, true);
  writeString(view, 36, 'data');
  view.setUint32(40, len, true);

  return new Blob([view, bytes], { type: 'audio/wav' });
};

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

// --- NEW: Chat with Book ---

export const createBookChatSession = (book: BookInsight): Chat => {
  return ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: {
      systemInstruction: `You are an intelligent, friendly AI assistant designed to help the user understand the book "${book.title}" by ${book.author}.
      
      Here is the specific context and summary of the book:
      
      ONE SENTENCE TAKEAWAY:
      ${book.oneSentenceTakeaway}

      SUMMARY:
      ${book.summary}
      
      KEY INSIGHTS:
      ${book.keyInsights.join('\n- ')}
      
      ACTIONABLE STEPS:
      ${book.actionableSteps.join('\n- ')}
      
      Your Goal:
      - Answer questions based on the book's content provided above.
      - Help the user apply the concepts to their life.
      - If the user asks something outside the scope of this summary but relevant to the book (based on your general training), you may answer but mention that it is based on general knowledge, not the specific summary.
      - Be concise, encouraging, and clear.
      `
    }
  });
};
