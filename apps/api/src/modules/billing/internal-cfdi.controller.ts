import * as crypto from 'crypto';

import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  RawBodyRequest,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CfdiIssuedDto } from './dto/cfdi-issued.dto';
import { CfdiTimelineService } from './services/cfdi-timeline.service';

/**
 * Service-to-service callback from Karafiel after async CFDI stamping.
 * HMAC matches the product webhook contract (raw body, DHANAM_WEBHOOK_SECRET).
 */
@ApiTags('internal-billing')
@Controller('internal/billing')
export class InternalCfdiController {
  private readonly logger = new Logger(InternalCfdiController.name);

  constructor(
    private readonly cfdiTimeline: CfdiTimelineService,
    private readonly config: ConfigService
  ) {}

  @Post('cfdi-issued')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Record Karafiel-issued CFDI UUID on billing timeline (HMAC-signed)',
  })
  @ApiHeader({
    name: 'X-Dhanam-Signature',
    description: 'HMAC-SHA256 hex digest of the raw JSON body',
  })
  async recordCfdiIssued(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-dhanam-signature') signature: string,
    @Body() dto: CfdiIssuedDto
  ) {
    this.verifySignature(req, signature, dto);

    const updated = await this.cfdiTimeline.attachCfdiUuid(dto.payment_id, dto.cfdi_uuid);
    this.logger.log(
      `CFDI timeline updated payment_id=${dto.payment_id} uuid=${dto.cfdi_uuid} rows=${updated}`
    );

    return { status: 'ok', updated, payment_id: dto.payment_id, cfdi_uuid: dto.cfdi_uuid };
  }

  private verifySignature(
    req: RawBodyRequest<Request>,
    signature: string,
    dto: CfdiIssuedDto
  ): void {
    if (!signature) {
      throw new UnauthorizedException('Missing X-Dhanam-Signature header');
    }

    const secret = this.config.get<string>('DHANAM_WEBHOOK_SECRET');
    if (!secret) {
      this.logger.error('DHANAM_WEBHOOK_SECRET not configured');
      throw new UnauthorizedException('Signature verification not configured');
    }

    // Karafiel signs compact JSON (`separators=(",", ":")`). Fall back to the
    // same canonical shape when Fastify did not attach rawBody.
    const rawBody =
      typeof req.rawBody === 'string'
        ? req.rawBody
        : req.rawBody
          ? req.rawBody.toString('utf8')
          : JSON.stringify({
              payment_id: dto.payment_id,
              cfdi_uuid: dto.cfdi_uuid,
              source: dto.source ?? 'karafiel',
            });

    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    const provided = signature.trim();

    const expectedBuf = Buffer.from(expected, 'utf8');
    const providedBuf = Buffer.from(provided, 'utf8');
    if (
      expectedBuf.length !== providedBuf.length ||
      !crypto.timingSafeEqual(expectedBuf, providedBuf)
    ) {
      throw new UnauthorizedException('Invalid signature');
    }
  }
}
