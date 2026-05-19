import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { AuditService } from '../../core/audit/audit.service';
import { PrismaService } from '../../core/prisma/prisma.service';

import { CreateHouseholdDto, UpdateHouseholdDto, AddMemberDto, UpdateMemberDto } from './dto';
import { HouseholdsService } from './households.service';

// Using string literals instead of enums since Prisma client may not be generated
const HouseholdType = {
  family: 'family' as const,
  individual: 'individual' as const,
  trust: 'trust' as const,
  estate: 'estate' as const,
};

const RelationshipType = {
  spouse: 'spouse' as const,
  child: 'child' as const,
  parent: 'parent' as const,
  grandparent: 'grandparent' as const,
  grandchild: 'grandchild' as const,
  sibling: 'sibling' as const,
  other: 'other' as const,
};

const Currency = {
  USD: 'USD' as const,
  MXN: 'MXN' as const,
  EUR: 'EUR' as const,
};

describe('HouseholdsService', () => {
  let service: HouseholdsService;
  let prisma: PrismaService;
  let auditService: AuditService;

  const mockUserId = 'user-123';
  const mockHouseholdId = 'household-123';
  const mockMemberId = 'member-123';

  const mockHousehold = {
    id: mockHouseholdId,
    name: 'Smith Family',
    type: HouseholdType.family,
    baseCurrency: Currency.USD,
    description: 'Main family household',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    members: [
      {
        id: mockMemberId,
        householdId: mockHouseholdId,
        userId: mockUserId,
        relationship: RelationshipType.spouse,
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
    spaces: [],
    goals: [],
  };

  const mockPrismaService = {
    household: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    householdMember: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    space: {
      findMany: jest.fn(),
    },
    goal: {
      findMany: jest.fn(),
    },
  };

  const mockAuditService = {
    log: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HouseholdsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<HouseholdsService>(HouseholdsService);
    prisma = module.get<PrismaService>(PrismaService);
    auditService = module.get<AuditService>(AuditService);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new household', async () => {
      const dto: CreateHouseholdDto = {
        name: 'Smith Family',
        type: HouseholdType.family,
        baseCurrency: Currency.USD,
        description: 'Main family household',
      };

      mockPrismaService.household.create.mockResolvedValue(mockHousehold);

      const result = await service.create(dto, mockUserId);

      expect(result).toEqual(mockHousehold);
      expect(mockPrismaService.household.create).toHaveBeenCalledWith({
        data: {
          name: dto.name,
          type: dto.type,
          baseCurrency: dto.baseCurrency,
          description: dto.description,
          members: {
            create: {
              userId: mockUserId,
              relationship: 'other',
              isMinor: false,
            },
          },
        },
        include: {
          members: true,
        },
      });
      expect(mockAuditService.log).toHaveBeenCalled();
    });

    it('should create household with default values', async () => {
      const dto: CreateHouseholdDto = {
        name: 'Smith Family',
      };

      mockPrismaService.household.create.mockResolvedValue(mockHousehold);

      await service.create(dto, mockUserId);

      expect(mockPrismaService.household.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'family',
            baseCurrency: 'USD',
          }),
        })
      );
    });
  });

  describe('findById', () => {
    it('should find a household by ID', async () => {
      mockPrismaService.household.findFirst.mockResolvedValue(mockHousehold);

      const result = await service.findById(mockHouseholdId, mockUserId);

      expect(result).toEqual(mockHousehold);
      expect(mockPrismaService.household.findFirst).toHaveBeenCalledWith({
        where: {
          id: mockHouseholdId,
          members: {
            some: {
              userId: mockUserId,
            },
          },
        },
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException if household not found', async () => {
      mockPrismaService.household.findFirst.mockResolvedValue(null);

      await expect(service.findById(mockHouseholdId, mockUserId)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('findByUser', () => {
    it('should find all households for a user', async () => {
      const households = [mockHousehold];
      mockPrismaService.household.findMany.mockResolvedValue(households);

      const result = await service.findByUser(mockUserId);

      expect(result).toEqual(households);
      expect(mockPrismaService.household.findMany).toHaveBeenCalledWith({
        where: {
          members: {
            some: {
              userId: mockUserId,
            },
          },
        },
        include: expect.any(Object),
        orderBy: {
          createdAt: 'desc',
        },
      });
    });
  });

  describe('update', () => {
    it('should update a household', async () => {
      const dto: UpdateHouseholdDto = {
        name: 'Updated Family',
        description: 'Updated description',
      };

      mockPrismaService.household.findFirst.mockResolvedValue(mockHousehold);
      mockPrismaService.household.update.mockResolvedValue({
        ...mockHousehold,
        ...dto,
      });

      const result = await service.update(mockHouseholdId, dto, mockUserId);

      expect(result.name).toBe(dto.name);
      expect(mockPrismaService.household.update).toHaveBeenCalled();
      expect(mockAuditService.log).toHaveBeenCalled();
    });

    it('should throw NotFoundException if household not found', async () => {
      mockPrismaService.household.findFirst.mockResolvedValue(null);

      await expect(service.update(mockHouseholdId, {}, mockUserId)).rejects.toThrow(
        NotFoundException
      );
    });

    it('should update household type', async () => {
      const dto: UpdateHouseholdDto = {
        type: HouseholdType.trust,
      };

      mockPrismaService.household.findFirst.mockResolvedValue(mockHousehold);
      mockPrismaService.household.update.mockResolvedValue({
        ...mockHousehold,
        type: HouseholdType.trust,
      });

      const result = await service.update(mockHouseholdId, dto, mockUserId);

      expect(result.type).toBe(HouseholdType.trust);
      expect(mockPrismaService.household.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: HouseholdType.trust,
          }),
        })
      );
    });

    it('should update household baseCurrency', async () => {
      const dto: UpdateHouseholdDto = {
        baseCurrency: Currency.MXN,
      };

      mockPrismaService.household.findFirst.mockResolvedValue(mockHousehold);
      mockPrismaService.household.update.mockResolvedValue({
        ...mockHousehold,
        baseCurrency: Currency.MXN,
      });

      const result = await service.update(mockHouseholdId, dto, mockUserId);

      expect(result.baseCurrency).toBe(Currency.MXN);
      expect(mockPrismaService.household.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            baseCurrency: Currency.MXN,
          }),
        })
      );
    });
  });

  describe('delete', () => {
    it('should delete a household', async () => {
      mockPrismaService.household.findFirst.mockResolvedValue(mockHousehold);
      mockPrismaService.household.findUnique.mockResolvedValue({
        ...mockHousehold,
        _count: { spaces: 0, goals: 0 },
      });
      mockPrismaService.household.delete.mockResolvedValue(mockHousehold);

      await service.delete(mockHouseholdId, mockUserId);

      expect(mockPrismaService.household.delete).toHaveBeenCalledWith({
        where: { id: mockHouseholdId },
      });
      expect(mockAuditService.log).toHaveBeenCalled();
    });

    it('should throw BadRequestException if household has spaces', async () => {
      mockPrismaService.household.findFirst.mockResolvedValue(mockHousehold);
      mockPrismaService.household.findUnique.mockResolvedValue({
        ...mockHousehold,
        _count: { spaces: 1, goals: 0 },
      });

      await expect(service.delete(mockHouseholdId, mockUserId)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should throw BadRequestException if household has goals', async () => {
      mockPrismaService.household.findFirst.mockResolvedValue(mockHousehold);
      mockPrismaService.household.findUnique.mockResolvedValue({
        ...mockHousehold,
        _count: { spaces: 0, goals: 1 },
      });

      await expect(service.delete(mockHouseholdId, mockUserId)).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('addMember', () => {
    it('should add a member to household', async () => {
      const dto: AddMemberDto = {
        userId: 'user-456',
        relationship: RelationshipType.child,
        isMinor: true,
      };

      const newMember = {
        id: 'member-456',
        householdId: mockHouseholdId,
        userId: dto.userId,
        relationship: dto.relationship,
        isMinor: dto.isMinor,
        accessStartDate: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: {
          id: dto.userId,
          name: 'Jane Smith',
          email: 'jane@example.com',
          dateOfBirth: new Date('2010-01-01'),
        },
      };

      mockPrismaService.household.findFirst.mockResolvedValue(mockHousehold);
      mockPrismaService.user.findUnique.mockResolvedValue({ id: dto.userId });
      mockPrismaService.householdMember.findUnique.mockResolvedValue(null);
      mockPrismaService.householdMember.create.mockResolvedValue(newMember);

      const result = await service.addMember(mockHouseholdId, dto, mockUserId);

      expect(result).toEqual(newMember);
      expect(mockPrismaService.householdMember.create).toHaveBeenCalled();
      expect(mockAuditService.log).toHaveBeenCalled();
    });

    it('should throw NotFoundException if user not found', async () => {
      const dto: AddMemberDto = {
        userId: 'user-456',
        relationship: RelationshipType.child,
      };

      mockPrismaService.household.findFirst.mockResolvedValue(mockHousehold);
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.addMember(mockHouseholdId, dto, mockUserId)).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw BadRequestException if user already a member', async () => {
      const dto: AddMemberDto = {
        userId: mockUserId,
        relationship: RelationshipType.spouse,
      };

      mockPrismaService.household.findFirst.mockResolvedValue(mockHousehold);
      mockPrismaService.user.findUnique.mockResolvedValue({ id: mockUserId });
      mockPrismaService.householdMember.findUnique.mockResolvedValue({
        id: mockMemberId,
      });

      await expect(service.addMember(mockHouseholdId, dto, mockUserId)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should add member with accessStartDate', async () => {
      const dto: AddMemberDto = {
        userId: 'user-456',
        relationship: RelationshipType.child,
        accessStartDate: '2024-06-01',
      };

      const newMember = {
        id: 'member-456',
        householdId: mockHouseholdId,
        userId: dto.userId,
        relationship: dto.relationship,
        isMinor: false,
        accessStartDate: new Date('2024-06-01'),
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: {
          id: dto.userId,
          name: 'Jane Smith',
          email: 'jane@example.com',
          dateOfBirth: new Date('2010-01-01'),
        },
      };

      mockPrismaService.household.findFirst.mockResolvedValue(mockHousehold);
      mockPrismaService.user.findUnique.mockResolvedValue({ id: dto.userId });
      mockPrismaService.householdMember.findUnique.mockResolvedValue(null);
      mockPrismaService.householdMember.create.mockResolvedValue(newMember);

      const result = await service.addMember(mockHouseholdId, dto, mockUserId);

      expect(result.accessStartDate).toEqual(new Date('2024-06-01'));
      expect(mockPrismaService.householdMember.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            accessStartDate: new Date('2024-06-01'),
          }),
        })
      );
    });

    it('should add member without isMinor (defaults to false)', async () => {
      const dto: AddMemberDto = {
        userId: 'user-789',
        relationship: RelationshipType.grandparent,
      };

      const newMember = {
        id: 'member-789',
        householdId: mockHouseholdId,
        userId: dto.userId,
        relationship: dto.relationship,
        isMinor: false,
        accessStartDate: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: {
          id: dto.userId,
          name: 'Grandparent Smith',
          email: 'grandparent@example.com',
          dateOfBirth: new Date('1950-01-01'),
        },
      };

      mockPrismaService.household.findFirst.mockResolvedValue(mockHousehold);
      mockPrismaService.user.findUnique.mockResolvedValue({ id: dto.userId });
      mockPrismaService.householdMember.findUnique.mockResolvedValue(null);
      mockPrismaService.householdMember.create.mockResolvedValue(newMember);

      await service.addMember(mockHouseholdId, dto, mockUserId);

      expect(mockPrismaService.householdMember.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isMinor: false,
          }),
        })
      );
    });
  });

  describe('updateMember', () => {
    const mockUpdatedMember = {
      ...mockHousehold.members[0],
      relationship: RelationshipType.parent,
      isMinor: false,
      accessStartDate: new Date('2024-06-01'),
      notes: 'Updated notes',
      updatedAt: new Date('2024-01-15'),
    };

    it('should update a member with all fields', async () => {
      const dto: UpdateMemberDto = {
        relationship: RelationshipType.parent,
        isMinor: false,
        accessStartDate: '2024-06-01',
        notes: 'Updated notes',
      };

      mockPrismaService.household.findFirst.mockResolvedValue(mockHousehold);
      mockPrismaService.householdMember.findFirst.mockResolvedValue(mockHousehold.members[0]);
      mockPrismaService.householdMember.update.mockResolvedValue(mockUpdatedMember);

      const result = await service.updateMember(mockHouseholdId, mockMemberId, dto, mockUserId);

      expect(result).toEqual(mockUpdatedMember);
      expect(mockPrismaService.householdMember.update).toHaveBeenCalledWith({
        where: { id: mockMemberId },
        data: {
          relationship: RelationshipType.parent,
          isMinor: false,
          accessStartDate: new Date('2024-06-01'),
          notes: 'Updated notes',
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              dateOfBirth: true,
            },
          },
        },
      });
      expect(mockAuditService.log).toHaveBeenCalledWith({
        userId: mockUserId,
        action: 'HOUSEHOLD_MEMBER_UPDATED',
        resource: 'household',
        resourceId: mockHouseholdId,
        severity: 'low',
        metadata: {
          memberId: mockMemberId,
          changes: ['relationship', 'isMinor', 'accessStartDate', 'notes'],
        },
      });
    });

    it('should update only relationship field', async () => {
      const dto: UpdateMemberDto = {
        relationship: RelationshipType.child,
      };

      mockPrismaService.household.findFirst.mockResolvedValue(mockHousehold);
      mockPrismaService.householdMember.findFirst.mockResolvedValue(mockHousehold.members[0]);
      mockPrismaService.householdMember.update.mockResolvedValue({
        ...mockHousehold.members[0],
        relationship: RelationshipType.child,
      });

      await service.updateMember(mockHouseholdId, mockMemberId, dto, mockUserId);

      expect(mockPrismaService.householdMember.update).toHaveBeenCalledWith({
        where: { id: mockMemberId },
        data: {
          relationship: RelationshipType.child,
        },
        include: expect.any(Object),
      });
    });

    it('should update only isMinor field', async () => {
      const dto: UpdateMemberDto = {
        isMinor: true,
      };

      mockPrismaService.household.findFirst.mockResolvedValue(mockHousehold);
      mockPrismaService.householdMember.findFirst.mockResolvedValue(mockHousehold.members[0]);
      mockPrismaService.householdMember.update.mockResolvedValue({
        ...mockHousehold.members[0],
        isMinor: true,
      });

      await service.updateMember(mockHouseholdId, mockMemberId, dto, mockUserId);

      expect(mockPrismaService.householdMember.update).toHaveBeenCalledWith({
        where: { id: mockMemberId },
        data: {
          isMinor: true,
        },
        include: expect.any(Object),
      });
    });

    it('should update accessStartDate with a valid date', async () => {
      const dto: UpdateMemberDto = {
        accessStartDate: '2024-12-01',
      };

      mockPrismaService.household.findFirst.mockResolvedValue(mockHousehold);
      mockPrismaService.householdMember.findFirst.mockResolvedValue(mockHousehold.members[0]);
      mockPrismaService.householdMember.update.mockResolvedValue({
        ...mockHousehold.members[0],
        accessStartDate: new Date('2024-12-01'),
      });

      await service.updateMember(mockHouseholdId, mockMemberId, dto, mockUserId);

      expect(mockPrismaService.householdMember.update).toHaveBeenCalledWith({
        where: { id: mockMemberId },
        data: {
          accessStartDate: new Date('2024-12-01'),
        },
        include: expect.any(Object),
      });
    });

    it('should update accessStartDate to null when empty string provided', async () => {
      const dto: UpdateMemberDto = {
        accessStartDate: '',
      };

      mockPrismaService.household.findFirst.mockResolvedValue(mockHousehold);
      mockPrismaService.householdMember.findFirst.mockResolvedValue(mockHousehold.members[0]);
      mockPrismaService.householdMember.update.mockResolvedValue({
        ...mockHousehold.members[0],
        accessStartDate: null,
      });

      await service.updateMember(mockHouseholdId, mockMemberId, dto, mockUserId);

      expect(mockPrismaService.householdMember.update).toHaveBeenCalledWith({
        where: { id: mockMemberId },
        data: {
          accessStartDate: null,
        },
        include: expect.any(Object),
      });
    });

    it('should update only notes field', async () => {
      const dto: UpdateMemberDto = {
        notes: 'Special family member',
      };

      mockPrismaService.household.findFirst.mockResolvedValue(mockHousehold);
      mockPrismaService.householdMember.findFirst.mockResolvedValue(mockHousehold.members[0]);
      mockPrismaService.householdMember.update.mockResolvedValue({
        ...mockHousehold.members[0],
        notes: 'Special family member',
      });

      await service.updateMember(mockHouseholdId, mockMemberId, dto, mockUserId);

      expect(mockPrismaService.householdMember.update).toHaveBeenCalledWith({
        where: { id: mockMemberId },
        data: {
          notes: 'Special family member',
        },
        include: expect.any(Object),
      });
    });

    it('should update notes to empty string', async () => {
      const dto: UpdateMemberDto = {
        notes: '',
      };

      mockPrismaService.household.findFirst.mockResolvedValue(mockHousehold);
      mockPrismaService.householdMember.findFirst.mockResolvedValue(mockHousehold.members[0]);
      mockPrismaService.householdMember.update.mockResolvedValue({
        ...mockHousehold.members[0],
        notes: '',
      });

      await service.updateMember(mockHouseholdId, mockMemberId, dto, mockUserId);

      expect(mockPrismaService.householdMember.update).toHaveBeenCalledWith({
        where: { id: mockMemberId },
        data: {
          notes: '',
        },
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException when member not found', async () => {
      const dto: UpdateMemberDto = {
        relationship: RelationshipType.child,
      };

      mockPrismaService.household.findFirst.mockResolvedValue(mockHousehold);
      mockPrismaService.householdMember.findFirst.mockResolvedValue(null);

      await expect(
        service.updateMember(mockHouseholdId, mockMemberId, dto, mockUserId)
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when household not found', async () => {
      const dto: UpdateMemberDto = {
        relationship: RelationshipType.child,
      };

      mockPrismaService.household.findFirst.mockResolvedValue(null);

      await expect(
        service.updateMember(mockHouseholdId, mockMemberId, dto, mockUserId)
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle isMinor set to false explicitly', async () => {
      const dto: UpdateMemberDto = {
        isMinor: false,
      };

      mockPrismaService.household.findFirst.mockResolvedValue(mockHousehold);
      mockPrismaService.householdMember.findFirst.mockResolvedValue({
        ...mockHousehold.members[0],
        isMinor: true,
      });
      mockPrismaService.householdMember.update.mockResolvedValue({
        ...mockHousehold.members[0],
        isMinor: false,
      });

      await service.updateMember(mockHouseholdId, mockMemberId, dto, mockUserId);

      expect(mockPrismaService.householdMember.update).toHaveBeenCalledWith({
        where: { id: mockMemberId },
        data: {
          isMinor: false,
        },
        include: expect.any(Object),
      });
    });

    it('should not include undefined fields in update data', async () => {
      const dto: UpdateMemberDto = {
        relationship: RelationshipType.sibling,
      };

      mockPrismaService.household.findFirst.mockResolvedValue(mockHousehold);
      mockPrismaService.householdMember.findFirst.mockResolvedValue(mockHousehold.members[0]);
      mockPrismaService.householdMember.update.mockResolvedValue({
        ...mockHousehold.members[0],
        relationship: RelationshipType.sibling,
      });

      await service.updateMember(mockHouseholdId, mockMemberId, dto, mockUserId);

      const updateCall = mockPrismaService.householdMember.update.mock.calls[0][0];
      expect(updateCall.data).not.toHaveProperty('isMinor');
      expect(updateCall.data).not.toHaveProperty('accessStartDate');
      expect(updateCall.data).not.toHaveProperty('notes');
    });
  });

  describe('removeMember', () => {
    it('should remove a member from household', async () => {
      mockPrismaService.household.findFirst.mockResolvedValue(mockHousehold);
      mockPrismaService.householdMember.findFirst.mockResolvedValue(mockHousehold.members[0]);
      mockPrismaService.householdMember.count.mockResolvedValue(2);
      mockPrismaService.householdMember.delete.mockResolvedValue(mockHousehold.members[0]);

      await service.removeMember(mockHouseholdId, mockMemberId, mockUserId);

      expect(mockPrismaService.householdMember.delete).toHaveBeenCalledWith({
        where: { id: mockMemberId },
      });
      expect(mockAuditService.log).toHaveBeenCalled();
    });

    it('should throw BadRequestException if last member', async () => {
      mockPrismaService.household.findFirst.mockResolvedValue(mockHousehold);
      mockPrismaService.householdMember.findFirst.mockResolvedValue(mockHousehold.members[0]);
      mockPrismaService.householdMember.count.mockResolvedValue(1);

      await expect(service.removeMember(mockHouseholdId, mockMemberId, mockUserId)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should throw NotFoundException if member not found', async () => {
      mockPrismaService.household.findFirst.mockResolvedValue(mockHousehold);
      mockPrismaService.householdMember.findFirst.mockResolvedValue(null);

      await expect(service.removeMember(mockHouseholdId, mockMemberId, mockUserId)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('getNetWorth', () => {
    it('should calculate household net worth', async () => {
      const spaces = [
        {
          id: 'space-1',
          name: 'Personal',
          accounts: [
            {
              id: 'acc-1',
              name: 'Checking',
              type: 'checking',
              currency: Currency.USD,
              balance: 5000,
            },
            {
              id: 'acc-2',
              name: 'Credit Card',
              type: 'credit',
              currency: Currency.USD,
              balance: -1000,
            },
          ],
        },
      ];

      mockPrismaService.household.findFirst.mockResolvedValue(mockHousehold);
      mockPrismaService.space.findMany.mockResolvedValue(spaces);

      const result = await service.getNetWorth(mockHouseholdId, mockUserId);

      expect(result.totalNetWorth).toBe(4000); // 5000 - 1000
      expect(result.bySpace).toHaveLength(1);
      expect(result.bySpace[0].netWorth).toBe(4000);
      expect(result.bySpace[0].assets).toBe(5000);
      expect(result.bySpace[0].liabilities).toBe(1000);
    });
  });

  describe('getGoalSummary', () => {
    it('should calculate household goal summary', async () => {
      const goals = [
        {
          id: 'goal-1',
          type: 'retirement',
          status: 'active',
          targetAmount: 1000000,
        },
        {
          id: 'goal-2',
          type: 'education',
          status: 'active',
          targetAmount: 50000,
        },
        {
          id: 'goal-3',
          type: 'retirement',
          status: 'achieved',
          targetAmount: 100000,
        },
      ];

      mockPrismaService.household.findFirst.mockResolvedValue(mockHousehold);
      mockPrismaService.goal.findMany.mockResolvedValue(goals);

      const result = await service.getGoalSummary(mockHouseholdId, mockUserId);

      expect(result.totalGoals).toBe(3);
      expect(result.activeGoals).toBe(2);
      expect(result.achievedGoals).toBe(1);
      expect(result.totalTargetAmount).toBe(1150000);
      expect(result.byType.retirement).toBe(2);
      expect(result.byType.education).toBe(1);
    });
  });
});
