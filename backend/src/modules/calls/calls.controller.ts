import { Controller, Get } from '@nestjs/common';

/**
 * WebRTC ICE configuration. Served from the API so we can add/rotate STUN/TURN
 * servers later without shipping an app update. Free Google STUN by default.
 */
@Controller('calls')
export class CallsController {
  @Get('ice-servers')
  iceServers() {
    const custom = process.env.TURN_URL
      ? [
          {
            urls: process.env.TURN_URL,
            username: process.env.TURN_USERNAME,
            credential: process.env.TURN_CREDENTIAL,
          },
        ]
      : [];
    return {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        ...custom,
      ],
    };
  }
}
