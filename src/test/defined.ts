/**
 * Narrowing assertion for test fixtures.
 *
 * `expect(value).toBeDefined()` proves the value at runtime but tells the
 * compiler nothing, so every property access after it is still "possibly
 * undefined" — which is exactly the check `noUncheckedIndexedAccess` turns on.
 * This asserts and narrows in one step, and fails with the fixture's name
 * ("expected a migrated profile, got undefined") rather than as a TypeError
 * three lines later on a property of nothing.
 */
export function defined<T>(value: T | undefined | null, label = 'value'): T {
  if (value === undefined || value === null) {
    throw new Error(`expected a ${label}, got ${String(value)}`);
  }
  return value;
}
