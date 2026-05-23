import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestFastifyApplication } from '@nestjs/platform-fastify';

import { createE2EApp } from './helpers/e2e-app.helper';

describe('OpenAPI export (e2e)', () => {
  let app: NestFastifyApplication;

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('writes docs/api/openapi.json', async () => {
    app = await createE2EApp();

    const config = new DocumentBuilder()
      .setTitle('Dhanam Ledger API')
      .setDescription('Comprehensive financial management API')
      .setVersion('1.0.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    const outDir = join(__dirname, '../../../../docs/api');
    mkdirSync(outDir, { recursive: true });
    const outPath = join(outDir, 'openapi.json');
    writeFileSync(outPath, `${JSON.stringify(document, null, 2)}\n`);

    expect(document.paths).toBeDefined();
    expect(Object.keys(document.paths ?? {}).length).toBeGreaterThan(0);
  }, 120_000);
});
