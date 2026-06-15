import { Test } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import { AuthUser } from '../auth/auth-user.interface';
import { OrganizationsRepository } from '../organizations/organizations.repository';
import { STORAGE_SERVICE } from '../storage/storage.service';
import { SongsRepository } from './songs.repository';
import { SongsService } from './songs.service';
import { CreateSongDto } from './dto/create-song.dto';

const songwriter: AuthUser = {
  id: 'sw-1',
  name: 'SW',
  email: 'sw@x.com',
  role: UserRole.SONGWRITER,
};

const file = {
  buffer: Buffer.from('audio'),
  mimetype: 'audio/mpeg',
  originalname: 'demo.mp3',
} as Express.Multer.File;

describe('SongsService', () => {
  let service: SongsService;
  let songsRepo: jest.Mocked<SongsRepository>;
  let orgRepo: jest.Mocked<OrganizationsRepository>;
  let storage: { put: jest.Mock; getStream: jest.Mock; remove: jest.Mock };

  const dto: CreateSongDto = { organizationId: 'org1', title: 'My Demo' };

  beforeEach(async () => {
    storage = { put: jest.fn(), getStream: jest.fn(), remove: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        SongsService,
        { provide: SongsRepository, useValue: { create: jest.fn(), findManyAndCount: jest.fn() } },
        {
          provide: OrganizationsRepository,
          useValue: { findMembership: jest.fn(), findForUser: jest.fn() },
        },
        { provide: STORAGE_SERVICE, useValue: storage },
      ],
    }).compile();

    service = moduleRef.get(SongsService);
    songsRepo = moduleRef.get(SongsRepository);
    orgRepo = moduleRef.get(OrganizationsRepository);
  });

  it('removes the stored file if the DB write fails (no orphans)', async () => {
    orgRepo.findMembership.mockResolvedValue({ id: 'm1' } as never);
    storage.put.mockResolvedValue({ storageKey: 'key.mp3', sizeBytes: 5 });
    songsRepo.create.mockRejectedValue(new Error('db down'));

    await expect(service.upload(songwriter, dto, file)).rejects.toThrow('db down');
    expect(storage.remove).toHaveBeenCalledWith('key.mp3');
  });

  it('returns an empty page when the user belongs to no organizations', async () => {
    orgRepo.findForUser.mockResolvedValue([]);
    const result = await service.list(songwriter, { page: 1, limit: 20, skip: 0 });
    expect(result.data).toHaveLength(0);
    expect(result.meta.total).toBe(0);
  });
});
