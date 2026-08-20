import 'server-only';
import crypto from 'crypto';
import { cache } from 'react';
import { backendFetch } from './backend';

// =========================================================
// The panel's data layer.
//
// THE PANEL STORES NOTHING. Every collection lives in the 10X
// API's MongoDB and is reached through the authenticated API at
// /api/v1/admin/collections/:name. There is no local
// copy, no cache and no fallback file — if the API is down the
// panel says so rather than showing something that used to be
// true.
//
// The panel keeps its original contract — read a collection,
// edit the array, write it back — so every page and action
// above this file is unchanged.
//
// The backend JWT is kept in an HttpOnly cookie. This module is server-only,
// and every collection call is made from the Next.js server.
// =========================================================

export type CollectionName =
  | 'orders'
  | 'customers'
  | 'products'
  | 'coupons'
  | 'subscriptions'
  | 'settings'
  | 'events'
  | 'returns'
  | 'queries'
  | 'carts'
  | 'syncing'
  ;

/**
 * Raised when the API is unreachable or refuses the bridge.
 *
 * A 409 means someone else changed a record between this request reading it
 * and writing it back; the message names what moved. Server actions let it
 * surface, so the operator sees "reload and try again" rather than losing the
 * other person's edit.
 */
export class DataSourceError extends Error {
  status: number;
  constructor(message: string, status = 503) {
    super(message);
    this.name = 'DataSourceError';
    this.status = status;
  }
}

/**
 * What this request has read, per collection.
 *
 * `cache()` scopes it to the current request, so two admins acting at the same
 * moment never see each other's read sets. It is sent back with the write so
 * the API can tell "I deleted this" from "someone else added that after I
 * loaded the page" — without it, an unrelated edit silently deletes a
 * colleague's brand-new order.
 */
const readSet = cache(() => new Map<CollectionName, string[]>());

async function bridge<T>(
  name: CollectionName,
  init: { method: 'GET' } | { method: 'PUT'; data: unknown },
): Promise<T> {
  let response: Response;
  try {
    response = await backendFetch(`/api/v1/admin/collections/${name}`, {
      method: init.method,
      headers: {
        Accept: 'application/json',
        ...(init.method === 'PUT' ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(init.method === 'PUT'
        ? { body: JSON.stringify({ data: init.data, knownIds: readSet().get(name) ?? [] }) }
        : {}),
      cache: 'no-store',
    });
  } catch {
    // Connection refused. Say the API is down rather than rendering a page
    // that looks like there is simply no data.
    throw new DataSourceError(
      'Can’t reach the 10X API. Start the server (npm run dev in server/) and reload.',
    );
  }

  const text = await response.text();
  let payload: { ok?: boolean; data?: unknown; message?: string } = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = {};
  }

  if (!response.ok) {
    throw new DataSourceError(
      payload.message ?? `The API refused the ${name} request (${response.status}).`,
      response.status,
    );
  }

  return payload.data as T;
}

export async function readCollection<T>(name: CollectionName): Promise<T> {
  const data = await bridge<T>(name, { method: 'GET' });
  if (Array.isArray(data)) {
    readSet().set(
      name,
      (data as { id?: string }[]).map((row) => String(row?.id ?? '')).filter(Boolean),
    );
  }
  return data;
}

export async function writeCollection<T>(name: CollectionName, data: T): Promise<void> {
  await bridge<unknown>(name, { method: 'PUT', data });
}

/**
 * A fresh id.
 *
 * Shaped exactly like a MongoDB ObjectId — 4-byte timestamp, 5 random bytes,
 * 3-byte counter — because these ids ARE the database's `_id`. That keeps
 * "create, then redirect to /orders/<id>" landing on the document that was
 * just created, instead of on a 404 while the database quietly assigned a
 * different id.
 *
 * The prefix is kept in the signature so call sites read the same as before;
 * an ObjectId has no room for it.
 */
let idCounter = crypto.randomBytes(3).readUIntBE(0, 3);
const idMachine = crypto.randomBytes(5);

export function newId(_prefix: string) {
  const time = Math.floor(Date.now() / 1000);
  idCounter = (idCounter + 1) % 0xffffff;
  const buf = Buffer.alloc(12);
  buf.writeUInt32BE(time, 0);
  idMachine.copy(buf, 4);
  buf.writeUIntBE(idCounter, 9, 3);
  return buf.toString('hex');
}
