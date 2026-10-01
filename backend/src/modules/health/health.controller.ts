import { Controller, Get } from '@nestjs/common';
import { HealthService, type HealthReport } from './health.service.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { SkipThrottle } from '@nestjs/throttler';

/**
 * Public, unauthenticated endpoint: GET /api/v1/health
 */
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get()
  check(): Promise<HealthReport> {
    return this.healthService.check();
  }

  /**
   * GET /api/v1/health/live — liveness WITHOUT touching the database. Use it for
   * the hosting health check and keep-awake pings so a free scale-to-zero
   * database (Neon) can sleep when nobody is using the app.
   */
  @Public()
  @SkipThrottle()
  @Get('live')
  live() {
    return { status: 'ok', uptimeSeconds: Math.round(process.uptime()) };
  }
}
