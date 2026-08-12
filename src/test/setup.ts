import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { afterEach } from 'vitest';
import { cleanup, configure } from '@testing-library/react';

// waitFor keeps its own 1s budget, separate from vitest's testTimeout. With all
// files running in parallel, IndexedDB round-trips overran it on a loaded
// machine while the assertions themselves were correct.
configure({ asyncUtilTimeout: 5000 });

afterEach(() => {
  cleanup();
  localStorage.clear();
});
