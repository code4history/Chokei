import { mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, resolve } from 'node:path';

export type ConverterLike = {
  import(format: 'ai'): ConverterLike;
  export(format: 'svg'): ConverterLike;
  run(inputPath: string, outputDirectory: string): Promise<void> | void;
};

export type ConverterFactory = () => ConverterLike | Promise<ConverterLike>;

export type ConvertOptions = {
  inputPath: string;
  outputDirectory: string;
  configPath?: string;
  mode?: 'legacy' | 'fixture';
  converterFactory?: ConverterFactory;
};

export type ConvertManifest = {
  input: {
    path: string;
    config: string | null;
  };
  outputs: string[];
  success: true;
  diagnostics: [];
};

export class ConversionError extends Error {
  public constructor(
    message: string,
    public readonly exitCode: 2 | 3,
  ) {
    super(message);
    this.name = 'ConversionError';
  }
}

const validateInput = (inputPath: string): void => {
  let inputStat;
  try {
    inputStat = statSync(inputPath);
  } catch {
    throw new ConversionError(`入力が存在しません: ${inputPath}`, 2);
  }

  if (inputStat.isFile()) {
    const source = readFileSync(inputPath, 'utf8');
    if (!/^\s*(?:<\?xml[^>]*>\s*)?<svg\b/i.test(source)) {
      throw new ConversionError(`SVG入力が不正です: ${inputPath}`, 2);
    }
  }
};

const validateConfig = (configPath: string | undefined): void => {
  if (!configPath) return;

  let source: string;
  try {
    source = readFileSync(configPath, 'utf8');
  } catch {
    throw new ConversionError(`設定が存在しません: ${configPath}`, 2);
  }

  try {
    // 設定を実行せず、構文だけを確認する。既存の generator の副作用を発生させない。
    new Function('require', 'module', 'exports', source); // eslint-disable-line no-new-func
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ConversionError(`設定が不正です: ${message}`, 2);
  }
};

const listOutputs = (outputDirectory: string): string[] =>
  readdirSync(outputDirectory)
    .filter((entry) => statSync(resolve(outputDirectory, entry)).isFile())
    .sort();

const defaultConverterFactory: ConverterFactory = async () => {
  const { Converter } = await import('piconvert');
  return new Converter() as unknown as ConverterLike;
};

export const convert = async (options: ConvertOptions): Promise<ConvertManifest> => {
  if (options.mode !== 'legacy') validateInput(options.inputPath);
  validateConfig(options.configPath);
  mkdirSync(options.outputDirectory, { recursive: true });

  const converterFactoryResult = (options.converterFactory ?? defaultConverterFactory)();
  const converter =
    converterFactoryResult instanceof Promise ? await converterFactoryResult : converterFactoryResult;
  try {
    converter.import('ai').export('svg');
    await converter.run(options.inputPath, options.outputDirectory);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ConversionError(`変換に失敗しました: ${message}`, 3);
  }

  return {
    input: {
      path: basename(options.inputPath),
      config: options.configPath ? basename(options.configPath) : null,
    },
    outputs: listOutputs(options.outputDirectory),
    success: true,
    diagnostics: [],
  };
};

export const convertCli = async (options: ConvertOptions): Promise<0 | 2 | 3> => {
  try {
    await convert(options);
    return 0;
  } catch (error) {
    if (error instanceof ConversionError) return error.exitCode;
    return 3;
  }
};
