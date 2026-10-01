import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MediaController } from './media.controller.js';
import { MediaService } from './media.service.js';
import { LocalStorageDriver } from './storage/local-storage.driver.js';
import { CloudinaryStorageDriver, parseCloudinaryUrl } from './storage/cloudinary-storage.driver.js';
import { STORAGE_DRIVER } from './storage/storage.types.js';

/**
 * Media uploads. The storage backend is bound behind STORAGE_DRIVER, so
 * swapping local disk for a cloud driver later is a one-line change here.
 */
@Module({
  controllers: [MediaController],
  providers: [
    MediaService,
    {
      // Cloud (Cloudinary) when CLOUDINARY_URL is set — required on hosts with
      // a wiped-on-restart disk (e.g. Render free). Local disk otherwise (dev).
      provide: STORAGE_DRIVER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        if (parseCloudinaryUrl(config.get<string>('CLOUDINARY_URL'))) {
          new Logger('MediaModule').log('Media storage: Cloudinary');
          return new CloudinaryStorageDriver(config);
        }
        new Logger('MediaModule').log('Media storage: local disk');
        return new LocalStorageDriver(config);
      },
    },
  ],
})
export class MediaModule {}
