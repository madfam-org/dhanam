import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

import { LoggerService } from '@core/logger/logger.service';
import { PrismaService } from '@core/prisma/prisma.service';

export const ADMIN_ROLE_KEY = 'adminRole';
export const AdminRole = (role?: string) => Reflect.metadata(ADMIN_ROLE_KEY, role);

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private prisma: PrismaService,
    private logger: LoggerService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    const userId = user.dhanamUserId || user.id;
    let isAdmin = user.isAdmin === true;

    if (!isAdmin && typeof userId === 'string' && userId.length > 0) {
      const localUser = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { isAdmin: true },
      });
      isAdmin = localUser?.isAdmin === true;
    }

    if (!isAdmin) {
      this.logger.warn(
        `Non-admin user ${userId || 'unknown'} attempted to access admin endpoint`,
        'AdminGuard'
      );
      throw new ForbiddenException('Admin access required');
    }

    // Log admin access for audit trail
    this.logger.log(`Admin access granted to user ${userId}`, 'AdminGuard');

    return true;
  }
}
