'use client';

import { Vote, Shield } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Proposal {
  id: string;
  title: string;
  status: 'active' | 'passed' | 'rejected';
  votedAt?: string;
  userVote?: 'for' | 'against' | 'abstain';
  dao?: string;
}

interface GovernanceActivityProps {
  proposals: Proposal[];
  totalVotesCast: number;
  votingPower: number;
  votingPowerToken: string;
}

export function GovernanceActivity({
  proposals,
  totalVotesCast,
  votingPower,
  votingPowerToken,
}: GovernanceActivityProps) {
  const statusColors: Record<string, string> = {
    active: 'bg-blue-500/10 text-blue-600',
    passed: 'bg-green-500/10 text-green-600',
    rejected: 'bg-red-500/10 text-red-600',
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Vote className="h-5 w-5" />
            Governance Activity
          </CardTitle>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Shield className="h-3 w-3" />
            {new Intl.NumberFormat().format(votingPower)} {votingPowerToken}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4 mb-4">
          <div className="p-3 rounded-lg bg-muted/50 flex-1 text-center">
            <p className="text-sm text-muted-foreground">Votes Cast</p>
            <p className="text-lg font-semibold">{totalVotesCast}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 flex-1 text-center">
            <p className="text-sm text-muted-foreground">Active Proposals</p>
            <p className="text-lg font-semibold">
              {proposals.filter((p) => p.status === 'active').length}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {proposals.map((proposal) => (
            <div key={proposal.id} className="flex items-center justify-between p-2 rounded border">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{proposal.title}</p>
                {proposal.dao && <p className="text-xs text-muted-foreground">{proposal.dao}</p>}
                {proposal.votedAt && (
                  <p className="text-xs text-muted-foreground">Voted: {proposal.userVote}</p>
                )}
              </div>
              <Badge variant="outline" className={statusColors[proposal.status] || ''}>
                {proposal.status}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
