import { reportExportDenialStatus } from "./authorization.ts";

export async function authorizeReportExportRequest(
  loadPrincipal: () => Promise<{ role: unknown } | null>,
): Promise<Response | null> {
  const principal = await loadPrincipal();
  const status = reportExportDenialStatus(principal?.role);
  if (status === null) return null;

  return Response.json(
    { error: status === 401 ? "Authentication required." : "Forbidden." },
    { status },
  );
}
