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
export declare class ConversionError extends Error {
    readonly exitCode: 2 | 3;
    constructor(message: string, exitCode: 2 | 3);
}
export declare const convert: (options: ConvertOptions) => Promise<ConvertManifest>;
export declare const convertCli: (options: ConvertOptions) => Promise<0 | 2 | 3>;
