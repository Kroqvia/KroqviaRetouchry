import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EditOp } from '../types/editor';
import { invoke } from '@tauri-apps/api/core';
import { renderPreview } from '../utils/tauri';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('tauri invoke bindings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderPreview passes camelCase preview bounds and returns Uint8Array', async () => {
    const ops: EditOp[] = [{ kind: 'brightness', value: 0.2 }];
    vi.mocked(invoke).mockResolvedValue([137, 80, 78, 71]);

    const result = await renderPreview('/tmp/input.png', ops, 900, 650);

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith('render_preview', {
      path: '/tmp/input.png',
      ops,
      maxWidth: 900,
      maxHeight: 650,
    });

    const args = vi.mocked(invoke).mock.calls[0]?.[1] as Record<string, unknown>;
    expect(args).not.toHaveProperty('max_width');
    expect(args).not.toHaveProperty('max_height');

    expect(result).toBeInstanceOf(Uint8Array);
    expect(Array.from(result)).toEqual([137, 80, 78, 71]);
  });
});
