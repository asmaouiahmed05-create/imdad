import ExcelJS from "exceljs";
import { PassThrough } from "node:stream";
import {
  movementReportWhere,
  isReportType,
  parseReportFilters,
  productReportWhere,
  reportTitle,
} from "@/lib/inventory-reports";
import { inventoryStatus } from "@/lib/inventory-status";
import { prisma } from "@/lib/db";
import { getAuthenticatedPrincipal } from "@/lib/authz";
import { authorizeReportExportRequest } from "@/lib/report-export-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BATCH_SIZE = 500;
const numberFormat = "#,##0.##";
const dateFormat = "dd/mm/yyyy hh:mm";

type ExportColumn = {
  header: string;
  key: string;
  width: number;
  numFmt?: string;
};

const productColumns: ExportColumn[] = [
  { header: "اسم الصنف", key: "name", width: 32 },
  { header: "رمز SKU", key: "sku", width: 20 },
  { header: "الكمية الحالية", key: "quantity", width: 18, numFmt: numberFormat },
  { header: "الوحدة", key: "unit", width: 16 },
  { header: "الحد الأدنى", key: "minQuantity", width: 18, numFmt: numberFormat },
  { header: "الحالة", key: "status", width: 18 },
  { header: "تاريخ الإضافة", key: "createdAt", width: 22, numFmt: dateFormat },
];

const movementColumns: ExportColumn[] = [
  { header: "التاريخ", key: "createdAt", width: 22, numFmt: dateFormat },
  { header: "اسم المنتج", key: "name", width: 30 },
  { header: "رمز SKU", key: "sku", width: 20 },
  { header: "نوع الحركة", key: "type", width: 16 },
  { header: "الكمية", key: "quantity", width: 18, numFmt: numberFormat },
  { header: "الوحدة", key: "unit", width: 16 },
  { header: "السبب", key: "reason", width: 32 },
  { header: "المرجع", key: "reference", width: 24 },
];

function statusLabel(status: ReturnType<typeof inventoryStatus>) {
  return status === "out"
    ? "نفد المخزون"
    : status === "low"
      ? "مخزون منخفض"
      : "متوفر";
}

function prismaErrorCode(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

function filterDescription(filters: ReturnType<typeof parseReportFilters>) {
  return [
    filters.query ? `البحث: ${filters.query}` : "",
    filters.from ? `من: ${filters.from}` : "",
    filters.to ? `إلى: ${filters.to}` : "",
  ]
    .filter(Boolean)
    .join(" | ") || "لا توجد فلاتر إضافية";
}

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0F4C81" },
  };
  row.alignment = { horizontal: "right", vertical: "middle" };
  row.height = 24;
}

function reportStream(stream: PassThrough) {
  let ended = false;
  let failure: Error | undefined;
  let wakeReader: (() => void) | undefined;

  stream.on("end", () => {
    ended = true;
    wakeReader?.();
  });
  stream.on("error", (error: Error) => {
    failure = error;
    wakeReader?.();
  });

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      while (true) {
        const chunk = stream.read();
        if (chunk !== null) {
          controller.enqueue(
            chunk instanceof Uint8Array
              ? chunk
              : new TextEncoder().encode(String(chunk)),
          );
          return;
        }
        if (failure) {
          controller.error(failure);
          return;
        }
        if (ended) {
          controller.close();
          return;
        }

        await new Promise<void>((resolve) => {
          const onReadable = () => {
            stream.off("readable", onReadable);
            wakeReader = undefined;
            resolve();
          };
          wakeReader = onReadable;
          stream.once("readable", onReadable);
          if (stream.readableLength > 0 || stream.readableEnded || failure) {
            stream.off("readable", onReadable);
            wakeReader = undefined;
            resolve();
          }
        });
      }
    },
    cancel() {
      stream.destroy();
    },
  });
}

