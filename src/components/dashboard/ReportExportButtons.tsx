"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ReportExportButtons({ exportUrl }: { exportUrl: string }) {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function downloadExcel() {
    setIsExporting(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(exportUrl);
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        const message =
          typeof body === "object" && body !== null && "error" in body &&
          typeof body.error === "string"
            ? body.error
            : "تعذّر إنشاء ملف Excel. حاول مرة أخرى.";
        throw new Error(message);
      }

      const file = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const fileName =
        disposition.match(/filename="([^"]+)"/)?.[1] ?? "inventory-report.xlsx";
      const fileUrl = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = fileUrl;
      link.download = fileName;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(fileUrl), 1000);
      setSuccess("اكتمل تجهيز ملف Excel وبدأ التنزيل.");
    } catch (cause) {
      setError(
        cause instanceof Error && /[\u0600-\u06FF]/u.test(cause.message)
          ? cause.message
          : "تعذّر الاتصال بالخادم أو تنزيل الملف. حاول مرة أخرى.",
      );
    } finally {
      setIsExporting(false);
    }
  }

  function printReport() {
    setError("");
    setSuccess("اختر «حفظ بتنسيق PDF» من نافذة الطباعة.");
    window.print();
  }

  return (
    <div className="no-print flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        onClick={downloadExcel}
        disabled={isExporting}
        className="h-10 border-white/[0.08] bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-white"
      >
        {isExporting ? (
          <Download aria-hidden="true" className="size-4 animate-pulse" />
        ) : (
          <FileSpreadsheet aria-hidden="true" className="size-4" />
        )}
        {isExporting ? "جارٍ تجهيز Excel..." : "تصدير Excel"}
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={printReport}
        className="h-10 border-white/[0.08] bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-white"
      >
        <Printer aria-hidden="true" className="size-4" />
        حفظ PDF / طباعة
      </Button>
      <span role="status" aria-live="polite" className="sr-only">
        {isExporting ? "جارٍ إنشاء ملف التقرير" : ""}
      </span>
      {success && (
        <p role="status" aria-live="polite" className="w-full text-xs text-emerald-300">
          {success}
        </p>
      )}
      {error && (
        <p role="alert" className="w-full text-xs text-rose-300">
          {error}
        </p>
      )}
    </div>
  );
}
