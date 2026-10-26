import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';
import {
  installIntersectionObserver,
  installMatchMedia,
  installResizeObserver,
  resetIntersectionObservers,
  resetMediaQueries,
} from './browserMocks';

beforeEach(() => {
  installMatchMedia();
  installIntersectionObserver();
  installResizeObserver();
});

afterEach(() => {
  cleanup();
  resetMediaQueries();
  resetIntersectionObservers();
  window.localStorage.clear();
  document.documentElement.removeAttribute('data-display-mode');
});
