import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

jest.mock(
  '@dhanam/ui',
  () =>
    new Proxy(
      {},
      {
        get: (_, prop) => {
          if (prop === '__esModule') return true;
          if (prop === 'Input') {
            return ({ id, value, onChange, ...props }: any) => (
              <input id={id} value={value} onChange={onChange} {...props} />
            );
          }
          if (prop === 'Label') {
            return ({ htmlFor, children }: any) => <label htmlFor={htmlFor}>{children}</label>;
          }
          if (prop === 'Button') {
            return ({ children, onClick, disabled, ...props }: any) => (
              <button type="button" onClick={onClick} disabled={disabled} {...props}>
                {children}
              </button>
            );
          }
          return ({ children, ...props }: any) => (
            <div data-testid={String(prop).toLowerCase()} {...props}>
              {children}
            </div>
          );
        },
      }
    )
);

jest.mock(
  'lucide-react',
  () =>
    new Proxy(
      {},
      {
        get: (_, prop) => {
          if (prop === '__esModule') return true;
          return (props: any) => <span data-testid={`icon-${String(prop)}`} {...props} />;
        },
      }
    )
);

jest.mock('@/lib/api/admin', () => ({
  adminApi: {
    getMadfamImportPlatformConfig: jest.fn(),
    updateMadfamImportPlatformConfig: jest.fn(),
  },
}));

import { adminApi } from '@/lib/api/admin';

import MadfamImportSettingsPage from '../(dashboard)/madfam-import/page';

const mockGet = adminApi.getMadfamImportPlatformConfig as jest.Mock;
const mockUpdate = adminApi.updateMadfamImportPlatformConfig as jest.Mock;

describe('MadfamImportSettingsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockResolvedValue({
      businessRfc: 'XAXX010101000',
      spaceNameBusiness: 'Innovaciones MADFAM',
      spaceNamePartner: 'MADFAM Socio AFAC',
      spaceNamePersonal: 'Aldo Personal',
      accountSuffixPartner: '-afac',
      accountSuffixPersonal: '-personal',
    });
    mockUpdate.mockResolvedValue({
      businessRfc: 'XAXX010101000',
      spaceNameBusiness: 'Innovaciones MADFAM',
      spaceNamePartner: 'MADFAM Socio AFAC',
      spaceNamePersonal: 'Aldo Personal',
      accountSuffixPartner: '-afac',
      accountSuffixPersonal: '-personal',
    });
  });

  it('loads and displays MADFAM import settings', async () => {
    render(<MadfamImportSettingsPage />);

    expect(await screen.findByLabelText('Business RFC')).toHaveValue('XAXX010101000');
    expect(screen.getByLabelText('Partner space name')).toHaveValue('MADFAM Socio AFAC');
    expect(mockGet).toHaveBeenCalled();
  });

  it('saves settings via admin API', async () => {
    const user = userEvent.setup();
    render(<MadfamImportSettingsPage />);

    await screen.findByLabelText('Business RFC');
    await user.click(screen.getByRole('button', { name: /save settings/i }));

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          businessRfc: 'XAXX010101000',
          spaceNamePartner: 'MADFAM Socio AFAC',
        })
      );
    });
    expect(await screen.findByRole('status')).toHaveTextContent(/settings saved/i);
  });
});
