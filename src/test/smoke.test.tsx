import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

function Hello() {
  return <h1>BookSum</h1>;
}

describe('toolchain', () => {
  it('renders a React component in jsdom', () => {
    render(<Hello />);
    expect(screen.getByRole('heading', { name: 'BookSum' })).toBeInTheDocument();
  });

  it('exposes indexedDB to tests', () => {
    expect(globalThis.indexedDB).toBeDefined();
  });
});
