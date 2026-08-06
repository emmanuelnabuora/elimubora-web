'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

/**
 * Resizes an image client-side before upload -- real phone photos
 * can easily be 3-5MB, well over the backend's ~1.5MB data-URL cap.
 * Draws onto a canvas capped at maxDimension on the longest side and
 * re-encodes as JPEG at a reasonable quality, which keeps typical
 * uploads well under the limit without the person needing to know or
 * care about file size themselves.
 */
function resizeImage(file: File, maxDimension: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('That file doesn\u2019t look like a valid image.'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not process that image.'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function ImageUploadField({
  endpoint,
  fieldName,
  currentImageUrl,
  label,
  shape = 'square',
  maxDimension = 512
}: {
  endpoint: string;
  fieldName: string;
  currentImageUrl: string | null;
  label: string;
  shape?: 'square' | 'circle';
  maxDimension?: number;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(currentImageUrl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setSuccess(false);
    setLoading(true);
    try {
      const dataUrl = await resizeImage(file, maxDimension, 0.85);
      setPreview(dataUrl);
      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ [fieldName]: dataUrl })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Could not upload that image. Try again.');
        setPreview(currentImageUrl);
        return;
      }
      setSuccess(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not process that image.');
      setPreview(currentImageUrl);
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  const previewSize = shape === 'circle' ? 96 : 80;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <div
        style={{
          width: previewSize,
          height: previewSize,
          borderRadius: shape === 'circle' ? '50%' : 12,
          background: 'var(--eb-bg-panel, #F5F4FF)',
          border: '1px solid var(--eb-line)',
          display: 'grid',
          placeItems: 'center',
          overflow: 'hidden',
          flexShrink: 0
        }}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ fontSize: 11, color: 'var(--eb-fg-muted)', textAlign: 'center', padding: 4 }}>No image</span>
        )}
      </div>
      <div>
        <label className="admin-nav-link" style={{ display: 'inline-block', padding: '9px 16px', cursor: 'pointer' }}>
          {loading ? 'Uploading…' : `${currentImageUrl ? 'Change' : 'Upload'} ${label}`}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={handleFileChange}
            disabled={loading}
            style={{ display: 'none' }}
          />
        </label>
        {error && (
          <p className="auth-error" style={{ marginTop: 6, marginBottom: 0 }}>
            {error}
          </p>
        )}
        {success && !error && (
          <p style={{ fontSize: 13, color: 'var(--eb-primary)', marginTop: 6, marginBottom: 0 }}>Updated.</p>
        )}
      </div>
    </div>
  );
}
