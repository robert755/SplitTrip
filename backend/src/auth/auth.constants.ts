export const REFRESH_TOKEN_COOKIE = 'splittrip_refresh';
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const ACCESS_TOKEN_TTL = '15m';

export function getAccessTokenSecret(): string {
  const secret = process.env['JWT_ACCESS_SECRET'];
  if (!secret || Buffer.byteLength(secret, 'utf8') < 32) {
    throw new Error('JWT_ACCESS_SECRET must contain at least 32 characters.');
  }
  return secret;
}

export function getAllowedFrontendOrigins(): string[] {
  const configuredOrigins = process.env['FRONTEND_ORIGINS'];
  const origins = configuredOrigins
    ? configuredOrigins.split(',').map((origin) => origin.trim())
    : process.env['NODE_ENV'] === 'production'
      ? []
      : ['http://localhost:3001'];

  for (const origin of origins) {
    if (!origin || new URL(origin).origin !== origin) {
      throw new Error('FRONTEND_ORIGINS must contain valid origins without paths.');
    }
  }

  return origins;
}
