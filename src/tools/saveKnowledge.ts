import { z } from 'zod';
import { Knowledge } from '../models/knowledge.js';
import { CreateKnowledgeSchema } from '../types/knowledge.js';
import { isDatabaseConnected } from '../config/database.js';
import { generateKnowledgeEmbedding, isModelReady } from '../services/embeddings.js';
import { upsertVector, isQdrantAvailable } from '../services/vectorStore.js';

/**
 * Zod schema для MCP tool input
 */
export const SaveKnowledgeInputSchema = z.object({
  title: z.string().describe('Краткое название (например: "Webpack микро-фронтенд конфиг")'),
  content: z.string().describe('Полное содержимое: код, конфиг или описание решения'),
  kind: z.enum(['snippet', 'issue', 'pattern']).describe('Тип: snippet (код), issue (баг-фикс), pattern (паттерн)'),
  tags: z.array(z.string()).describe('Теги для поиска: ["webpack", "react", "config"]'),
  project: z.string().optional().describe('Опционально: название проекта'),
});

export type SaveKnowledgeInput = z.infer<typeof SaveKnowledgeInputSchema>;

/**
 * Сохраняет новую единицу знаний в MongoDB + Qdrant
 */
export async function saveKnowledge(input: SaveKnowledgeInput): Promise<string> {
  if (!isDatabaseConnected()) {
    throw new Error('Database is not connected. Please check MongoDB status.');
  }

  // Валидация входных данных
  const validationResult = CreateKnowledgeSchema.safeParse(input);
  if (!validationResult.success) {
    const errors = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
    throw new Error(`Validation failed: ${errors.join(', ')}`);
  }

  const data = validationResult.data;
  const normalizedTags = data.tags.map(tag => tag.toLowerCase().trim());

  // Сохранение в MongoDB
  const knowledge = new Knowledge({
    title: data.title.trim(),
    content: data.content,
    kind: data.kind,
    tags: normalizedTags,
    project: data.project?.trim(),
  });

  await knowledge.save();
  const id = knowledge._id.toString();

  // Векторизация и сохранение в Qdrant
  let vectorized = false;
  if (isModelReady() && await isQdrantAvailable()) {
    try {
      const embedding = await generateKnowledgeEmbedding(
        data.title,
        normalizedTags,
        data.content
      );

      await upsertVector(id, embedding, {
        title: data.title,
        kind: data.kind,
        tags: normalizedTags,
        project: data.project || null,
      });

      vectorized = true;
    } catch (error) {
      console.error('[Vector] Failed to vectorize:', error);
      // Не падаем — MongoDB запись уже сохранена
    }
  }

  return JSON.stringify({
    success: true,
    id,
    vectorized,
    message: `Knowledge "${data.title}" saved successfully${vectorized ? ' (with vector)' : ''}`,
  });
}
