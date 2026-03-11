import { useEffect, useState } from 'react';

export const useLoadedImage = (url: string | null): HTMLImageElement | null => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (url === null || url.length === 0) {
      setImage(null);
      return;
    }

    const nextImage = new globalThis.Image();
    let disposed = false;

    nextImage.onload = () => {
      if (!disposed) {
        setImage(nextImage);
      }
    };

    nextImage.onerror = () => {
      if (!disposed) {
        setImage(null);
      }
    };

    nextImage.src = url;

    return () => {
      disposed = true;
    };
  }, [url]);

  return image;
};
