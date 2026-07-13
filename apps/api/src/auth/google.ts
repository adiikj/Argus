import { createRemoteJWKSet, jwtVerify } from 'jose';

// jose (already a dependency) verifies Google's signed ID tokens directly
// against Google's public JWKS — no google-auth-library needed, same "plain
// fetch, no SDK" pattern as the LLMProvider integrations.
const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

export interface GoogleProfile {
  googleId: string;
  email: string;
  name?: string;
}

export async function verifyGoogleIdToken(
  idToken: string,
  clientId: string,
): Promise<GoogleProfile | undefined> {
  try {
    const { payload } = await jwtVerify(idToken, JWKS, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience: clientId,
    });
    if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') return undefined;
    if (payload.email_verified === false) return undefined;
    return {
      googleId: payload.sub,
      email: payload.email,
      name: typeof payload.name === 'string' ? payload.name : undefined,
    };
  } catch {
    return undefined;
  }
}
