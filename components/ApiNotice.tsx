export default function ApiNotice({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="mb-6 rounded-xl border border-yellow-800 bg-yellow-950/60 p-4 text-sm text-yellow-200">
      <p className="font-bold">Mode contoh — IDLIX-API belum terhubung.</p>
      <p className="mt-1 text-yellow-200/90">
        Install Docker Desktop lalu jalankan <code className="rounded bg-black/40 px-1">docker compose up -d</code> dari
        repo IDLIX-API, atau isi <code className="rounded bg-black/40 px-1">IDLIX_API_URL</code> di{" "}
        <code className="rounded bg-black/40 px-1">.env.local</code> dengan URL API publik kamu. Halaman ini memakai
        data contoh agar UI tetap bisa dilihat.
      </p>
    </div>
  );
}
