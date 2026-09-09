/**
 * Render JSON document templates to US Letter PDFs via PDFKit.
 */

import PDFDocument from "pdfkit";
import { getLogoPngBuffer } from "./branding.mjs";
import {
  ATTACHMENT_TO_SIGNATURE_GAP,
  drawCutHere,
  drawFooter,
  drawInlineAttachments,
  drawLabeledLine,
  drawLineStack,
  drawPageBorder,
  drawRow,
  drawSectionTitle,
  drawTable,
  drawTitleBar,
  drawTotalRow,
  drawUnderlineField,
  display,
  LOGO_HEIGHT,
  LOGO_WIDTH,
  MARGIN,
  PAGE_WIDTH,
  planInlineAttachments,
  SIGNATURE_BLOCK_HEIGHT,
  GRID_FOOTER_RESERVE,
} from "./pdfLayout.mjs";

const BLOCK_TYPES = new Set([
  "header",
  "metaRow",
  "section",
  "row",
  "multiline",
  "spacer",
  "text",
  "imageAttachments",
  "signature",
  "titleBar",
  "columns",
  "labeledLine",
  "lineStack",
  "table",
  "totalRow",
  "cutHere",
]);

/**
 * @param {unknown} value
 * @param {string} path
 */
function expectString(value, path) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${path} must be a non-empty string`);
  }
  return value.trim();
}

/**
 * @param {unknown} block
 * @param {string} path
 */
function validateBlock(block, path) {
  if (!block || typeof block !== "object" || Array.isArray(block)) {
    throw new Error(`${path} must be an object`);
  }
  const b = /** @type {Record<string, unknown>} */ (block);
  const type = expectString(b.type, `${path}.type`);
  if (!BLOCK_TYPES.has(type)) {
    throw new Error(`Unknown block type "${type}" at ${path}`);
  }
  switch (type) {
    case "header":
    case "titleBar":
      expectString(b.title, `${path}.title`);
      break;
    case "metaRow":
      expectString(b.left, `${path}.left`);
      break;
    case "section":
      expectString(b.title, `${path}.title`);
      break;
    case "row":
      expectString(b.label, `${path}.label`);
      expectString(b.value, `${path}.value`);
      break;
    case "multiline":
    case "text":
      expectString(b.value, `${path}.value`);
      break;
    case "spacer":
      if (b.height != null && (typeof b.height !== "number" || b.height < 0)) {
        throw new Error(`${path}.height must be a non-negative number`);
      }
      break;
    case "signature":
      if (!Array.isArray(b.fields) || b.fields.length === 0) {
        throw new Error(`${path}.fields must be a non-empty array`);
      }
      break;
    case "columns": {
      if (!Array.isArray(b.columns) || b.columns.length === 0) {
        throw new Error(`${path}.columns must be a non-empty array`);
      }
      b.columns.forEach((col, i) => {
        if (!Array.isArray(col)) {
          throw new Error(`${path}.columns[${i}] must be an array of blocks`);
        }
        col.forEach((child, j) => {
          validateBlock(child, `${path}.columns[${i}][${j}]`);
        });
      });
      break;
    }
    case "labeledLine":
      if (typeof b.label !== "string" && typeof b.caption !== "string") {
        throw new Error(`${path} needs label or caption`);
      }
      break;
    case "lineStack":
      if (typeof b.lines !== "number" || b.lines < 1) {
        throw new Error(`${path}.lines must be a positive number`);
      }
      break;
    case "table": {
      if (!Array.isArray(b.columns) || b.columns.length === 0) {
        throw new Error(`${path}.columns must be a non-empty array`);
      }
      b.columns.forEach((col, i) => {
        if (!col || typeof col !== "object" || Array.isArray(col)) {
          throw new Error(`${path}.columns[${i}] must be an object`);
        }
        expectString(
          /** @type {Record<string, unknown>} */ (col).label,
          `${path}.columns[${i}].label`,
        );
      });
      break;
    }
    case "totalRow":
      expectString(b.label, `${path}.label`);
      break;
    default:
      break;
  }
}

const PRINT_CONTEXTS = new Set(["task", "report"]);

/**
 * @typedef {{ label: string, context: string, surfaces: Record<string, boolean>, requiresStatus: string | null, persist: boolean, page: string, margin: number, footer?: boolean, border?: boolean, blocks: unknown[] }} PrintTemplateDefinition
 */

/**
 * @param {unknown} parsed
 * @param {string} [templateKey]
 */
export function validatePrintTemplate(parsed, templateKey = "") {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Invalid template${templateKey ? ` "${templateKey}"` : ""}: expected object`);
  }
  const obj = /** @type {Record<string, unknown>} */ (parsed);
  const label = expectString(obj.label, "label");
  const context = expectString(obj.context, "context");
  if (!PRINT_CONTEXTS.has(context)) {
    throw new Error(`context must be one of: ${[...PRINT_CONTEXTS].join(", ")}`);
  }

  /** @type {Record<string, boolean>} */
  const surfaces = {};
  if (obj.surfaces != null) {
    if (typeof obj.surfaces !== "object" || Array.isArray(obj.surfaces)) {
      throw new Error("surfaces must be an object");
    }
    const s = /** @type {Record<string, unknown>} */ (obj.surfaces);
    if (s.taskMenu != null && typeof s.taskMenu !== "boolean") {
      throw new Error("surfaces.taskMenu must be a boolean");
    }
    if (s.taskMenu === true) surfaces.taskMenu = true;
  }

  let requiresStatus = null;
  if (obj.requiresStatus != null) {
    if (typeof obj.requiresStatus !== "string" || !obj.requiresStatus.trim()) {
      throw new Error("requiresStatus must be a non-empty string when set");
    }
    requiresStatus = obj.requiresStatus.trim();
  }

  let persist = false;
  if (obj.persist != null) {
    if (typeof obj.persist !== "boolean") {
      throw new Error("persist must be a boolean");
    }
    persist = obj.persist;
  }

  if (obj.page != null && obj.page !== "letter") {
    throw new Error(`Unsupported page size: ${String(obj.page)}`);
  }
  if (obj.margin != null && (typeof obj.margin !== "number" || obj.margin < 0)) {
    throw new Error("margin must be a non-negative number");
  }
  if (!Array.isArray(obj.blocks) || obj.blocks.length === 0) {
    throw new Error("blocks must be a non-empty array");
  }

  for (let i = 0; i < obj.blocks.length; i++) {
    validateBlock(obj.blocks[i], `blocks[${i}]`);
  }

  return {
    label,
    context,
    surfaces,
    requiresStatus,
    persist,
    page: "letter",
    margin: typeof obj.margin === "number" ? obj.margin : MARGIN,
    footer: obj.footer !== false,
    border: obj.border === true,
    blocks: obj.blocks,
  };
}

