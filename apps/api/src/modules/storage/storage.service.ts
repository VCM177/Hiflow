export interface UploadedFileData {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface StoredFile {
  url: string;
}

/**
 * Storage port. Callers depend on this abstraction so swapping local disk for
 * S3 or Supabase only means providing a different implementation.
 */
export abstract class StorageService {
  abstract upload(file: UploadedFileData): Promise<StoredFile>;
  abstract remove(url: string): Promise<void>;
}
