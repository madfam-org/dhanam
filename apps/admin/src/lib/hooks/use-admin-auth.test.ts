import { hasPlatformAdminAccess } from './use-admin-auth';

function unsignedJwt(payload: Record<string, unknown>): string {
  const encoded = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `header.${encoded}.signature`;
}

describe('hasPlatformAdminAccess', () => {
  it('allows users with the platform admin flag', () => {
    expect(
      hasPlatformAdminAccess(
        {
          id: 'admin-1',
          email: 'admin@example.com',
          name: 'Admin',
          isAdmin: true,
          spaces: [],
        },
        null
      )
    ).toBe(true);
  });

  it('allows Janua tokens with the is_admin claim', () => {
    expect(
      hasPlatformAdminAccess(
        {
          id: 'janua-admin-1',
          email: 'admin@example.com',
          name: 'Admin',
          spaces: [],
        },
        unsignedJwt({ is_admin: true })
      )
    ).toBe(true);
  });

  it('does not allow space owner/admin roles without a platform admin signal', () => {
    expect(
      hasPlatformAdminAccess(
        {
          id: 'space-owner-1',
          email: 'owner@example.com',
          name: 'Space Owner',
          spaces: [{ id: 'space-1', role: 'owner' }],
        },
        unsignedJwt({ is_admin: false })
      )
    ).toBe(false);
  });
});
