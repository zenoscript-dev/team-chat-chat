import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import jwtConfig from './config/jwt.config';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule, // Register PassportModule without defaultStrategy
    ConfigModule.forRoot({
      load: [jwtConfig], // Ensure jwtConfig is loaded
    }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret'),
        signOptions: {
          expiresIn: configService.get<string>('jwt.signOptions.expiresIn'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [JwtStrategy], // Register JwtStrategy here
  exports: [JwtModule, PassportModule], // Export necessary modules
})
export class AuthModule {}
