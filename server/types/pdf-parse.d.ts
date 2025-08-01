declare module 'pdf-parse' {
  interface PDFParseOptions {
    max?: number;
    version?: string;
    normalizeWhitespace?: boolean;
    disableCombineTextItems?: boolean;
  }

  interface PDFParseResult {
    text: string;
    numpages: number;
    info: any;
    metadata: any;
    version: string;
  }

  function pdfParse(dataBuffer: Buffer, options?: PDFParseOptions): Promise<PDFParseResult>;
  
  export = pdfParse;
} 