/**
 * @param {string} text
 * @param {Record<string, string>} tagMap
 */
export function substituteTags(text, tagMap) {
  let out = String(text);
  const entries = Object.entries(tagMap).sort((a, b) => b[0].length - a[0].length);
  for (const [tag, value] of entries) {
    out = out.split(`{{${tag}}}`).join(value);
  }
  return out;
}

/**
 * @param {unknown} value
 * @param {Record<string, string>} tagMap
 */
function substituteDeep(value, tagMap) {
  if (typeof value === "string") return substituteTags(value, tagMap);
  if (Array.isArray(value)) return value.map((item) => substituteDeep(item, tagMap));
  if (value && typeof value === "object") {
    /** @type {Record<string, unknown>} */
    const out = {};
    for (const [key, child] of Object.entries(value)) {
      out[key] = substituteDeep(child, tagMap);
    }
    return out;
  }
  return value;
}

/**
 * @param {unknown[]} blocks
 * @param {Record<string, string>} tagMap
 */
function substituteBlocks(blocks, tagMap) {
  return /** @type {unknown[]} */ (substituteDeep(blocks, tagMap));
}

/**
 * @param {Record<string, string>} tagMap
 * @param {string | undefined} showWhen
 */
function shouldShowBlock(tagMap, showWhen) {
  if (!showWhen) return true;
  const value = tagMap[showWhen];
  if (value == null) return false;
  const trimmed = String(value).trim();
  return trimmed !== "" && trimmed !== "n/a";
}

/**
 * @param {unknown} block
 * @param {number} x
 * @param {number} width
 */
function columnFractions(block, count) {
  const b = /** @type {Record<string, unknown>} */ (block);
  if (Array.isArray(b.widths) && b.widths.length === count) {
    const nums = b.widths.map((w) => (typeof w === "number" ? w : 0));
    const sum = nums.reduce((a, n) => a + n, 0);
    if (sum > 0) return nums.map((n) => n / sum);
  }
  return Array.from({ length: count }, () => 1 / count);
}

/**
 * @param {PrintTemplateDefinition} template
 * @param {{ tagMap: Record<string, string>, companyName: string, imageAttachments?: Array<{ buffer: Buffer, fileName: string, caption: string | null }> }} ctx
 * @returns {Promise<Buffer>}
 */
