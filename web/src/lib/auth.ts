import { useSyncExternalStore } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import {
  clearAdminToken,
  clearAgentToken,
  getAuthVersion,
  subscribeAuth,
} from './api';

export type SignOutKind = 'agent' | 'admin';

type SignOutListener = () => void;
const signOutListeners = new Set<SignOutListener>();
let signOutPending: SignOutKind | null = null;

function subscribeSignOut(listener: SignOutListener): () => void {
  signOutListeners.add(listener);
  return () => signOutListeners.delete(listener);
}

function getSignOutPending(): SignOutKind | null {
  return signOutPending;
}

function setSignOutPending(kind: SignOutKind | null): void {
  signOutPending = kind;
  signOutListeners.forEach((l) => l());
}

const SIGN_OUT_DELAY_MS = 500;

/** Re-render route guards when tokens change (sign-in / sign-out). */
export function useAuthVersion(): number {
  return useSyncExternalStore(subscribeAuth, getAuthVersion, getAuthVersion);
}

export function useSignOutPending(): SignOutKind | null {
  return useSyncExternalStore(subscribeSignOut, getSignOutPending, getSignOutPending);
}

export async function signOutAgent(navigate: NavigateFunction): Promise<void> {
  if (signOutPending) return;
  setSignOutPending('agent');
  try {
    await new Promise((r) => setTimeout(r, SIGN_OUT_DELAY_MS));
    clearAgentToken();
    navigate('/', { replace: true });
  } finally {
    setSignOutPending(null);
  }
}

export async function signOutAdmin(navigate: NavigateFunction): Promise<void> {
  if (signOutPending) return;
  setSignOutPending('admin');
  try {
    await new Promise((r) => setTimeout(r, SIGN_OUT_DELAY_MS));
    clearAdminToken();
    navigate('/admin/login', { replace: true });
  } finally {
    setSignOutPending(null);
  }
}
