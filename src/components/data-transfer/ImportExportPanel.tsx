"use client";

import { createPortal } from "react-dom";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { ChevronDown, Download, FileSpreadsheet, FileText, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

type ImportResult = {
  accepted: number;
  rejected: number;
  duplicates: number;
  confirmed: boolean;
  previewToken?: string;
  results: {
    row: number;
    status: "accepted" | "rejected" | "duplicate";
    message: string;
    values: Record<string, string>;
  }[];
};

const importFieldLabels: Record<string, string> = {
  name: "الاسم / Name",
  sku: "رمز SKU",
  unit: "الوحدة / Unit",
  quantity: "الكمية الابتدائية / Initial quantity",
  minQuantity: "حد التنبيه / Reorder threshold",
  classification: "التصنيف / Classification",
  contactPerson: "جهة الاتصال / Contact",
  phone: "الهاتف / Phone",
  email: "البريد الإلكتروني / Email",
  address: "العنوان / Address",
  city: "المدينة / City",
  notes: "ملاحظات / Notes",
};

function isImportResult(value: unknown): value is ImportResult {
  if (typeof value !== "object" || value === null) return false;
  if (
    !("accepted" in value) || typeof value.accepted !== "number" ||
    !("rejected" in value) || typeof value.rejected !== "number" ||
    !("duplicates" in value) || typeof value.duplicates !== "number" ||
    !("confirmed" in value) || typeof value.confirmed !== "boolean" ||
    !("results" in value) || !Array.isArray(value.results)
  ) return false;
  if ("previewToken" in value && typeof value.previewToken !== "string") {
    return false;
  }
  return value.results.every((row: unknown) => {
    if (
      typeof row !== "object" || row === null ||
      !("row" in row) || typeof row.row !== "number" ||
      !("message" in row) || typeof row.message !== "string" ||
      !("status" in row) ||
      (row.status !== "accepted" && row.status !== "rejected" && row.status !== "duplicate") ||
      !("values" in row) || typeof row.values !== "object" || row.values === null
    ) return false;
    return Object.values(row.values).every((item) => typeof item === "string");
  });
}

type Props = {
  dataset: string;
  filters?: Record<string, string>;
  importDataset?: "products" | "suppliers" | "customers";
  showExcel?: boolean;
  showWord?: boolean;
};

type MenuPosition = {
  top: number;
  left: number;
  maxHeight: number;
};

export function ImportExportPanel({
  dataset,
  filters = {},
  importDataset,
  showExcel = true,
  showWord = true,
}: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useLayoutEffect(() => {
    if (!menuOpen) {
      setMenuPosition(null);
      return;
    }

    const positionMenu = () => {
      const trigger = triggerRef.current;
      const menu = menuRef.current;
      if (!trigger || !menu) return;

      const triggerRect = trigger.getBoundingClientRect();
      const gap = 8;
      const viewportPadding = 8;
      const spaceBelow = Math.max(
        0,
        window.innerHeight - triggerRect.bottom - gap - viewportPadding,
      );
      const spaceAbove = Math.max(0, triggerRect.top - gap - viewportPadding);
      const openUp = menu.scrollHeight > spaceBelow && spaceAbove > spaceBelow;
      const maxHeight = openUp ? spaceAbove : spaceBelow;
      const menuHeight = Math.min(menu.scrollHeight, maxHeight);
      const top = openUp
        ? triggerRect.top - gap - menuHeight
        : triggerRect.bottom + gap;
      const menuWidth = menu.getBoundingClientRect().width;
      const isRtl = window.getComputedStyle(trigger).direction === "rtl";
      const alignedLeft = isRtl
        ? triggerRect.right - menuWidth
        : triggerRect.left;
      const maxLeft = Math.max(
        viewportPadding,
        window.innerWidth - menuWidth - viewportPadding,
      );

      setMenuPosition({
        top: Math.max(viewportPadding, top),
        left: Math.min(Math.max(viewportPadding, alignedLeft), maxLeft),
        maxHeight,
      });
    };

    positionMenu();
    window.addEventListener("resize", positionMenu);
    window.addEventListener("scroll", positionMenu, true);
    return () => {
      window.removeEventListener("resize", positionMenu);
      window.removeEventListener("scroll", positionMenu, true);
    };
  }, [menuOpen, file, result, busy, exporting, error, notice]);

  useEffect(() => {
    if (!menuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (
        target instanceof Node &&
        !triggerRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  async function downloadFile(url: string, fallbackName: string) {
    setExporting(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(url);
      if (!response.ok) {
        const payload: unknown = await response.json().catch(() => null);
        const message =
          typeof payload === "object" && payload !== null && "error" in payload &&
          typeof payload.error === "string"
            ? payload.error
            : "تعذّر إنشاء الملف.";
        throw new Error(message);
      }
      const file = await response.blob();
      const filename =
        response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/u)?.[1] ??
        fallbackName;
      const fileUrl = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = fileUrl;
      link.download = filename;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(fileUrl), 1000);
      setNotice("تم تجهيز الملف وبدء التنزيل.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذّر الاتصال بالخادم.");
    } finally {
      setExporting(false);
    }
  }

  function exportFile(format: "xlsx" | "docx") {
    const params = new URLSearchParams({ dataset, format, ...filters });
    void downloadFile(`/api/data-transfer?${params.toString()}`, `imdad-${dataset}.${format}`);
  }

  function downloadTemplate() {
    if (!importDataset) return;
    void downloadFile(`/api/data-transfer?template=${importDataset}`, `imdad-${importDataset}-template.xlsx`);
  }

  async function submitImport(mode: "preview" | "confirm") {
    if (!file || !importDataset) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const body = new FormData();
      body.set("dataset", importDataset);
      body.set("file", file);
      body.set("mode", mode);
      if (mode === "confirm" && result?.previewToken) {
        body.set("previewToken", result.previewToken);
      }
      const response = await fetch("/api/data-transfer", { method: "POST", body });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const message =
          typeof payload === "object" && payload !== null && "error" in payload &&
          typeof payload.error === "string"
            ? payload.error
            : "تعذّر معالجة ملف الاستيراد.";
        throw new Error(message);
      }
      if (!isImportResult(payload)) {
        throw new Error("استجابة الاستيراد غير صالحة.");
      }
      setResult(payload);
      if (payload.confirmed) setNotice("اكتملت معالجة الصفوف؛ راجع الملخص أدناه.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذّر الاتصال بالخادم.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div dir="rtl" aria-busy={busy || exporting}>
      <button
        ref={triggerRef}
        type="button"
        aria-controls={menuId}
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
        className="group flex h-10 cursor-pointer list-none items-center gap-2 rounded-lg border border-white/[0.12] bg-slate-900 px-3 text-sm text-slate-200 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40"
      >
        <Download aria-hidden="true" className="size-4 text-sky-300" />
        استيراد / تصدير · Import / Export
        <ChevronDown
          aria-hidden="true"
          className={`size-4 transition ${menuOpen ? "rotate-180" : ""}`}
        />
      </button>
      {menuOpen && typeof document !== "undefined" && createPortal(
        <div
          ref={menuRef}
          id={menuId}
          aria-busy={busy || exporting}
          style={{
            top: menuPosition?.top ?? 0,
            left: menuPosition?.left ?? 0,
            maxHeight: menuPosition?.maxHeight,
            width: "min(18rem, calc(100vw - 1rem))",
            visibility: menuPosition ? "visible" : "hidden",
          }}
          className="fixed z-[100] grid gap-2 overflow-y-auto rounded-xl border border-white/[0.1] bg-slate-950 p-3 shadow-xl"
        >
        <div className="flex flex-wrap gap-2">
          {showExcel && (
            <Button type="button" variant="outline" onClick={() => exportFile("xlsx")} disabled={exporting || busy} className="h-9">
              <FileSpreadsheet aria-hidden="true" className="size-4" />
              {exporting ? "جارٍ التصدير..." : "تصدير Excel"}
            </Button>
          )}
          {showWord && (
            <Button type="button" variant="outline" onClick={() => exportFile("docx")} disabled={exporting || busy} className="h-9">
              <FileText aria-hidden="true" className="size-4" />
              {exporting ? "جارٍ التصدير..." : "تصدير Word"}
            </Button>
          )}
        </div>
        {importDataset && (
          <>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={downloadTemplate} disabled={exporting || busy} className="h-9">
                <Download aria-hidden="true" className="size-4" />
                قالب الاستيراد
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInput.current?.click()}
                disabled={busy || exporting}
                className="h-9"
              >
                <Upload aria-hidden="true" className="size-4" />
                اختيار ملف Excel
              </Button>
            </div>
            <input
              ref={fileInput}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              aria-label="اختيار ملف Excel للاستيراد"
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                event.currentTarget.value = "";
                setResult(null);
                setError("");
                setNotice("");
              }}
            />
            {file && (
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400" aria-live="polite">
                <span className="max-w-56 truncate" dir="auto">{file.name}</span>
                <Button type="button" size="sm" onClick={() => submitImport("preview")} disabled={busy}>
                  {busy ? "جارٍ التحقق..." : "معاينة البيانات"}
                </Button>
              </div>
            )}
            {result && (
              <div className="rounded-xl border border-white/[0.08] bg-slate-900 p-3 text-xs text-slate-300" aria-live="polite">
                <p aria-live="polite" className="font-medium text-slate-100">
                  {result.confirmed ? "نتيجة الاستيراد · Import results" : "معاينة الاستيراد · Import preview"}
                </p>
                <p className="mt-1 text-slate-400" dir="auto">
                  مقبول {result.accepted} · مرفوض {result.rejected} · مكرر {result.duplicates}
                  <span className="ms-1 text-slate-500">
                    · Accepted {result.accepted} · Rejected {result.rejected} · Duplicates {result.duplicates}
                  </span>
                </p>
                {!result.confirmed && result.accepted > 0 && result.previewToken && (
                  <Button type="button" size="sm" className="mt-2" onClick={() => submitImport("confirm")} disabled={busy}>
                    {busy ? "جارٍ الاستيراد..." : "تأكيد إضافة الصفوف المقبولة"}
                  </Button>
                )}
                <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">
                  {result.results.map((row) => (
                    <li key={row.row} className="rounded-lg border border-white/[0.05] bg-slate-950/70 p-2">
                      <p className={row.status === "accepted" ? "text-emerald-300" : row.status === "duplicate" ? "text-amber-300" : "text-rose-300"}>
                        الصف {row.row} · Row {row.row}: {row.message}
                      </p>
                      <dl className="mt-1 grid grid-cols-1 gap-x-3 gap-y-1 text-slate-400 sm:grid-cols-2">
                        {Object.entries(row.values).filter(([, value]) => value).map(([key, value]) => (
                          <div key={key} className="flex min-w-0 gap-1">
                            <dt className="shrink-0">{importFieldLabels[key] ?? key}:</dt>
                            <dd className="min-w-0 truncate" dir="auto">{value}</dd>
                          </div>
                        ))}
                      </dl>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
        {error && <p role="alert" className="text-xs text-rose-300">{error}</p>}
        {notice && <p role="status" aria-live="polite" className="text-xs text-emerald-300">{notice}</p>}
        </div>,
        document.body,
      )}
    </div>
  );
}
