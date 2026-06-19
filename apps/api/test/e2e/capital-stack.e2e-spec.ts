import * as crypto from 'crypto';

import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { JwtService } from '@nestjs/jwt';

import { EntityGroupService } from '../../src/modules/capital-stack/entity-group.service';
import { PrismaService } from '../../src/core/prisma/prisma.service';

import { createE2EApp } from './helpers/e2e-app.helper';
import { TestHelper } from './helpers/test.helper';

/**
 * RFC-6 golden scenario: owner contribution → match → Karafiel mock → sealed.
 */
describe('Capital Stack Golden Journey', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let testHelper: TestHelper;
  let entityGroups: EntityGroupService;

  let ownerToken: string;
  let ownerId: string;
  let personalSpaceId: string;
  let businessSpaceId: string;
  let entityGroupId: string;
  let journalId: string;
  let targetTxnId: string;

  beforeAll(async () => {
    process.env.FEATURE_CAPITAL_STACK_ENABLED = 'true';
    process.env.FEATURE_CAPITAL_STACK_KARAFIEL = 'false';
    process.env.DHANAM_WEBHOOK_SECRET = 'e2e-capital-stack-secret';

    app = await createE2EApp();
    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);
    testHelper = new TestHelper(prisma, jwtService);
    entityGroups = app.get(EntityGroupService);

    await testHelper.cleanDatabase();

    const owner = await testHelper.createCompleteUserWithSpace({
      email: TestHelper.generateUniqueEmail('cap-owner'),
      password: 'OwnerPass123!',
      name: 'Beneficial Owner',
      spaceName: 'Aldo Personal',
    });
    ownerToken = owner.authToken;
    ownerId = owner.user.id;
    personalSpaceId = owner.space.id;

    const operator = await testHelper.createCompleteUserWithSpace({
      email: TestHelper.generateUniqueEmail('cap-operator'),
      password: 'OperatorPass123!',
      name: 'Entity Operator',
      spaceName: 'Innovaciones MADFAM',
    });

    const businessSpace = await testHelper.createSpace(operator.user.id, {
      name: 'Innovaciones MADFAM',
      type: 'business',
      currency: 'MXN',
    });
    businessSpaceId = businessSpace.id;

    const group = await entityGroups.createEntityGroup(
      {
        name: 'MADFAM Operator Group',
        beneficialOwnerUserId: ownerId,
        operatorUserId: operator.user.id,
        personalSpaceId,
        businessSpaceId,
        legalName: 'Innovaciones MADFAM S.A.S. de C.V.',
        taxId: 'IMA2501164Y7',
      },
      ownerId
    );
    entityGroupId = group.household.id;

    const businessAccount = await testHelper.createAccount(businessSpaceId, {
      provider: 'manual',
      providerAccountId: 'biz-checking',
      name: 'Entity Operating',
      type: 'checking',
      subtype: 'checking',
      currency: 'MXN',
      balance: 0,
    });

    await prisma.account.update({
      where: { id: businessAccount.id },
      data: { capitalPurpose: 'entity_operating' },
    });

    const targetTxn = await testHelper.createMockTransaction(businessAccount.id, {
      amount: 15000,
      description: 'Entity deposit',
      date: new Date('2026-06-18'),
    });
    targetTxnId = targetTxn.id;
  }, 60_000);

  afterAll(async () => {
    await testHelper.cleanDatabase();
    await app.close();
  });

  function signBody(body: object): string {
    return crypto
      .createHmac('sha256', process.env.DHANAM_WEBHOOK_SECRET!)
      .update(JSON.stringify(body))
      .digest('hex');
  }

  it('lists entity groups for beneficial owner', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/capital-stack/groups',
      headers: { authorization: `Bearer ${ownerToken}` },
    });

    expect(response.statusCode).toBe(200);
    const groups = response.json() as Array<{ id: string }>;
    expect(groups.some((g) => g.id === entityGroupId)).toBe(true);
  });

  it('creates a proposed journal entry', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/capital-stack/journal',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        entityGroupId,
        flowType: 'capital_contribution',
        amount: 15000,
        currency: 'MXN',
        sourceSpaceId: personalSpaceId,
        targetSpaceId: businessSpaceId,
        status: 'proposed',
      },
    });

    expect(response.statusCode).toBe(201);
    const journal = response.json() as { id: string; status: string };
    journalId = journal.id;
    expect(journal.status).toBe('proposed');
  });

  it('matches journal to business-side transaction', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/v1/capital-stack/journal/${journalId}/match`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        targetTransactionId: targetTxnId,
        targetSpaceId: businessSpaceId,
      },
    });

    expect(response.statusCode).toBe(201);
    expect((response.json() as { status: string }).status).toBe('matched');
  });

  it('sends journal to Karafiel (mock path)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/v1/capital-stack/journal/${journalId}/send-to-karafiel`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json() as { karafiel_case_id: string; review_required: boolean };
    expect(body.karafiel_case_id).toMatch(/^MOCK-CAP-/);
    expect(body.review_required).toBe(true);
  });

  it('accepts Karafiel capital-flow-resolved callback and seals journal', async () => {
    const payload = {
      correlation_id: journalId,
      karafiel_case_id: 'kf-e2e-1',
      resolution: 'sealed',
      sealed_at: new Date().toISOString(),
    };

    const response = await app.inject({
      method: 'POST',
      url: '/v1/internal/compliance/capital-flow-resolved',
      headers: {
        'x-dhanam-signature': signBody(payload),
        'content-type': 'application/json',
      },
      payload,
    });

    expect(response.statusCode).toBe(200);

    const journal = await prisma.ownerCapitalJournal.findUnique({ where: { id: journalId } });
    expect(journal?.status).toBe('compliance_sealed');
    expect(journal?.karafielCaseId).toBe('kf-e2e-1');
  });
});
