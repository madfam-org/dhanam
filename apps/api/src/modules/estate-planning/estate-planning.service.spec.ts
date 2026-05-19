import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { AuditService } from '../../core/audit/audit.service';
import { PrismaService } from '../../core/prisma/prisma.service';

import {
  CreateWillDto,
  UpdateWillDto,
  AddBeneficiaryDto,
  UpdateBeneficiaryDto,
  AddExecutorDto,
  UpdateExecutorDto,
} from './dto';
import { EstatePlanningService } from './estate-planning.service';

// Using string literals instead of enums since Prisma client may not be generated
const WillStatus = {
  draft: 'draft' as const,
  active: 'active' as const,
  revoked: 'revoked' as const,
  executed: 'executed' as const,
};

const AssetType = {
  bank_account: 'bank_account' as const,
  investment_account: 'investment_account' as const,
  crypto_account: 'crypto_account' as const,
  real_estate: 'real_estate' as const,
  business_interest: 'business_interest' as const,
  personal_property: 'personal_property' as const,
  other: 'other' as const,
};

describe('EstatePlanningService', () => {
  let service: EstatePlanningService;
  let prisma: PrismaService;
  let auditService: AuditService;

  const mockUserId = 'user-123';
  const mockHouseholdId = 'household-123';
  const mockWillId = 'will-123';
  const mockBeneficiaryId = 'beneficiary-123';
  const mockExecutorId = 'executor-123';
  const mockMemberId = 'member-123';

  const mockHousehold = {
    id: mockHouseholdId,
    name: 'Smith Family',
    type: 'family',
    baseCurrency: 'USD',
    description: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    members: [
      {
        id: mockMemberId,
        householdId: mockHouseholdId,
        userId: mockUserId,
        relationship: 'spouse',
        isMinor: false,
        accessStartDate: null,
        notes: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        user: {
          id: mockUserId,
          name: 'John Smith',
          email: 'john@example.com',
          dateOfBirth: new Date('1985-01-01'),
        },
      },
    ],
  };

  const mockWill = {
    id: mockWillId,
    householdId: mockHouseholdId,
    name: 'Smith Family Will',
    status: WillStatus.draft,
    lastReviewedAt: null,
    activatedAt: null,
    revokedAt: null,
    executedAt: null,
    notes: 'Test will',
    legalDisclaimer: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    household: mockHousehold,
    beneficiaries: [],
    executors: [],
    _count: {
      beneficiaries: 0,
      executors: 0,
    },
  };

  const mockBeneficiary = {
    id: mockBeneficiaryId,
    willId: mockWillId,
    beneficiaryId: mockMemberId,
    assetType: AssetType.bank_account,
    assetId: null,
    percentage: 100,
    conditions: null,
    notes: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    beneficiary: {
      id: mockMemberId,
      relationship: 'child',
      user: {
        id: 'user-456',
        name: 'Jane Smith',
        email: 'jane@example.com',
      },
    },
  };

  const mockExecutor = {
    id: mockExecutorId,
    willId: mockWillId,
    executorId: mockMemberId,
    isPrimary: true,
    order: 1,
    acceptedAt: null,
    notes: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    executor: {
      id: mockMemberId,
      relationship: 'spouse',
      user: {
        id: mockUserId,
        name: 'John Smith',
        email: 'john@example.com',
      },
    },
  };

  const mockPrismaService = {
    household: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    will: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
    beneficiaryDesignation: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    willExecutor: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    householdMember: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  const mockAuditService = {
    log: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EstatePlanningService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<EstatePlanningService>(EstatePlanningService);
    prisma = module.get<PrismaService>(PrismaService);
    auditService = module.get<AuditService>(AuditService);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('createWill', () => {
    it('should create a new will in draft status', async () => {
      const dto: CreateWillDto = {
        householdId: mockHouseholdId,
        name: 'Smith Family Will',
        notes: 'Test will',
        legalDisclaimer: true,
      };

      mockPrismaService.householdMember.findFirst.mockResolvedValue(mockHousehold.members[0]);
      mockPrismaService.will.create.mockResolvedValue(mockWill);

      const result = await service.createWill(dto, mockUserId);

      expect(result).toEqual(mockWill);
      expect(mockPrismaService.will.create).toHaveBeenCalledWith({
        data: {
          householdId: dto.householdId,
          name: dto.name,
          notes: dto.notes,
          legalDisclaimer: dto.legalDisclaimer,
          status: WillStatus.draft,
        },
        include: expect.any(Object),
      });
      expect(mockAuditService.log).toHaveBeenCalled();
    });

    it('should throw NotFoundException if household not found', async () => {
      const dto: CreateWillDto = {
        householdId: mockHouseholdId,
        name: 'Test Will',
      };

      mockPrismaService.householdMember.findFirst.mockResolvedValue(null);

      await expect(service.createWill(dto, mockUserId)).rejects.toThrow(NotFoundException);
    });

    it('should create will with default legalDisclaimer as false', async () => {
      const dto: CreateWillDto = {
        householdId: mockHouseholdId,
        name: 'Test Will',
      };

      mockPrismaService.householdMember.findFirst.mockResolvedValue(mockHousehold.members[0]);
      mockPrismaService.will.create.mockResolvedValue(mockWill);

      await service.createWill(dto, mockUserId);

      expect(mockPrismaService.will.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            legalDisclaimer: false,
          }),
        })
      );
    });
  });

  describe('findById', () => {
    it('should find a will by ID', async () => {
      mockPrismaService.will.findFirst.mockResolvedValue(mockWill);

      const result = await service.findById(mockWillId, mockUserId);

      expect(result).toEqual(mockWill);
      expect(mockPrismaService.will.findFirst).toHaveBeenCalledWith({
        where: {
          id: mockWillId,
          household: {
            members: {
              some: {
                userId: mockUserId,
              },
            },
          },
        },
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException if will not found or user has no access', async () => {
      mockPrismaService.will.findFirst.mockResolvedValue(null);

      await expect(service.findById(mockWillId, mockUserId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByHousehold', () => {
    it('should find all wills for a household', async () => {
      const wills = [mockWill];
      mockPrismaService.householdMember.findFirst.mockResolvedValue(mockHousehold.members[0]);
      mockPrismaService.will.findMany.mockResolvedValue(wills);

      const result = await service.findByHousehold(mockHouseholdId, mockUserId);

      expect(result).toEqual(wills);
      expect(mockPrismaService.will.findMany).toHaveBeenCalledWith({
        where: {
          householdId: mockHouseholdId,
        },
        include: expect.any(Object),
        orderBy: {
          createdAt: 'desc',
        },
      });
    });

    it('should throw NotFoundException if household not found', async () => {
      mockPrismaService.householdMember.findFirst.mockResolvedValue(null);

      await expect(service.findByHousehold(mockHouseholdId, mockUserId)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('updateWill', () => {
    it('should update a will', async () => {
      const dto: UpdateWillDto = {
        name: 'Updated Will',
        notes: 'Updated notes',
      };

      const updatedWill = { ...mockWill, ...dto };

      mockPrismaService.will.findFirst.mockResolvedValue(mockWill);
      mockPrismaService.will.update.mockResolvedValue(updatedWill);

      const result = await service.updateWill(mockWillId, dto, mockUserId);

      expect(result.name).toBe(dto.name);
      expect(mockPrismaService.will.update).toHaveBeenCalled();
      expect(mockAuditService.log).toHaveBeenCalled();
    });

    it('should throw BadRequestException when updating executed will', async () => {
      const executedWill = { ...mockWill, status: WillStatus.executed };
      mockPrismaService.will.findFirst.mockResolvedValue(executedWill);

      await expect(service.updateWill(mockWillId, { name: 'Updated' }, mockUserId)).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('deleteWill', () => {
    it('should delete a draft will', async () => {
      mockPrismaService.will.findFirst.mockResolvedValue(mockWill);
      mockPrismaService.will.delete.mockResolvedValue(mockWill);

      await service.deleteWill(mockWillId, mockUserId);

      expect(mockPrismaService.will.delete).toHaveBeenCalledWith({
        where: { id: mockWillId },
      });
      expect(mockAuditService.log).toHaveBeenCalled();
    });

    it('should throw BadRequestException when deleting non-draft will', async () => {
      const activeWill = { ...mockWill, status: WillStatus.active };
      mockPrismaService.will.findFirst.mockResolvedValue(activeWill);

      await expect(service.deleteWill(mockWillId, mockUserId)).rejects.toThrow(BadRequestException);
    });
  });

  describe('activateWill', () => {
    it('should activate a valid will', async () => {
      const willWithBeneficiaries = {
        ...mockWill,
        beneficiaries: [mockBeneficiary],
        executors: [mockExecutor],
      };
      const activatedWill = {
        ...willWithBeneficiaries,
        status: WillStatus.active,
        activatedAt: new Date(),
      };

      mockPrismaService.will.findFirst.mockResolvedValue(willWithBeneficiaries);
      mockPrismaService.beneficiaryDesignation.findMany.mockResolvedValue([mockBeneficiary]);
      mockPrismaService.will.updateMany.mockResolvedValue({ count: 0 });
      mockPrismaService.will.update.mockResolvedValue(activatedWill);

      const result = await service.activateWill(mockWillId, mockUserId);

      expect(result.status).toBe(WillStatus.active);
      expect(mockPrismaService.will.update).toHaveBeenCalledWith({
        where: { id: mockWillId },
        data: {
          status: 'active',
          activatedAt: expect.any(Date),
        },
        include: expect.any(Object),
      });
      expect(mockAuditService.log).toHaveBeenCalled();
    });

    it('should throw BadRequestException when activating non-draft will', async () => {
      const activeWill = { ...mockWill, status: WillStatus.active };
      mockPrismaService.will.findFirst.mockResolvedValue(activeWill);

      await expect(service.activateWill(mockWillId, mockUserId)).rejects.toThrow(
        BadRequestException
      );
      await expect(service.activateWill(mockWillId, mockUserId)).rejects.toThrow(
        'Can only activate draft wills'
      );
    });

    it('should throw BadRequestException when activating revoked will', async () => {
      const revokedWill = { ...mockWill, status: WillStatus.revoked };
      mockPrismaService.will.findFirst.mockResolvedValue(revokedWill);

      await expect(service.activateWill(mockWillId, mockUserId)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should throw BadRequestException if legalDisclaimer not accepted', async () => {
      const willWithoutDisclaimer = { ...mockWill, legalDisclaimer: false };
      mockPrismaService.will.findFirst.mockResolvedValue(willWithoutDisclaimer);

      await expect(service.activateWill(mockWillId, mockUserId)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should throw BadRequestException if no beneficiaries', async () => {
      const willWithoutBeneficiaries = { ...mockWill, beneficiaries: [] };
      mockPrismaService.will.findFirst.mockResolvedValue(willWithoutBeneficiaries);

      await expect(service.activateWill(mockWillId, mockUserId)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should throw BadRequestException if no executors', async () => {
      const willWithoutExecutors = {
        ...mockWill,
        beneficiaries: [mockBeneficiary],
        executors: [],
      };
      mockPrismaService.will.findFirst.mockResolvedValue(willWithoutExecutors);

      await expect(service.activateWill(mockWillId, mockUserId)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should throw BadRequestException if beneficiary allocations invalid', async () => {
      const invalidBeneficiary = { ...mockBeneficiary, percentage: 50 }; // Only 50%
      const willWithInvalidAllocations = {
        ...mockWill,
        beneficiaries: [invalidBeneficiary],
        executors: [mockExecutor],
      };

      mockPrismaService.will.findFirst.mockResolvedValue(willWithInvalidAllocations);
      mockPrismaService.beneficiaryDesignation.findMany.mockResolvedValue([invalidBeneficiary]);

      await expect(service.activateWill(mockWillId, mockUserId)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should auto-revoke previous active will when activating new one', async () => {
      const willWithBeneficiaries = {
        ...mockWill,
        beneficiaries: [mockBeneficiary],
        executors: [mockExecutor],
      };

      mockPrismaService.will.findFirst.mockResolvedValue(willWithBeneficiaries);
      mockPrismaService.beneficiaryDesignation.findMany.mockResolvedValue([mockBeneficiary]);
      mockPrismaService.will.updateMany.mockResolvedValue({ count: 1 }); // One previous active will
      mockPrismaService.will.update.mockResolvedValue({
        ...willWithBeneficiaries,
        status: WillStatus.active,
      });

      await service.activateWill(mockWillId, mockUserId);

      expect(mockPrismaService.will.updateMany).toHaveBeenCalledWith({
        where: {
          householdId: mockHouseholdId,
          status: 'active',
        },
        data: {
          status: 'revoked',
          revokedAt: expect.any(Date),
        },
      });
    });
  });

  describe('revokeWill', () => {
    it('should revoke an active will', async () => {
      const activeWill = { ...mockWill, status: WillStatus.active };
      const revokedWill = {
        ...activeWill,
        status: WillStatus.revoked,
        revokedAt: new Date(),
      };

      mockPrismaService.will.findFirst.mockResolvedValue(activeWill);
      mockPrismaService.will.update.mockResolvedValue(revokedWill);

      const result = await service.revokeWill(mockWillId, mockUserId);

      expect(result.status).toBe(WillStatus.revoked);
      expect(mockPrismaService.will.update).toHaveBeenCalledWith({
        where: { id: mockWillId },
        data: {
          status: WillStatus.revoked,
          revokedAt: expect.any(Date),
        },
        include: expect.any(Object),
      });
      expect(mockAuditService.log).toHaveBeenCalled();
    });

    it('should throw BadRequestException when revoking non-active will', async () => {
      mockPrismaService.will.findFirst.mockResolvedValue(mockWill); // draft status

      await expect(service.revokeWill(mockWillId, mockUserId)).rejects.toThrow(BadRequestException);
    });
  });

  describe('validateBeneficiaryAllocations', () => {
    it('should validate correct allocations (100% per asset type)', async () => {
      const beneficiaries = [
        { ...mockBeneficiary, percentage: 100, assetType: AssetType.bank_account },
      ];

      mockPrismaService.beneficiaryDesignation.findMany.mockResolvedValue(beneficiaries);

      const result = await service.validateBeneficiaryAllocations(mockWillId);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid allocations (not 100%)', async () => {
      const beneficiaries = [
        { ...mockBeneficiary, percentage: 50, assetType: AssetType.bank_account },
      ];

      mockPrismaService.beneficiaryDesignation.findMany.mockResolvedValue(beneficiaries);

      const result = await service.validateBeneficiaryAllocations(mockWillId);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('bank_account: allocations sum to 50%');
    });

    it('should validate multiple asset types independently', async () => {
      const beneficiaries = [
        {
          ...mockBeneficiary,
          id: 'ben-1',
          percentage: 100,
          assetType: AssetType.bank_account,
        },
        {
          ...mockBeneficiary,
          id: 'ben-2',
          percentage: 60,
          assetType: AssetType.investment_account,
        },
        {
          ...mockBeneficiary,
          id: 'ben-3',
          percentage: 40,
          assetType: AssetType.investment_account,
        },
      ];

      mockPrismaService.beneficiaryDesignation.findMany.mockResolvedValue(beneficiaries);

      const result = await service.validateBeneficiaryAllocations(mockWillId);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle floating point precision (99.99% should be valid)', async () => {
      const beneficiaries = [
        { ...mockBeneficiary, percentage: 33.33, assetType: AssetType.bank_account },
        { ...mockBeneficiary, percentage: 33.33, assetType: AssetType.bank_account },
        { ...mockBeneficiary, percentage: 33.34, assetType: AssetType.bank_account },
      ];

      mockPrismaService.beneficiaryDesignation.findMany.mockResolvedValue(beneficiaries);

      const result = await service.validateBeneficiaryAllocations(mockWillId);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('addBeneficiary', () => {
    it('should add a beneficiary to a will', async () => {
      const dto: AddBeneficiaryDto = {
        beneficiaryId: mockMemberId,
        assetType: AssetType.bank_account,
        percentage: 100,
      };

      mockPrismaService.will.findFirst.mockResolvedValue(mockWill);
      mockPrismaService.householdMember.findFirst.mockResolvedValue(mockHousehold.members[0]);
      mockPrismaService.beneficiaryDesignation.create.mockResolvedValue(mockBeneficiary);

      const result = await service.addBeneficiary(mockWillId, dto, mockUserId);

      expect(result).toEqual(mockBeneficiary);
      expect(mockPrismaService.beneficiaryDesignation.create).toHaveBeenCalledWith({
        data: {
          willId: mockWillId,
          beneficiaryId: dto.beneficiaryId,
          assetType: dto.assetType,
          percentage: dto.percentage,
        },
        include: expect.any(Object),
      });
      expect(mockAuditService.log).toHaveBeenCalled();
    });

    it('should throw NotFoundException if beneficiary not a household member', async () => {
      const dto: AddBeneficiaryDto = {
        beneficiaryId: 'invalid-member',
        assetType: AssetType.bank_account,
        percentage: 100,
      };

      mockPrismaService.will.findFirst.mockResolvedValue(mockWill);
      mockPrismaService.householdMember.findFirst.mockResolvedValue(null);

      await expect(service.addBeneficiary(mockWillId, dto, mockUserId)).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw BadRequestException when adding to executed will', async () => {
      const executedWill = { ...mockWill, status: WillStatus.executed };
      const dto: AddBeneficiaryDto = {
        beneficiaryId: mockMemberId,
        assetType: AssetType.bank_account,
        percentage: 100,
      };

      mockPrismaService.will.findFirst.mockResolvedValue(executedWill);

      await expect(service.addBeneficiary(mockWillId, dto, mockUserId)).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('updateBeneficiary', () => {
    it('should update a beneficiary', async () => {
      const dto: UpdateBeneficiaryDto = {
        percentage: 50,
        notes: 'Updated notes',
      };

      const updatedBeneficiary = { ...mockBeneficiary, ...dto };

      mockPrismaService.will.findFirst.mockResolvedValue(mockWill);
      mockPrismaService.beneficiaryDesignation.findFirst.mockResolvedValue(mockBeneficiary);
      mockPrismaService.beneficiaryDesignation.update.mockResolvedValue(updatedBeneficiary);

      const result = await service.updateBeneficiary(
        mockWillId,
        mockBeneficiaryId,
        dto,
        mockUserId
      );

      expect(result.percentage).toBe(dto.percentage);
      expect(mockAuditService.log).toHaveBeenCalled();
    });

    it('should throw NotFoundException if beneficiary not found', async () => {
      mockPrismaService.will.findFirst.mockResolvedValue(mockWill);
      mockPrismaService.beneficiaryDesignation.findFirst.mockResolvedValue(null);

      await expect(
        service.updateBeneficiary(mockWillId, 'invalid', {}, mockUserId)
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when updating beneficiary on executed will', async () => {
      const executedWill = { ...mockWill, status: WillStatus.executed };
      mockPrismaService.will.findFirst.mockResolvedValue(executedWill);

      await expect(
        service.updateBeneficiary(mockWillId, mockBeneficiaryId, { percentage: 50 }, mockUserId)
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.updateBeneficiary(mockWillId, mockBeneficiaryId, { percentage: 50 }, mockUserId)
      ).rejects.toThrow('Cannot modify an executed will');
    });
  });

  describe('removeBeneficiary', () => {
    it('should remove a beneficiary from a will', async () => {
      mockPrismaService.will.findFirst.mockResolvedValue(mockWill);
      mockPrismaService.beneficiaryDesignation.findFirst.mockResolvedValue(mockBeneficiary);
      mockPrismaService.beneficiaryDesignation.delete.mockResolvedValue(mockBeneficiary);

      await service.removeBeneficiary(mockWillId, mockBeneficiaryId, mockUserId);

      expect(mockPrismaService.beneficiaryDesignation.delete).toHaveBeenCalledWith({
        where: { id: mockBeneficiaryId },
      });
      expect(mockAuditService.log).toHaveBeenCalled();
    });

    it('should throw BadRequestException when removing from executed will', async () => {
      const executedWill = { ...mockWill, status: WillStatus.executed };
      mockPrismaService.will.findFirst.mockResolvedValue(executedWill);

      await expect(
        service.removeBeneficiary(mockWillId, mockBeneficiaryId, mockUserId)
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if beneficiary not found', async () => {
      mockPrismaService.will.findFirst.mockResolvedValue(mockWill);
      mockPrismaService.beneficiaryDesignation.findFirst.mockResolvedValue(null);

      await expect(
        service.removeBeneficiary(mockWillId, 'invalid-beneficiary', mockUserId)
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.removeBeneficiary(mockWillId, 'invalid-beneficiary', mockUserId)
      ).rejects.toThrow('Beneficiary designation not found');
    });
  });

  describe('addExecutor', () => {
    it('should add an executor to a will', async () => {
      const dto: AddExecutorDto = {
        executorId: mockMemberId,
        isPrimary: true,
        order: 1,
      };

      mockPrismaService.will.findFirst.mockResolvedValue(mockWill);
      mockPrismaService.householdMember.findFirst.mockResolvedValue(mockHousehold.members[0]);
      mockPrismaService.willExecutor.create.mockResolvedValue(mockExecutor);

      const result = await service.addExecutor(mockWillId, dto, mockUserId);

      expect(result).toEqual(mockExecutor);
      expect(mockPrismaService.willExecutor.create).toHaveBeenCalledWith({
        data: {
          willId: mockWillId,
          executorId: dto.executorId,
          isPrimary: dto.isPrimary,
          order: dto.order,
        },
        include: expect.any(Object),
      });
      expect(mockAuditService.log).toHaveBeenCalled();
    });

    it('should throw NotFoundException if executor not a household member', async () => {
      const dto: AddExecutorDto = {
        executorId: 'invalid-member',
        isPrimary: true,
        order: 1,
      };

      mockPrismaService.will.findFirst.mockResolvedValue(mockWill);
      mockPrismaService.householdMember.findFirst.mockResolvedValue(null);

      await expect(service.addExecutor(mockWillId, dto, mockUserId)).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw BadRequestException when adding to executed will', async () => {
      const executedWill = { ...mockWill, status: WillStatus.executed };
      const dto: AddExecutorDto = {
        executorId: mockMemberId,
        isPrimary: true,
        order: 1,
      };

      mockPrismaService.will.findFirst.mockResolvedValue(executedWill);

      await expect(service.addExecutor(mockWillId, dto, mockUserId)).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('updateExecutor', () => {
    it('should update an executor', async () => {
      const dto: UpdateExecutorDto = {
        isPrimary: false,
        order: 2,
        notes: 'Updated notes',
      };

      const updatedExecutor = { ...mockExecutor, ...dto };

      mockPrismaService.will.findFirst.mockResolvedValue(mockWill);
      mockPrismaService.willExecutor.findFirst.mockResolvedValue(mockExecutor);
      mockPrismaService.willExecutor.update.mockResolvedValue(updatedExecutor);

      const result = await service.updateExecutor(mockWillId, mockExecutorId, dto, mockUserId);

      expect(result.order).toBe(dto.order);
      expect(mockAuditService.log).toHaveBeenCalled();
    });

    it('should throw NotFoundException if executor not found', async () => {
      mockPrismaService.will.findFirst.mockResolvedValue(mockWill);
      mockPrismaService.willExecutor.findFirst.mockResolvedValue(null);

      await expect(service.updateExecutor(mockWillId, 'invalid', {}, mockUserId)).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw BadRequestException when updating executor on executed will', async () => {
      const executedWill = { ...mockWill, status: WillStatus.executed };
      mockPrismaService.will.findFirst.mockResolvedValue(executedWill);

      await expect(
        service.updateExecutor(mockWillId, mockExecutorId, { isPrimary: false }, mockUserId)
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.updateExecutor(mockWillId, mockExecutorId, { isPrimary: false }, mockUserId)
      ).rejects.toThrow('Cannot modify an executed will');
    });
  });

  describe('removeExecutor', () => {
    it('should remove an executor from a will', async () => {
      mockPrismaService.will.findFirst.mockResolvedValue(mockWill);
      mockPrismaService.willExecutor.findFirst.mockResolvedValue(mockExecutor);
      mockPrismaService.willExecutor.delete.mockResolvedValue(mockExecutor);

      await service.removeExecutor(mockWillId, mockExecutorId, mockUserId);

      expect(mockPrismaService.willExecutor.delete).toHaveBeenCalledWith({
        where: { id: mockExecutorId },
      });
      expect(mockAuditService.log).toHaveBeenCalled();
    });

    it('should throw BadRequestException when removing from executed will', async () => {
      const executedWill = { ...mockWill, status: WillStatus.executed };
      mockPrismaService.will.findFirst.mockResolvedValue(executedWill);

      await expect(service.removeExecutor(mockWillId, mockExecutorId, mockUserId)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should throw NotFoundException if executor not found', async () => {
      mockPrismaService.will.findFirst.mockResolvedValue(mockWill);
      mockPrismaService.willExecutor.findFirst.mockResolvedValue(null);

      await expect(
        service.removeExecutor(mockWillId, 'invalid-executor', mockUserId)
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.removeExecutor(mockWillId, 'invalid-executor', mockUserId)
      ).rejects.toThrow('Executor not found');
    });
  });
});
