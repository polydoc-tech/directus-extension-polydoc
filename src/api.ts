import { defineOperationApi } from '@directus/extensions-sdk';
import {
  buildRequestBody,
  defaultFilename,
  extractApiErrorMessage,
  type PolyDocDeliveryMode,
  type PolyDocOperation,
  type PolyDocParams,
  type PolyDocSourceType,
} from './lib/build-request-body.js';
import { DEFAULT_BASE_URL } from './lib/constants.js';
import { saveToDirectusFile } from './lib/deliver.js';

type Options = Record<string, any>;

function asObject(value: unknown): Record<string, unknown> | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'object') return value as Record<string, unknown>;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === 'object' && parsed !== null
        ? (parsed as Record<string, unknown>)
        : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/** Collect a flat option subset into a nested options object, skipping blanks. */
function pick(options: Options, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    const value = options[key];
    if (value !== undefined && value !== null && value !== '') out[key] = value;
  }
  return out;
}

export default defineOperationApi<Options>({
  id: 'polydoc',
  handler: async (options, context) => {
    const { services, getSchema, database, accountability, env } = context as any;

    const apiKey = (options.apiKey as string) || (env.POLYDOC_API_KEY as string) || '';
    if (!apiKey) {
      throw new Error(
        'PolyDoc: no API key. Set the API Key option or the POLYDOC_API_KEY environment variable.',
      );
    }

    const baseUrl = ((options.baseUrl as string) || DEFAULT_BASE_URL).replace(/\/+$/, '');
    const sandbox = options.sandbox === true || options.sandbox === 'true';
    const operation = (options.operation as PolyDocOperation) ?? 'pdf';
    const sourceType = (options.sourceType as PolyDocSourceType) ?? 'url';
    const deliveryMode = (options.deliveryMode as PolyDocDeliveryMode) ?? 'directusFile';

    const params: PolyDocParams = {
      operation,
      sourceType,
      url: options.url,
      html: options.html,
      templateId: options.templateId,
      templateData: asObject(options.templateData),
      filename: options.filename || undefined,
      tag: options.tag || undefined,
      timeout: typeof options.timeout === 'number' ? options.timeout : undefined,
      advanced: asObject(options.advanced),
      delivery: { mode: deliveryMode },
    };

    if (operation === 'pdf') {
      params.pdfOptions = pick(options, [
        'format',
        'landscape',
        'printBackground',
        'scale',
        'pageRanges',
        'outline',
        'tagged',
        'marginTop',
        'marginRight',
        'marginBottom',
        'marginLeft',
      ]);
    } else if (operation === 'screenshot') {
      params.screenshotOptions = pick(options, [
        'imageType',
        'fullPage',
        'quality',
        'viewportWidth',
        'viewportHeight',
        'devicePixelRatio',
      ]);
    } else {
      params.eInvoiceStandard = options.eInvoiceStandard;
      params.eInvoiceProfile = options.eInvoiceProfile;
      params.eInvoiceVerify = options.eInvoiceVerify === true;
      params.invoice = asObject(options.invoice);
    }

    if (deliveryMode === 'cloudStorage') {
      params.delivery.presignedUrl = options.presignedUrl;
    } else if (deliveryMode === 'webhook') {
      const extra = asObject(options.webhookOptions) ?? {};
      params.delivery.webhook = { url: options.webhookUrl, ...extra };
    }

    const { endpoint, body, isBinary } = buildRequestBody(params);

    const res = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'X-Sandbox': sandbox ? 'true' : 'false',
      },
      body: JSON.stringify(body),
    });

    const conversionId = res.headers.get('x-conversion-id') ?? undefined;
    const creditUsed = res.headers.get('x-credit-used') ?? undefined;
    const contentType = (res.headers.get('content-type') ?? '').split(';')[0].trim();

    if (!res.ok) {
      const text = await res.text();
      const message = extractApiErrorMessage(text) ?? `PolyDoc request failed (HTTP ${res.status})`;
      throw new Error(message);
    }

    // Cloud storage and async webhook return a JSON receipt rather than the file.
    if (!isBinary) {
      const receipt = contentType.includes('application/json') ? await res.json() : { success: true };
      return { ...receipt, conversionId, creditUsed };
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    const imageType = params.screenshotOptions?.imageType as string | undefined;
    const filename = params.filename || defaultFilename(operation, imageType);
    const fileContentType = contentType || 'application/octet-stream';

    if (deliveryMode === 'base64') {
      return {
        base64: buffer.toString('base64'),
        filename,
        contentType: fileContentType,
        sizeBytes: buffer.length,
        conversionId,
        creditUsed,
      };
    }

    // Default: save straight into Directus Files.
    const fileId = await saveToDirectusFile(
      { services, getSchema, database, accountability, env },
      { buffer, filename, contentType: fileContentType, folder: options.folder || null },
    );

    return {
      fileId,
      filename,
      contentType: fileContentType,
      sizeBytes: buffer.length,
      conversionId,
      creditUsed,
    };
  },
});
