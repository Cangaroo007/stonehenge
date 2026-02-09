/**
 * Privacy Vault — Anonymization & Re-identification Engine
 *
 * Protects sensitive data before it reaches Claude for analysis.
 * Uses tokenization to swap names, addresses, emails, and phone numbers
 * for generic tokens (e.g., ENTITY_001, ADDRESS_001), then maps them back
 * once Claude returns its analysis.
 *
 * Designed for financial JSON data from Xero / MYOB integrations:
 *   - Invoices
 *   - Transactions
 *   - Contacts (suppliers, creditors, customers)
 *
 * Storage: In-memory Map by default, with an optional TTL for auto-expiry.
 * Each de-identification session gets a unique vault ID so multiple
 * concurrent analyses don't collide.
 */

import crypto from 'crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Categories of sensitive fields we detect and tokenize. */
export type SensitiveFieldCategory =
  | 'NAME'
  | 'ADDRESS'
  | 'EMAIL'
  | 'PHONE'
  | 'ABN'
  | 'BANK_ACCOUNT'
  | 'TAX_NUMBER';

/** A single mapping entry between a real value and its token. */
export interface VaultEntry {
  token: string;
  realValue: string;
  category: SensitiveFieldCategory;
  /** JSON path where this value was found (for audit trail). */
  fieldPath: string;
}

/** The full de-identification map for one session. */
export interface DeIdentificationMap {
  vaultId: string;
  createdAt: Date;
  expiresAt: Date;
  entityCount: number;
  entries: Map<string, VaultEntry>; // token -> VaultEntry
  /** Reverse lookup: real value -> token (for consistent replacement). */
  reverseIndex: Map<string, string>; // realValue -> token
}

/** Summary returned after de-identification. */
export interface DeIdentificationResult {
  vaultId: string;
  sanitizedData: unknown;
  fieldCounts: Record<SensitiveFieldCategory, number>;
  totalTokenized: number;
}

/** Options for the DeIdentifier. */
export interface DeIdentifierOptions {
  /** TTL in milliseconds for the vault. Default: 30 minutes. */
  ttlMs?: number;
  /** Additional field names to treat as sensitive (case-insensitive). */
  extraSensitiveFields?: string[];
  /** If true, redact values entirely instead of tokenizing. Default: false. */
  redactMode?: boolean;
}

// ---------------------------------------------------------------------------
// Field detection configuration
// ---------------------------------------------------------------------------

/**
 * Maps field-name patterns to sensitivity categories.
 * Matching is case-insensitive and checks whether the field name
 * *contains* any of the listed substrings.
 */
const SENSITIVE_FIELD_PATTERNS: Record<SensitiveFieldCategory, string[]> = {
  NAME: [
    'name', 'firstname', 'first_name', 'lastName', 'last_name',
    'contactname', 'contact_name', 'companyname', 'company_name',
    'displayname', 'display_name', 'fullname', 'full_name',
    'payeename', 'payee_name', 'payername', 'payer_name',
    'vendorname', 'vendor_name', 'suppliername', 'supplier_name',
    'directorname', 'director_name', 'creditorname', 'creditor_name',
  ],
  ADDRESS: [
    'address', 'addressline', 'address_line', 'street', 'streetaddress',
    'street_address', 'city', 'suburb', 'state', 'postcode', 'postalcode',
    'postal_code', 'zipcode', 'zip_code', 'country',
    'deliveryaddress', 'delivery_address', 'postaladdress', 'postal_address',
  ],
  EMAIL: [
    'email', 'emailaddress', 'email_address',
  ],
  PHONE: [
    'phone', 'phonenumber', 'phone_number', 'mobile', 'mobilenumber',
    'mobile_number', 'fax', 'faxnumber', 'fax_number', 'telephone',
  ],
  ABN: [
    'abn', 'taxnumber', 'tax_number', 'businessnumber', 'business_number',
  ],
  BANK_ACCOUNT: [
    'bankaccount', 'bank_account', 'accountnumber', 'account_number',
    'bsb', 'routingnumber', 'routing_number', 'iban', 'swiftcode', 'swift_code',
  ],
  TAX_NUMBER: [
    'tfn', 'taxfilenumber', 'tax_file_number', 'gst', 'vatnumber', 'vat_number',
  ],
};

