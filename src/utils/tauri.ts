import { invoke } from '@tauri-apps/api/core';
import type { AppError, EditOp, ExportRequest, ImageMeta } from '../types/editor';

export const openImage = async (path: string): Promise<ImageMeta> => {
  return invoke<ImageMeta>('open_image', { path });
};

export const renderPreview = async (
  path: string,
  ops: EditOp[],
  maxWidth: number,
  maxHeight: number,
): Promise<Uint8Array> => {
  const bytes = await invoke<number[]>('render_preview', {
    path,
    ops,
    max_width: maxWidth,
    max_height: maxHeight,
  });

  return Uint8Array.from(bytes);
};

export const exportImage = async (req: ExportRequest): Promise<ImageMeta> => {
  return invoke<ImageMeta>('export_image', { req });
};

export const validatePath = async (path: string): Promise<void> => {
  await invoke('validate_path', { path });
};

export const formatError = (error: unknown): string => {
  if (typeof error === 'string') {
    return error;
  }

  if (error && typeof error === 'object') {
    const maybe = error as Partial<AppError>;
    if (maybe.message) {
      return maybe.code ? `${maybe.code}: ${maybe.message}` : maybe.message;
    }
  }

  return 'An unexpected error occurred.';
};
