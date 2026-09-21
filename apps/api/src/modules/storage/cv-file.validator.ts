import { BadRequestException } from '@nestjs/common';
import { fromBuffer } from 'file-type';
import { extname } from 'node:path';
import { UploadedFileData } from './storage.service';

export const CV_MAX_BYTES = 5 * 1024 * 1024;

// The declared extension and mimetype come from the client and prove nothing.
// The file's own bytes must say the same thing. Legacy `.doc` is refused outright.
const ACCEPTED: Readonly<
  Record<string, { detectedAs: string; signature: readonly number[] }>
> = {
  '.pdf': { detectedAs: 'pdf', signature: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  '.docx': { detectedAs: 'docx', signature: [0x50, 0x4b, 0x03, 0x04] }, // PK\3\4
};

/**
 * Returns the normalised extension when the file is an acceptable CV.
 *
 * Two layers: a cheap check of the leading bytes, then file-type, which tells a
 * Word document from any other zip by the entry names inside it. The order
 * matters: file-type 16 (the last release for Node 20) can loop forever on a
 * malformed ASF header (GHSA-5v7r-6r5c-r473). Only files that already start
 * with %PDF or PK ever reach it, so that parser is unreachable from an upload.
 */
export async function assertValidCv(file: UploadedFileData): Promise<string> {
  const ext = extname(file.originalname).toLowerCase();
  const accepted = ACCEPTED[ext];

  if (!accepted) {
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

  const startsWithSignature = accepted.signature.every(
    (byte, index) => file.buffer[index] === byte,
  );

  if (
    !startsWithSignature ||
    (await fromBuffer(file.buffer))?.ext !== accepted.detectedAs
  ) {
    throw new BadRequestException('Nội dung tệp không khớp với định dạng CV');
  }

  return ext;
}