/**
 * Prefixes used when generating tokens, making Claude's output human-readable.
 * e.g., ENTITY_001, ADDRESS_003, etc.
 */
const TOKEN_PREFIXES: Record<SensitiveFieldCategory, string> = {
  NAME: 'ENTITY',
  ADDRESS: 'ADDRESS',
  EMAIL: 'EMAIL',
  PHONE: 'PHONE',
  ABN: 'ABN',
  BANK_ACCOUNT: 'ACCOUNT',
  TAX_NUMBER: 'TAXREF',
};

// ---------------------------------------------------------------------------
// In-memory vault store (module-level singleton)
// ---------------------------------------------------------------------------

const vaultStore = new Map<string, DeIdentificationMap>();

/** Periodic cleanup of expired vaults (runs every 5 minutes). */
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

function ensureCleanupRunning(): void {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(() => {
    const now = new Date();
    for (const [id, vault] of vaultStore) {
      if (vault.expiresAt < now) {
        vaultStore.delete(id);
      }
    }
  }, 5 * 60 * 1000);
  // Allow Node to exit even if the interval is still running
  if (cleanupInterval && typeof cleanupInterval === 'object' && 'unref' in cleanupInterval) {
    cleanupInterval.unref();
  }
}

// ---------------------------------------------------------------------------
// DeIdentifier class
// ---------------------------------------------------------------------------

export class DeIdentifier {
  private readonly ttlMs: number;
  private readonly extraFields: string[];
  private readonly redactMode: boolean;

