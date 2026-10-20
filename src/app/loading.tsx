export default function Loading() {
  return (
    <main
      aria-label="جارٍ تحميل لوحة المخزون"
      aria-busy="true"
      className="mx-auto w-full max-w-[1600px] animate-pulse space-y-6 p-4 sm:p-6 lg:p-8"
    >
      <p role="status" className="sr-only">
        جارٍ تحميل بيانات المخزون
      </p>
      <div className="h-16 max-w-md rounded-xl bg-slate-800/70" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="h-32 rounded-2xl bg-slate-900/80" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="h-72 rounded-2xl bg-slate-900/80" />
        <div className="h-72 rounded-2xl bg-slate-900/80" />
      </div>
      <div className="h-[28rem] rounded-2xl bg-slate-900/80" />
    </main>
  );
}
