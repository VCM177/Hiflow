import { BadRequestException } from '@nestjs/common';
import { assertValidCv, CV_MAX_BYTES } from './cv-file.validator';
import { UploadedFileData } from './storage.service';

const PDF = Buffer.from('%PDF-1.4\n% a fake but well-formed header\n');
const OLE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0]);
// A Windows executable starts with "MZ".
const EXE = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(200, 0x90)]);

/** A zip of stored (uncompressed) entries: enough for the type sniffer to read their names. */
const zipOf = (...names: string[]): Buffer =>
  Buffer.concat(
    names.map((name) => {
      const body = Buffer.from('hi');
      const header = Buffer.alloc(30);
      header.writeUInt32LE(0x04034b50, 0);
      header.writeUInt16LE(20, 4);
      header.writeUInt32LE(body.length, 18);
      header.writeUInt32LE(body.length, 22);
      header.writeUInt16LE(Buffer.byteLength(name), 26);
      return Buffer.concat([header, Buffer.from(name), body]);
    }),
  );

const DOCX = zipOf('[Content_Types].xml', '_rels/.rels', 'word/document.xml');
const XLSX = zipOf('[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml');
const PLAIN_ZIP = zipOf('notes.txt', 'readme.md');

const fileOf = (name: string, buffer: Buffer): UploadedFileData => ({
  originalname: name,
  mimetype: 'application/octet-stream',
  size: buffer.length,
  buffer,
});

describe('assertValidCv', () => {
  it.each([
    ['cv.pdf', PDF, '.pdf'],
    ['cv.docx', DOCX, '.docx'],
    ['CV-Upper.PDF', PDF, '.pdf'],
    ['CV-Upper.DOCX', DOCX, '.docx'],
  ])('accepts %s and returns its extension', async (name, buffer, ext) => {
    await expect(assertValidCv(fileOf(name, buffer))).resolves.toBe(ext);
  });

  describe('refuses a file whose name and content disagree', () => {
    it.each([
      ['a Windows executable renamed to .pdf', 'cv.pdf', EXE],
      ['a Windows executable renamed to .docx', 'cv.docx', EXE],
      [
        'a shell script renamed to .pdf',
        'cv.pdf',
        Buffer.from('#!/bin/sh\nrm -rf /'),
      ],
      [
        'an HTML page renamed to .pdf',
        'cv.pdf',
        Buffer.from('<html><script>alert(1)</script>'),
      ],
      ['a PDF renamed to .docx', 'cv.docx', PDF],
      ['a Word document renamed to .pdf', 'cv.pdf', DOCX],
      ['a spreadsheet renamed to .docx', 'cv.docx', XLSX],
      ['a plain zip renamed to .docx', 'cv.docx', PLAIN_ZIP],
      ['a legacy Word file renamed to .pdf', 'cv.pdf', OLE],
    ])('%s', async (_label, name, buffer) => {
      await expect(assertValidCv(fileOf(name, buffer))).rejects.toThrow(
        'không khớp với định dạng',
      );
    });
  });

  describe('refuses by extension before looking at the content', () => {
    it.each([
      ['a legacy .doc, even with genuine content', 'cv.doc', OLE],
      ['an executable', 'run.exe', EXE],
      ['a script', 'run.sh', Buffer.from('#!/bin/sh')],
      ['a file with no extension', 'cv', PDF],
      ['a double extension that ends in .exe', 'cv.pdf.exe', PDF],
    ])('%s', async (_label, name, buffer) => {
      await expect(assertValidCv(fileOf(name, buffer))).rejects.toThrow(
        'PDF hoặc DOCX',
      );
    });
  });

  it('answers with a 400, not a 500, for every refusal', async () => {
    await expect(assertValidCv(fileOf('cv.pdf', EXE))).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(assertValidCv(fileOf('cv.doc', OLE))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('refuses an empty file', async () => {
    await expect(
      assertValidCv(fileOf('cv.pdf', Buffer.alloc(0))),
    ).rejects.toThrow('rỗng');
  });

  it('refuses a file over the size limit', async () => {
    const oversized = Buffer.concat([PDF, Buffer.alloc(CV_MAX_BYTES + 1)]);

    await expect(assertValidCv(fileOf('cv.pdf', oversized))).rejects.toThrow(
      '5MB',
    );
  });
});
