'use client';

import { Users, Trophy } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface GuildData {
  platform: string;
  guildName: string;
  role: 'owner' | 'manager' | 'scholar';
  scholarCount?: number;
  revenueSharePercent?: number;
  monthlyIncomeUsd?: number;
  treasuryValueUsd?: number;
}

interface GuildTrackerProps {
  guilds: GuildData[];
}

const formatUsd = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);

const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-yellow-500/10 text-yellow-600',
  manager: 'bg-blue-500/10 text-blue-600',
  scholar: 'bg-green-500/10 text-green-600',
};

export function GuildTracker({ guilds }: GuildTrackerProps) {
  if (guilds.length === 0) return null;

  const totalIncome = guilds.reduce((s, g) => s + (g.monthlyIncomeUsd || 0), 0);
  const totalScholars = guilds.reduce((s, g) => s + (g.scholarCount || 0), 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-5 w-5" />
            Guild & Scholarship Tracker
          </CardTitle>
          <span className="text-sm text-muted-foreground">
            {totalScholars} scholars · {formatUsd(totalIncome)}/mo
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {guilds.map((guild, idx) => (
            <div key={idx} className="p-3 rounded-lg border">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">{guild.guildName}</span>
                  <Badge variant="outline" className={ROLE_COLORS[guild.role] || ''}>
                    {guild.role}
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground capitalize">
                  {guild.platform.replace('-', ' ')}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {guild.scholarCount != null && (
                  <div>
                    <p className="text-muted-foreground">Scholars</p>
                    <p className="font-medium">{guild.scholarCount}</p>
                  </div>
                )}
                {guild.revenueSharePercent != null && (
                  <div>
                    <p className="text-muted-foreground">Rev Share</p>
                    <p className="font-medium">{guild.revenueSharePercent}%</p>
                  </div>
                )}
                {guild.monthlyIncomeUsd != null && (
                  <div>
                    <p className="text-muted-foreground">Monthly</p>
                    <p className="font-medium text-green-600">
                      {formatUsd(guild.monthlyIncomeUsd)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
