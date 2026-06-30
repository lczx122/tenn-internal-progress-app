export interface Job {
  id: string
  customer_name: string
  address: string
  phone: string
  project: string
  stage: string
  key_holder: string
  start_date: string | null
  target_date: string | null
  is_archived: boolean
  created_at: string
  updated_at: string
  updated_by: string
  // Added in the unit revamp. Older rows default to empty / sensible values.
  unit_code: string
  is_owner: boolean
  owner_relationship: string
  house_types: string[]
  pic: string
  pics: string[]
  key_holder_type: string
  order_total: number
  // Per-trade order amounts (work category -> RM). Seeded from a Sales Order's
  // category_totals and/or entered per trade on the unit. Empty = not broken down.
  order_by_category?: Record<string, number>
}

export interface Project {
  id: string
  name: string
  created_at: string
}

// A payment collected from the customer against a unit's order total.
export interface Claim {
  id: string
  job_id: string
  category: string // one of CLAIM_CATEGORIES (payment stage)
  work_category?: string | null // the trade this collection is for (null = Unallocated)
  amount: number // resolved RM collected
  percent: number | null // set when entered as a % of the order total
  note: string
  collected_on: string | null
  created_by: string | null
  created_by_name: string
  created_at: string
}

export interface JobWork {
  id: string
  job_id: string
  category: string
  title: string
  stage: string
  remarks: string
  updated_by: string
  created_at: string
  updated_at: string
}

export type JobEventType = 'note' | 'stage' | 'key' | 'created'

export interface JobEvent {
  id: string
  job_id: string
  type: JobEventType
  body: string
  author_id: string | null
  author_name: string
  created_at: string
}

export type Role = 'admin' | 'staff' | 'boss' | 'guest'

export interface Profile {
  id: string
  full_name: string
  role: Role
  staff_pic?: string
}

export interface CostLine {
  label: string
  amount: number
}

// Commission is a COST: fixed RM, or a % of the selling price.
export interface CommLine {
  name: string
  kind: 'fixed' | 'pct'
  value: number
}

// Profit share is a % of gross profit.
export interface ShareLine {
  name: string
  percent: number
}

export interface Costing {
  id: string
  cash_sale_no: string
  category: string
  // Optional link to a Unit (work card). When set, the costing's progress /
  // status is derived live from that unit's work-card stages.
  job_id: string | null
  customer: string
  costing_date: string | null
  revenue: number // selling price
  costs: CostLine[]
  commissions: CommLine[]
  shares: ShareLine[]
  notes: string
  status: string
  created_by: string | null
  created_at: string
  updated_at: string
}

export type DocType = 'QT' | 'SO'

export interface Appointment {
  id: string
  title: string
  type: string
  job_id: string | null
  customer_name: string
  location: string
  who: string
  assigned_to: string | null
  assignee_ids: string[]
  starts_at: string
  ends_at: string | null
  status: 'scheduled' | 'done' | 'cancelled'
  notes: string
  is_private: boolean
  created_by: string | null
  created_by_name: string
  created_at: string
  updated_at: string
}

export interface Quotation {
  id: string
  number: string
  doc_type: DocType
  source_id: string | null
  yymm: string
  seq: number
  customer_name: string
  customer_phone: string
  unit: string
  prepared_by: string
  categories: string
  total: number
  payload: unknown
  created_by: string | null
  created_at: string
  unit_id?: string | null
}
