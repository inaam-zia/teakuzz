"use client";

import { useEffect, useRef, useState } from "react";
import { menuThumbUrl } from "@/lib/menu-image";

const PLACEHOLDER =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

type Props = {
  src: string | null | undefined;
  alt: string;
  className?: string;
};

export default function LazyMenuImage({ src, alt, className = "" }: Props) {
  const ref = useRef<HTMLImageElement>(null);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);

  const thumb = menuThumbUrl(src);
  const fullSrc = src ?? null;

  useEffect(() => {
    const el = ref.current;
    if (!el || !thumb) return;

    if (typeof IntersectionObserver === "undefined") {
      setLoadedSrc(thumb);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setLoadedSrc(thumb);
          observer.disconnect();
        }
      },
      { rootMargin: "120px", threshold: 0.01 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [thumb]);

  if (!src) return null;

  function handleError() {
    if (fullSrc && loadedSrc !== fullSrc) {
      setLoadedSrc(fullSrc);
    }
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={loadedSrc ?? PLACEHOLDER}
      alt={alt}
      className={`${className} ${loadedSrc ? "menu-image--loaded" : "menu-image--pending"}`}
      decoding="async"
      loading="lazy"
      onError={handleError}
    />
  );
}
