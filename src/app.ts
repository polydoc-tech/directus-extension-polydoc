import { defineOperationApp } from '@directus/extensions-sdk';
import {
  EINVOICE_PROFILES,
  EINVOICE_STANDARDS,
  IMAGE_TYPES,
  PAGE_FORMATS,
} from './lib/constants.js';

type Rule = Record<string, unknown>;

/** Meta fragment that hides a field unless `rule` matches another option's value. */
function onlyWhen(rule: Rule) {
  return {
    hidden: true,
    conditions: [{ name: 'show', rule, hidden: false }],
  };
}

const choices = (values: readonly string[], labels?: Record<string, string>) =>
  values.map((value) => ({ text: labels?.[value] ?? value, value }));

const EXAMPLE_INVOICE = {
  number: 'INV-001',
  issueDate: '2026-01-31',
  dueDate: '2026-03-02',
  currencyCode: 'EUR',
  seller: {
    name: 'Your Company GmbH',
    address: { line1: 'Main St 1', city: 'Berlin', postalCode: '10115', countryCode: 'DE' },
    taxId: 'DE123456789',
  },
  buyer: {
    name: 'Customer SARL',
    address: { line1: 'Rue 2', city: 'Paris', postalCode: '75001', countryCode: 'FR' },
  },
  lines: [
    {
      description: 'Widget',
      quantity: 2,
      unitPrice: 10,
      lineTotal: 20,
      vatRate: 19,
      vatCategoryCode: 'S',
    },
  ],
  taxSummary: [{ categoryCode: 'S', rate: 19, taxableAmount: 20, taxAmount: 3.8 }],
  paymentTerms: 'Net 30',
  totalNetAmount: 20,
  totalTaxAmount: 3.8,
  totalGrossAmount: 23.8,
};

