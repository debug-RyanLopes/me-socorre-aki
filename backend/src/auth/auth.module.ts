import { Global, Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthController, LoginThrottlerGuard } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';

@Global()
@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: Number(process.env.LOGIN_RATE_LIMIT ?? 5) }])],
  controllers: [AuthController],
  providers: [AuthService, PasswordService, SessionService, LoginThrottlerGuard],
  exports: [AuthService, PasswordService, SessionService],
})
export class AuthModule {}
