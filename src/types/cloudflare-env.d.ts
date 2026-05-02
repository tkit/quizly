declare global {
  interface D1Result<T = unknown> {
    results?: T[];
    success: boolean;
    meta: unknown;
    error?: string;
  }

  interface D1PreparedStatement {
    bind(...values: unknown[]): D1PreparedStatement;
    first<T = unknown>(column?: string): Promise<T | null>;
    all<T = unknown>(): Promise<D1Result<T>>;
    run<T = unknown>(): Promise<D1Result<T>>;
  }

  interface D1Database {
    prepare(query: string): D1PreparedStatement;
    batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  }

  interface R2Object {
    httpEtag: string;
    writeHttpMetadata(headers: Headers): void;
  }

  interface R2ObjectBody extends R2Object {
    body: ReadableStream;
  }

  interface R2Bucket {
    get(key: string): Promise<R2ObjectBody | null>;
  }

  interface CloudflareEnv {
    DB?: D1Database;
    QUESTION_IMAGES?: R2Bucket;
    GOOGLE_OAUTH_CLIENT_ID?: string;
    GOOGLE_OAUTH_CLIENT_SECRET?: string;
    AUTH_SECRET?: string;
  }
}

export {};
