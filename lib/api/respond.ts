import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';

/**
 * The single error shape, contract §3. Every route uses these helpers rather than constructing
 * responses inline — a route that invents its own error body is the defect this file prevents.
 */
export interface ApiError {
  error: string;
  field?: string;
  detail?: unknown;
}

export const ok = <T>(body: T, status = 200) => NextResponse.json(body, { status });

export const badRequest = (error: string, field?: string, detail?: unknown) =>
  NextResponse.json<ApiError>({ error, ...(field && { field }), ...(detail !== undefined && { detail }) }, { status: 400 });

export const unauthorized = () =>
  NextResponse.json<ApiError>({ error: 'unauthorized' }, { status: 401 });

export const forbidden = (error = 'forbidden') =>
  NextResponse.json<ApiError>({ error }, { status: 403 });

/**
 * Used for "not in your firm" as well as "does not exist". Contract §3: a 403 would confirm the
 * resource exists, which is itself a cross-tenant leak.
 */
export const notFound = (error = 'not_found') =>
  NextResponse.json<ApiError>({ error }, { status: 404 });

export const conflict = (error: string, detail?: unknown) =>
  NextResponse.json<ApiError>({ error, ...(detail !== undefined && { detail }) }, { status: 409 });

export const unprocessable = (error: string, field?: string, detail?: unknown) =>
  NextResponse.json<ApiError>({ error, ...(field && { field }), ...(detail !== undefined && { detail }) }, { status: 422 });

export const locked = (error = 'shadow_mode') =>
  NextResponse.json<ApiError>({ error }, { status: 423 });

/**
 * Returns a correlation ref rather than the error text. The message may name a table, a column or
 * a constraint, and this response goes to a browser.
 */
export function internal(error: unknown) {
  const ref = randomUUID();
  console.error(`[internal ${ref}]`, error);
  return NextResponse.json({ error: 'internal', ref }, { status: 500 });
}
