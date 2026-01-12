/**
 * Сервис генерации эмбеддингов через Ollama
 * Модель: nomic-embed-text (768 dimensions)
 */

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'nomic-embed-text';
export const VECTOR_SIZE = 768; // nomic-embed-text dimension

interface OllamaEmbeddingResponse {
  embedding: number[];
}

/**
 * Генерирует эмбеддинг для текста через Ollama API
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  // Обрезаем текст до разумного размера (8K токенов ~ 32K символов)
  const truncatedText = text.slice(0, 32000);

  try {
    const response = await fetch(`${OLLAMA_URL}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        prompt: truncatedText,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama API error: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as OllamaEmbeddingResponse;
    
    if (!data.embedding || !Array.isArray(data.embedding)) {
      throw new Error('Invalid embedding response from Ollama');
    }

    return data.embedding;
  } catch (error) {
    if (error instanceof Error && error.message.includes('fetch failed')) {
      throw new Error(`Ollama not available at ${OLLAMA_URL}. Run: ollama serve`);
    }
    throw error;
  }
}

/**
 * Генерирует эмбеддинг для KnowledgeItem (комбинация title + tags + content)
 */
export async function generateKnowledgeEmbedding(
  title: string,
  tags: string[],
  content: string
): Promise<number[]> {
  // Взвешенная комбинация: title важнее content
  const text = `${title}\n\nTags: ${tags.join(', ')}\n\n${content}`;
  return generateEmbedding(text);
}

/**
 * Проверка доступности Ollama
 */
export async function isOllamaAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
