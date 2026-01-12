import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/recall_mcp';

let isConnected = false;

/**
 * Подключение к MongoDB с retry логикой
 */
export async function connectDatabase(): Promise<void> {
  if (isConnected) {
    return;
  }

  try {
    mongoose.set('strictQuery', true);
    
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    isConnected = true;
    console.error('[DB] Connected to MongoDB'); // stderr для логов MCP
  } catch (error) {
    console.error('[DB] Connection failed:', error);
    throw new Error(`Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Проверка состояния подключения
 */
export function isDatabaseConnected(): boolean {
  return isConnected && mongoose.connection.readyState === 1;
}

/**
 * Graceful shutdown
 */
export async function disconnectDatabase(): Promise<void> {
  if (!isConnected) {
    return;
  }

  await mongoose.disconnect();
  isConnected = false;
  console.error('[DB] Disconnected from MongoDB');
}

/**
 * Обработчики событий mongoose
 */
mongoose.connection.on('error', (err) => {
  console.error('[DB] Connection error:', err);
  isConnected = false;
});

mongoose.connection.on('disconnected', () => {
  console.error('[DB] Disconnected');
  isConnected = false;
});
