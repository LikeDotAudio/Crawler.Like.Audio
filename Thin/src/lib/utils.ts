import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function prettyPrintJson(data: any): string {
  try {
    const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
    return JSON.stringify(parsedData, null, 2);
  } catch (error) {
    console.error("Failed to parse JSON for pretty printing", error);
    return typeof data === 'string' ? data : JSON.stringify(data);
  }
}
