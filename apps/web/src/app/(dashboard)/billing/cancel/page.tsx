'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@dhanam/ui';
import { Button } from '@dhanam/ui';
import { XCircle, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function BillingCancelPage() {
  const router = useRouter();

  return (
    <div className="flex items-center justify-center min-h-[500px] p-6">
      <Card className="max-w-md w-full text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-muted p-3">
              <XCircle className="h-8 w-8 text-muted-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl">Checkout Cancelled</CardTitle>
          <CardDescription>
            No worries — you haven't been charged. You can upgrade anytime.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2">
            <Button variant="outline" onClick={() => router.push('/billing/upgrade')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Plans
            </Button>
            <Button variant="ghost" onClick={() => router.push('/dashboard')}>
              Return to Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
