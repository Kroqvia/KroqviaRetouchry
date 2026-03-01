import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { CropRect } from '../types/editor';

type Handle = 'move' | 'nw' | 'ne' | 'sw' | 'se';

interface DragState {
  handle: Handle;
  startX: number;
  startY: number;
  origin: CropRect;
}

interface CropOverlayProps {
  imageMeta: {
    width: number;
    height: number;
  };
  crop: CropRect;
  disabled?: boolean;
  onChange: (crop: CropRect) => void;
}

const HANDLE_SIZE = 10;

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const normalize = (rect: CropRect, maxWidth: number, maxHeight: number): CropRect => {
  const x = clamp(Math.round(rect.x), 0, Math.max(0, maxWidth - 1));
  const y = clamp(Math.round(rect.y), 0, Math.max(0, maxHeight - 1));
  const width = clamp(Math.round(rect.width), 1, maxWidth - x);
  const height = clamp(Math.round(rect.height), 1, maxHeight - y);
  return { x, y, width, height };
};

const adjust = (origin: CropRect, dx: number, dy: number, handle: Handle): CropRect => {
  switch (handle) {
    case 'move':
      return { ...origin, x: origin.x + dx, y: origin.y + dy };
    case 'nw':
      return {
        x: origin.x + dx,
        y: origin.y + dy,
        width: origin.width - dx,
        height: origin.height - dy,
      };
    case 'ne':
      return {
        x: origin.x,
        y: origin.y + dy,
        width: origin.width + dx,
        height: origin.height - dy,
      };
    case 'sw':
      return {
        x: origin.x + dx,
        y: origin.y,
        width: origin.width - dx,
        height: origin.height + dy,
      };
    case 'se':
    default:
      return {
        x: origin.x,
        y: origin.y,
        width: origin.width + dx,
        height: origin.height + dy,
      };
  }
};

export function CropOverlay({ imageMeta, crop, disabled, onChange }: CropOverlayProps): JSX.Element {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  const style = useMemo(
    () => ({
      left: `${(crop.x / imageMeta.width) * 100}%`,
      top: `${(crop.y / imageMeta.height) * 100}%`,
      width: `${(crop.width / imageMeta.width) * 100}%`,
      height: `${(crop.height / imageMeta.height) * 100}%`,
    }),
    [crop, imageMeta],
  );

  const beginDrag = (event: ReactPointerEvent, handle: Handle): void => {
    if (disabled) {
      return;
    }

    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    setDragState({
      handle,
      startX: event.clientX,
      startY: event.clientY,
      origin: crop,
    });
  };

  const onPointerMove = (event: ReactPointerEvent): void => {
    if (!dragState || !overlayRef.current) {
      return;
    }

    const bounds = overlayRef.current.getBoundingClientRect();
    if (bounds.width < 1 || bounds.height < 1) {
      return;
    }

    const dx = ((event.clientX - dragState.startX) / bounds.width) * imageMeta.width;
    const dy = ((event.clientY - dragState.startY) / bounds.height) * imageMeta.height;

    const next = adjust(dragState.origin, dx, dy, dragState.handle);
    onChange(normalize(next, imageMeta.width, imageMeta.height));
  };

  const onPointerUp = (): void => {
    setDragState(null);
  };

  return (
    <div
      ref={overlayRef}
      className="crop-overlay"
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className="crop-shade top" style={{ height: style.top }} />
      <div className="crop-shade bottom" style={{ top: `calc(${style.top} + ${style.height})` }} />
      <div className="crop-shade left" style={{ top: style.top, height: style.height, width: style.left }} />
      <div className="crop-shade right" style={{ top: style.top, height: style.height, left: `calc(${style.left} + ${style.width})` }} />

      <div className="crop-rect" style={style} onPointerDown={(event) => beginDrag(event, 'move')}>
        <button
          type="button"
          className="crop-handle nw"
          style={{ width: HANDLE_SIZE, height: HANDLE_SIZE }}
          onPointerDown={(event) => beginDrag(event, 'nw')}
        />
        <button
          type="button"
          className="crop-handle ne"
          style={{ width: HANDLE_SIZE, height: HANDLE_SIZE }}
          onPointerDown={(event) => beginDrag(event, 'ne')}
        />
        <button
          type="button"
          className="crop-handle sw"
          style={{ width: HANDLE_SIZE, height: HANDLE_SIZE }}
          onPointerDown={(event) => beginDrag(event, 'sw')}
        />
        <button
          type="button"
          className="crop-handle se"
          style={{ width: HANDLE_SIZE, height: HANDLE_SIZE }}
          onPointerDown={(event) => beginDrag(event, 'se')}
        />
      </div>
    </div>
  );
}