  constructor(options: DeIdentifierOptions = {}) {
    this.ttlMs = options.ttlMs ?? 30 * 60 * 1000; // 30 minutes default
    this.extraFields = (options.extraSensitiveFields ?? []).map((f) => f.toLowerCase());
    this.redactMode = options.redactMode ?? false;
    ensureCleanupRunning();
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Scans financial JSON data and replaces sensitive fields with tokens.
   *
   * @param data - Raw financial JSON (invoices, transactions, contacts, or an array of them).
   * @returns A DeIdentificationResult containing the sanitized data and a vault ID
   *          to use later for re-identification.
   */
  deIdentify(data: unknown): DeIdentificationResult {
    const vaultId = this.generateVaultId();
    const now = new Date();

    const vault: DeIdentificationMap = {
      vaultId,
      createdAt: now,
      expiresAt: new Date(now.getTime() + this.ttlMs),
      entityCount: 0,
      entries: new Map(),
      reverseIndex: new Map(),
    };

    const fieldCounts: Record<SensitiveFieldCategory, number> = {
      NAME: 0,
      ADDRESS: 0,
      EMAIL: 0,
      PHONE: 0,
      ABN: 0,
      BANK_ACCOUNT: 0,
      TAX_NUMBER: 0,
    };

    // Deep-clone and walk the data, replacing sensitive values in-place
    const sanitized = this.walkAndTokenize(
      structuredClone(data),
      vault,
      fieldCounts,
      '$',
    );

    // Persist the vault
    vaultStore.set(vaultId, vault);

    const totalTokenized = Object.values(fieldCounts).reduce((sum, c) => sum + c, 0);

    return {
      vaultId,
      sanitizedData: sanitized,
      fieldCounts,
      totalTokenized,
    };
  }

  /**
   * Retrieve the raw de-identification map for a given vault ID.
   * Useful for debugging or audit logging.
   */
  getVault(vaultId: string): DeIdentificationMap | undefined {
    return vaultStore.get(vaultId);
  }

  /**
   * Manually expire / destroy a vault (e.g., after re-identification is done).
   */
  destroyVault(vaultId: string): boolean {
    return vaultStore.delete(vaultId);
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  private generateVaultId(): string {
    return `vault_${crypto.randomBytes(16).toString('hex')}`;
  }

  /**
   * Recursively walk through data, detecting sensitive fields and replacing
   * their values with tokens.
   */
  private walkAndTokenize(
    node: unknown,
    vault: DeIdentificationMap,
    counts: Record<SensitiveFieldCategory, number>,
    path: string,
  ): unknown {
    if (node === null || node === undefined) return node;

    if (Array.isArray(node)) {
      return node.map((item, idx) =>
        this.walkAndTokenize(item, vault, counts, `${path}[${idx}]`),
      );
    }

    if (typeof node === 'object' && node !== null) {
      const obj = node as Record<string, unknown>;
      const result: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(obj)) {
        const fieldPath = `${path}.${key}`;
        const category = this.classifyField(key);

        if (category && typeof value === 'string' && value.trim().length > 0) {
          // This is a sensitive field with a string value — tokenize it
          const token = this.getOrCreateToken(value.trim(), category, fieldPath, vault);
          counts[category]++;
          result[key] = token;
        } else {
          // Recurse into nested objects / arrays
          result[key] = this.walkAndTokenize(value, vault, counts, fieldPath);
        }
      }

      return result;
    }

    // Primitives (number, boolean, string in non-sensitive context) pass through
    return node;
  }

  /**
   * Check if a field name matches any known sensitive category.
   */
  private classifyField(fieldName: string): SensitiveFieldCategory | null {
    const lower = fieldName.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Check user-provided extra fields first
    for (const extra of this.extraFields) {
      if (lower.includes(extra.replace(/[^a-z0-9]/g, ''))) {
        return 'NAME'; // Default extra fields to NAME category
      }
    }

    // Check built-in patterns
    for (const [category, patterns] of Object.entries(SENSITIVE_FIELD_PATTERNS)) {
      for (const pattern of patterns) {
        const normalizedPattern = pattern.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (lower === normalizedPattern || lower.includes(normalizedPattern)) {
          return category as SensitiveFieldCategory;
        }
      }
    }

    return null;
  }

  /**
   * Return an existing token for a value, or create a new one.
   * Ensures the same real value always maps to the same token within a session.
   */
  private getOrCreateToken(
    realValue: string,
    category: SensitiveFieldCategory,
    fieldPath: string,
    vault: DeIdentificationMap,
  ): string {
    // Check if we already tokenized this exact value
    const existingToken = vault.reverseIndex.get(realValue);
    if (existingToken) return existingToken;

    if (this.redactMode) {
      const token = '[REDACTED]';
      // In redact mode we don't store a reverse map (data is irreversibly removed)
      return token;
    }

    // Generate a new token
    vault.entityCount++;
    const prefix = TOKEN_PREFIXES[category];
    const token = `${prefix}_${String(vault.entityCount).padStart(3, '0')}`;

    // Store both directions
    vault.entries.set(token, {
      token,
      realValue,
      category,
      fieldPath,
    });
    vault.reverseIndex.set(realValue, token);

    return token;
  }
}

// ---------------------------------------------------------------------------
// ReIdentifier — standalone function
// ---------------------------------------------------------------------------

/**
 * Takes Claude's analysis output (which uses tokens like ENTITY_001) and swaps
 * the real names/values back in before saving to the final report.
 *
 * Works on any data shape — strings, objects, arrays, nested structures.
 * Performs both:
 *   1. Exact token replacement in string fields
 *   2. Substring replacement inside longer text blocks (e.g., Claude's narrative)
 *
 * @param analysisOutput - Claude's analysis result (any JSON-serializable shape).
 * @param vaultId - The vault ID returned by DeIdentifier.deIdentify().
 * @param destroyAfter - If true (default), destroy the vault after re-identification.
 * @returns The analysis with all tokens replaced by real values.
 * @throws Error if the vault ID is not found or has expired.
 */
export function reIdentify(
  analysisOutput: unknown,
  vaultId: string,
  destroyAfter = true,
): unknown {
  const vault = vaultStore.get(vaultId);

  if (!vault) {
    throw new Error(
      `Privacy vault "${vaultId}" not found. It may have expired or been destroyed.`
    );
  }

  if (vault.expiresAt < new Date()) {
    vaultStore.delete(vaultId);
    throw new Error(
      `Privacy vault "${vaultId}" has expired. De-identification map is no longer available.`
    );
  }

  // Build a sorted list of tokens (longest first) to avoid partial replacements
  const tokenPairs = Array.from(vault.entries.entries())
    .map(([token, entry]) => ({ token, realValue: entry.realValue }))
    .sort((a, b) => b.token.length - a.token.length);

  const result = walkAndReplace(analysisOutput, tokenPairs);

  if (destroyAfter) {
    vaultStore.delete(vaultId);
  }

  return result;
}

/**
 * Recursively walk data and replace tokens with real values.
 */
function walkAndReplace(
  node: unknown,
  tokenPairs: Array<{ token: string; realValue: string }>,
): unknown {
  if (node === null || node === undefined) return node;

  if (typeof node === 'string') {
    return replaceTokensInString(node, tokenPairs);
  }

  if (Array.isArray(node)) {
    return node.map((item) => walkAndReplace(item, tokenPairs));
  }

  if (typeof node === 'object' && node !== null) {
    const obj = node as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = walkAndReplace(value, tokenPairs);
    }
    return result;
  }

