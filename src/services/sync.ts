/**
 * Синхронизация MongoDB ↔ Qdrant
 * Проверяет записи без векторов и индексирует их
 */

import { Knowledge } from '../models/knowledge.js';
import { generateKnowledgeEmbedding } from './embeddings.js';
import { upsertVector, isQdrantAvailable } from './vectorStore.js';

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';

/**
 * Получает MongoDB ID всех записей в Qdrant (из payload.mongo_id)
 */
async function getQdrantMongoIds(): Promise<Set<string>> {
  const ids = new Set<string>();
  
  try {
    const response = await fetch(
      `${QDRANT_URL}/collections/knowledge/points/scroll`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          limit: 10000, 
          with_payload: { include: ['mongo_id'] }
        }),
      }
    );
    
    if (response.ok) {
      const data = await response.json() as { 
        result: { 
          points: Array<{ payload?: { mongo_id?: string } }> 
        } 
      };
      
      for (const point of data.result.points) {
        if (point.payload?.mongo_id) {
          ids.add(point.payload.mongo_id);
        }
      }
    }
  } catch (error) {
    console.error('[Sync] Failed to get Qdrant IDs:', error);
  }
  
  return ids;
}

/**
 * Синхронизирует записи из MongoDB в Qdrant
 * Индексирует только те, которых нет в Qdrant
 */
export async function syncMongoToQdrant(): Promise<{ synced: number; failed: number }> {
  if (!(await isQdrantAvailable())) {
    console.error('[Sync] Qdrant not available, skipping sync');
    return { synced: 0, failed: 0 };
  }

  console.error('[Sync] Starting MongoDB → Qdrant sync...');
  
  // Получаем MongoDB ID уже проиндексированных записей
  const indexedIds = await getQdrantMongoIds();
  console.error(`[Sync] Found ${indexedIds.size} vectors in Qdrant`);
  
  // Получаем все записи из MongoDB
  const allDocs = await Knowledge.find({}, { _id: 1, title: 1, tags: 1, content: 1, kind: 1, project: 1 })
    .lean()
    .exec();
  
  console.error(`[Sync] Found ${allDocs.length} documents in MongoDB`);
  
  // Фильтруем те, которых нет в Qdrant
  const toSync = allDocs.filter(doc => !indexedIds.has(doc._id.toString()));
  
  if (toSync.length === 0) {
    console.error('[Sync] All documents already indexed');
    return { synced: 0, failed: 0 };
  }
  
  console.error(`[Sync] Need to index ${toSync.length} documents`);
  
  let synced = 0;
  let failed = 0;
  
  for (const doc of toSync) {
    const id = doc._id.toString();
    
    try {
      const embedding = await generateKnowledgeEmbedding(
        doc.title,
        doc.tags,
        doc.content
      );
      
      await upsertVector(id, embedding, {
        title: doc.title,
        kind: doc.kind,
        tags: doc.tags,
        project: doc.project || null,
      });
      
      synced++;
      
      if (synced % 5 === 0) {
        console.error(`[Sync] Progress: ${synced}/${toSync.length}`);
      }
    } catch (error) {
      console.error(`[Sync] Failed to index ${id}:`, error);
      failed++;
    }
  }
  
  console.error(`[Sync] Completed: ${synced} synced, ${failed} failed`);
  return { synced, failed };
}
