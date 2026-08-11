import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  convert,
  convertCli,
  type ConverterLike,
  type ConvertOptions,
  ConversionError,
} from './convert-adapter';

const thisDirectory = dirname(fileURLToPath(import.meta.url));
const fixtureDirectory = resolve(thisDirectory, '../tests/fixtures');
const temporaryDirectories: string[] = [];

const createTemporaryOutputDirectory = async (): Promise<string> => {
  const directory = await mkdtemp(join(tmpdir(), 'chokei-m1-t2-'));
  temporaryDirectories.push(directory);
  return directory;
};

const createConverter = (run: ConverterLike['run']): ConverterLike => {
  const converter: ConverterLike = {
    import: vi.fn(() => converter),
    export: vi.fn(() => converter),
    run,
  };
  return converter;
};

const fixtureOptions = (outputDirectory: string): ConvertOptions => ({
  inputPath: join(fixtureDirectory, 'valid.svg'),
  configPath: join(fixtureDirectory, 'convert_config.js'),
  outputDirectory,
});

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
  vi.restoreAllMocks();
});

describe('convert adapter', () => {
  it('valid fixtureを実コードで変換し、manifest契約を返す', async () => {
    const outputDirectory = await createTemporaryOutputDirectory();
    const converter = createConverter(async (_inputPath, destination) => {
      await writeFile(join(destination, 'converted.svg'), '<svg />');
    });

    const manifest = await convert({
      ...fixtureOptions(outputDirectory),
      converterFactory: () => converter,
    });

    const expectedManifest = JSON.parse(
      await readFile(join(fixtureDirectory, 'expected-manifest.json'), 'utf8'),
    );
    expect(manifest).toEqual(expectedManifest);
    expect(converter.import).toHaveBeenCalledWith('ai');
    expect(converter.export).toHaveBeenCalledWith('svg');
  });

  it('invalid SVGと設定ファイルは終了コード2になる', async () => {
    const outputDirectory = await createTemporaryOutputDirectory();
    const invalidSvgOptions = {
      ...fixtureOptions(outputDirectory),
      inputPath: join(fixtureDirectory, 'invalid.svg'),
      converterFactory: () => createConverter(vi.fn()),
    };
    const invalidConfigOptions = {
      ...fixtureOptions(outputDirectory),
      configPath: join(fixtureDirectory, 'invalid-config.js'),
      converterFactory: () => createConverter(vi.fn()),
    };

    expect(await convertCli(invalidSvgOptions)).toBe(2);
    expect(await convertCli(invalidConfigOptions)).toBe(2);
  });

  it('piconvert変換失敗は終了コード3になり、ConversionErrorを保持する', async () => {
    const outputDirectory = await createTemporaryOutputDirectory();
    const conversionFailure = new Error('stub conversion failure');
    const options = {
      ...fixtureOptions(outputDirectory),
      converterFactory: () => createConverter(vi.fn().mockRejectedValue(conversionFailure)),
    };

    await expect(convert(options)).rejects.toBeInstanceOf(ConversionError);
    await expect(convertCli(options)).resolves.toBe(3);
  });

  it('公開入口のmain/exportsと生成物の対応を固定する', async () => {
    const packageJson = JSON.parse(await readFile(resolve(thisDirectory, '../package.json'), 'utf8')) as {
      main: string;
      types: string;
      exports: Record<string, Record<string, string> | string>;
      scripts: Record<string, string>;
    };

    expect(packageJson.main).toBe('index.js');
    expect(packageJson.types).toBe('./dist/index.d.ts');
    expect(packageJson.exports).toEqual({
      '.': {
        types: './dist/index.d.ts',
        import: './dist/index.mjs',
        require: './index.js',
      },
      './convert': {
        types: './dist/convert.d.ts',
        import: './dist/convert.mjs',
        require: './dist/convert.cjs',
      },
      './package.json': './package.json',
    });
    expect(packageJson.scripts.inkscape).toBe('piconvert install');

    await expect(readFile(resolve(thisDirectory, '../index.js'), 'utf8')).resolves.toBe(
      'module.exports = require("./dist/index.cjs");\n',
    );
    await expect(readFile(resolve(thisDirectory, '../dist/index.cjs'), 'utf8')).resolves.toBeDefined();
    await expect(readFile(resolve(thisDirectory, '../dist/index.mjs'), 'utf8')).resolves.toBeDefined();
    await expect(readFile(resolve(thisDirectory, '../dist/index.d.ts'), 'utf8')).resolves.toBeDefined();
    await expect(readFile(resolve(thisDirectory, '../dist/convert.cjs'), 'utf8')).resolves.toBeDefined();
    await expect(readFile(resolve(thisDirectory, '../dist/convert.mjs'), 'utf8')).resolves.toBeDefined();
    await expect(readFile(resolve(thisDirectory, '../dist/convert.d.ts'), 'utf8')).resolves.toBeDefined();
  });

  it('legacy entryはrequire時の既存副作用を一度だけ実行する', async () => {
    const run = vi.fn();
    vi.doMock('piconvert', () => ({
      Converter: class {
        import() {
          return this;
        }

        export() {
          return this;
        }

        run(...args: [string, string]) {
          return run(...args);
        }
      },
    }));

    vi.resetModules();
    await import('./index');

    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith('./ai', './dest');
  });
});
