/**
 * Shared Vitest setup — loaded AFTER vitest.setup.ts.
 *
 * Registers @testing-library/jest-dom matchers (toBeInTheDocument, toHaveAttribute, etc.)
 * for every unit/integration test that asserts against a jsdom-rendered component tree.
 */
import '@testing-library/jest-dom/vitest';
