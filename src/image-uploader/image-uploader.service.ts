import { Injectable } from '@nestjs/common';
import { BufferedFile } from 'src/minio-client/file.model';
import { MinioClientService } from 'src/minio-client/minio-client.service';

@Injectable()
export class ImageUploaderService {
  constructor(private minioClientService: MinioClientService) {}

  async uploadImage(image: BufferedFile) {
    const uploaded_image = await this.minioClientService.upload(image, {
      id: 'dsaa',
      referenceId: 'eqeqe',
      referenceType: 'blahblah',
    });

    return {
      image_url: uploaded_image.url,
      message: 'Image upload successful',
    };
  }

  async getFile(key: string) {
    return await this.minioClientService.get(key);
  }
}
