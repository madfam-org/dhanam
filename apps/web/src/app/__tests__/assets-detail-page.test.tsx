import { render, screen } from '@testing-library/react';
import React from 'react';

const mockPush = jest.fn();
const mockParams = { id: 'asset-123' };

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useParams: () => mockParams,
}));

jest.mock('next/link', () => {
  return ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  );
});

jest.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: any) => (
    <div data-testid="card" {...props}>
      {children}
    </div>
  ),
  CardContent: ({ children }: any) => <div>{children}</div>,
  CardDescription: ({ children }: any) => <p>{children}</p>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <h3>{children}</h3>,
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: any) => <span>{children}</span>,
}));

jest.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children }: any) => <div>{children}</div>,
  TabsContent: ({ children, value }: any) => <div data-testid={`tab-${value}`}>{children}</div>,
  TabsList: ({ children }: any) => <div>{children}</div>,
  TabsTrigger: ({ children }: any) => <button>{children}</button>,
}));

jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: any) => (open ? <div data-testid="dialog">{children}</div> : null),
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h3>{children}</h3>,
}));

jest.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({ children, open }: any) =>
    open ? <div data-testid="alert-dialog">{children}</div> : null,
  AlertDialogAction: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  AlertDialogCancel: ({ children }: any) => <button>{children}</button>,
  AlertDialogContent: ({ children }: any) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: any) => <p>{children}</p>,
  AlertDialogFooter: ({ children }: any) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: any) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: any) => <h3>{children}</h3>,
}));

jest.mock(
  'lucide-react',
  () =>
    new Proxy(
      {},
      {
        get: (_, prop) => {
          if (prop === '__esModule') return true;
          return (props: any) => (
            <span data-testid={`icon-${String(prop).toLowerCase()}`} {...props} />
          );
        },
      }
    )
);

jest.mock('date-fns', () => ({
  formatDistanceToNow: () => '3 days ago',
}));

jest.mock('@dhanam/shared', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    locale: 'en',
    setLocale: jest.fn(),
  }),
}));

jest.mock('@/components/assets/manual-asset-form', () => ({
  ManualAssetForm: () => <div data-testid="manual-asset-form" />,
}));

jest.mock('@/components/assets/document-upload', () => ({
  DocumentUpload: () => <div data-testid="document-upload" />,
}));

jest.mock('@/components/assets/document-list', () => ({
  DocumentList: () => <div data-testid="document-list" />,
}));

jest.mock('@/lib/api/client', () => ({
  apiClient: {
    get: jest.fn().mockResolvedValue(null),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock('@/lib/api/documents', () => ({
  documentsApi: {
    getDocuments: jest.fn().mockResolvedValue([]),
    getConfig: jest.fn().mockResolvedValue({ maxFileSize: 50_000_000, allowedTypes: [] }),
  },
}));

jest.mock('@/stores/space', () => ({
  useSpaceStore: (selector: any) => {
    const state = { currentSpace: { id: 'space-1', name: 'Personal', currency: 'USD' } };
    return selector ? selector(state) : state;
  },
}));

import AssetDetailPage from '../(dashboard)/assets/[id]/page';

describe('AssetDetailPage', () => {
  it('should render without crashing', () => {
    render(<AssetDetailPage />);
    // Page renders - either loading state or content
    expect(document.body).toBeTruthy();
  });

  it('should show loading skeleton when data is loading', () => {
    render(<AssetDetailPage />);
    // Before API resolves, should show loading animation
    expect(document.querySelector('.animate-pulse')).toBeTruthy();
  });

  it('should render page container', () => {
    const { container } = render(<AssetDetailPage />);
    expect(container.firstChild).toBeTruthy();
  });
});
