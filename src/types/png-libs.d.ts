// Type declarations for PNG chunk libraries

declare module 'png-chunks-extract' {
    interface PngChunk {
        name: string;
        data: Uint8Array;
    }
    function extract(data: Uint8Array): PngChunk[];
    export = extract;
}

declare module 'png-chunk-text' {
    interface TextChunk {
        keyword: string;
        text: string;
    }
    const text: {
        encode(keyword: string, text: string): { name: string; data: Uint8Array };
        decode(data: Uint8Array): TextChunk;
    };
    export = text;
}