export async function GET(request: Request) {
  const denial = await authorizeReportExportRequest(getAuthenticatedPrincipal);
  if (denial) return denial;

  const params = new URL(request.url).searchParams;
  if (params.has("report") && !isReportType(params.get("report"))) {
    return Response.json(
      { error: "نوع التقرير غير صالح." },
      { status: 400 },
    );
  }
  const filters = parseReportFilters(params);
  if (filters.dateError) {
    return Response.json({ error: filters.dateError }, { status: 400 });
  }

  const isMovementReport = filters.report === "movements";
  const columns = isMovementReport ? movementColumns : productColumns;
  const fileName = `imdad-${filters.report}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  const output = new PassThrough({ highWaterMark: 64 * 1024 });
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
    stream: output,
    useStyles: true,
    useSharedStrings: false,
  });
  const worksheet = (index: number) => {
    const name = `${isMovementReport ? "الحركات" : "الأصناف"} ${index}`;
    const nextSheet = workbook.addWorksheet(name, {
      views: [{ rightToLeft: true, state: "frozen", ySplit: 4 }],
    });
    nextSheet.columns = columns.map(({ key, width }) => ({ key, width }));
    nextSheet.mergeCells(1, 1, 1, columns.length);
    const titleRow = nextSheet.addRow([reportTitle(filters.report)]);
    titleRow.font = { bold: true, size: 16, color: { argb: "FF0F172A" } };
    titleRow.alignment = { horizontal: "right" };
    titleRow.commit();

    nextSheet.addRow([
      `تاريخ إنشاء التقرير: ${new Intl.DateTimeFormat("ar-DZ", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Africa/Algiers",
      }).format(new Date())}`,
    ]).commit();
    nextSheet.addRow([`الفلاتر: ${filterDescription(filters)}`]).commit();

    const headerRow = nextSheet.addRow(columns.map((column) => column.header));
    styleHeader(headerRow);
    headerRow.commit();
    nextSheet.autoFilter = {
      from: { row: 4, column: 1 },
      to: { row: 4, column: columns.length },
    };
    return nextSheet;
  };
  let sheetIndex = 1;
  let sheet = worksheet(sheetIndex);
  let dataRowsInSheet = 0;

  const columnFormats = columns.map((column) => column.numFmt);

  async function writeRow(values: (string | number | Date | null)[]) {
    if (dataRowsInSheet >= 1_048_572) {
      sheet.commit();
      sheet = worksheet(++sheetIndex);
      dataRowsInSheet = 0;
    }
    const row = sheet.addRow(values);
    dataRowsInSheet += 1;
    row.alignment = { vertical: "top", horizontal: "right" };
    values.forEach((value, index) => {
      const format = columnFormats[index];
      if ((value instanceof Date || typeof value === "number") && format) {
        row.getCell(index + 1).numFmt = format;
      }
    });
    row.commit();
  }

  void (async () => {
    try {
      if (isMovementReport) {
        const where = movementReportWhere(filters);
        let cursor: { id: string } | undefined;
        while (true) {
          const movements = await prisma.stockMovement.findMany({
            where,
            select: {
              id: true,
              type: true,
              quantity: true,
              reason: true,
              reference: true,
              createdAt: true,
              product: {
                select: { name: true, sku: true, unit: true },
              },
            },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: BATCH_SIZE,
            ...(cursor ? { cursor, skip: 1 } : {}),
          });
          if (!movements.length) break;

          for (const movement of movements) {
            await writeRow([
              movement.createdAt,
              movement.product.name,
              movement.product.sku,
              movement.type === "IN" ? "استلام" : "صرف",
              movement.quantity,
              movement.product.unit,
              movement.reason ?? "",
              movement.reference ?? "",
            ]);
          }

          cursor = { id: movements[movements.length - 1].id };
          if (movements.length < BATCH_SIZE) break;
        }
      } else {
        const where = productReportWhere(filters.report, filters.query);
        let cursor: { id: string } | undefined;
        while (true) {
          const products = await prisma.product.findMany({
            where,
            select: {
              id: true,
              name: true,
              sku: true,
              unit: true,
              quantity: true,
              minQuantity: true,
              createdAt: true,
            },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: BATCH_SIZE,
            ...(cursor ? { cursor, skip: 1 } : {}),
          });
          if (!products.length) break;

          for (const product of products) {
            await writeRow([
              product.name,
              product.sku,
              product.quantity,
              product.unit,
              product.minQuantity,
              statusLabel(inventoryStatus(product.quantity, product.minQuantity)),
              product.createdAt,
            ]);
          }

          cursor = { id: products[products.length - 1].id };
          if (products.length < BATCH_SIZE) break;
        }
      }

      await workbook.commit();
    } catch (error) {
      console.error("Failed to stream inventory Excel report", {
        code: prismaErrorCode(error),
      });
      output.destroy(new Error("Failed to create inventory report"));
    }
  })();

  return new Response(reportStream(output), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
