import { z } from 'zod';
import { Knowledge } from '../models/knowledge.js';
import { isDatabaseConnected } from '../config/database.js';
import { generateEmbedding, isOllamaAvailable } from '../services/embeddings.js';
import { searchVectors, isQdrantAvailable } from '../services/vectorStore.js';
import type { KnowledgeSearchResult } from '../types/knowledge.js';

/**
 * Zod schema для MCP tool input
 */
export const SearchKnowledgeInputSchema = z.object({
  query: z.string().min(1).describe('Поисковый запрос: ключевые слова или фраза'),
  kind: z.enum(['snippet', 'issue', 'pattern']).optional().describe('Фильтр по типу (опционально)'),
  project: z.string().optional().describe('Фильтр по проекту (опционально)'),
  limit: z.number().min(1).max(20).default(5).describe('Количество результатов (по умолчанию 5)'),
});

export type SearchKnowledgeInput = z.infer<typeof SearchKnowledgeInputSchema>;

const PREVIEW_LENGTH = 200;

/**
 * Гибридный поиск: vector (семантический) + text (keyword)
 */
export async function searchKnowledge(input: SearchKnowledgeInput): Promise<string> {
  if (!isDatabaseConnected()) {
    throw new Error('Database is not connected. Please check MongoDB status.');
  }

  const { query, kind, project, limit = 5 } = input;

  // Пробуем векторный поиск
  const vectorResults = await tryVectorSearch(query, kind, project, limit);
  
  if (vectorResults.length > 0) {
    return JSON.stringify({
      success: true,
      searchType: 'vector',
      count: vectorResults.length,
      results: vectorResults,
    });
  }

  // Fallback на текстовый поиск MongoDB
  const textResults = await textSearch(query, kind, project, limit);

  return JSON.stringify({
    success: true,
    searchType: 'text',
    count: textResults.length,
    results: textResults,
    message: textResults.length === 0 ? `No results for: ${query}` : undefined,
  });
}

/**
 * Векторный поиск через Qdrant
 */
async function tryVectorSearch(
  query: string,
  kind?: string,
  project?: string,
  limit: number = 5
): Promise<KnowledgeSearchResult[]> {
  // Проверка доступности сервисов
  if (!(await isOllamaAvailable()) || !(await isQdrantAvailable())) {
    return [];
  }

  try {
    const queryVector = await generateEmbedding(query);
    
    // Построение фильтра для Qdrant
    const filter: Record<string, unknown> = {};
    if (kind) filter.kind = kind;
    if (project) filter.project = project;

    const results = await searchVectors(
      queryVector, 
      limit, 
      Object.keys(filter).length > 0 ? filter : undefined
    );

    if (results.length === 0) return [];

    // Получаем полные данные из MongoDB
    const ids = results.map(r => r.id);
    const docs = await Knowledge.find({ _id: { $in: ids } }).lean().exec();
    const docMap = new Map(docs.map(d => [d._id.toString(), d]));

    return results
      .map(r => {
        const doc = docMap.get(r.id);
        if (!doc) return null;

        return {
          id: r.id,
          title: doc.title,
          kind: doc.kind,
          tags: doc.tags,
          preview: doc.content.length > PREVIEW_LENGTH
            ? doc.content.substring(0, PREVIEW_LENGTH) + '...'
            : doc.content,
          project: doc.project,
          score: r.score,
        };
      })
      .filter((r): r is KnowledgeSearchResult => r !== null);
  } catch (error) {
    console.error('[Vector Search] Failed:', error);
    return [];
  }
}

/**
 * Текстовый поиск MongoDB (fallback)
 */
async function textSearch(
  query: string,
  kind?: string,
  project?: string,
  limit: number = 5
): Promise<KnowledgeSearchResult[]> {
  const filter: Record<string, unknown> = {
    $text: { $search: query },
  };

  if (kind) filter.kind = kind;
  if (project) filter.project = project;

  const results = await Knowledge.find(filter, {
    score: { $meta: 'textScore' },
  })
    .sort({ score: { $meta: 'textScore' } })
    .limit(limit)
    .lean()
    .exec();

  return results.map((doc) => ({
    id: doc._id.toString(),
    title: doc.title,
    kind: doc.kind,
    tags: doc.tags,
    preview: doc.content.length > PREVIEW_LENGTH
      ? doc.content.substring(0, PREVIEW_LENGTH) + '...'
      : doc.content,
    project: doc.project,
    score: (doc as unknown as { score: number }).score,
  }));
}
