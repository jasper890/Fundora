import "server-only";
import postgres from "postgres";

declare global {
  // eslint-disable-next-line no-var
  var __proofpaySql: ReturnType<typeof postgres> | undefined;
}

function createSql() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not configured");
  }
  return postgres(url, {
    prepare: false,
    max: 10,
  });
}

export function sql() {
  if (!globalThis.__proofpaySql) {
    globalThis.__proofpaySql = createSql();
  }
  return globalThis.__proofpaySql;
}

export async function withTransaction<T>(
  fn: (tx: ReturnType<typeof postgres>) => Promise<T>,
): Promise<T> {
  const client = sql();
  return client.begin(async (tx) => fn(tx as unknown as ReturnType<typeof postgres>)) as Promise<T>;
}