export default defineOperationApp({
  id: 'polydoc',
  name: 'PolyDoc',
  icon: 'picture_as_pdf',
  description: 'Convert HTML or URLs to PDF, capture screenshots, and generate EU e-invoices.',
  overview: ({ operation, sourceType, deliveryMode }) => [
    { label: 'Operation', text: String(operation ?? 'pdf') },
    { label: 'Source', text: String(sourceType ?? 'url') },
    { label: 'Delivery', text: String(deliveryMode ?? 'directusFile') },
  ],
  options: [
    {
      field: 'operation',
      name: 'Operation',
      type: 'string',
      meta: {
        width: 'half',
        interface: 'select-dropdown',
        options: {
          choices: choices(['pdf', 'screenshot', 'einvoice'], {
            pdf: 'HTML/URL to PDF',
            screenshot: 'Capture Screenshot',
            einvoice: 'Generate E-Invoice',
          }),
        },
      },
      schema: { default_value: 'pdf' },
    },
    {
      field: 'sourceType',
      name: 'Source',
      type: 'string',
      meta: {
        width: 'half',
        interface: 'select-dropdown',
        options: {
          choices: choices(['url', 'html', 'template'], {
            url: 'URL (render a web page)',
            html: 'HTML (render an inline string)',
            template: 'Template (saved PolyDoc template)',
          }),
        },
        note: 'Where the document content comes from.',
      },
      schema: { default_value: 'url' },
    },

    // Source inputs
    {
      field: 'url',
      name: 'URL',
      type: 'string',
      meta: {
        width: 'full',
        interface: 'input',
        options: { placeholder: 'https://example.com' },
        ...onlyWhen({ sourceType: { _eq: 'url' } }),
      },
    },
    {
      field: 'html',
      name: 'HTML',
      type: 'text',
      meta: {
        width: 'full',
        interface: 'input-multiline',
        options: { placeholder: '<h1>Hello</h1>' },
        ...onlyWhen({ sourceType: { _eq: 'html' } }),
      },
    },
    {
      field: 'templateId',
      name: 'Template ID',
      type: 'string',
      meta: {
        width: 'half',
        interface: 'input',
        note: 'ID of the saved template (from the PolyDoc dashboard).',
        ...onlyWhen({ sourceType: { _eq: 'template' } }),
      },
    },
    {
      field: 'templateData',
      name: 'Template Data',
      type: 'json',
      meta: {
        width: 'full',
        interface: 'input-code',
        options: { language: 'json' },
        note: 'Data passed to the Liquid template renderer.',
        ...onlyWhen({ sourceType: { _eq: 'template' } }),
      },
      schema: { default_value: {} },
    },

    // E-Invoice
    {
      field: 'eInvoiceStandard',
      name: 'E-Invoice Standard',
      type: 'string',
      meta: {
        width: 'half',
        interface: 'select-dropdown',
        options: {
          choices: choices(EINVOICE_STANDARDS, { zugferd: 'ZUGFeRD', facturx: 'Factur-X' }),
        },
        ...onlyWhen({ operation: { _eq: 'einvoice' } }),
      },
      schema: { default_value: 'zugferd' },
    },
    {
      field: 'eInvoiceProfile',
      name: 'E-Invoice Profile',
      type: 'string',
      meta: {
        width: 'half',
        interface: 'select-dropdown',
        options: { choices: choices(EINVOICE_PROFILES) },
        note: 'EN 16931 data granularity profile.',
        ...onlyWhen({ operation: { _eq: 'einvoice' } }),
      },
      schema: { default_value: 'en16931' },
    },
    {
      field: 'invoice',
      name: 'Invoice Data',
      type: 'json',
      meta: {
        width: 'full',
        interface: 'input-code',
        options: { language: 'json' },
        note: 'Structured invoice: seller, buyer, lines, totals (see docs.polydoc.tech).',
        ...onlyWhen({ operation: { _eq: 'einvoice' } }),
      },
      schema: { default_value: EXAMPLE_INVOICE },
    },
    {
      field: 'eInvoiceVerify',
      name: 'Verify Compliance',
      type: 'boolean',
      meta: {
        width: 'half',
        interface: 'boolean',
        note: 'Verify PDF/A and e-invoice compliance (fails the operation if invalid).',
        ...onlyWhen({ operation: { _eq: 'einvoice' } }),
      },
      schema: { default_value: false },
    },

    // PDF layout options
    {
      field: 'format',
      name: 'Page Format',
      type: 'string',
      meta: {
        width: 'half',
        interface: 'select-dropdown',
        options: { choices: choices(PAGE_FORMATS) },
        ...onlyWhen({ operation: { _eq: 'pdf' } }),
      },
      schema: { default_value: 'A4' },
    },
    {
      field: 'landscape',
      name: 'Landscape',
      type: 'boolean',
      meta: {
        width: 'half',
        interface: 'boolean',
        ...onlyWhen({ operation: { _eq: 'pdf' } }),
      },
      schema: { default_value: false },
    },
    {
      field: 'printBackground',
      name: 'Print Background',
      type: 'boolean',
      meta: {
        width: 'half',
        interface: 'boolean',
        note: 'Print background graphics and colors.',
        ...onlyWhen({ operation: { _eq: 'pdf' } }),
      },
      schema: { default_value: true },
    },
    {
      field: 'scale',
      name: 'Scale',
      type: 'float',
      meta: {
        width: 'half',
        interface: 'input',
        note: 'Render scale, 0.1 to 2.',
        ...onlyWhen({ operation: { _eq: 'pdf' } }),
      },
      schema: { default_value: 1 },
    },
    {
      field: 'pageRanges',
      name: 'Page Ranges',
      type: 'string',
      meta: {
        width: 'half',
        interface: 'input',
        options: { placeholder: '1-5, 8, 11-13' },
        note: 'Pages to include; empty means all.',
        ...onlyWhen({ operation: { _eq: 'pdf' } }),
      },
    },
    {
      field: 'outline',
      name: 'Outline (Bookmarks)',
      type: 'boolean',
      meta: {
        width: 'half',
        interface: 'boolean',
        note: 'Generate PDF bookmarks from HTML headings.',
        ...onlyWhen({ operation: { _eq: 'pdf' } }),
      },
      schema: { default_value: false },
    },
    {
      field: 'tagged',
      name: 'Tagged (Accessible)',
      type: 'boolean',
      meta: {
        width: 'half',
        interface: 'boolean',
        note: 'Produce a tagged, accessible PDF.',
        ...onlyWhen({ operation: { _eq: 'pdf' } }),
      },
      schema: { default_value: false },
    },
    {
      field: 'marginTop',
      name: 'Margin Top',
      type: 'string',
      meta: {
        width: 'half',
        interface: 'input',
        options: { placeholder: '10mm' },
        ...onlyWhen({ operation: { _eq: 'pdf' } }),
      },
    },
    {
      field: 'marginRight',
      name: 'Margin Right',
      type: 'string',
      meta: {
        width: 'half',
        interface: 'input',
        options: { placeholder: '10mm' },
        ...onlyWhen({ operation: { _eq: 'pdf' } }),
      },
    },
    {
      field: 'marginBottom',
      name: 'Margin Bottom',
      type: 'string',
      meta: {
        width: 'half',
        interface: 'input',
        options: { placeholder: '10mm' },
        ...onlyWhen({ operation: { _eq: 'pdf' } }),
      },
    },
    {
      field: 'marginLeft',
      name: 'Margin Left',
      type: 'string',
      meta: {
        width: 'half',
        interface: 'input',
        options: { placeholder: '10mm' },
        ...onlyWhen({ operation: { _eq: 'pdf' } }),
      },
    },

    // Screenshot options
    {
      field: 'imageType',
      name: 'Image Type',
      type: 'string',
      meta: {
        width: 'half',
        interface: 'select-dropdown',
        options: { choices: choices(IMAGE_TYPES, { png: 'PNG', jpeg: 'JPEG', webp: 'WebP' }) },
        ...onlyWhen({ operation: { _eq: 'screenshot' } }),
      },
      schema: { default_value: 'png' },
    },
    {
      field: 'fullPage',
      name: 'Full Page',
      type: 'boolean',
      meta: {
        width: 'half',
        interface: 'boolean',
        note: 'Capture the entire scrollable page.',
        ...onlyWhen({ operation: { _eq: 'screenshot' } }),
      },
      schema: { default_value: false },
    },
    {
      field: 'quality',
      name: 'Quality',
      type: 'integer',
      meta: {
        width: 'half',
        interface: 'input',
        note: 'Compression quality for JPEG/WebP, 0 to 100.',
        ...onlyWhen({ operation: { _eq: 'screenshot' } }),
      },
      schema: { default_value: 80 },
    },
    {
      field: 'viewportWidth',
      name: 'Viewport Width',
      type: 'integer',
      meta: {
        width: 'half',
        interface: 'input',
        ...onlyWhen({ operation: { _eq: 'screenshot' } }),
      },
      schema: { default_value: 1280 },
    },
    {
      field: 'viewportHeight',
      name: 'Viewport Height',
      type: 'integer',
      meta: {
        width: 'half',
        interface: 'input',
        ...onlyWhen({ operation: { _eq: 'screenshot' } }),
      },
      schema: { default_value: 800 },
    },
    {
      field: 'devicePixelRatio',
      name: 'Device Pixel Ratio',
      type: 'integer',
      meta: {
        width: 'half',
        interface: 'input',
        note: 'e.g. 2 for retina (0 to 10).',
        ...onlyWhen({ operation: { _eq: 'screenshot' } }),
      },
      schema: { default_value: 1 },
    },

    // Delivery
    {
      field: 'deliveryMode',
      name: 'Delivery',
      type: 'string',
      meta: {
        width: 'half',
        interface: 'select-dropdown',
        options: {
          choices: choices(['directusFile', 'base64', 'cloudStorage', 'webhook'], {
            directusFile: 'Save to Directus File',
            base64: 'Base64 (return in output)',
            cloudStorage: 'Cloud Storage (presigned URL)',
            webhook: 'Webhook',
          }),
        },
        note: 'How the generated file is returned.',
      },
      schema: { default_value: 'directusFile' },
    },
    {
      field: 'folder',
      name: 'Target Folder',
      type: 'string',
      meta: {
        width: 'half',
        interface: 'system-folder',
        note: 'Optional folder for the created file.',
        ...onlyWhen({ deliveryMode: { _eq: 'directusFile' } }),
      },
    },
    {
      field: 'presignedUrl',
      name: 'Presigned URL',
      type: 'string',
      meta: {
        width: 'full',
        interface: 'input',
        note: 'HTTP PUT presigned URL from your storage provider.',
        ...onlyWhen({ deliveryMode: { _eq: 'cloudStorage' } }),
      },
    },
    {
      field: 'webhookUrl',
      name: 'Webhook URL',
      type: 'string',
      meta: {
        width: 'full',
        interface: 'input',
        note: 'URL the generated file is delivered to.',
        ...onlyWhen({ deliveryMode: { _eq: 'webhook' } }),
      },
    },
    {
      field: 'webhookOptions',
      name: 'Webhook Options',
      type: 'json',
      meta: {
        width: 'full',
        interface: 'input-code',
        options: { language: 'json' },
        note: 'Extra webhook settings (async, method, headers, retries, retryDelay, timeout).',
        ...onlyWhen({ deliveryMode: { _eq: 'webhook' } }),
      },
      schema: { default_value: {} },
    },

    // Connection + shared extras
    {
      field: 'apiKey',
      name: 'API Key',
      type: 'string',
      meta: {
        width: 'full',
        interface: 'input',
        options: { masked: true },
        note: 'PolyDoc API key. Leave blank to use the POLYDOC_API_KEY environment variable.',
      },
    },
    {
      field: 'sandbox',
      name: 'Sandbox',
      type: 'boolean',
      meta: {
        width: 'half',
        interface: 'boolean',
        note: 'Run in sandbox mode (higher quota, watermarked output).',
      },
      schema: { default_value: false },
    },
    {
      field: 'filename',
      name: 'Filename',
      type: 'string',
      meta: { width: 'half', interface: 'input' },
    },
    {
      field: 'tag',
      name: 'Tag',
      type: 'string',
      meta: { width: 'half', interface: 'input', note: 'Label for logging (max 30 chars).' },
    },
    {
      field: 'timeout',
      name: 'Timeout (ms)',
      type: 'integer',
      meta: { width: 'half', interface: 'input' },
      schema: { default_value: 30000 },
    },
    {
      field: 'advanced',
      name: 'Advanced (JSON)',
      type: 'json',
      meta: {
        width: 'full',
        interface: 'input-code',
        options: { language: 'json' },
        note: 'Raw fields deep-merged into the request body for any API option not exposed above (pdf.watermark, pdf.pdfa, pdf.ua, render, request).',
      },
      schema: { default_value: {} },
    },
  ],
});
