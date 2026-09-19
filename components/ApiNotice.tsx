export default function ApiNotice({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="mb-6 rounded-xl border border-yellow-800 bg-yellow-950/60 p-4 text-sm text-yellow-200">
      <p className="font-bold">Katalog tidak dapat dimuat.</p>
      <p className="mt-1 text-yellow-200/90">
        Periksa koneksi internetmu lalu muat ulang halaman. Di bawah ini kami tampilkan pilihan editor sementara.
      </p>
    </div>
  );
}
