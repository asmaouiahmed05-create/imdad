export function PurchasingLoading({ label }: { label: string }) {
  return (
    <main
      aria-label={`جارٍ تحميل ${label}`}
      aria-busy="true"
      className="mx-auto w-full max-w-[1600px] animate-pulse space-y-5 p-4 sm:p-6 lg:p-8"
    >
      <p role="status" className="sr-only">جارٍ التحميل</p>
      <div className="h-16 max-w-md rounded-xl bg-slate-800/70" />
      <div className="h-12 rounded-xl bg-slate-900/80" />
      <div className="h-[28rem] rounded-2xl bg-slate-900/80" />
    </main>
  );
}
