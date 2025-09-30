import type { Db } from 'mongodb';
import { MongoClient, ObjectId } from 'mongodb';

const DEFAULT_URI =
  process.env.MONGO_URI ||
  'mongodb://myusername:mypassword@171.43.138.237:27017/fastgpt?authSource=admin&directConnection=true';

const DEFAULT_DB_NAME = (() => {
  if (process.env.MONGO_DB_NAME) {
    return process.env.MONGO_DB_NAME;
  }
  try {
    const parsedUrl = new URL(DEFAULT_URI);
    const pathname = parsedUrl.pathname?.replace(/^\//, '');
    return pathname || 'fastgpt';
  } catch {
    return 'fastgpt';
  }
})();

let client: MongoClient | null = null;
let connecting: Promise<MongoClient> | null = null;

async function getClient(): Promise<MongoClient> {
  if (client) {
    return client;
  }
  if (connecting) {
    return connecting;
  }

  connecting = (async () => {
    const mongoClient = new MongoClient(DEFAULT_URI);
    await mongoClient.connect();
    client = mongoClient;
    connecting = null;
    return mongoClient;
  })();

  return connecting;
}

export async function withMongo<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  const mongoClient = await getClient();
  const dbName = DEFAULT_DB_NAME;
  const db = mongoClient.db(dbName);
  return fn(db);
}

export function resetMongoClient() {
  if (client) {
    void client.close();
  }
  client = null;
  connecting = null;
}

export { ObjectId };
