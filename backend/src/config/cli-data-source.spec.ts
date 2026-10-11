/** Loads the module fresh with the given DATABASE_URL (the CLI loads it once per run). */
function load(url: string | undefined): { mod: unknown; typeorm: typeof import('typeorm') } {
  const saved = process.env.DATABASE_URL;
  if (url === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = url;
  try {
    let mod: unknown;
    let typeorm!: typeof import('typeorm');
    jest.isolateModules(() => {
      // Same isolated registry, so `instanceof` compares against the same class.
      typeorm = jest.requireActual('typeorm');
      mod = jest.requireActual('./cli-data-source');
    });
    return { mod, typeorm };
  } finally {
    if (saved === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = saved;
  }
}

const MESSAGE = 'DATABASE_URL is missing. Set it in backend/.env (copy backend/.env.example).';

describe('cli-data-source (TypeORM CLI entry)', () => {
  it('refuses to load without DATABASE_URL, with a message saying what to do', () => {
    expect(() => load(undefined)).toThrow(MESSAGE);
    expect(() => load('')).toThrow(MESSAGE);
  });

  it('exports a DataSource for the given URL', () => {
    const { mod, typeorm } = load('postgres://u:p@localhost:5433/db');
    const { default: dataSource } = mod as { default: InstanceType<typeof typeorm.DataSource> };
    expect(dataSource).toBeInstanceOf(typeorm.DataSource);
    expect(dataSource.options).toMatchObject({ url: 'postgres://u:p@localhost:5433/db', installExtensions: false });
  });
});
