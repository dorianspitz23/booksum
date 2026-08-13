import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { afterEach } from 'vitest';
import { cleanup, configure } from '@testing-library/react';

// waitFor keeps its own 1s budget, separate from vitest's testTimeout. With all
// files running in parallel, IndexedDB round-trips overran it on a loaded
// machine while the assertions themselves were correct.
configure({ asyncUtilTimeout: 5000 });

// jsdom does not implement scrollIntoView, so any component that scrolls a
// transcript or list into view (ChatModal) throws on mount without this.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});
