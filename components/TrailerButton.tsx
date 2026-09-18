"use client";

import { useState } from "react";
import TrailerModal from "@/components/TrailerModal";

// Tombol trailer untuk halaman detail (server component), supaya modal dan
// penanganan fokusnya bisa dipakai tanpa membuat seluruh halaman jadi client component.
export default function TrailerButton({ trailerId, title }: { trailerId: string; title: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-md border border-white/20 px-6 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
      >
        ▶ Trailer
      </button>
      <TrailerModal trailerId={open ? trailerId : null} title={title} onClose={() => setOpen(false)} />
    </>
  );
}
