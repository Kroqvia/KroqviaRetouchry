import type { CropRect, EditOp, ImageMeta } from '../types/editor';

interface DimensionsLike {
  width: number;
  height: number;
}

export const getSuggestedCrop = (input: DimensionsLike): CropRect => ({
  x: Math.round(input.width * 0.1),
  y: Math.round(input.height * 0.1),
  width: Math.round(input.width * 0.8),
  height: Math.round(input.height * 0.8),
});

export const getExportFormatFromPath = (path: string): 'png' | 'jpeg' | 'webp' => {
  const lower = path.toLowerCase();
  if (lower.endsWith('.png')) {
    return 'png';
  }

  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
    return 'jpeg';
  }

  if (lower.endsWith('.webp')) {
    return 'webp';
  }

  return 'png';
};

export const activeImageDimensions = (meta: ImageMeta | null, ops: EditOp[]): { width: number; height: number } => {
  if (!meta) {
    return { width: 0, height: 0 };
  }

  let width = meta.width;
  let height = meta.height;

  for (const op of ops) {
    switch (op.kind) {
      case 'crop': {
        width = op.width;
        height = op.height;
        break;
      }
      case 'resize': {
        width = op.width;
        height = op.height;
        break;
      }
      case 'rotate': {
        if (op.degrees === 90 || op.degrees === 270) {
          const tmp = width;
          width = height;
          height = tmp;
        }
        break;
      }
      default:
        break;
    }
  }

  return { width, height };
};
