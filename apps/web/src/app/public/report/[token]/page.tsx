'use client';

import { Download, Loader2, FileText, AlertCircle } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { reportsApi } from '@/lib/api/reports';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function PublicReportPage() {
  const params = useParams();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<{
    reportName: string;
    format: string;
    generatedAt: string;
    fileSize: number;
    downloadUrl: string;
  } | null>(null);

  useEffect(() => {
    if (!token) return;

    const fetchReport = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await reportsApi.getPublicReport(token);
        setReport(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'This link is invalid, expired, or has been revoked.'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Loading report...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h2 className="text-lg font-semibold mb-2">Report Unavailable</h2>
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
              <p className="text-sm text-muted-foreground mt-4">
                If you believe this is an error, please contact the person who shared this link.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!report) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="p-3 bg-muted rounded-full w-fit mx-auto mb-2">
            <FileText className="h-8 w-8" />
          </div>
          <CardTitle>{report.reportName}</CardTitle>
          <CardDescription>Shared financial report</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-center gap-3">
            <Badge variant="outline" className="text-xs uppercase">
              {report.format}
            </Badge>
            <span className="text-sm text-muted-foreground">{formatFileSize(report.fileSize)}</span>
            <span className="text-sm text-muted-foreground">
              {new Date(report.generatedAt).toLocaleDateString()}
            </span>
          </div>

          <Button
            className="w-full"
            size="lg"
            onClick={() => window.open(report.downloadUrl, '_blank')}
          >
            <Download className="mr-2 h-5 w-5" />
            Download Report
          </Button>

          <p className="text-xs text-center text-muted-foreground">Powered by Dhanam</p>
        </CardContent>
      </Card>
    </div>
  );
}
