"use client";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="id">
      <body style={{ background: "#0a0a0a", color: "#f5f5f5", fontFamily: "system-ui, sans-serif", padding: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900 }}>Aplikasi gagal dimuat</h1>
        <p style={{ marginTop: 8, color: "#a1a1aa", fontSize: 14 }}>
          Terjadi kesalahan pada kerangka aplikasi. Coba muat ulang halaman.
        </p>
        {error.digest ? <p style={{ color: "#52525b", fontSize: 12 }}>Kode: {error.digest}</p> : null}
        <button
          onClick={reset}
          style={{
            marginTop: 16,
            background: "#dc2626",
            color: "white",
            border: 0,
            borderRadius: 6,
            padding: "10px 18px",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Muat ulang
        </button>
      </body>
    </html>
  );
}
