import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// CSP pragmatis: origin sendiri + yang benar-benar dibutuhkan aplikasi.
// - 'unsafe-inline' pada script masih diperlukan karena Next menyisipkan payload
//   RSC sebagai script inline. Nonce akan lebih ketat tetapi butuh middleware.
// - 'unsafe-eval' + ws: hanya untuk dev (React Refresh/Turbopack HMR).
// - media-src/worker-src blob: dipakai hls.js (MSE + worker dari blob).
// - frame-src youtube: hanya halaman trailer (iframe eksternal satu-satunya).
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://image.tmdb.org https://picsum.photos https://i.ytimg.com https://img.youtube.com",
  "font-src 'self' data:",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "frame-src https://www.youtube.com https://www.youtube-nocookie.com",
  "frame-ancestors 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    // pathname dibatasi supaya host CDN gambar tidak bisa dipakai untuk
    // memproses path sembarangan lewat optimizer.
    remotePatterns: [
      { protocol: "https", hostname: "image.tmdb.org", pathname: "/t/p/**" },
      { protocol: "https", hostname: "picsum.photos", pathname: "/**" }, // hanya data contoh
      { protocol: "https", hostname: "i.ytimg.com", pathname: "/vi/**" },
      { protocol: "https", hostname: "img.youtube.com", pathname: "/vi/**" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: CSP },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
