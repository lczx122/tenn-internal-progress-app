// The work categories a unit can have. Each category on a unit is tracked
// independently with its own stage (see stages.ts). Edit this list to add or
// rename categories — the dropdowns and badges update automatically.

export interface Category {
  key: string
  label: string
  accent: string // tailwind text/border accent for the category badge
}

// These MUST match the work categories the quotation/SO generator produces
// (computeWorkCategories / WORK_MAP in public/quotation.html), in the same order
// as the quote builder's sections, so staff see identical categories everywhere.
export const CATEGORIES: Category[] = [
  { key: 'Mindhome',         label: 'Mindhome',         accent: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
  { key: 'Aluminium Cabinet',label: 'Aluminium Cabinet',accent: 'text-cyan-700 bg-cyan-50 border-cyan-200' },
  { key: 'Iron Work',        label: 'Iron Work',        accent: 'text-body bg-page border-line-2' },
  { key: 'Aluminium Work',   label: 'Aluminium Work',   accent: 'text-sky-700 bg-sky-50 border-sky-200' },
  { key: 'Painting',         label: 'Painting',         accent: 'text-fuchsia-700 bg-fuchsia-50 border-fuchsia-200' },
  { key: 'Waterproofing',    label: 'Waterproofing',    accent: 'text-blue-700 bg-blue-50 border-blue-200' },
  { key: 'Smart Home',     label: 'Smart Home',      accent: 'text-teal-700 bg-teal-50 border-teal-200' },
  { key: 'Smart Lock',     label: 'Smart Lock',      accent: 'text-violet-700 bg-violet-50 border-violet-200' },
  { key: 'EE',             label: 'EE / Electrical', accent: 'text-rose-700 bg-rose-50 border-rose-200' },
  { key: 'Other Services', label: 'Other Services',  accent: 'text-amber-700 bg-amber-50 border-amber-200' },
]

const byKey = new Map(CATEGORIES.map((c) => [c.key, c]))

export function getCategory(key: string): Category {
  return (
    byKey.get(key) ?? {
      key,
      label: key,
      accent: 'text-body bg-surface-2 border-line',
    }
  )
}
