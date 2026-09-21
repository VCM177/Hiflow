import {
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageClient } from '@supabase/storage-js';
import { randomUUID } from 'node:crypto';
import { assertValidCv } from './cv-file.validator';
import { contentTypeOfKey, CV_SUBDIR, isCvKey } from './storage.constants';
import {
  FileDownload,
  StorageService,
  StoredFile,
  UploadedFileData,
} from './storage.service';

/** How long a signed download address works: long enough to start the download. */
export const SIGNED_URL_SECONDS = 60;
const DEFAULT_BUCKET = 'hiflow-cvs';

interface StorageFailure {
  message: string;
  status?: number;
}

/** The slice of a Supabase bucket this adapter uses, so a test can stand in for it. */
export interface SupabaseBucket {
  upload(
    path: string,
    body: Buffer,
    options: { contentType: string; upsert: boolean },
  ): Promise<{ error: StorageFailure | null }>;
  remove(paths: string[]): Promise<{ error: StorageFailure | null }>;
  createSignedUrl(
    path: string,
    expiresIn: number,
    options: { download: string },
  ): Promise<{
    data: { signedUrl: string } | null;
    error: StorageFailure | null;
  }>;
}

const isNotFound = (error: StorageFailure): boolean =>
  error.status === 404 || /not found/i.test(error.message);

/**
 * CVs live in a private Supabase bucket. Nothing is ever public: a file is only
 * reachable through a signed address that expires after a minute, handed out by
 * an endpoint that has already checked who is asking.
 */
export class SupabaseStorage extends StorageService {
  private readonly logger = new Logger(SupabaseStorage.name);

  constructor(private readonly bucket: SupabaseBucket) {
    super();
  }

  /**
   * Uses the storage client on its own rather than the full supabase-js one:
   * `createClient` also builds a realtime client, which needs a native
   * WebSocket and throws at boot on Node 20.
   */
  static fromConfig(config: ConfigService): SupabaseStorage {
    const baseUrl = config
      .getOrThrow<string>('SUPABASE_URL')
      .replace(/\/+$/, '');
    const serviceKey = config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY');
    const client = new StorageClient(`${baseUrl}/storage/v1`, {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    });

    return new SupabaseStorage(
      client.from(config.get<string>('SUPABASE_BUCKET') ?? DEFAULT_BUCKET),
    );
  }

  async upload(file: UploadedFileData): Promise<StoredFile> {
    const ext = await assertValidCv(file);
    // Server-generated name: the client's filename is never used as a key.
    const key = `${CV_SUBDIR}/${randomUUID()}${ext}`;

    const { error } = await this.bucket.upload(key, file.buffer, {
      contentType: contentTypeOfKey(key),
      upsert: false,
    });

    if (error) {
      this.logger.error(`Upload of ${key} failed: ${error.message}`);
      throw new ServiceUnavailableException(
        'Không lưu được tệp CV, vui lòng thử lại',
      );
    }

    return { key };
  }

  async remove(key: string): Promise<void> {
    if (!isCvKey(key)) return;

    const { error } = await this.bucket.remove([key]);
    // The caller treats a failed cleanup as a warning, never as a failed request.
    if (error) throw new Error(error.message);
  }

  async download(key: string, filename: string): Promise<FileDownload> {
    if (!isCvKey(key)) {
      throw new NotFoundException('Không tìm thấy tệp CV');
    }

    const { data, error } = await this.bucket.createSignedUrl(
      key,
      SIGNED_URL_SECONDS,
      { download: filename },
    );

    if (error || !data) {
      if (error && isNotFound(error)) {
        throw new NotFoundException('Không tìm thấy tệp CV');
      }

      this.logger.error(
        `Signing ${key} failed: ${error?.message ?? 'no address returned'}`,
      );
      throw new ServiceUnavailableException(
        'Không tải được tệp CV, vui lòng thử lại',
      );
    }

    return { kind: 'redirect', url: data.signedUrl };
  }
}
