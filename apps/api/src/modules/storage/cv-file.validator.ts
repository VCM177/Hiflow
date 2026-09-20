import { BadRequestException } from '@nestjs/common';
import { fromBuffer } from 'file-type';
import { extname } from 'node:path';
import { UploadedFileData } from './storage.service';

export const CV_MAX_BYTES = 5 * 1024 * 1024;

// The declared extension and mimetype come from the client and prove nothing.
// The file's own bytes must say the same thing: file-type reads the leading
// bytes (and, for Office files, the names inside the zip) and reports what the
// file really is. Legacy `.doc` is refused outright.
const DETECTED_TYPE_BY_EXTENSION: Readonly<Record<string, string>> = {
  '.pdf': 'pdf',
  '.docx': 'docx',
};

/** Returns the normalised extension when the file is an acceptable CV. */
export async function assertValidCv(file: UploadedFileData): Promise<string> {
  const ext = extname(file.originalname).toLowerCase();
  const expectedType = DETECTED_TYPE_BY_EXTENSION[ext];

  if (!expectedType) {
    throw new BadRequestException(
      'Chỉ chấp nhận tệp CV định dạng PDF hoặc DOCX',
    );
  }

  if (file.buffer.length === 0) {
    throw new BadRequestException('Tệp CV rỗng');
  }

  if (file.buffer.length > CV_MAX_BYTES) {
    throw new BadRequestException('Tệp CV không được vượt quá 5MB');
  }

  const detected = await fromBuffer(file.buffer);

  if (detected?.ext !== expectedType) {
    throw new BadRequestException('Nội dung tệp không khớp với định dạng CV');
  }

  return ext;
}
