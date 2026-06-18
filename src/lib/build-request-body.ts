import { PDF_CONVERT_PATH, SCREENSHOT_CONVERT_PATH } from './constants.js';

/**
 * Pure assembly of the PolyDoc request body from resolved operation options.
 * No I/O and no Directus references, so it is unit-testable in isolation and
 * stays the single source of truth for the request shape.
 * Ported from the n8n connector's GenericFunctions.buildRequestBody.
 */

export type PolyDocOperation = 'pdf' | 'screenshot' | 'einvoice';
export type PolyDocSourceType = 'url' | 'html' | 'template';
export type PolyDocDeliveryMode = 'directusFile' | 'base64' | 'cloudStorage' | 'webhook';

type Dict = Record<string, unknown>;

export interface PolyDocParams {
  operation: PolyDocOperation;
  sourceType: PolyDocSourceType;
  url?: string;
  html?: string;
  templateId?: string;
  templateData?: Dict;
  filename?: string;
  tag?: string;
  timeout?: number;
  /** PDF UI options: format, landscape, printBackground, scale, pageRanges, outline, tagged, margin* */
  pdfOptions?: Dict;
  /** Screenshot UI options: imageType, fullPage, quality, viewportWidth, viewportHeight, devicePixelRatio, encoding */
  screenshotOptions?: Dict;
  eInvoiceStandard?: 'facturx' | 'zugferd';
  eInvoiceProfile?: string;
  eInvoiceVerify?: boolean;
  invoice?: Dict;
  /** Raw object deep-merged into the request body for any field not surfaced as a control. */
  advanced?: Dict;
  delivery: {
    mode: PolyDocDeliveryMode;
    presignedUrl?: string;
    webhook?: Dict;
  };
}

export interface PolyDocRequest {
  endpoint: typeof PDF_CONVERT_PATH | typeof SCREENSHOT_CONVERT_PATH;
  body: Dict;
  /** True when the API returns the file bytes directly (no cloudStorage/webhook delivery field). */
  isBinary: boolean;
}

