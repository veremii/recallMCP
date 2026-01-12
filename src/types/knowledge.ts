import { z } from 'zod';

/**
 * Типы знаний в базе
 * - snippet: фрагмент кода, конфиг, шаблон
 * - issue: решение проблемы, баг-фикс
 * - pattern: архитектурный паттерн, best practice
 */
export const KnowledgeKindSchema = z.enum(['snippet', 'issue', 'pattern']);
export type KnowledgeKind = z.infer<typeof KnowledgeKindSchema>;

/**
 * Схема валидации для создания записи
 */
export const CreateKnowledgeSchema = z.object({
  title: z.string().min(3).max(200),
  content: z.string().min(1).max(50000),
  kind: KnowledgeKindSchema,
  tags: z.array(z.string().min(1).max(50)).min(1).max(20),
  project: z.string().max(100).optional(),
});

export type CreateKnowledgeInput = z.infer<typeof CreateKnowledgeSchema>;

/**
 * Полная структура записи в БД
 */
export interface KnowledgeItem {
  id: string;
  title: string;
  kind: KnowledgeKind;
  tags: string[];
  content: string;
  project?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Результат поиска (без полного content для экономии токенов)
 */
export interface KnowledgeSearchResult {
  id: string;
  title: string;
  kind: KnowledgeKind;
  tags: string[];
  preview: string; // Первые 200 символов content
  project?: string;
  score?: number;
}
