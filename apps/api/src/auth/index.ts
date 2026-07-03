export { signToken, verifyToken } from './token.js';

export interface AuthOptions {
  sitePassword: string;
  authSecret: string;
}
