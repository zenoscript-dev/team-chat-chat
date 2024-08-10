import { Module } from '@nestjs/common';
import { ImageUploaderService } from './image-uploader.service';
import { ImageUploaderController } from './image-uploader.controller';
import { MinioClientModule } from 'src/minio-client/minio-client.module';

@Module({
  imports: [MinioClientModule],
  controllers: [ImageUploaderController],
  providers: [ImageUploaderService]
})
export class ImageUploaderModule {}
