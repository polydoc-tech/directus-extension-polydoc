export const DEFAULT_BASE_URL = 'https://api.polydoc.tech';

export const PDF_CONVERT_PATH = '/pdf/convert';
export const SCREENSHOT_CONVERT_PATH = '/screenshot/convert';

export const PAGE_FORMATS = ['A3', 'A4', 'A5', 'Ledger', 'Legal', 'Letter', 'Tabloid'] as const;

export const IMAGE_TYPES = ['png', 'jpeg', 'webp'] as const;

export const EINVOICE_STANDARDS = ['zugferd', 'facturx'] as const;

export const EINVOICE_PROFILES = ['minimum', 'basicwl', 'basic', 'en16931', 'extended'] as const;
