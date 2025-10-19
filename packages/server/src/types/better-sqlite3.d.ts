declare module 'better-sqlite3' {
  type BindParameters = Record<string, unknown> | unknown[];

  interface RunResult {
    changes: number;
    lastInsertRowid: number;
  }

  interface Statement<Bind extends BindParameters = BindParameters, Result = unknown> {
    run(bind?: Bind): RunResult;
    get(bind?: Bind): Result | undefined;
    all(bind?: Bind): Result[];
  }

  interface Transaction<Args extends unknown[], ReturnType> {
    (...args: Args): ReturnType;
  }

  interface DatabaseOptions {
    readonly?: boolean;
    fileMustExist?: boolean;
    timeout?: number;
    verbose?: (message: string) => void;
  }

  class Database {
    constructor(filename: string, options?: DatabaseOptions);
    prepare<Bind extends BindParameters = BindParameters, Result = unknown>(
      source: string,
    ): Statement<Bind, Result>;
    transaction<Args extends unknown[], ReturnType>(
      fn: (...args: Args) => ReturnType,
    ): Transaction<Args, ReturnType>;
    exec(source: string): this;
    pragma(source: string): unknown;
    close(): void;
  }

  export = Database;
}
