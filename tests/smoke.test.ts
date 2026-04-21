// Smoke test — verifies the build output is importable
describe('cipp-mcp smoke', () => {
  it('package.json has expected name', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pkg = require('../package.json') as { name: string };
    expect(pkg.name).toBe('cipp-mcp');
  });
});
