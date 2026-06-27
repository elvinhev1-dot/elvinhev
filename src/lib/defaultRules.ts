import { ReplacementRule } from './docxEngine';

/** The buyer ("ALICI") column is table 0, cell index 1 in the sample
 * contract's layout (cell 0 = SATICI/seller, cell 1 = ALICI/buyer).
 * Scoping the buyer's bank-detail rules to this cell is what
 * prevents them from also matching the seller's bank block when the
 * two blocks happen to share identical literal values (a real
 * scenario in the sample document: both banks show the same VÖEN,
 * M/h, and SWIFT code). */
const BUYER_CELL = { tableIndex: 0, cellIndex: 1 };

/**
 * defaultRules.ts
 * ------------------------------------------------------------------
 * These rules describe HOW to turn the literal "SR TEXNO" sample
 * contract into a reusable {{placeholder}} template, and double as
 * the definition of the dynamic web form (label, input type,
 * example, required).
 *
 * Order matters: longer / more specific literal strings should be
 * listed before shorter ones that might be substrings of them. The
 * engine already sorts each rule's own `matches` array longest-first,
 * but the RULE ORDER below also matters because some values
 * (e.g. the two VÖEN numbers, the two M/h numbers) are ambiguous on
 * their own — they only become unambiguous when matched as part of
 * a longer surrounding string ("VÖEN: 1605720711" rather than just
 * "1605720711"). Keeping the labelled "Kod:", "M/h:", "SWIFT:" etc.
 * in the match string is what disambiguates the BUYER's bank block
 * from the SELLER's bank block, since both blocks use the same
 * field labels.
 * ------------------------------------------------------------------
 */
export const defaultRules: ReplacementRule[] = [
  {
    id: 'contract_number',
    label: 'Contract Number',
    placeholder: '{{contract_number}}',
    matches: ['№ 11/06-01'],
    inputType: 'text',
    example: '11/06-01',
    required: true,
  },
  {
    id: 'contract_date',
    label: 'Contract Date',
    placeholder: '{{contract_date}}',
    matches: ['«11» iyun 2026-ci il'],
    inputType: 'text',
    example: '«11» iyun 2026-ci il',
    required: true,
  },
  {
    id: 'buyer_company',
    label: 'Buyer Company Name',
    placeholder: '{{buyer_company}}',
    matches: ['“SR TEXNO” MMC', '"SR TEXNO" MMC', 'SR TEXNO” MMC'],
    inputType: 'text',
    example: '“SR TEXNO” MMC',
    required: true,
  },
  {
    id: 'director_name',
    label: 'Director Full Name',
    placeholder: '{{director_name}}',
    matches: ['Babaliyev Rolan İlqar oğlu'],
    inputType: 'text',
    example: 'Babaliyev Rolan İlqar oğlu',
    required: true,
  },
  {
    id: 'buyer_tin',
    label: 'Buyer TIN (VÖEN)',
    placeholder: '{{buyer_tin}}',
    matches: ['VÖEN: 1605720711'],
    scope: BUYER_CELL,
    inputType: 'text',
    example: '1605720711',
    required: true,
  },
  {
    id: 'bank_name',
    label: 'Bank Name',
    placeholder: '{{bank_name}}',
    matches: ['“Kapital Bank” ASC Xətai filialı', '"Kapital Bank" ASC Xətai filialı'],
    scope: BUYER_CELL,
    inputType: 'text',
    example: '“Kapital Bank” ASC Xətai filialı',
    required: true,
  },
  {
    id: 'bank_tin',
    label: 'Bank TIN',
    placeholder: '{{bank_tin}}',
    tagText: 'VÖEN: {{bank_tin}}',
    // The seller's bank block in the sample contract shares this
    // exact VÖEN value, so this rule MUST be scoped to the buyer
    // cell — otherwise it would also tag (and later overwrite) the
    // seller's bank TIN. tagText keeps the "VÖEN: " label in the
    // document itself, so the generated contract still reads
    // "VÖEN: <value>" in both columns, matching the seller column's
    // untouched formatting.
    matches: ['VÖEN: 9900003611'],
    scope: BUYER_CELL,
    inputType: 'text',
    example: '9900003611',
    required: true,
  },
  {
    id: 'bank_mh',
    label: 'Correspondent Account (M/h)',
    placeholder: '{{bank_mh}}',
    tagText: 'M/h: {{bank_mh}}',
    // Same caveat as bank_tin: identical to the seller's M/h in the
    // sample contract, so this must stay scoped to the buyer cell.
    // tagText keeps the "M/h:" label in the document for the same
    // formatting reason.
    matches: ['M/h: AZ37NABZ01350100000000001944'],
    scope: BUYER_CELL,
    inputType: 'text',
    example: 'AZ37NABZ01350100000000001944',
    required: true,
  },
  {
    id: 'bank_hh',
    label: 'Settlement Account (H/h)',
    placeholder: '{{bank_hh}}',
    tagText: 'H/h: {{bank_hh}}',
    matches: ['H/h: AZ06AIIB400600J9444676080107'],
    scope: BUYER_CELL,
    inputType: 'text',
    example: 'AZ06AIIB400600J9444676080107',
    required: true,
  },
  {
    id: 'bank_code',
    label: 'Bank Code',
    placeholder: '{{bank_code}}',
    tagText: 'Kod: {{bank_code}}',
    matches: ['Kod: 200071'],
    scope: BUYER_CELL,
    inputType: 'text',
    example: '200071',
    required: true,
  },
  {
    id: 'swift_code',
    label: 'SWIFT Code',
    placeholder: '{{swift_code}}',
    tagText: 'SWIFT: {{swift_code}}',
    // Same caveat: identical SWIFT code is used by both banks in the
    // sample contract, so this must stay scoped to the buyer cell.
    matches: ['SWIFT: AIIBAZ2XXXX'],
    scope: BUYER_CELL,
    inputType: 'text',
    example: 'AIIBAZ2XXXX',
    required: true,
  },
  {
    id: 'address',
    label: 'Address',
    placeholder: '{{address}}',
    // The sample contract does not print a standalone buyer address
    // line, so this has 0 occurrences in that file and will simply
    // not appear as a detected field for it — but it's kept here so
    // templates that DO include an address line pick it up
    // automatically, and so the form always offers the field the
    // brief asked for.
    matches: [],
    inputType: 'textarea',
    example: 'Bakı şəhəri, Yasamal rayonu, ...',
    required: false,
  },
];

/**
 * Convenience: strips the surrounding "{{" / "}}" from a placeholder
 * string, e.g. "{{buyer_company}}" -> "buyer_company".
 */
export function placeholderId(placeholder: string): string {
  return placeholder.replace(/[{}]/g, '').trim();
}
