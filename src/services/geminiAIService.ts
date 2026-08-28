/**
 * Gemini AI Service for Velvet Reader
 * Features:
 * - Rotation through comma-separated API keys with auto-failover on 429 / Rate Limit
 * - Fixed model: gemini-flash-lite-latest
 * - Easy English dictionary lookup with simple explanation, IPA, synonyms, and context awareness
 */

export interface IWordExplanation {
  word?: string;
  ipa?: string;
  simpleDefinition?: string;
  contextExplanation: string;
  isSentence?: boolean;
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
   * Look up a word or explain a sentence using Gemini AI with key rotation
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
    const wordCount = trimmedWord.split(/\s+/).filter(Boolean).length;
    const isSentence = wordCount > 3 || (/[.?!;]/.test(trimmedWord) && wordCount > 2);

    const systemInstruction = isSentence
      ? `You are an expert English literature tutor and linguist.
Explain selected sentences or passages in VERY SIMPLE, PLAIN, EASY-TO-UNDERSTAND BRITISH ENGLISH (en-GB).
Break down complex sentences, metaphors, idioms, or archaic phrasing so any reader understands clearly and effortlessly.
Always respond in strictly valid JSON without markdown fences or extra commentary.`
      : `You are an expert British English linguist and dictionary editor (Oxford & Cambridge English standards).
Explain words in VERY SIMPLE, PLAIN, EASY-TO-UNDERSTAND BRITISH ENGLISH (en-GB). Avoid academic or obscure definitions.
Always provide the precise standard British English (Received Pronunciation / UK) IPA phonetic transcription using standard Unicode IPA symbols and the proper primary stress mark /ˈ/ (U+02C8) (e.g. /ˈeŋ.kleɪv/, /ˈdɒm.ɪ.saɪl/, /ˈskedʒ.uːl/).
Always respond in strictly valid JSON without markdown fences or extra commentary.`;

    const prompt = isSentence
      ? `Context: From the book "${bookTitle || 'the book'}" in the current chapter/section:
"""
${cleanContext}
"""

Please explain what this sentence/passage means in this context in plain everyday English:
"${trimmedWord}"

Return ONLY a JSON object with this exact structure:
{
  "contextExplanation": "A clear, plain, and easy-to-understand explanation of what this sentence means in this context, breaking down any tricky metaphors, idioms, or archaic phrasing."
}`
      : `Context: From the book "${bookTitle || 'the book'}" in the current chapter/section:
"""
${cleanContext}
"""

Please explain the word/phrase "${trimmedWord}" as it is used in this context using British English (UK / Cambridge / Oxford) standards.

Return ONLY a JSON object with this exact structure:
{
  "word": "${trimmedWord}",
  "ipa": "/.../", // Standard British English (UK / RP) IPA pronunciation with proper IPA symbols & stress mark /ˈ/ (e.g. /ˈeŋ.kleɪv/, /ˈdɒm.ɪ.saɪl/)
  "simpleDefinition": "A very simple, clear explanation in British English of what this word means in this context, using everyday English words.",
  "contextExplanation": "One short simple sentence explaining what it specifically refers to in this sentence or chapter."
}`;

    let lastError: any = null;

    // Try each API key in rotation until one succeeds
    for (let i = 0; i < keys.length; i++) {
      const apiKey = keys[i];
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.MODEL}:generateContent`;

        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
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

        if (isSentence) {
          return {
            contextExplanation: parsed.contextExplanation || parsed.simpleDefinition || 'No explanation available.',
            isSentence: true,
          };
        }

        // Normalize IPA string: replace standard ASCII apostrophes/single quotes with true Unicode IPA stress marks
        let rawIpa = (parsed.ipa || '').trim();
        if (rawIpa) {
          rawIpa = rawIpa
            .replace(/'/g, 'ˈ')
            .replace(/`/g, 'ˈ')
            .replace(/,/g, 'ˌ');
        }

        return {
          word: parsed.word || trimmedWord,
          ipa: rawIpa,
          simpleDefinition: parsed.simpleDefinition || 'No definition found.',
          contextExplanation: parsed.contextExplanation || '',
          isSentence: false,
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
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.MODEL}:generateContent`;

        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
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
