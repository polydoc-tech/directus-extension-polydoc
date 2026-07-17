export const DEFAULT_BASE_URL = 'https://api.polydoc.tech';

/**
 * Hard ceiling for a single API request. The gateway caps a conversion at 10
 * minutes and holds the connection open until it resolves, so 15 minutes clears
 * any legitimate slow render plus queue and network overhead. Its only job is to
 * break a dead or stalled connection that would otherwise hang the flow forever.
 */
export const REQUEST_TIMEOUT_MS = 900_000;

export const PDF_CONVERT_PATH = '/pdf/convert';
export const SCREENSHOT_CONVERT_PATH = '/screenshot/convert';

export const PAGE_FORMATS = ['A3', 'A4', 'A5', 'Ledger', 'Legal', 'Letter', 'Tabloid'] as const;

export const IMAGE_TYPES = ['png', 'jpeg', 'webp'] as const;

export const EINVOICE_STANDARDS = ['zugferd', 'facturx'] as const;

export const EINVOICE_PROFILES = ['minimum', 'basicwl', 'basic', 'en16931', 'extended'] as const;
