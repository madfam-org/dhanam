import { DhanamApiError, DhanamAuthError } from './errors';

describe('DhanamApiError', () => {
  it('sets message, status, and body', () => {
    const err = new DhanamApiError('Not found', 404, { detail: 'missing' });
    expect(err.message).toBe('Not found');
    expect(err.status).toBe(404);
    expect(err.body).toEqual({ detail: 'missing' });
    expect(err.name).toBe('DhanamApiError');
  });

  it('extracts code from structured body', () => {
    const err = new DhanamApiError('Bad request', 400, { code: 'INVALID_PLAN' });
    expect(err.code).toBe('INVALID_PLAN');
  });

  it('leaves code undefined when body has no code', () => {
    const err = new DhanamApiError('Server error', 500);
    expect(err.code).toBeUndefined();
  });

  it('is an instance of Error', () => {
    const err = new DhanamApiError('fail', 500);
    expect(err).toBeInstanceOf(Error);
  });
});

describe('DhanamAuthError', () => {
  it('defaults to 401 and auth message', () => {
    const err = new DhanamAuthError();
    expect(err.status).toBe(401);
    expect(err.message).toBe('Authentication failed');
    expect(err.name).toBe('DhanamAuthError');
  });

  it('accepts custom message and body', () => {
    const err = new DhanamAuthError('Token expired', { reason: 'expired' });
    expect(err.message).toBe('Token expired');
    expect(err.body).toEqual({ reason: 'expired' });
  });

  it('is an instance of DhanamApiError', () => {
    const err = new DhanamAuthError();
    expect(err).toBeInstanceOf(DhanamApiError);
  });
});
