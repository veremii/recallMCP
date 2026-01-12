import { z } from 'zod';
import { Knowledge } from '../models/knowledge.js';
import { isDatabaseConnected } from '../config/database.js';
import type { KnowledgeItem } from '../types/knowledge.js';

/**
 * Zod schema для MCP tool input
 */
export const GetKnowledgeInputSchema = z.object({
  id: z.string().min(1).describe('ID записи из результатов поиска'),
});

export type GetKnowledgeInput = z.infer<typeof GetKnowledgeInputSchema>;

/**
 * Получает полную запись по ID
 */
export async function getKnowledge(input: GetKnowledgeInput): Promise<string> {
  if (!isDatabaseConnected()) {
    throw new Error('Database is not connected. Please check MongoDB status.');
  }

  const { id } = input;

  // Валидация ObjectId
  if (!id.match(/^[0-9a-fA-F]{24}$/)) {
    throw new Error(`Invalid ID format: ${id}. Expected 24-character hex string.`);
  }

  const doc = await Knowledge.findById(id).lean().exec();

  if (!doc) {
    throw new Error(`Knowledge item not found: ${id}`);
  }

  const result: KnowledgeItem = {
    id: doc._id.toString(),
    title: doc.title,
    kind: doc.kind,
    tags: doc.tags,
    content: doc.content,
    project: doc.project,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };

  return JSON.stringify({
    success: true,
    item: result,
  });
}
