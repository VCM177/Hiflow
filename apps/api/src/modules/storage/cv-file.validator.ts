import { BadRequestException } from '@nestjs/common';
import { extname } from 'node:path';
import { UploadedFileData } from './storage.service';

export const CV_MAX_BYTES = 5 * 1024 * 1024;

// The declared mimetype comes from the client and cannot be trusted, so the
// file's leading bytes must match its extension.
const CV_SIGNATURES: Record<string, readonly number[]> = {
  '.pdf': [0x25, 0x50, 0x44, 0x46],
  '.docx': [0x50, 0x4b, 0x03, 0x04],
  '.doc': [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1],
};

/** Returns the normalised extension when the file is an acceptable CV. */
export function assertValidCv(file: UploadedFileData): string {
  const ext = extname(file.originalname).toLowerCase();
  const signature = CV_SIGNATURES[ext];

  if (!signature) {
    throw new BadRequestException(
      'Chỉ chấp nhận tệp CV định dạng PDF, DOC hoặc DOCX',
    );
  }

  if (file.buffer.length === 0) {
    throw new BadRequestException('Tệp CV rỗng');
  }

  if (file.buffer.length > CV_MAX_BYTES) {
    throw new BadRequestException('Tệp CV không được vượt quá 5MB');
  }

  const matchesSignature = signature.every(
    (byte, index) => file.buffer[index] === byte,
  );

  if (!matchesSignature) {
    throw new BadRequestException('Nội dung tệp không khớp với định dạng CV');
  }

  return ext;
}
