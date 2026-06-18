import { Injectable, Logger } from '@nestjs/common';

import { ComplianceBridgeDirection, ComplianceBridgeResolution, Prisma } from '@db';

import { PrismaService } from '../../core/prisma/prisma.service';

export interface RecordBridgeEventInput {
  journalId?: string;
  direction: ComplianceBridgeDirection;
  eventType: string;
  correlationId: string;
  resolution?: ComplianceBridgeResolution;
  payload?: Prisma.InputJsonValue;
  resolvedBy?: string;
}

@Injectable()
export class ComplianceBridgeEventService {
  private readonly logger = new Logger(ComplianceBridgeEventService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordBridgeEventInput) {
    const event = await this.prisma.complianceBridgeEvent.create({
      data: {
        journalId: input.journalId,
        direction: input.direction,
        eventType: input.eventType,
        correlationId: input.correlationId,
        resolution: input.resolution ?? ComplianceBridgeResolution.auto,
        payload: input.payload,
        resolvedBy: input.resolvedBy,
        resolvedAt: input.resolvedBy ? new Date() : undefined,
      },
    });

    this.logger.debug(
      `ComplianceBridgeEvent ${event.eventType} correlation=${input.correlationId}`
    );

    return event;
  }

  async list(filters: { correlationId?: string; journalId?: string; limit?: number }) {
    return this.prisma.complianceBridgeEvent.findMany({
      where: {
        ...(filters.correlationId ? { correlationId: filters.correlationId } : {}),
        ...(filters.journalId ? { journalId: filters.journalId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: filters.limit ?? 100,
    });
  }
}
