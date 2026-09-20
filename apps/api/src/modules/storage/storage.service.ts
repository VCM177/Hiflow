import type { Readable } from 'node:stream';

export interface UploadedFileData {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/** Where a file lives, whatever the backend: never a public URL. */
export interface StoredFile {
  key: string;
}

/**
 * How a stored file reaches the caller: a short-lived signed address to send
 * the browser to, or the bytes themselves when the backend cannot sign.
 */
export type FileDownload =
  | { kind: 'redirect'; url: string }
  | {
      kind: 'stream';
      stream: Readable;
      contentType: string;
      filename: string;
    };

/**
 * Storage port. Callers depend on this abstraction, so swapping local disk for
 * Supabase only means providing a different implementation. Files are private:
 * they are only ever reachable through `download`, behind the caller's own
 * authorisation check.
 */
export abstract class StorageService {
  abstract upload(file: UploadedFileData): Promise<StoredFile>;
  abstract remove(key: string): Promise<void>;
  /** Throws NotFoundException when the file is gone. `filename` is what the browser saves it as. */
  abstract download(key: string, filename: string): Promise<FileDownload>;
}
