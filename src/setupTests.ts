// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// `client-zip` is ESM and uses browser-only APIs (TextDecoder,
// Blob.prototype.stream) at module load. No test needs real zip behavior,
// so route every import to the stub at src/__mocks__/client-zip.ts.
jest.mock('client-zip');
