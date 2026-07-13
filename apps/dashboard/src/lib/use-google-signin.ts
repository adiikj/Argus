'use client';

import { useEffect, useRef } from 'react';

// Google's Identity Services script exposes this global once loaded — only
// the slice of its shape we actually call is declared, no @types package.
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }): void;
          renderButton(
            parent: HTMLElement,
            options: { theme?: string; size?: string; width?: number },
          ): void;
        };
      };
    };
  }
}

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
export const GOOGLE_BUTTON_ELEMENT_ID = 'google-signin-button';

function loadScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${SCRIPT_SRC}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('failed to load Google Identity Services script'));
    document.head.appendChild(script);
  });
}

// Renders Google's own "Sign in with Google" button into #google-signin-button
// once NEXT_PUBLIC_GOOGLE_CLIENT_ID is set — Google's hosted script handles the
// whole flow client-side and hands back a signed ID token via `onCredential`,
// no OAuth redirect/code-exchange or extra npm package needed.
export function useGoogleSignIn(onCredential: (credential: string) => void): { enabled: boolean } {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const onCredentialRef = useRef(onCredential);
  onCredentialRef.current = onCredential;

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;

    loadScript()
      .then(() => {
        if (cancelled || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => onCredentialRef.current(response.credential),
        });
        const el = document.getElementById(GOOGLE_BUTTON_ELEMENT_ID);
        if (el) {
          window.google.accounts.id.renderButton(el, {
            theme: 'outline',
            size: 'large',
            width: 320,
          });
        }
      })
      .catch(() => {
        // Google's script is unreachable (offline, blocked) — email+password
        // login still works, so this fails silently rather than surfacing an
        // error for a feature the user may not even be trying to use.
      });

    return () => {
      cancelled = true;
    };
  }, [clientId]);

  return { enabled: Boolean(clientId) };
}
