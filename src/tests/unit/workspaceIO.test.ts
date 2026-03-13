import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadText } from '../../io/workspaceIO';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('workspace IO', () => {
  it('downloads text via a blob-backed anchor element', async () => {
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    const createObjectURLSpy = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:workspace-test');
    const revokeObjectURLSpy = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => undefined);

    downloadText('workspace.json', '{"ok":true}', 'application/json');

    const blob = createObjectURLSpy.mock.calls[0]?.[0];

    expect(blob).toBeInstanceOf(Blob);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:workspace-test');

    const clickedAnchor = clickSpy.mock.instances[0] as
      | HTMLAnchorElement
      | undefined;

    expect(clickedAnchor?.download).toBe('workspace.json');
    expect(clickedAnchor?.href).toBe('blob:workspace-test');

    if (!(blob instanceof Blob)) {
      throw new TypeError('expected blob payload');
    }

    await expect(blob.text()).resolves.toBe('{"ok":true}');
    expect(blob.type).toBe('application/json');
  });
});
