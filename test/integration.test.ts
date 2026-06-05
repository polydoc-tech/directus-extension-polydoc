import { describe, expect, it } from 'vitest';
import { buildRequestBody, type PolyDocParams } from '../src/lib/build-request-body.js';

const API_KEY = process.env.POLYDOC_API_KEY;
const BASE = (process.env.POLYDOC_BASE_URL ?? 'https://api.polydoc.tech').replace(/\/+$/, '');
const TEMPLATE_ID = process.env.POLYDOC_TEMPLATE_ID ?? 'jlE-whg';

/**
 * Exercises the same buildRequestBody the operation handler uses, against the
 * real API in sandbox mode (X-Sandbox: true never touches production quota).
 * Skipped unless POLYDOC_API_KEY is set, so CI without the secret stays green.
 */
async function call(params: PolyDocParams): Promise<Response> {
  const { endpoint, body } = buildRequestBody(params);
  return fetch(`${BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
      'X-Sandbox': 'true',
    },
    body: JSON.stringify(body),
  });
}

const directusFile: PolyDocParams['delivery'] = { mode: 'directusFile' };

const INVOICE = {
  number: 'INV-SMOKE-1',
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
    { description: 'Widget', quantity: 2, unitPrice: 10, lineTotal: 20, vatRate: 19, vatCategoryCode: 'S' },
  ],
  taxSummary: [{ categoryCode: 'S', rate: 19, taxableAmount: 20, taxAmount: 3.8 }],
  paymentTerms: 'Net 30',
  totalNetAmount: 20,
  totalTaxAmount: 3.8,
  totalGrossAmount: 23.8,
};

describe.skipIf(!API_KEY)('PolyDoc live API (sandbox)', () => {
  it('PDF from inline HTML returns a PDF', async () => {
    const res = await call({
      operation: 'pdf',
      sourceType: 'html',
      html: '<h1>Directus smoke test</h1>',
      delivery: directusFile,
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/pdf');
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('PDF from a saved template renders', async () => {
    const res = await call({
      operation: 'pdf',
      sourceType: 'template',
      templateId: TEMPLATE_ID,
      templateData: { invoice_number: 'INV-1', customer_name: 'Acme' },
      delivery: directusFile,
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/pdf');
  });

  it('Screenshot from URL returns a PNG', async () => {
    const res = await call({
      operation: 'screenshot',
      sourceType: 'url',
      url: 'https://example.com',
      screenshotOptions: { imageType: 'png', fullPage: true },
      delivery: directusFile,
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('image/png');
  });

  it('E-Invoice (ZUGFeRD / EN 16931) returns a hybrid PDF', async () => {
    const res = await call({
      operation: 'einvoice',
      sourceType: 'html',
      html: '<h1>Invoice INV-SMOKE-1</h1>',
      eInvoiceStandard: 'zugferd',
      eInvoiceProfile: 'en16931',
      eInvoiceVerify: true,
      invoice: INVOICE,
      delivery: directusFile,
    });
    if (res.status !== 200) {
      throw new Error(`E-Invoice failed (${res.status}): ${await res.text()}`);
    }
    expect(res.headers.get('content-type')).toContain('application/pdf');
  });
});
