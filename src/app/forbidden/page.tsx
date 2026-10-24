import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <main className="mx-auto max-w-xl space-y-4 p-8">
      <h1 className="text-2xl font-semibold text-white">غير مصرح</h1>
      <p className="text-slate-300">ليس لديك صلاحية لعرض هذه الصفحة.</p>
      <Link className="text-sky-300 underline" href="/">
        العودة إلى لوحة المخزون
      </Link>
    </main>
  );
}
