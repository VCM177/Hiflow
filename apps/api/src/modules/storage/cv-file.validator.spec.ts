import { BadRequestException } from '@nestjs/common';
import { assertValidCv, CV_MAX_BYTES } from './cv-file.validator';
import { UploadedFileData } from './storage.service';

const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d];
const ZIP = [0x50, 0x4b, 0x03, 0x04];
const OLE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

const fileOf = (name: string, bytes: number[]): UploadedFileData => ({
  originalname: name,
  mimetype: 'application/octet-stream',
  size: bytes.length,
  buffer: Buffer.from(bytes),
});

describe('assertValidCv', () => {
  it.each([
    ['cv.pdf', PDF, '.pdf'],
    ['cv.docx', ZIP, '.docx'],
    ['cv.doc', OLE, '.doc'],
    ['CV-Upper.PDF', PDF, '.pdf'],
  ])('accepts %s and returns its extension', (name, bytes, ext) => {
    expect(assertValidCv(fileOf(name, bytes))).toBe(ext);
  });

  it('rejects an extension that is not a document', () => {
    expect(() => assertValidCv(fileOf('run.exe', PDF))).toThrow(
      BadRequestException,
    );
  });

  it('rejects a file with no extension', () => {
    expect(() => assertValidCv(fileOf('cv', PDF))).toThrow(BadRequestException);
  });

  it('rejects content that does not match the declared extension', () => {
    // A script renamed to .pdf must not pass on its name alone.
    const script = Array.from(Buffer.from('#!/bin/sh\nrm -rf /'));

    expect(() => assertValidCv(fileOf('cv.pdf', script))).toThrow(
      'không khớp với định dạng',
    );
  });

  it('rejects an empty file', () => {
    expect(() => assertValidCv(fileOf('cv.pdf', []))).toThrow('rỗng');
  });

  it('rejects a file over the size limit', () => {
    const oversized: UploadedFileData = {
      originalname: 'cv.pdf',
      mimetype: 'application/pdf',
      size: CV_MAX_BYTES + 1,
      buffer: Buffer.concat([Buffer.from(PDF), Buffer.alloc(CV_MAX_BYTES + 1)]),
    };

    expect(() => assertValidCv(oversized)).toThrow('5MB');
  });
});
