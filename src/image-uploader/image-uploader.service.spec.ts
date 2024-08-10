import { Test, TestingModule } from '@nestjs/testing';
import { ImageUploaderService } from './image-uploader.service';

describe('ImageUploaderService', () => {
  let service: ImageUploaderService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ImageUploaderService],
    }).compile();

    service = module.get<ImageUploaderService>(ImageUploaderService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
