import { assertValidCv } from './cv-file.validator';

// file-type 16 can loop forever on a malformed ASF header (GHSA-5v7r-6r5c-r473).
// A real run would hang the test process, so file-type is replaced with a spy
// and the test proves it is never reached by a file that lacks a PDF or zip start.
const fromBuffer = jest.fn();
jest.mock('file-type', () => ({
  fromBuffer: (buffer: Buffer): unknown => fromBuffer(buffer),
}));

const ASF_GUID = [
  0x30, 0x26, 0xb2, 0x75, 0x8e, 0x66, 0xcf, 0x11, 0xa6, 0xd9, 0x00, 0xaa, 0x00,
  0x62, 0xce, 0x6c,
];
const asfFile = (name: string) => {
  const buffer = Buffer.from([...ASF_GUID, ...new Array<number>(64).fill(0)]);
  return {
    originalname: name,
    mimetype: 'video/x-ms-asf',
    size: buffer.length,
    buffer,
  };
};

describe('assertValidCv keeps file-type away from formats it should never parse', () => {
  beforeEach(() => fromBuffer.mockReset());

  it.each(['cv.pdf', 'cv.docx'])(
    'refuses an ASF container named %s without ever handing it to file-type',
    async (name) => {
      await expect(assertValidCv(asfFile(name))).rejects.toThrow(
        'không khớp với định dạng',
      );
      expect(fromBuffer).not.toHaveBeenCalled();
    },
  );

  it('does hand a file that starts like a PDF to file-type', async () => {
    fromBuffer.mockResolvedValue({ ext: 'pdf', mime: 'application/pdf' });
    const buffer = Buffer.from('%PDF-1.4 body');

    await expect(
      assertValidCv({
        originalname: 'cv.pdf',
        mimetype: 'application/pdf',
        size: buffer.length,
        buffer,
      }),
    ).resolves.toBe('.pdf');
    expect(fromBuffer).toHaveBeenCalledTimes(1);
  });
});
