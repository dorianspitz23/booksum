import 'fake-indexeddb/auto';
import { afterEach } from 'vitest';

/**
 * A jsdom window costs seconds to build and tens of megabytes to hold, and this
 * file used to force one for every test file — including the dozen that touch no
 * DOM at all. On a loaded machine that is not merely slow: worker startup times
 * out, vitest reports `Failed to start threads worker`, and those files never
 * run. The run does exit non-zero, but the summary counts only the files that
 * did run, so the shortfall is easy to miss.
 *
 * Everything DOM-specific below is therefore guarded, so a pure-logic test file
 * can opt out with `// @vitest-environment node` and pay for none of it.
 */
const hasDom = typeof window !== 'undefined' && typeof document !== 'undefined';

/**
 * Several suites need only `localStorage` — the legacy migration and the API-key
 * store both read and write it but never touch the DOM. Rather than pay for a
 * whole jsdom window to get one Web Storage object, the node environment gets a
 * minimal in-memory implementation. It is spec-shaped enough for these tests:
 * string coercion, `length`, `key(n)`, and iteration order by insertion.
 */
if (!hasDom && typeof globalThis.localStorage === 'undefined') {
  class MemoryStorage implements Storage {
    #entries = new Map<string, string>();

    get length(): number {
      return this.#entries.size;
    }
    key(index: number): string | null {
      return [...this.#entries.keys()][index] ?? null;
    }
    getItem(key: string): string | null {
      return this.#entries.get(String(key)) ?? null;
    }
    setItem(key: string, value: string): void {
      this.#entries.set(String(key), String(value));
    }
    removeItem(key: string): void {
      this.#entries.delete(String(key));
    }
    clear(): void {
      this.#entries.clear();
    }
  }

  Object.defineProperty(globalThis, 'localStorage', {
    value: new MemoryStorage(),
    configurable: true,
  });
}

if (hasDom) {
  await import('@testing-library/jest-dom/vitest');
  const { configure } = await import('@testing-library/react');

  // waitFor keeps its own 1s budget, separate from vitest's testTimeout. With
  // files running in parallel, IndexedDB round-trips overran it on a loaded
  // machine while the assertions themselves were correct.
  configure({ asyncUtilTimeout: 5000 });

  // jsdom does not implement scrollIntoView, so any component that scrolls a
  // transcript or list into view (ChatModal) throws on mount without this.
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
}

afterEach(async () => {
  if (hasDom) {
    const { cleanup } = await import('@testing-library/react');
    cleanup();
  }
  if (typeof localStorage !== 'undefined') localStorage.clear();
});
