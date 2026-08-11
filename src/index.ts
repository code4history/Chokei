import { Converter } from 'piconvert';
import { convert, type ConverterLike } from './convert-adapter';

const legacyConverterFactory = (): ConverterLike => new Converter() as unknown as ConverterLike;

// v2.0.1互換: package root の require/import 時に既存の変換を一度実行する。
void convert({
  inputPath: './ai',
  outputDirectory: './dest',
  mode: 'legacy',
  converterFactory: legacyConverterFactory,
});

export { convert } from './convert-adapter';
export type {
  ConverterFactory,
  ConverterLike,
  ConvertManifest,
  ConvertOptions,
} from './convert-adapter';
