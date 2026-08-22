/**
 * Gemini AI Service for Velvet Reader
 * Features:
 * - Rotation through comma-separated API keys with auto-failover on 429 / Rate Limit
 * - Fixed model: gemini-flash-lite-latest
 * - Easy English dictionary lookup with simple explanation, IPA, synonyms, and context awareness
 */

export interface IWordExplanation {
  word: string;
  ipa?: string;
  partOfSpeech?: string;
  simpleDefinition: string;
  synonyms: string[];
  contextExplanation?: string;
}

export class GeminiAIService {
  private static MODEL = 'gemini-flash-lite-latest';

  /**
   * Parse comma-separated API keys into a clean string array
   */
  public static parseApiKeys(keysString?: string): string[] {
    if (!keysString) return [];
    return keysString
      .split(/[,;\n]+/)
      .map((k) => k.trim())
      .filter((k) => k.length > 5);
  }

  /**
   * Look up a word using Gemini AI with key rotation
   */
  public static async explainWord(
    word: string,
    contextSection: string,
    bookTitle: string,
    apiKeysString?: string
  ): Promise<IWordExplanation> {
    const keys = this.parseApiKeys(apiKeysString);
    if (keys.length === 0) {
      throw new Error('MISSING_API_KEY');
    }

    const trimmedWord = word.trim();
    const cleanContext = contextSection ? contextSection.slice(0, 3000) : '';

    const systemInstruction = `You are a friendly, gentle English reading assistant for ESL readers. 
Explain words in VERY SIMPLE, PLAIN, EASY-TO-UNDERSTAND ENGLISH. Avoid academic or obscure definitions.
Always respond in strictly valid JSON without markdown fences or extra commentary.`;

    const prompt = `Context: From the book "${bookTitle || 'the book'}" in the current chapter/section:
"""
${cleanContext}
"""

Please explain the word/phrase "${trimmedWord}" as it is used in this context.

Return ONLY a JSON object with this exact structure:
{
  "word": "${trimmedWord}",
  "ipa": "/.../",
  "partOfSpeech": "noun / verb / adjective / etc",
  "simpleDefinition": "A very simple, clear explanation of what this word means in this context, using everyday English words.",
  "synonyms": ["simple synonym 1", "simple synonym 2", "simple synonym 3"],
  "contextExplanation": "One short simple sentence explaining what it specifically refers to in this sentence or chapter."
}`;

    let lastError: any = null;

    // Try each API key in rotation until one succeeds
    for (let i = 0; i < keys.length; i++) {
      const apiKey = keys[i];
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.MODEL}:generateContent?key=${apiKey}`;

        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: `${systemInstruction}\n\n${prompt}` }],
              },
            ],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.2,
            },
          }),
        });

        if (res.status === 429 || res.status === 403 || res.status === 503) {
          // Rate limit or quota exhausted -> continue to next key
          lastError = new Error(`Key #${i + 1} rate limited (${res.status})`);
          console.warn(`[GeminiAIService] Key #${i + 1} rate limited. Rotating to next key...`);
          continue;
        }

        if (!res.ok) {
          const errText = await res.text();
          lastError = new Error(`Gemini API error: ${res.status} - ${errText}`);
          continue;
        }

        const data = await res.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (!rawText) {
          throw new Error('Empty response from Gemini');
        }

        // Clean JSON text (strip markdown code block markers if any)
        const cleanJson = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
        const parsed: IWordExplanation = JSON.parse(cleanJson);
        return {
          word: parsed.word || trimmedWord,
          ipa: parsed.ipa || '',
          partOfSpeech: parsed.partOfSpeech || '',
          simpleDefinition: parsed.simpleDefinition || 'No definition found.',
          synonyms: Array.isArray(parsed.synonyms) ? parsed.synonyms : [],
          contextExplanation: parsed.contextExplanation || '',
        };
      } catch (err) {
        lastError = err;
        console.warn(`[GeminiAIService] Key #${i + 1} failed:`, err);
      }
    }

    throw lastError || new Error('All provided Gemini API keys failed or reached rate limits.');
  }

  /**
   * Summarize a chapter by identifying all headers/subheadings and generating clear English summaries
   */
  public static async summarizeChapterByHeaders(
    chapterTitle: string,
    chapterText: string,
    bookTitle: string,
    apiKeysString?: string
  ): Promise<Array<{ header: string; summary: string; keyPoints: string[] }>> {
    const keys = this.parseApiKeys(apiKeysString);
    if (keys.length === 0) {
      throw new Error('MISSING_API_KEY');
    }

    const cleanText = chapterText ? chapterText.slice(0, 45000) : '';

    const systemInstruction = `You are an expert reading assistant. Your task is to analyze a book chapter, identify all major headers, titles, and subheadings within that chapter (e.g. Chapter title, "The Luxury Trap", "Divine Intervention", "Victims of the Revolution", etc.), and provide a clear, concise English summary for EACH section.
Rules:
1. Identify all distinct headers/subheadings present in the chapter content.
2. For each header, write a 2-3 sentence overview summary in plain, easy-to-understand English.
3. For each header, provide 2-4 key bullet points explaining core arguments, facts, or takeaways.
4. Output strictly valid JSON with no markdown wrapping.`;

    const prompt = `Book: "${bookTitle || 'Unknown'}"
Chapter: "${chapterTitle}"

Full Chapter Content:
"""
${cleanText}
"""

Please identify all sections/headers in this chapter and provide an English summary for each.

Return JSON in this exact schema:
{
  "sections": [
    {
      "header": "Name of Header or Subheading",
      "summary": "2-3 clear sentences summarizing the core idea of this section in accessible English.",
      "keyPoints": [
        "Key takeaway or argument 1",
        "Key takeaway or argument 2",
        "Key takeaway or argument 3"
      ]
    }
  ]
}`;

    let lastError: any = null;

    for (let i = 0; i < keys.length; i++) {
      const apiKey = keys[i];
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.MODEL}:generateContent?key=${apiKey}`;

        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: `${systemInstruction}\n\n${prompt}` }],
              },
            ],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.3,
            },
          }),
        });

        if (res.status === 429 || res.status === 403 || res.status === 503) {
          lastError = new Error(`Key #${i + 1} rate limited (${res.status})`);
          console.warn(`[GeminiAIService] Key #${i + 1} rate limited during chapter summary.`);
          continue;
        }

        if (!res.ok) {
          const errText = await res.text();
          lastError = new Error(`Gemini API error: ${res.status} - ${errText}`);
          continue;
        }

        const data = await res.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (!rawText) {
          throw new Error('Empty response from Gemini');
        }

        const cleanJson = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJson);
        const sections = Array.isArray(parsed.sections) ? parsed.sections : [];

        if (sections.length === 0) {
          // Fallback if model returned single object
          return [
            {
              header: chapterTitle || 'Chapter Overview',
              summary: parsed.summary || 'Summary of this section.',
              keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
            },
          ];
        }

        return sections.map((s: any) => ({
          header: s.header || chapterTitle,
          summary: s.summary || '',
          keyPoints: Array.isArray(s.keyPoints) ? s.keyPoints : [],
        }));
      } catch (err) {
        lastError = err;
        console.warn(`[GeminiAIService] Key #${i + 1} summary generation failed:`, err);
      }
    }

    throw lastError || new Error('All provided Gemini API keys failed.');
  }
}
