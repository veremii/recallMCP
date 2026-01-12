/**
 * Сервис генерации эмбеддингов через @xenova/transformers
 * Модель: multilingual-e5-small (384 dimensions)
 * Хорошая поддержка русского языка
 */

import { pipeline, type FeatureExtractionPipeline } from "@xenova/transformers";

const MODEL_NAME = "Xenova/multilingual-e5-small";
export const VECTOR_SIZE = 384;

let embeddingPipeline: FeatureExtractionPipeline | null = null;
let isInitializing = false;

/**
 * Инициализация модели (lazy loading)
 */
async function getEmbeddingPipeline(): Promise<FeatureExtractionPipeline> {
  if (embeddingPipeline) {
    return embeddingPipeline;
  }

  if (isInitializing) {
    // Ждём пока модель загрузится
    while (isInitializing) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return embeddingPipeline!;
  }

  isInitializing = true;
  console.error(`[Embeddings] Loading model ${MODEL_NAME}...`);

  try {
    embeddingPipeline = await pipeline("feature-extraction", MODEL_NAME, {
      quantized: true, // Используем квантованную версию (~90MB vs ~470MB)
    });
    console.error("[Embeddings] Model loaded successfully");
    return embeddingPipeline;
  } finally {
    isInitializing = false;
  }
}

/**
 * Генерирует эмбеддинг для текста
 * E5 модели требуют префикс "query: " или "passage: "
 */
export async function generateEmbedding(
  text: string,
  isQuery = true
): Promise<number[]> {
  const pipe = await getEmbeddingPipeline();

  // E5 модели требуют специальный префикс
  const prefixedText = isQuery ? `query: ${text}` : `passage: ${text}`;

  // Обрезаем до 512 токенов (~2000 символов для безопасности)
  const truncatedText = prefixedText.slice(0, 2000);

  const output = await pipe(truncatedText, {
    pooling: "mean",
    normalize: true,
  });

  // Конвертируем в обычный массив
  return Array.from(output.data as Float32Array);
}

/**
 * Генерирует эмбеддинг для KnowledgeItem (как passage)
 */
export async function generateKnowledgeEmbedding(
  title: string,
  tags: string[],
  content: string
): Promise<number[]> {
  const text = `${title}. ${tags.join(", ")}. ${content}`;
  return generateEmbedding(text, false); // passage, не query
}

/**
 * Предзагрузка модели при старте
 */
export async function preloadModel(): Promise<void> {
  await getEmbeddingPipeline();
}

/**
 * Проверка готовности модели
 */
export function isModelReady(): boolean {
  return embeddingPipeline !== null;
}
