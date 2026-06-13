/** Persist customer join state so refresh can resume instead of restarting the welcome flow. */

const PREFIX = 'assistlens.customer.';

export interface CustomerSessionState {
  name: string;
  wasInCall: boolean;
  /** User left voluntarily — refresh should show rejoin, not welcome or auto-connect. */
  pendingRejoin?: boolean;
  sessionId?: string;
}

function key(inviteToken: string): string {
  return `${PREFIX}${inviteToken.slice(-32)}`;
}

export function loadCustomerSession(inviteToken: string): CustomerSessionState | null {
  try {
    const raw = sessionStorage.getItem(key(inviteToken));
    if (!raw) return null;
    return JSON.parse(raw) as CustomerSessionState;
  } catch {
    return null;
  }
}

export function saveCustomerSession(inviteToken: string, state: CustomerSessionState): void {
  sessionStorage.setItem(key(inviteToken), JSON.stringify(state));
}

export function clearCustomerSession(inviteToken: string): void {
  sessionStorage.removeItem(key(inviteToken));
}
