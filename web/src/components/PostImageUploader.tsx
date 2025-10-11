"use client";

import { useMemo, useRef, useState, type ChangeEvent } from "react";

export type PostImageAsset = {
  url: string;
  key?: string;
};

type PostImageUploaderProps = {
  images: PostImageAsset[];
  onChange: (images: PostImageAsset[]) => void;
  maxImages?: number;
};

const DEFAULT_MAX_IMAGES = 5;
const DEFAULT_MAX_FILE_SIZE = 5 * 1024 * 1024;

export function PostImageUploader({
  images,
  onChange,
  maxImages = DEFAULT_MAX_IMAGES,
}: PostImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const remainingSlots = useMemo(() => Math.max(maxImages - images.length, 0), [images.length, maxImages]);
  const maxFileSizeLabel = useMemo(
    () => `${(DEFAULT_MAX_FILE_SIZE / (1024 * 1024)).toFixed(1)}MB`,
    [],
  );

  const triggerPicker = () => {
    setErrorMessage(null);
    setInfoMessage(null);
    fileInputRef.current?.click();
  };

  const handleRemove = (url: string) => {
    onChange(images.filter((image) => image.url !== url));
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) {
      return;
    }

    const availableSlots = remainingSlots;
    if (availableSlots <= 0) {
      setErrorMessage(`画像は最大 ${maxImages} 枚までです。`);
      event.target.value = "";
      return;
    }

    const files = Array.from(fileList).slice(0, availableSlots);
    const nextImages: PostImageAsset[] = [];
    setErrorMessage(null);
    setInfoMessage(null);
    setIsUploading(true);

    try {
      for (const file of files) {
        if (!file.type.startsWith("image/")) {
          setErrorMessage("画像ファイル以外はアップロードできません。");
          continue;
        }

        if (file.size > DEFAULT_MAX_FILE_SIZE) {
          setErrorMessage(`ファイルサイズは ${maxFileSizeLabel} 以下にしてください。`);
          continue;
        }

        const presignResponse = await fetch("/api/posts/media", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
          }),
        });

        const presignData = (await presignResponse.json().catch(() => ({}))) as {
          uploadUrl?: string;
          objectUrl?: string;
          key?: string;
          error?: string;
        };

        if (!presignResponse.ok || !presignData.uploadUrl || !presignData.objectUrl) {
          throw new Error(presignData.error ?? "アップロードURLの取得に失敗しました。");
        }

        const uploadResponse = await fetch(presignData.uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": file.type,
          },
          body: file,
        });

        if (!uploadResponse.ok) {
          const errorDetail = await uploadResponse.text().catch(() => null);
          if (errorDetail) {
            console.error("Upload failed response:", errorDetail);
          }
          throw new Error(`画像のアップロードに失敗しました。（${uploadResponse.status}）`);
        }

        nextImages.push({
          url: presignData.objectUrl,
          key: presignData.key,
        });
      }

      if (nextImages.length > 0) {
        onChange([...images, ...nextImages]);
        setInfoMessage(`${nextImages.length} 件の画像を追加しました。`);
      }
    } catch (error) {
      console.error("Failed to upload post image", error);
      setErrorMessage((error as Error).message || "画像のアップロードに失敗しました。");
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {images.map((image) => (
          <div
            key={image.url}
            className="relative h-24 w-24 overflow-hidden rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)]"
          >
            <img src={image.url} alt="投稿画像" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => handleRemove(image.url)}
              className="absolute right-1 top-1 rounded-full bg-black/60 px-2 py-1 text-[10px] text-white"
            >
              削除
            </button>
          </div>
        ))}
        {images.length < maxImages && (
          <button
            type="button"
            onClick={triggerPicker}
            disabled={isUploading}
            className="flex h-24 w-24 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[color:var(--color-border)] text-[11px] text-[color:var(--color-fg-muted)] hover:bg-[color:var(--color-surface-2)] disabled:opacity-60"
          >
            <span>画像を追加</span>
            <span className="text-[10px]">{remainingSlots} / {maxImages}</span>
          </button>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={handleFileChange}
      />
      <p className="text-[10px] text-[color:var(--color-fg-muted)]">
        最大 {maxImages} 枚までアップロードできます（{maxFileSizeLabel} 以下）。
      </p>
      {isUploading && <p className="text-[10px] text-[color:var(--color-fg-muted)]">アップロード中です…</p>}
      {infoMessage && (
        <p className="rounded border border-[#c6f6d5] bg-[#f0fff4] px-3 py-2 text-[10px] text-[#2f855a]">{infoMessage}</p>
      )}
      {errorMessage && (
        <p className="rounded border border-[#fed7d7] bg-[#fff5f5] px-3 py-2 text-[10px] text-[#c53030]">{errorMessage}</p>
      )}
    </div>
  );
}
