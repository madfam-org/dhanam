import { parseKarafielCfdiUuid } from '../utils/karafiel-webhook-response';

describe('parseKarafielCfdiUuid', () => {
  it('extracts cfdi_uuid from top-level response', () => {
    expect(
      parseKarafielCfdiUuid(JSON.stringify({ cfdi_uuid: '11111111-2222-3333-4444-555555555555' }))
    ).toBe('11111111-2222-3333-4444-555555555555');
  });

  it('extracts nested cfdiUuid', () => {
    expect(
      parseKarafielCfdiUuid(
        JSON.stringify({ data: { cfdiUuid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' } })
      )
    ).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
  });

  it('returns null for invalid JSON', () => {
    expect(parseKarafielCfdiUuid('not-json')).toBeNull();
  });
});
