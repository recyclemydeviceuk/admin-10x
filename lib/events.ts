import 'server-only';
import { readCollection, writeCollection, newId } from './db';

// =========================================================
// Activity events — the feed behind the notification bell.
// Server actions log one line per business moment; the bell
// polls /api/notifications and rings on anything new.
// =========================================================

export type PanelEventType = 'order' | 'customer' | 'subscription' | 'payment' | 'return' | 'query';

export type PanelEvent = {
  id: string;
  type: PanelEventType;
  title: string;
  message: string;
  href: string;
  at: string;
};

const MAX_EVENTS = 200;

export async function logEvent(input: {
  type: PanelEventType;
  title: string;
  message: string;
  href: string;
}): Promise<void> {
  try {
    const events = await readCollection<PanelEvent[]>('events');
    events.unshift({ id: newId('evt'), at: new Date().toISOString(), ...input });
    await writeCollection('events', events.slice(0, MAX_EVENTS));
  } catch {
    // The feed must never break the action that triggered it.
  }
}
