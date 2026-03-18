/**
 * Keeps test output readable by silencing noisy app logging.
 * Spies remain in place so tests can still assert e.g. expect(console.error).toHaveBeenCalled().
 */
const noop = (): void => {};

beforeAll(() => {
  jest.spyOn(console, "log").mockImplementation(noop);
  jest.spyOn(console, "error").mockImplementation(noop);
  jest.spyOn(console, "warn").mockImplementation(noop);
});
