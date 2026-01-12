/**
 * Сервис работы с Qdrant vector store
 * Поддерживает scalar quantization для экономии памяти
 */

import { QdrantClient } from "@qdrant/js-client-rest";
import { VECTOR_SIZE } from "./embeddings.js";

const QDRANT_URL = process.env.QDRANT_URL || "http://localhost:6333";
const COLLECTION_NAME = "knowledge";

let client: QdrantClient | null = null;
let isInitialized = false;

/**
 * Конвертирует MongoDB ObjectId (24 hex) в UUID формат для Qdrant
 * ObjectId: 6964e2c9c9340d7d4ed77ac1
 * UUID:     6964e2c9-c934-0d7d-4ed7-7ac100000000
 */
function mongoIdToUuid(mongoId: string): string {
  // Дополняем до 32 символов (UUID без дефисов)
  const padded = mongoId.padEnd(32, "0");
  // Форматируем как UUID: 8-4-4-4-12
  return `${padded.slice(0, 8)}-${padded.slice(8, 12)}-${padded.slice(
    12,
    16
  )}-${padded.slice(16, 20)}-${padded.slice(20, 32)}`;
}

/**
 * Конвертирует UUID обратно в MongoDB ObjectId
 */
function uuidToMongoId(uuid: string): string {
  // Убираем дефисы и берём первые 24 символа
  return uuid.replace(/-/g, "").slice(0, 24);
}

/**
 * Получение клиента Qdrant
 */
function getClient(): QdrantClient {
  if (!client) {
    client = new QdrantClient({ url: QDRANT_URL });
  }
  return client;
}

/**
 * Инициализация коллекции с quantization
 */
export async function initVectorStore(): Promise<void> {
  if (isInitialized) return;

  const qdrant = getClient();

  try {
    // Проверяем существование коллекции
    const collections = await qdrant.getCollections();
    const exists = collections.collections.some(
      (c) => c.name === COLLECTION_NAME
    );

    if (!exists) {
      // Создаём коллекцию с scalar quantization
      await qdrant.createCollection(COLLECTION_NAME, {
        vectors: {
          size: VECTOR_SIZE,
          distance: "Cosine",
        },
        // Scalar quantization: int8 вместо float32 (4x меньше памяти)
        quantization_config: {
          scalar: {
            type: "int8",
            quantile: 0.99,
            always_ram: true,
          },
        },
        // Оптимизация для малых датасетов
        optimizers_config: {
          memmap_threshold: 20000,
        },
      });

      console.error("[Qdrant] Collection created with scalar quantization");
    }

    isInitialized = true;
    console.error("[Qdrant] Connected to", QDRANT_URL);
  } catch (error) {
    console.error("[Qdrant] Init failed:", error);
    throw new Error(
      `Qdrant initialization failed: ${
        error instanceof Error ? error.message : "Unknown"
      }`
    );
  }
}

/**
 * Сохранение вектора в Qdrant
 * @param id - MongoDB ObjectId (24 hex chars)
 */
export async function upsertVector(
  id: string,
  vector: number[],
  payload: Record<string, unknown>
): Promise<void> {
  const qdrant = getClient();
  const uuid = mongoIdToUuid(id);

  await qdrant.upsert(COLLECTION_NAME, {
    wait: true,
    points: [
      {
        id: uuid,
        vector,
        payload: { ...payload, mongo_id: id },
      },
    ],
  });
}

/**
 * Поиск похожих векторов
 * Возвращает MongoDB ObjectId в поле id
 */
export async function searchVectors(
  queryVector: number[],
  limit: number = 5,
  filter?: Record<string, unknown>
): Promise<
  Array<{ id: string; score: number; payload: Record<string, unknown> }>
> {
  const qdrant = getClient();

  const results = await qdrant.search(COLLECTION_NAME, {
    vector: queryVector,
    limit,
    with_payload: true,
    filter: filter
      ? {
          must: Object.entries(filter).map(([key, value]) => ({
            key,
            match: { value },
          })),
        }
      : undefined,
    // Используем quantized vectors для поиска (быстрее)
    params: {
      quantization: {
        rescore: true, // Rescore топ результатов с оригинальными векторами
      },
    },
  });

  return results.map((r) => {
    const payload = r.payload as Record<string, unknown>;
    // Возвращаем mongo_id если есть, иначе конвертируем UUID
    const mongoId =
      (payload.mongo_id as string) || uuidToMongoId(r.id as string);

    return {
      id: mongoId,
      score: r.score,
      payload,
    };
  });
}

/**
 * Удаление вектора
 * @param id - MongoDB ObjectId
 */
export async function deleteVector(id: string): Promise<void> {
  const qdrant = getClient();
  const uuid = mongoIdToUuid(id);

  await qdrant.delete(COLLECTION_NAME, {
    wait: true,
    points: [uuid],
  });
}

/**
 * Проверка доступности Qdrant
 */
export async function isQdrantAvailable(): Promise<boolean> {
  try {
    const qdrant = getClient();
    await qdrant.getCollections();
    return true;
  } catch {
    return false;
  }
}
