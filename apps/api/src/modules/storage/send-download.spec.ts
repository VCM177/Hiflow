import type { Response } from 'express';
import { PassThrough, Readable } from 'node:stream';
import { sendDownload } from './send-download';

const responseSpy = () => {
  const body = new PassThrough();
  const set = jest.fn();
  const redirect = jest.fn();
  const destroy = jest.spyOn(body, 'destroy');
  const response = Object.assign(body, {
    set,
    redirect,
  }) as unknown as Response;
  return { response, body, set, redirect, destroy };
};

const collect = async (stream: PassThrough): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk as Buffer));
  return Buffer.concat(chunks).toString();
};

describe('sendDownload', () => {
  it('sends the browser to the signed address with a temporary redirect', () => {
    const { response, redirect, set } = responseSpy();

    sendDownload(response, {
      kind: 'redirect',
      url: 'https://files.example/x',
    });

    expect(redirect).toHaveBeenCalledWith(302, 'https://files.example/x');
    expect(set).not.toHaveBeenCalled();
  });

  it('streams the bytes as a private, non-sniffable attachment', async () => {
    const { response, body, set } = responseSpy();

    sendDownload(response, {
      kind: 'stream',
      stream: Readable.from(['hello ', 'cv']),
      contentType: 'application/pdf',
      filename: 'CV-1.pdf',
    });

    expect(set).toHaveBeenCalledWith({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="CV-1.pdf"',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    });
    expect(await collect(body)).toBe('hello cv');
  });

  it('cuts the connection if reading the file fails midway', () => {
    const { response, destroy } = responseSpy();
    const stream = new Readable({ read() {} });

    sendDownload(response, {
      kind: 'stream',
      stream,
      contentType: 'application/pdf',
      filename: 'CV-1.pdf',
    });
    stream.emit('error', new Error('disk read failed'));

    expect(destroy).toHaveBeenCalled();
  });
});
