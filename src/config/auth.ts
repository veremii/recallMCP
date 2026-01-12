import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

interface ApiKey {
  id: string;
  key: string;
  name: string;
  enabled: boolean;
}

interface ApiKeysConfig {
  keys: ApiKey[];
}

let apiKeys: Map<string, ApiKey> = new Map();

/**
 * Загружает API ключи из JSON файла
 */
export function loadApiKeys(): void {
  const configPath = process.env.API_KEYS_PATH || resolve(process.cwd(), 'config/api-keys.json');
  
  if (!existsSync(configPath)) {
    console.error(`[Auth] API keys file not found: ${configPath}`);
    console.error('[Auth] Create config/api-keys.json from api-keys.example.json');
    return;
  }

  try {
    const content = readFileSync(configPath, 'utf-8');
    const config: ApiKeysConfig = JSON.parse(content);
    
    apiKeys.clear();
    for (const key of config.keys) {
      if (key.enabled) {
        apiKeys.set(key.key, key);
      }
    }
    
    console.error(`[Auth] Loaded ${apiKeys.size} API keys`);
  } catch (error) {
    console.error('[Auth] Failed to load API keys:', error);
  }
}

/**
 * Проверяет API ключ
 */
export function validateApiKey(key: string | undefined): ApiKey | null {
  if (!key) return null;
  
  // Поддержка формата "Bearer sk-xxx" и просто "sk-xxx"
  const cleanKey = key.startsWith('Bearer ') ? key.slice(7) : key;
  
  return apiKeys.get(cleanKey) || null;
}

/**
 * Возвращает количество активных ключей
 */
export function getActiveKeysCount(): number {
  return apiKeys.size;
}
