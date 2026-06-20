// Shared option lists + helpers for the Unit (job) form and Claims.
// Kept in one place so the New/Edit form, Unit detail and the Claims page agree.

// House types — staff can tick several (storey + lot type are independent).
export const HOUSE_TYPES = [
  'Single Storey',
  'Double Storey',
  'Semi-D Bungalow',
  'Bungalow',
  'Shop Lot',
  'Corner Lot',
  'Intermediate Lot',
  'End Lot',
  'Other',
] as const

// People who can be Person-In-Charge of a unit (and "other staff" key holders).
export const STAFF_PICS = [
  'Lucas',
  'Royce',
  'Kimchi',
  'Sally',
  'Winnie',
  'Billy',
  'Joey',
  'Ah Lee',
  'Sharon',
  'Angel',
  'Melissa',
  'CAM',
] as const

// Relationship to the owner when the contact person is not the owner.
export const RELATIONSHIPS = [
  'Spouse',
  'Son/Daughter',
  'Parent',
  'Sibling',
  'Friend',
  'Tenant',
  'Agent',
  'Other',
] as const

// Who is holding the keys. "Other Staff" reveals a staff picker, "Others" a text box.
export const KEY_HOLDER_TYPES = ['Office', 'PIC', 'Owner', 'Other Staff', 'Others'] as const
export type KeyHolderType = (typeof KEY_HOLDER_TYPES)[number]

// Match the signed-in display name to one of the fixed PIC names (case-insensitive)
// so the form can default the PIC to whoever is using the device.
export function defaultPic(displayName: string): string {
  const n = displayName.trim().toLowerCase()
  return STAFF_PICS.find((p) => p.toLowerCase() === n) ?? ''
}

// Build the human-readable key-holder label that is stored in jobs.key_holder
// and shown on cards/dashboard. `detail` is the staff name (Other Staff) or the
// free text (Others); `pic` lets the "PIC" choice resolve to the PIC's name.
export function keyHolderLabel(
  type: KeyHolderType,
  detail: string,
  pic: string,
): string {
  switch (type) {
    case 'PIC':
      return pic ? `PIC (${pic})` : 'PIC'
    case 'Other Staff':
      return detail.trim() || 'Other Staff'
    case 'Others':
      return detail.trim() || 'Others'
    case 'Owner':
      return 'Owner'
    case 'Office':
    default:
      return 'Office'
  }
}

// ---- Claims ----------------------------------------------------------------
// Standard claim progression categories. "Custom" buckets any custom amount or
// custom percentage entry. These are also the columns of the Claims summary.
export const CLAIM_CATEGORIES = [
  'Booking Fee / Deposit',
  '50% Collected',
  '100% Collected',
  'Custom',
] as const
export type ClaimCategory = (typeof CLAIM_CATEGORIES)[number]
