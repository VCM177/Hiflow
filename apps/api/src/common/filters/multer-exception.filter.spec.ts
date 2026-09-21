import { MulterError } from 'multer';
import { MulterExceptionFilter } from './multer-exception.filter';

const run = (error: MulterError) => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = { switchToHttp: () => ({ getResponse: () => ({ status }) }) };
  new MulterExceptionFilter().catch(error, host as never);
  return { status, json };
};

describe('MulterExceptionFilter', () => {
  it.each([
    'LIMIT_UNEXPECTED_FILE',
    'LIMIT_FILE_COUNT',
    'LIMIT_PART_COUNT',
    'LIMIT_FIELD_COUNT',
    'LIMIT_FIELD_VALUE',
    'MISSING_FIELD_NAME',
  ] as const)('answers 400, not 500, for %s', (code) => {
    const { status, json } = run(new MulterError(code, 'resume'));

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400, error: 'Bad Request' }),
    );
  });

  it('answers 413 for a file that is too large', () => {
    const { status } = run(new MulterError('LIMIT_FILE_SIZE', 'cv'));

    expect(status).toHaveBeenCalledWith(413);
  });

  it('does not echo the field name or the multer message back', () => {
    const { json } = run(new MulterError('LIMIT_UNEXPECTED_FILE', '<script>'));

    expect(JSON.stringify(json.mock.calls)).not.toContain('script');
  });
});
