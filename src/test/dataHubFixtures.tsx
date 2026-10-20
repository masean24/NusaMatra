import { render } from '@testing-library/react';
import { vi, type Mock } from 'vitest';
import type { ReactElement } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { DataHubProvider } from '@/features/data-hub';
import { DisplayModeProvider } from '@/features/theme';
import { DataHubHttpClient, NusaMatraDataHubRepository, type DataMode } from '@/services/api';

/** Test helpers over the responses captured from the real Data Hub (src/services/api/__fixtures__). */
const capturedFiles = import.meta.glob<string>('../services/api/__fixtures__/*.{json,txt}', {
  query: '?raw',
  import: 'default',
  eager: true,
});

export function fixtureText(file: string): string {
  const text = capturedFiles[`../services/api/__fixtures__/${file}`];
  if (text === undefined) throw new Error(`Missing captured fixture: ${file}`);
  return text;
}

export function fixtureJson(name: string): unknown {
  return JSON.parse(fixtureText(`${name}.json`));
}

/** Headers of a capture; regions_nonempty and datasets were captured as bodies only. */
export function fixtureHeaders(name: string): Headers {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  const text = capturedFiles[`../services/api/__fixtures__/${name}.headers.txt`] ?? '';
  for (const line of text.split(/\r?\n/)) {
    const separator = line.indexOf(': ');
    if (separator > 0 && !line.startsWith('URL:') && !line.startsWith('HTTP STATUS:')) {
      headers.set(line.slice(0, separator), line.slice(separator + 2));
    }
  }
  return headers;
}

/** A fresh Response of a capture (a body can only be read once, so never reuse one). */
export function fixtureResponse(name: string, status = 200): Response {
  return new Response(fixtureText(`${name}.json`), { status, headers: fixtureHeaders(name) });
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export type FixtureHandler = (url: URL, init: RequestInit | undefined) => Response | Promise<Response>;

/**
 * A `fetch` stand-in that answers by URL path. A path with no handler is a test failure, so a
 * component cannot quietly call an endpoint the test did not expect.
 */
export function createFixtureFetch(handlers: Readonly<Record<string, FixtureHandler>>): Mock<typeof fetch> {
  return vi.fn<typeof fetch>((input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    const handler = handlers[url.pathname];
    if (!handler) return Promise.reject(new Error(`Unexpected request: ${url.pathname}`));
    return Promise.resolve(handler(url, init));
  });
}

/** The URLs a `createFixtureFetch` stand-in was asked for, in order. */
export function requestedUrls(fetchMock: Mock<typeof fetch>): URL[] {
  return fetchMock.mock.calls.map(
    ([input]) => new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url),
  );
}

export function repositoryOver(fetchImpl: typeof fetch): NusaMatraDataHubRepository {
  return new NusaMatraDataHubRepository(
    new DataHubHttpClient({ baseUrl: 'https://data-hub.test', fetchImpl }),
  );
}

interface RenderOptions {
  readonly fetchImpl: typeof fetch | null;
  readonly dataMode?: DataMode;
  readonly path?: string;
}

/** Renders a feature inside the providers and router the app gives it. */
export function renderWithDataHub(
  ui: ReactElement,
  { fetchImpl, dataMode = 'DEMO', path = '/' }: RenderOptions,
) {
  const router = createMemoryRouter([{ path: '*', element: ui }], { initialEntries: [path] });
  const utils = render(
    <DisplayModeProvider>
      <DataHubProvider repository={fetchImpl ? repositoryOver(fetchImpl) : null} initialDataMode={dataMode}>
        <RouterProvider router={router} />
      </DataHubProvider>
    </DisplayModeProvider>,
  );
  return { ...utils, router };
}

/** An element a test expects to exist; fails with a message instead of a bare `undefined`. */
export function present<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw new Error(`Expected ${what} to exist`);
  return value;
}
