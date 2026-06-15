import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Test } from '@nestjs/testing';
import { AuthUser } from '../auth/auth-user.interface';
import { OrganizationsRepository } from '../organizations/organizations.repository';
import { SongsRepository } from '../songs/songs.repository';
import { PitchesRepository } from './pitches.repository';
import { PitchesService } from './pitches.service';
import { CreatePitchDto } from './dto/create-pitch.dto';

const manager: AuthUser = {
  id: 'mgr-1',
  name: 'Mgr',
  email: 'mgr@x.com',
  role: UserRole.MANAGER,
};
const songwriter: AuthUser = { ...manager, id: 'sw-1', role: UserRole.SONGWRITER };

describe('PitchesService', () => {
  let service: PitchesService;
  let pitchesRepo: jest.Mocked<PitchesRepository>;
  let songsRepo: jest.Mocked<SongsRepository>;
  let orgRepo: jest.Mocked<OrganizationsRepository>;

  const dto: CreatePitchDto = { description: 'A pitch', tags: ['pop'] };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PitchesService,
        { provide: PitchesRepository, useValue: { create: jest.fn(), findById: jest.fn() } },
        { provide: SongsRepository, useValue: { findById: jest.fn() } },
        { provide: OrganizationsRepository, useValue: { findMembership: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(PitchesService);
    pitchesRepo = moduleRef.get(PitchesRepository);
    songsRepo = moduleRef.get(SongsRepository);
    orgRepo = moduleRef.get(OrganizationsRepository);
  });

  it('throws NotFound when the song does not exist', async () => {
    songsRepo.findById.mockResolvedValue(null);
    await expect(service.create(manager, 'missing', dto)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('forbids non-managers from creating a pitch', async () => {
    songsRepo.findById.mockResolvedValue({ id: 's1', organizationId: 'org1' } as never);
    await expect(service.create(songwriter, 's1', dto)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('forbids a manager who is not a member of the song’s org', async () => {
    songsRepo.findById.mockResolvedValue({ id: 's1', organizationId: 'org1' } as never);
    orgRepo.findMembership.mockResolvedValue(null);
    await expect(service.create(manager, 's1', dto)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('creates a pitch for a manager who is a member', async () => {
    songsRepo.findById.mockResolvedValue({ id: 's1', organizationId: 'org1' } as never);
    orgRepo.findMembership.mockResolvedValue({ id: 'm1' } as never);
    pitchesRepo.create.mockResolvedValue({ id: 'p1' } as never);

    const result = await service.create(manager, 's1', dto);

    expect(result).toEqual({ id: 'p1' });
    expect(pitchesRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ songId: 's1', createdById: 'mgr-1', description: 'A pitch' }),
    );
  });
});
