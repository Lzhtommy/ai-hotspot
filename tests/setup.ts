/**
 * Shared Vitest setup — loaded AFTER vitest.setup.ts.
 *
 * Registers @testing-library/jest-dom matchers (toBeInTheDocument, toHaveAttribute, etc.)
 * for every unit/integration test that asserts against a jsdom-rendered component tree.
 *
 * Installs a minimal polyfill for HTMLDialogElement.showModal/close because jsdom 29
 * does not implement the native <dialog> API (flagged in Plan 05-00 SUMMARY §Issues
 * Encountered). The polyfill toggles the `open` attribute so tests can assert visibility
 * via `dlg.hasAttribute('open')`; focus-trap semantics are not simulated (they are native
 * to real browsers and covered by Playwright E2E).
 *
 * Registers an afterEach(cleanup) hook so tests that call render() don't leak DOM
 * between cases. With `globals: false` in vitest.config.ts, testing-library's default
 * auto-cleanup does not fire; wire it explicitly so every test starts with an empty body.
 */
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});

// jsdom 29 lacks HTMLDialogElement.showModal / close / show.
// Patch the prototype only when the current implementation is missing the methods.
if (typeof window !== 'undefined' && typeof HTMLDialogElement !== 'undefined') {
  const proto = HTMLDialogElement.prototype as HTMLDialogElement & {
    showModal: () => void;
    show: () => void;
    close: (returnValue?: string) => void;
  };
  if (typeof proto.showModal !== 'function') {
    proto.showModal = function showModal(this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
  }
  if (typeof proto.show !== 'function') {
    proto.show = function show(this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
  }
  if (typeof proto.close !== 'function') {
    proto.close = function close(this: HTMLDialogElement) {
      this.removeAttribute('open');
    };
  }
}
