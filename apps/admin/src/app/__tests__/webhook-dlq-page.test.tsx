import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

jest.mock(
  '@dhanam/ui',
  () =>
    new Proxy(
      {},
      {
        get: (_, prop) => {
          if (prop === '__esModule') return true;
          const name = String(prop);

          if (name === 'Input') {
            return React.forwardRef<HTMLInputElement, any>(
              ({ className: _className, ...props }, ref) => <input ref={ref} {...props} />
            );
          }

          if (name === 'Button') {
            return ({
              children,
              className: _className,
              variant: _variant,
              size: _size,
              ...props
            }: any) => <button {...props}>{children}</button>;
          }

          if (name === 'Label') {
            return ({ children, ...props }: any) => <label {...props}>{children}</label>;
          }

          if (name === 'Badge') {
            return ({ children }: any) => <span>{children}</span>;
          }

          return ({ children, ...props }: any) => (
            <div data-testid={name.toLowerCase()} {...props}>
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
    listWebhookDlqFailures: jest.fn(),
    replayWebhookDlqFailure: jest.fn(),
    resolveWebhookDlqFailure: jest.fn(),
  },
}));

import { adminApi } from '@/lib/api/admin';

import WebhookDlqPage from '../(dashboard)/webhook-dlq/page';

const failure = {
  id: 'dlq-1',
  eventId: 'evt-payment-1',
  consumer: 'karafiel',
  consumerUrl: 'https://api.karafiel.mx/api/v1/webhooks/dhanam',
  eventType: 'payment.succeeded',
  attemptCount: 3,
  lastAttemptAt: '2026-05-21T04:00:00.000Z',
  lastStatusCode: 503,
  lastErrorMessage: 'consumer responded 503',
  nextRetryAt: '2026-05-21T04:08:00.000Z',
  resolvedAt: null,
  createdAt: '2026-05-21T03:55:00.000Z',
  updatedAt: '2026-05-21T04:00:00.000Z',
};

const listMock = adminApi.listWebhookDlqFailures as jest.Mock;
const replayMock = adminApi.replayWebhookDlqFailure as jest.Mock;
const resolveMock = adminApi.resolveWebhookDlqFailure as jest.Mock;

describe('WebhookDlqPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    listMock.mockResolvedValue({ items: [], total: 0, limit: 25, offset: 0 });
    replayMock.mockResolvedValue({
      id: 'dlq-1',
      ok: true,
      statusCode: 200,
      attemptCount: 1,
      nextRetryAt: null,
      resolvedAt: '2026-05-21T04:01:00.000Z',
    });
    resolveMock.mockResolvedValue({
      id: 'dlq-1',
      resolvedAt: '2026-05-21T04:02:00.000Z',
    });
  });

  it('renders the DLQ heading and empty state', async () => {
    render(<WebhookDlqPage />);

    expect(screen.getByText('Webhook DLQ')).toBeInTheDocument();
    expect(screen.getByText('Recovery Controls')).toBeInTheDocument();
    expect(await screen.findByText('No webhook delivery failures found')).toBeInTheDocument();
  });

  it('renders unresolved delivery rows', async () => {
    listMock.mockResolvedValue({ items: [failure], total: 1, limit: 25, offset: 0 });

    render(<WebhookDlqPage />);

    expect(await screen.findByText('karafiel')).toBeInTheDocument();
    expect(screen.getByText('payment.succeeded')).toBeInTheDocument();
    expect(screen.getByText('consumer responded 503')).toBeInTheDocument();
    expect(screen.getByText('Replay')).toBeInTheDocument();
    expect(screen.getByText('Resolve')).toBeInTheDocument();
  });

  it('replays a failed delivery and refreshes the list', async () => {
    listMock
      .mockResolvedValueOnce({ items: [failure], total: 1, limit: 25, offset: 0 })
      .mockResolvedValueOnce({ items: [], total: 0, limit: 25, offset: 0 });

    render(<WebhookDlqPage />);

    fireEvent.click(await screen.findByText('Replay'));

    await waitFor(() => {
      expect(replayMock).toHaveBeenCalledWith('dlq-1');
    });
    expect(await screen.findByText('Replay delivered for karafiel.')).toBeInTheDocument();
  });

  it('marks a delivery resolved with the operator reason', async () => {
    listMock
      .mockResolvedValueOnce({ items: [failure], total: 1, limit: 25, offset: 0 })
      .mockResolvedValueOnce({ items: [], total: 0, limit: 25, offset: 0 });

    render(<WebhookDlqPage />);

    await screen.findByText('karafiel');
    const reasonInput = await screen.findByLabelText('Resolve reason');
    fireEvent.input(reasonInput, {
      target: { value: 'CFDI issued manually' },
    });
    await waitFor(() => {
      expect(reasonInput).toHaveValue('CFDI issued manually');
    });
    fireEvent.click(screen.getByText('Resolve'));

    await waitFor(() => {
      expect(resolveMock).toHaveBeenCalledWith('dlq-1', 'CFDI issued manually');
    });
    expect(await screen.findByText('Marked karafiel delivery resolved.')).toBeInTheDocument();
  });
});
