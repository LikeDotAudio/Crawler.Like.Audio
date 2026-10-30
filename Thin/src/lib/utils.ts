import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function prettyPrintJson(data: unknown): string {
  try {
    const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
    return JSON.stringify(parsedData, null, 2);
  } catch (error) {
    console.error("Failed to parse JSON for pretty printing", error);
    return typeof data === 'string' ? data : JSON.stringify(data);
  }
}

/** The message of anything thrown: Error.message, or the thrown value as text. */
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
