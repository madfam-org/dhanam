'use client';

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@dhanam/ui';
import {
  AlertCircle,
  Archive,
  CheckCircle2,
  FileText,
  Loader2,
  ShieldCheck,
  UploadCloud,
} from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';

import { Progress } from '@/components/ui/progress';
import { complianceApi, type ComplianceIngestResult } from '@/lib/api/compliance';
import { cn } from '@/lib/utils';

interface StatementIngestDropzoneProps {
  spaceId: string;
}

interface UploadedStatement {
  filename: string;
  result: ComplianceIngestResult;
}

const ACCEPTED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

export function StatementIngestDropzone({ spaceId }: StatementIngestDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploads, setUploads] = useState<UploadedStatement[]>([]);

  const ingestFile = useCallback(
    async (file: File) => {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        toast.error(`${file.name} is not a supported statement file.`);
        return;
      }
      setUploading(true);
      setProgress(0);
      try {
        const result = await complianceApi.ingestStatement(spaceId, file, setProgress);
        setUploads((prev) => [{ filename: file.name, result }, ...prev]);
        toast.success(`${file.name} preserved and processed.`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : `Failed to ingest ${file.name}.`);
      } finally {
        setUploading(false);
      }
    },
    [spaceId]
  );

  const ingestFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      Array.from(files).forEach((file) => void ingestFile(file));
    },
    [ingestFile]
  );

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-emerald-200/70 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.02),rgba(251,191,36,0.12))] dark:border-emerald-900/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-3xl">
            <Archive className="h-7 w-7 text-emerald-700 dark:text-emerald-300" />
            Estados de Cuenta ingestion
          </CardTitle>
          <CardDescription className="max-w-3xl text-base">
            Drag in bank statements, PDFs, CSVs, or statement screenshots. Dhanam preserves the
            original, extracts structured metadata, seals the record through Karafiel, and keeps a
            compliance receipt tied to this space.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className={cn(
              'relative rounded-3xl border-2 border-dashed p-8 text-center transition-all md:p-12',
              dragging
                ? 'border-emerald-500 bg-emerald-500/10 shadow-lg shadow-emerald-500/10'
                : 'border-emerald-300/70 bg-background/70 hover:border-emerald-500/80'
            )}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              setDragging(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              ingestFiles(event.dataTransfer.files);
            }}
          >
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
              {uploading ? (
                <Loader2 className="h-8 w-8 animate-spin" />
              ) : (
                <UploadCloud className="h-8 w-8" />
              )}
            </div>
            <h2 className="text-xl font-semibold">Drop statements here</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
              Supports PDF, PNG/JPEG/WEBP screenshots, CSV, XLS, and XLSX up to 25MB. Add files one
              by one or batch several monthly statements.
            </p>
            <Button className="mt-6" onClick={() => inputRef.current?.click()} disabled={uploading}>
              Select statement files
            </Button>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={ACCEPTED_TYPES.join(',')}
              className="hidden"
              onChange={(event) => ingestFiles(event.target.files)}
            />
            {uploading && (
              <div className="mx-auto mt-6 max-w-md">
                <Progress value={progress} className="h-2" />
                <p className="mt-2 text-xs text-muted-foreground">Uploading {progress}%</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-start gap-3 pt-6">
            <ShieldCheck className="mt-1 h-5 w-5 text-emerald-600" />
            <div>
              <p className="font-medium">Preserved original</p>
              <p className="text-sm text-muted-foreground">
                R2 retention policy is selected from the user tier.
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-start gap-3 pt-6">
            <FileText className="mt-1 h-5 w-5 text-amber-600" />
            <div>
              <p className="font-medium">Structured extraction</p>
              <p className="text-sm text-muted-foreground">
                Statement periods, balances, rows, and confidence are captured when readable.
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-start gap-3 pt-6">
            <CheckCircle2 className="mt-1 h-5 w-5 text-sky-600" />
            <div>
              <p className="font-medium">Compliance receipt</p>
              <p className="text-sm text-muted-foreground">
                Karafiel receipt and Dhanam compliance record are returned immediately.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {uploads.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Recent ingestions</CardTitle>
            <CardDescription>Statement preservation receipts from this session.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {uploads.map((upload) => (
              <div
                key={`${upload.result.complianceRecordId}-${upload.filename}`}
                className="rounded-xl border p-4"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="font-medium">{upload.filename}</p>
                    <p className="text-xs text-muted-foreground">
                      Compliance record {upload.result.complianceRecordId}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Karafiel {upload.result.karafielId}
                    </p>
                  </div>
                  <div className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                    {upload.result.extractionEngine} ·{' '}
                    {Math.round(upload.result.transactionSummary.confidence * 100)}% confidence
                  </div>
                </div>
                {upload.result.statementSummary && (
                  <div className="mt-4 grid gap-2 text-sm md:grid-cols-4">
                    <div>
                      <p className="text-muted-foreground">Period</p>
                      <p>
                        {upload.result.statementSummary.periodStart || 'Unknown'} to{' '}
                        {upload.result.statementSummary.periodEnd || 'Unknown'}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Account</p>
                      <p>
                        {upload.result.statementSummary.accountLast4
                          ? `•••• ${upload.result.statementSummary.accountLast4}`
                          : 'Unknown'}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Closing balance</p>
                      <p>{upload.result.statementSummary.closingBalance ?? 'Pending review'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Rows</p>
                      <p>{upload.result.statementSummary.transactionCount}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : (
        <div className="flex items-center gap-2 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          <AlertCircle className="h-4 w-4" />
          No statements ingested in this browser session yet.
        </div>
      )}
    </div>
  );
}
