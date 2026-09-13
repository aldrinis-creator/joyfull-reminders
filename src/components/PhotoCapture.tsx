import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Check, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useT } from "@/hooks/useLanguage";

export type CapturedPhoto = {
  id: string;
  blob: Blob;
  dataUrl: string;
};

export const MAX_PHOTOS = 10;
const MAX_EDGE = 1600;

type Rect = { x: number; y: number; w: number; h: number };

const FULL: Rect = { x: 0.02, y: 0.02, w: 0.96, h: 0.96 };

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/** Crops the given region (in 0..1 fractions) out of the file and returns a downscaled JPEG. */
export async function cropToJpeg(file: Blob, rect: Rect): Promise<CapturedPhoto> {
  const bitmap = await createImageBitmap(file);
  const sx = Math.round(rect.x * bitmap.width);
  const sy = Math.round(rect.y * bitmap.height);
  const sw = Math.max(1, Math.round(rect.w * bitmap.width));
  const sh = Math.max(1, Math.round(rect.h * bitmap.height));
  const scale = Math.min(1, MAX_EDGE / Math.max(sw, sh));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sw * scale));
  canvas.height = Math.max(1, Math.round(sh * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.8),
  );
  if (!blob) throw new Error("no blob");
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, blob, dataUrl };
}

/** Simple draggable / resizable crop box over the photo — no extra libraries. */
function CropDialog({
  file,
  onDone,
  onCancel,
}: {
  file: File;
  onDone: (photo: CapturedPhoto) => void;
  onCancel: () => void;
}) {
  const t = useT();
  const [src, setSrc] = useState<string>("");
  const [rect, setRect] = useState<Rect>(FULL);
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ mode: "move" | "resize"; x: number; y: number; rect: Rect } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    setRect(FULL);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const onPointerDown = (mode: "move" | "resize") => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { mode, x: e.clientX, y: e.clientY, rect };
  };

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = drag.current;
    const box = boxRef.current;
    if (!d || !box) return;
    const bounds = box.getBoundingClientRect();
    const dx = (e.clientX - d.x) / bounds.width;
    const dy = (e.clientY - d.y) / bounds.height;
    if (d.mode === "move") {
      setRect({
        ...d.rect,
        x: clamp(d.rect.x + dx, 0, 1 - d.rect.w),
        y: clamp(d.rect.y + dy, 0, 1 - d.rect.h),
      });
    } else {
      setRect({
        ...d.rect,
        w: clamp(d.rect.w + dx, 0.1, 1 - d.rect.x),
        h: clamp(d.rect.h + dy, 0.1, 1 - d.rect.y),
      });
    }
  }, []);

  const endDrag = () => {
    drag.current = null;
  };

  const confirm = async () => {
    setBusy(true);
    try {
      onDone(await cropToJpeg(file, rect));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => (!v ? onCancel() : undefined)}>
      <DialogContent className="flex max-h-[92dvh] flex-col gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 border-b p-4">
          <DialogTitle>{t("photos.cropTitle")}</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-auto p-4">
          <p className="text-muted-foreground mb-3 text-sm">{t("photos.cropHint")}</p>
          <div
            ref={boxRef}
            className="relative mx-auto w-full touch-none select-none"
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            {src ? (
              <img src={src} alt={t("photos.cropTitle")} className="block w-full rounded-xl" />
            ) : null}
            <div
              className="border-primary absolute cursor-move border-2 bg-white/10"
              style={{
                left: `${rect.x * 100}%`,
                top: `${rect.y * 100}%`,
                width: `${rect.w * 100}%`,
                height: `${rect.h * 100}%`,
              }}
              onPointerDown={onPointerDown("move")}
              role="presentation"
            >
              <span
                className="bg-primary absolute -right-3 -bottom-3 size-6 cursor-se-resize rounded-full"
                onPointerDown={onPointerDown("resize")}
                role="presentation"
              />
            </div>
          </div>
        </div>
        <DialogFooter className="shrink-0 gap-2 border-t p-4">
          <Button variant="outline" className="h-12" onClick={() => setRect(FULL)}>
            <RotateCcw className="size-4" aria-hidden /> {t("photos.cropReset")}
          </Button>
          <Button variant="ghost" className="h-12" onClick={onCancel}>
            {t("photos.cropCancel")}
          </Button>
          <Button className="h-12" disabled={busy} onClick={() => void confirm()}>
            <Check className="size-4" aria-hidden /> {t("photos.cropUse")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Pick or photograph up to `max` images, cropping each one before it is kept.
 */
export function PhotoCapture({
  photos,
  onChange,
  max = MAX_PHOTOS,
  buttonLabel,
}: {
  photos: CapturedPhoto[];
  onChange: (photos: CapturedPhoto[]) => void;
  max?: number;
  buttonLabel?: string;
}) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [queue, setQueue] = useState<File[]>([]);

  const room = max - photos.length;
  const current = queue[0];

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const chosen = Array.from(e.target.files ?? []).filter((f) =>
            f.type.startsWith("image/"),
          );
          e.target.value = "";
          if (chosen.length) setQueue((q) => [...q, ...chosen.slice(0, room)]);
        }}
      />
      <Button
        type="button"
        variant="outline"
        className="h-12 w-full"
        disabled={room <= 0}
        onClick={() => inputRef.current?.click()}
      >
        <Camera className="size-5" aria-hidden />{" "}
        {buttonLabel ?? t("photos.addPhotos", { count: max })}
      </Button>
      <p className="text-muted-foreground text-xs">
        {t("photos.count", { count: photos.length, max })}
      </p>

      {photos.length ? (
        <ul className="flex flex-wrap gap-2">
          {photos.map((p, i) => (
            <li key={p.id} className="relative">
              <img
                src={p.dataUrl}
                alt={t("photos.photoAlt", { index: i + 1 })}
                className="border-border size-20 rounded-xl border object-cover"
              />
              <button
                type="button"
                aria-label={t("photos.remove", { index: i + 1 })}
                className="bg-destructive text-destructive-foreground absolute -top-2 -right-2 rounded-full p-1"
                onClick={() => onChange(photos.filter((x) => x.id !== p.id))}
              >
                <X className="size-3" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {current ? (
        <CropDialog
          file={current}
          onCancel={() => setQueue((q) => q.slice(1))}
          onDone={(photo) => {
            onChange([...photos, photo]);
            setQueue((q) => q.slice(1));
          }}
        />
      ) : null}
    </div>
  );
}
