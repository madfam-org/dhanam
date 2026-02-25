/**
 * =============================================================================
 * Janua OIDC JWT Strategy
 * =============================================================================
 * Validates JWTs issued by Janua (auth.madfam.io) using RS256 asymmetric keys.
 * This enables "One Membership, All Services" across the Galaxy ecosystem.
 *
 * Migration from local auth:
 * - Before: Dhanam issued its own JWTs (HS256 with JWT_SECRET)
 * - After: Dhanam validates Janua JWTs (RS256 via JWKS endpoint)
 *
 * The strategy fetches public keys from Janua's JWKS endpoint and caches them
 * with automatic rotation support via jwks-rsa.
 * =============================================================================
 */

import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { passportJwtSecret } from 'jwks-rsa';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { PrismaService } from '@core/prisma/prisma.service';

/**
 * JWT payload structure from Janua tokens.
 * Includes Galaxy ecosystem membership claims.
 */
export interface JanuaJwtPayload {
  // Standard OIDC claims
  sub: string; // User ID (UUID from Janua)
  email: string;
  iss: string; // Issuer: https://auth.madfam.io
  aud: string; // Audience
  exp: number; // Expiration timestamp
  iat: number; // Issued at timestamp
  jti: string; // JWT ID (unique token identifier)

  // Galaxy membership claims (from Operation MINT)
  tier?: 'community' | 'pro' | 'enterprise';
  roles?: string[]; // e.g., ['owner', 'admin']
  sub_status?: 'active' | 'inactive' | 'suspended';
  is_admin?: boolean;

  // OIDC profile claims
  name?: string;
  picture?: string;
  locale?: string;
}

/**
 * Validated user context attached to request after JWT validation.
 */
export interface JanuaUser {
  id: string; // Primary ID for @CurrentUser('id') compatibility
  userId: string; // Janua user ID
  email: string;
  name?: string;
  locale?: string;
  tier: string;
  roles: string[];
  subStatus: string;
  isAdmin: boolean;
  dhanamUserId?: string; // Local Dhanam user ID (if synced)
}

@Injectable()
export class JanuaStrategy extends PassportStrategy(Strategy, 'janua') {
  private readonly logger = new Logger(JanuaStrategy.name);

  constructor(private prisma: PrismaService) {
    // Get OIDC configuration from environment
    const jwksUri = process.env.JANUA_JWKS_URI || 'https://auth.madfam.io/.well-known/jwks.json';
    const issuer = process.env.JANUA_ISSUER || 'https://auth.madfam.io';
    const audience = process.env.JANUA_AUDIENCE || 'dhanam-api';

    super({
      // Extract JWT from Authorization: Bearer <token> header
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),

      // Use JWKS endpoint for RS256 key validation
      secretOrKeyProvider: passportJwtSecret({
        cache: true, // Cache signing keys for performance
        rateLimit: true, // Prevent JWKS endpoint abuse
        jwksRequestsPerMinute: 5, // Max 5 requests per minute to JWKS
        jwksUri: jwksUri,
      }),

      // Token validation options
      ignoreExpiration: false, // Reject expired tokens
      issuer: issuer, // Must match Janua issuer
      audience: audience, // Must match expected audience
      algorithms: ['RS256'], // Only accept RS256 (asymmetric)
    });

    this.logger.log(`Janua OIDC Strategy initialized`);
    this.logger.log(`  JWKS URI: ${jwksUri}`);
    this.logger.log(`  Issuer: ${issuer}`);
    this.logger.log(`  Audience: ${audience}`);
  }

  /**
   * Validate JWT payload and enrich with local user data.
   *
   * This method is called after signature verification succeeds.
   * It performs additional validation and syncs/fetches local user data.
   */
  async validate(payload: JanuaJwtPayload): Promise<JanuaUser> {
    this.logger.debug(`Validating Janua token for: ${payload.email}`);

    // Validate required claims
    if (!payload.sub || !payload.email) {
      this.logger.warn('Token missing required claims (sub, email)');
      throw new UnauthorizedException('Invalid token: missing required claims');
    }

    // Check subscription status (Galaxy ecosystem check)
    if (payload.sub_status === 'suspended') {
      this.logger.warn(`Suspended user attempted access: ${payload.email}`);
      throw new UnauthorizedException('Account suspended');
    }

    // Find or create local Dhanam user (Just-In-Time provisioning)
    let dhanamUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { id: payload.sub }, // Match by Janua ID
          { email: payload.email }, // Match by email
        ],
      },
      select: {
        id: true,
        email: true,
        name: true,
        locale: true,
        isActive: true,
      },
    });

    // JIT User Provisioning: Create local user if doesn't exist
    if (!dhanamUser) {
      this.logger.log(`JIT provisioning new user: ${payload.email}`);

      try {
        dhanamUser = await this.prisma.user.create({
          data: {
            id: payload.sub, // Use Janua ID as primary key
            email: payload.email,
            name: payload.name || payload.email.split('@')[0],
            locale: payload.locale || 'es',
            timezone: 'America/Mexico_City', // Default for LATAM-first
            passwordHash: '', // No local password (SSO only)
            isActive: true,
            emailVerified: true, // Janua handles verification
          },
          select: {
            id: true,
            email: true,
            name: true,
            locale: true,
            isActive: true,
          },
        });

        // Create default personal space for new user
        await this.prisma.space.create({
          data: {
            name: `${dhanamUser.name}'s Personal`,
            type: 'personal',
            currency: 'MXN',
            timezone: 'America/Mexico_City',
            userSpaces: {
              create: {
                userId: dhanamUser.id,
                role: 'owner',
              },
            },
          },
        });

        this.logger.log(`Created local user and space for: ${payload.email}`);
      } catch (error) {
        this.logger.error(`Failed to provision user: ${error.message}`);
        // Continue even if provisioning fails - user can still access
      }
    }

    // Check if local user is active
    if (dhanamUser && !dhanamUser.isActive) {
      this.logger.warn(`Inactive local user: ${payload.email}`);
      throw new UnauthorizedException('Local account deactivated');
    }

    // Sync user data if changed
    if (dhanamUser && payload.name && dhanamUser.name !== payload.name) {
      await this.prisma.user.update({
        where: { id: dhanamUser.id },
        data: { name: payload.name },
      });
    }

    // Return validated user context
    // IMPORTANT: Include 'id' for compatibility with @CurrentUser('id') decorator
    return {
      id: dhanamUser?.id || payload.sub, // Required by @CurrentUser('id')
      userId: payload.sub,
      email: payload.email,
      name: payload.name,
      locale: payload.locale,
      tier: payload.tier || 'community',
      roles: payload.roles || [],
      subStatus: payload.sub_status || 'active',
      isAdmin: payload.is_admin || false,
      dhanamUserId: dhanamUser?.id,
    };
  }
}
