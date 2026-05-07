'use client';

import { FileText } from 'lucide-react';

import { StatementIngestDropzone } from '@/components/statements/statement-ingest-dropzone';
import { useSpaceStore } from '@/stores/space';

export default function StatementsPage() {
  const { currentSpace } = useSpaceStore();

  if (!currentSpace) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-4 rounded-full bg-muted p-4">
          <FileText className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="mb-2 text-lg font-semibold">Select a space first</h3>
        <p className="max-w-sm text-sm text-muted-foreground">
          Statement ingestion needs a target space so Dhanam can preserve, seal, and index each
          document correctly.
        </p>
      </div>
    );
  }

  return <StatementIngestDropzone spaceId={currentSpace.id} />;
}
