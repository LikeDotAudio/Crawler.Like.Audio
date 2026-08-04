import * as XLSX from "xlsx";

export type SupportedFormat = "xlsx" | "xls" | "csv" | "ods";

export interface ParseResult {
  workbook: XLSX.WorkBook;
  suggestedFormat: SupportedFormat;
}

export interface ConvertOptions {
  workbook: XLSX.WorkBook;
  targetFormat: SupportedFormat;
  originalFileName: string;
}

export interface ConvertResult {
  blob: Blob;
  fileName: string;
}

export async function parseSpreadsheet(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        
        const ext = file.name.split('.').pop()?.toLowerCase();
        let suggestedFormat: SupportedFormat = 'xlsx';
        if (ext === 'csv') suggestedFormat = 'xlsx';
        else if (ext === 'xlsx' || ext === 'xls') suggestedFormat = 'csv';
        
        resolve({ workbook: wb, suggestedFormat });
      } catch (err: any) {
        reject(new Error("Error parsing spreadsheet: " + err.message));
      }
    };
    reader.onerror = () => {
      reject(new Error("Failed to read file."));
    };
    reader.readAsArrayBuffer(file);
  });
}

export async function convertSpreadsheet(options: ConvertOptions): Promise<ConvertResult> {
  return new Promise((resolve, reject) => {
    try {
      const { workbook, targetFormat, originalFileName } = options;
      let bookType: XLSX.BookType = "xlsx";
      let mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      
      switch (targetFormat) {
        case "xlsx":
          bookType = "xlsx";
          mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
          break;
        case "xls":
          bookType = "biff8";
          mimeType = "application/vnd.ms-excel";
          break;
        case "csv":
          bookType = "csv";
          mimeType = "text/csv";
          break;
        case "ods":
          bookType = "ods";
          mimeType = "application/vnd.oasis.opendocument.spreadsheet";
          break;
      }

      const buffer = XLSX.write(workbook, { bookType, type: "array" });
      const blob = new Blob([buffer], { type: mimeType });
      
      const baseName = originalFileName.substring(0, originalFileName.lastIndexOf('.')) || originalFileName;
      const fileName = `${baseName}.${targetFormat}`;
      
      resolve({ blob, fileName });
    } catch (err: any) {
      reject(new Error("Failed to convert file: " + err.message));
    }
  });
}