export async function renderDocumentTemplate(template, ctx) {
  const blocks = substituteBlocks(template.blocks, ctx.tagMap);
  const logoBuf = template.blocks.some(
    (b) => b && typeof b === "object" && /** @type {Record<string, unknown>} */ (b).type === "header" && /** @type {Record<string, unknown>} */ (b).logo,
  )
    ? await getLogoPngBuffer()
    : null;

  const hasAttachments = blocks.some(
    (b) => b && typeof b === "object" && /** @type {Record<string, unknown>} */ (b).type === "imageAttachments",
  );
  const hasSignature = blocks.some(
    (b) => b && typeof b === "object" && /** @type {Record<string, unknown>} */ (b).type === "signature",
  );
  const images = hasAttachments ? (ctx.imageAttachments ?? []) : [];
  const margin = typeof template.margin === "number" ? template.margin : MARGIN;
  const contentWidth = PAGE_WIDTH - margin * 2;
  const footerEnabled = template.footer !== false;
  const borderEnabled = template.border === true;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "LETTER",
      margins: { top: margin, bottom: margin, left: margin, right: margin },
      info: {
        Title: template.label,
        Author: ctx.companyName,
      },
    });

    /** @type {Buffer[]} */
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    let y = margin;
    let pageNumber = 1;
    let pageCount = 1;
    /** @type {null | { cellWidth: number, imageHeight: number, cellHeight: number, pageCount: number }} */
    let attachmentPlan = null;

    const paintChrome = () => {
      if (borderEnabled) drawPageBorder(doc);
      if (footerEnabled) drawFooter(doc, ctx.companyName, pageNumber, pageCount);
    };
    const startNextPage = () => {
      paintChrome();
      doc.addPage();
      pageNumber += 1;
      y = margin;
    };

    /**
     * @param {Record<string, unknown>} block
     * @param {number} x
     * @param {number} width
     * @param {number} startY
     */
    const renderOne = (block, x, width, startY) => {
      const type = String(block.type);
      let nextY = startY;

      if (type === "imageAttachments" && !attachmentPlan) {
        attachmentPlan = planInlineAttachments(doc.page.height, startY, images.length);
        pageCount = attachmentPlan.pageCount;
      }

      switch (type) {
        case "header": {
          const title = String(block.title);
          if (block.logo && logoBuf) {
            doc.image(logoBuf, x, startY, {
              width: LOGO_WIDTH,
              height: LOGO_HEIGHT,
            });
            doc.font("Helvetica-Bold").fontSize(18).fillColor("#000000");
            const titleH = doc.currentLineHeight();
            doc.text(title, x, startY + (LOGO_HEIGHT - titleH) / 2, {
              width,
              align: "right",
              lineBreak: false,
            });
            nextY = startY + LOGO_HEIGHT + 14;
          } else {
            doc.font("Helvetica-Bold").fontSize(18).fillColor("#000000");
            doc.text(title, x, startY, { width, align: "right" });
            nextY = doc.y + 14;
          }
          break;
        }
        case "titleBar":
          nextY = drawTitleBar(doc, String(block.title), x, startY, width, {
            fill: typeof block.fill === "string" ? block.fill : undefined,
            height: typeof block.height === "number" ? block.height : undefined,
            size: typeof block.size === "number" ? block.size : undefined,
          });
          break;
        case "metaRow": {
          doc.font("Helvetica").fontSize(10).fillColor("#000000");
          doc.text(String(block.left), x, startY, {
            width: width / 2,
            lineBreak: false,
          });
          const rightShowWhen =
            typeof block.rightShowWhen === "string" ? block.rightShowWhen : null;
          const right = typeof block.right === "string" ? block.right : "";
          if (
            right &&
            (!rightShowWhen || shouldShowBlock(ctx.tagMap, rightShowWhen))
          ) {
            doc.text(right, x, startY, {
              width,
              align: "right",
            });
          }
          nextY = doc.y + 12;
          break;
        }
        case "section":
          nextY = drawSectionTitle(doc, String(block.title), startY, x, width);
          break;
        case "row":
          if (block.showWhen && !shouldShowBlock(ctx.tagMap, String(block.showWhen))) {
            break;
          }
          nextY = drawRow(doc, String(block.label), String(block.value), startY, x, width);
          break;
        case "multiline": {
          if (block.label) {
            nextY = drawRow(doc, String(block.label), "", startY - 4, x, width);
          } else {
            nextY = startY;
          }
          doc.font("Helvetica").fontSize(10).fillColor("#000000");
          doc.text(display(String(block.value)), x, nextY, { width });
          nextY = doc.y + 12;
          break;
        }
        case "spacer":
          nextY = startY + (typeof block.height === "number" ? block.height : 8);
          break;
        case "text": {
          if (block.showWhen && !shouldShowBlock(ctx.tagMap, String(block.showWhen))) {
            break;
          }
          const size = typeof block.size === "number" ? block.size : 10;
          const font = block.bold ? "Helvetica-Bold" : "Helvetica";
          doc.font(font).fontSize(size).fillColor("#000000");
          doc.text(String(block.value), x, startY, {
            width,
            align: typeof block.align === "string" ? block.align : "left",
          });
          const gapAfter = typeof block.gapAfter === "number" ? block.gapAfter : 8;
          nextY = doc.y + gapAfter;
          break;
        }
        case "labeledLine":
          nextY = drawLabeledLine(doc, x, startY, width, {
            label: typeof block.label === "string" ? block.label : "",
            caption: typeof block.caption === "string" ? block.caption : "",
            value: typeof block.value === "string" ? block.value : "",
            size: typeof block.size === "number" ? block.size : undefined,
            bold: block.bold !== false,
          });
          break;
        case "lineStack":
          nextY = drawLineStack(
            doc,
            x,
            startY,
            width,
            typeof block.lines === "number" ? block.lines : 1,
            Array.isArray(block.values) ? block.values.map((v) => String(v)) : [],
            typeof block.rowHeight === "number" ? block.rowHeight : undefined,
          );
          break;
        case "table":
          nextY = drawTable(
            doc,
            x,
            startY,
            width,
            Array.isArray(block.columns)
              ? block.columns.map((col) => {
                  const c = /** @type {Record<string, unknown>} */ (col);
                  return {
                    label: String(c.label ?? ""),
                    width: typeof c.width === "number" ? c.width : undefined,
                    align: typeof c.align === "string" ? c.align : undefined,
                  };
                })
              : [],
            {
              rowCount: typeof block.rowCount === "number" ? block.rowCount : undefined,
              rows: Array.isArray(block.rows)
                ? block.rows.map((row) =>
                    Array.isArray(row) ? row.map((cell) => String(cell)) : [],
                  )
                : undefined,
              headerFill: typeof block.headerFill === "string" ? block.headerFill : undefined,
              rowHeight: typeof block.rowHeight === "number" ? block.rowHeight : undefined,
            },
          );
          break;
        case "totalRow":
          nextY = drawTotalRow(doc, x, startY, width, {
            label: String(block.label),
            value: typeof block.value === "string" ? block.value : "",
            bold: Boolean(block.bold),
            box: Boolean(block.box),
          });
          break;
        case "cutHere":
          nextY = drawCutHere(
            doc,
            x,
            startY,
            width,
            typeof block.label === "string" ? block.label : "Cut here",
          );
          break;
        case "columns": {
          const cols = Array.isArray(block.columns) ? block.columns : [];
          const gap = typeof block.gap === "number" ? block.gap : 20;
          const fractions = columnFractions(block, cols.length);
          const inner = width - gap * Math.max(0, cols.length - 1);
          let colX = x;
          let maxY = startY;
          cols.forEach((col, i) => {
            const colWidth = inner * fractions[i];
            const children = Array.isArray(col) ? col : [];
            let colY = startY;
            for (const child of children) {
              if (!child || typeof child !== "object" || Array.isArray(child)) continue;
              colY = renderOne(
                /** @type {Record<string, unknown>} */ (child),
                colX,
                colWidth,
                colY,
              );
            }
            maxY = Math.max(maxY, colY);
            colX += colWidth + gap;
          });
          nextY = maxY;
          break;
        }
        case "imageAttachments": {
          if (images.length > 0 && attachmentPlan) {
            nextY = drawInlineAttachments(doc, images, startY, attachmentPlan, startNextPage);
            nextY += ATTACHMENT_TO_SIGNATURE_GAP;
          }
          break;
        }
        case "signature": {
          const bottom = doc.page.height - margin - GRID_FOOTER_RESERVE;
          let sigY = startY;
          if (sigY + SIGNATURE_BLOCK_HEIGHT > bottom) {
            startNextPage();
            sigY = margin;
          }
          const fields = Array.isArray(block.fields)
            ? block.fields.map((f) => String(f))
            : ["Name", "Signature", "Date"];
          const colW = width / fields.length;
          fields.forEach((field, index) => {
            drawUnderlineField(doc, field, colW - 12, x + colW * index, sigY);
          });
          nextY = sigY + SIGNATURE_BLOCK_HEIGHT;
          break;
        }
        default:
          break;
      }
      return nextY;
    };

    for (const raw of blocks) {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
      y = renderOne(/** @type {Record<string, unknown>} */ (raw), margin, contentWidth, y);
    }

    paintChrome();
    doc.end();
  });
}
