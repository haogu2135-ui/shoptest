const readApiSource = (): string => require('fs').readFileSync(require('path').resolve(__dirname, 'index.ts'), 'utf8');

export {};

describe('API auth header type-safety guard', () => {
  it('applies authorization headers without broad any casts', () => {
    const source = readApiSource();
    const helperStart = source.indexOf('type HeaderSetter = {');
    const removeHeaderStart = source.indexOf('const removeAuthorizationHeader =');
    const helperSource = source.slice(helperStart, removeHeaderStart);

    expect(helperStart).toBeGreaterThan(-1);
    expect(removeHeaderStart).toBeGreaterThan(helperStart);
    expect(helperSource).not.toContain('headers?: any');
    expect(helperSource).not.toContain('as any');
    expect(helperSource).toContain('const hasHeaderSetter = (headers: unknown): headers is HeaderSetter');
    expect(helperSource).toContain("headers.set('Authorization', `Bearer ${token}`);");
    expect(helperSource).toContain("config.headers = { ...mutableHeaders, Authorization: `Bearer ${token}` } as AuthRetryConfig['headers'];");
  });
});
