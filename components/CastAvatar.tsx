"use client";

import Image from "next/image";
import { useState } from "react";

// Foto pemeran lingkaran: siluet outline bila tidak ada foto ATAU foto gagal
// dimuat (bukan lingkaran kosong).
export default function CastAvatar({ image, name }: { image?: string; name: string }) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(image) && !failed;

  return (
    <div className="relative mx-auto flex h-28 w-28 items-center justify-center overflow-hidden rounded-full bg-zinc-800 ring-1 ring-white/10">
      {showImage ? (
        <Image
          src={image as string}
          alt={name}
          fill
          sizes="112px"
          className="object-cover"
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-12 w-12 text-zinc-500"
        >
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 20c1.5-3.5 4-5.5 7-5.5s5.5 2 7 5.5" />
        </svg>
      )}
    </div>
  );
}
