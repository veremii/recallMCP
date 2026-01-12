/**
 * Синхронизация MongoDB ↔ Qdrant
 * Проверяет записи без векторов и индексирует их
 */

import { Knowledge } from '../models/knowledge.js';
import { generateKnowledgeEmbedding } from './embeddings.js';
import { upsertVector, searchVectors, isQdrantAvailable } from './vectorStore.js';

/**
 * Получает ID всех записей в Qdrant
 */
async function getQdrantIds(): Promise<Set<string>> {
  const ids = new Set<string>();
  
  try {
    // Делаем dummy поиск чтобы получить все записи
    // Qdrant не имеет "list all", поэтому используем scroll
    const response = await fetch(
      `${process.env.QDRANT_URL || 'http://localhost:6333'}/collections/knowledge/points/scroll`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 10000, with_payload: false }),
      }
    );
    
    if (response.ok) {
      const data = await response.json() as { result: { points: Array<{ id: string }> } };
      for (const point of data.result.points) {
        ids.add(String(point.id));
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
  
  // Получаем ID уже проиндексированных записей
  const qdrantIds = await getQdrantIds();
  console.error(`[Sync] Found ${qdrantIds.size} vectors in Qdrant`);
  
  // Получаем все записи из MongoDB
  const allDocs = await Knowledge.find({}, { _id: 1, title: 1, tags: 1, content: 1, kind: 1, project: 1 })
    .lean()
    .exec();
  
  console.error(`[Sync] Found ${allDocs.length} documents in MongoDB`);
  
  // Фильтруем те, которых нет в Qdrant
  const toSync = allDocs.filter(doc => !qdrantIds.has(doc._id.toString()));
  
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