function isPlainObject(value: unknown): value is Dict {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Deep-merge `source` into `target` (source wins). Arrays and scalars overwrite. */
export function mergeDeep(target: Dict, source: Dict): Dict {
  const out: Dict = { ...target };
  for (const [key, value] of Object.entries(source)) {
    // The advanced JSON is user-supplied; skip prototype-pollution keys.
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    if (isPlainObject(value) && isPlainObject(out[key])) {
      out[key] = mergeDeep(out[key] as Dict, value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function resolveSource(params: PolyDocParams): string {
  switch (params.sourceType) {
    case 'url':
      return params.url ?? '';
    case 'html':
      return params.html ?? '';
    case 'template':
      return `[template:${params.templateId ?? ''}]`;
    default:
      return '';
  }
}

function buildLayout(opts: Dict): Dict | undefined {
  const layout: Dict = {};
  if (typeof opts.format === 'string' && opts.format !== '') layout.format = opts.format;
  for (const flag of ['landscape', 'printBackground', 'outline', 'tagged'] as const) {
    if (typeof opts[flag] === 'boolean') layout[flag] = opts[flag];
  }
  if (typeof opts.scale === 'number') layout.scale = opts.scale;
  if (typeof opts.pageRanges === 'string' && opts.pageRanges !== '')
    layout.pageRanges = opts.pageRanges;

  const margins = ['marginTop', 'marginRight', 'marginBottom', 'marginLeft'] as const;
  if (margins.some((m) => opts[m] !== undefined && opts[m] !== '')) {
    layout.margin = {
      top: opts.marginTop ?? '0',
      right: opts.marginRight ?? '0',
      bottom: opts.marginBottom ?? '0',
      left: opts.marginLeft ?? '0',
    };
  }
  return Object.keys(layout).length > 0 ? layout : undefined;
}

function buildScreenshot(opts: Dict): Dict | undefined {
  const shot: Dict = {};
  if (typeof opts.imageType === 'string' && opts.imageType !== '') shot.type = opts.imageType;
  if (typeof opts.fullPage === 'boolean') shot.fullPage = opts.fullPage;
  if (typeof opts.quality === 'number') shot.quality = opts.quality;
  if (opts.encoding === 'base64') shot.encoding = 'base64';
  if (typeof opts.viewportWidth === 'number' && typeof opts.viewportHeight === 'number') {
    const viewport: Dict = { width: opts.viewportWidth, height: opts.viewportHeight };
    if (typeof opts.devicePixelRatio === 'number' && opts.devicePixelRatio > 0)
      viewport.devicePixelRatio = opts.devicePixelRatio;
    shot.viewport = viewport;
  }
  return Object.keys(shot).length > 0 ? shot : undefined;
}

/**
 * Assemble the PolyDoc request body. Returns the endpoint to call, the body to
 * send, and whether the default (binary) delivery is in effect.
 */
export function buildRequestBody(params: PolyDocParams): PolyDocRequest {
  const endpoint =
    params.operation === 'screenshot' ? SCREENSHOT_CONVERT_PATH : PDF_CONVERT_PATH;
  const body: Dict = { source: resolveSource(params) };

  if (params.templateData && Object.keys(params.templateData).length > 0)
    body.templateData = params.templateData;
  if (params.filename) body.filename = params.filename;
  if (params.tag) body.tag = params.tag;
  if (typeof params.timeout === 'number' && params.timeout > 0) body.timeout = params.timeout;

  if (params.operation === 'pdf') {
    const layout = params.pdfOptions ? buildLayout(params.pdfOptions) : undefined;
    if (layout) body.layout = layout;
  }

  if (params.operation === 'screenshot') {
    const shot = params.screenshotOptions ? buildScreenshot(params.screenshotOptions) : undefined;
    if (shot) body.screenshot = shot;
  }

  if (params.operation === 'einvoice') {
    const eInvoice: Dict = {
      standard: params.eInvoiceStandard,
      profile: params.eInvoiceProfile,
      invoice: params.invoice ?? {},
    };
    if (typeof params.eInvoiceVerify === 'boolean') eInvoice.verify = params.eInvoiceVerify;
    body.eInvoice = eInvoice;
  }

  // directusFile and base64 both consume the binary file bytes from the API;
  // cloudStorage and webhook hand delivery to PolyDoc and get a JSON receipt.
  const isBinary = params.delivery.mode === 'directusFile' || params.delivery.mode === 'base64';
  if (params.delivery.mode === 'cloudStorage' && params.delivery.presignedUrl) {
    body.cloudStorage = { presignedUrl: params.delivery.presignedUrl };
  }
  if (params.delivery.mode === 'webhook' && params.delivery.webhook) {
    body.webhook = params.delivery.webhook;
  }

  const merged =
    params.advanced && Object.keys(params.advanced).length > 0
      ? mergeDeep(body, params.advanced)
      : body;

  return { endpoint, body: merged, isBinary };
}

/** Default output filename when the user did not set one. */
export function defaultFilename(operation: PolyDocOperation, imageType?: string): string {
  if (operation === 'screenshot') {
    const ext = imageType === 'jpeg' ? 'jpg' : (imageType ?? 'png');
    return `screenshot.${ext}`;
  }
  return 'document.pdf';
}

/**
 * Best-effort extraction of PolyDoc's `{ error, message }` from a response body
 * (already-parsed object, JSON string, or raw text).
 */
export function extractApiErrorMessage(payload: unknown): string | undefined {
  let value: unknown = payload;
  if (value instanceof ArrayBuffer) value = Buffer.from(value).toString('utf8');
  if (Buffer.isBuffer(value)) value = value.toString('utf8');
  if (typeof value === 'string') {
    const text = value;
    try {
      value = JSON.parse(text);
    } catch {
      return text || undefined;
    }
  }
  if (isPlainObject(value)) {
    return (value.message as string) ?? (value.error as string) ?? undefined;
  }
  return undefined;
}