  return node;
}

/**
 * Replace all token occurrences in a single string.
 * Handles both exact matches and tokens embedded within prose text.
 */
function replaceTokensInString(
  text: string,
  tokenPairs: Array<{ token: string; realValue: string }>,
): string {
  let result = text;
  for (const { token, realValue } of tokenPairs) {
    // Use split/join for safe replacement without regex escaping issues
    result = result.split(token).join(realValue);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Convenience: one-shot helpers for common financial data shapes
// ---------------------------------------------------------------------------

/**
 * De-identify an array of Xero/MYOB-style contact objects.
 * Contacts typically have: Name, FirstName, LastName, EmailAddress,
 * Phones, Addresses, etc.
 */
export function deIdentifyContacts(
  contacts: unknown[],
  options?: DeIdentifierOptions,
): DeIdentificationResult {
  const engine = new DeIdentifier(options);
  return engine.deIdentify(contacts);
}

/**
 * De-identify an array of Xero/MYOB-style invoice objects.
 * Invoices embed Contact info, line items with descriptions, etc.
 */
export function deIdentifyInvoices(
  invoices: unknown[],
  options?: DeIdentifierOptions,
): DeIdentificationResult {
  const engine = new DeIdentifier(options);
  return engine.deIdentify(invoices);
}

/**
 * De-identify an array of transaction/journal objects.
 */
export function deIdentifyTransactions(
  transactions: unknown[],
  options?: DeIdentifierOptions,
): DeIdentificationResult {
  const engine = new DeIdentifier(options);
  return engine.deIdentify(transactions);
}

// ---------------------------------------------------------------------------
// Utility: get vault stats (for monitoring / admin dashboards)
// ---------------------------------------------------------------------------

export interface VaultStats {
  activeVaults: number;
  totalTokensStored: number;
  oldestVaultAge: number | null; // milliseconds
}

export function getVaultStats(): VaultStats {
  const now = Date.now();
  let totalTokens = 0;
  let oldestAge: number | null = null;

  for (const vault of vaultStore.values()) {
    totalTokens += vault.entries.size;
    const age = now - vault.createdAt.getTime();
    if (oldestAge === null || age > oldestAge) {
      oldestAge = age;
    }
  }

  return {
    activeVaults: vaultStore.size,
    totalTokensStored: totalTokens,
    oldestVaultAge: oldestAge,
  };
}
