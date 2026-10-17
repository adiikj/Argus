'use client';

import { useEffect, useState } from 'react';
import { getRole, type SessionRole } from './auth';

// read after mount — sessionStorage doesn't exist during server render, and
// reading it in render would make the first client paint disagree with it.
export function useSessionRole(): SessionRole | null {
  const [role, setRole] = useState<SessionRole | null>(null);
  useEffect(() => setRole(getRole()), []);
  return role;
}
