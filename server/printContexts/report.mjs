/**
 * Report print context — stub for future report templates.
 */

/**
 * @param {Record<string, unknown>} payload
 */
export function resolveReportPrint(payload) {
  const reportKey =
    payload && typeof payload.reportKey === "string"
      ? payload.reportKey.trim()
      : "";
  if (!reportKey) {
    throw Object.assign(new Error("reportKey is required"), { status: 400 });
  }

  throw Object.assign(new Error("Report context not implemented"), {
    status: 501,
  });
}
