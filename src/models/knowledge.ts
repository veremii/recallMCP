import mongoose, { Schema, Document } from 'mongoose';
import type { KnowledgeKind } from '../types/knowledge.js';

/**
 * Mongoose document interface
 */
export interface KnowledgeDocument extends Document {
  title: string;
  kind: KnowledgeKind;
  tags: string[];
  content: string;
  project?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * MongoDB Schema с текстовым индексом для поиска
 */
const knowledgeSchema = new Schema<KnowledgeDocument>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    kind: {
      type: String,
      required: true,
      enum: ['snippet', 'issue', 'pattern'],
    },
    tags: {
      type: [String],
      required: true,
      validate: [(v: string[]) => v.length > 0, 'At least one tag required'],
    },
    content: {
      type: String,
      required: true,
      maxlength: 50000,
    },
    project: {
      type: String,
      trim: true,
      maxlength: 100,
    },
  },
  {
    timestamps: true,
  }
);

// Текстовый индекс для полнотекстового поиска
knowledgeSchema.index(
  { title: 'text', content: 'text', tags: 'text' },
  { weights: { title: 10, tags: 5, content: 1 } }
);

// Индекс для фильтрации по kind и project
knowledgeSchema.index({ kind: 1 });
knowledgeSchema.index({ project: 1 });
knowledgeSchema.index({ tags: 1 });

export const Knowledge = mongoose.model<KnowledgeDocument>(
  'Knowledge',
  knowledgeSchema
);
