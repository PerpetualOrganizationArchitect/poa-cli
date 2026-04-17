/**
 * Unit tests for src/lib/subgraph.ts resilience helpers.
 *
 * Task #447-adjacent (HB#297): the outage classification helpers
 * distinguish between rate-limit (429, recoverable with time) and
 * GRAPH_API_KEY exhaustion (payment-required, needs operator
 * intervention). Both trigger fallback paths in query() — these tests
 * cover the detectors only; the path-switching is integration-level
 * and covered by manual verification against live subgraph outages.
 */

import { describe, it, expect } from 'vitest';
import { is429, isPaymentRequired } from '../../src/lib/subgraph';

describe('is429', () => {
  it('matches 429 status code in message', () => {
    expect(is429({ message: 'GraphQL Error (Code: 429): {...}' })).toBe(true);
  });

  it("matches 'Too many requests' wording", () => {
    expect(is429({ message: 'Too many requests, please try again later.' })).toBe(true);
  });

  it("matches nested response.error field", () => {
    expect(is429({ response: { error: 'Too many requests' } })).toBe(true);
  });

  it('does NOT match payment-required errors', () => {
    expect(is429({ message: 'auth error: payment required for subsequent requests' })).toBe(false);
  });

  it('does NOT match generic errors', () => {
    expect(is429({ message: 'Network timeout' })).toBe(false);
    expect(is429({ message: 'invalid query syntax' })).toBe(false);
  });

  it('safely handles null/undefined', () => {
    expect(is429(null)).toBe(false);
    expect(is429(undefined)).toBe(false);
    expect(is429({})).toBe(false);
  });
});

describe('isPaymentRequired', () => {
  it("matches 'payment required' wording", () => {
    expect(isPaymentRequired({ message: 'auth error: payment required for subsequent requests for this API key' })).toBe(true);
  });

  it('matches nested response.error field', () => {
    expect(isPaymentRequired({ response: { error: 'payment required' } })).toBe(true);
  });

  it('does NOT match 429', () => {
    expect(isPaymentRequired({ message: 'Too many requests, 429' })).toBe(false);
  });

  it('does NOT match generic errors', () => {
    expect(isPaymentRequired({ message: 'invalid query' })).toBe(false);
  });

  it('safely handles null/undefined', () => {
    expect(isPaymentRequired(null)).toBe(false);
    expect(isPaymentRequired(undefined)).toBe(false);
    expect(isPaymentRequired({})).toBe(false);
  });

  it('is orthogonal to is429 — a single error matches at most one', () => {
    // The two helpers classify mutually-exclusive outage modes.
    const rateLimit = { message: 'Too many requests' };
    const paymentOut = { message: 'payment required' };
    const neither = { message: 'random error' };

    expect(is429(rateLimit) && isPaymentRequired(rateLimit)).toBe(false);
    expect(is429(paymentOut) && isPaymentRequired(paymentOut)).toBe(false);
    expect(is429(neither) || isPaymentRequired(neither)).toBe(false);
  });
});
