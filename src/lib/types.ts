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

export interface Profile {
  id: string
  full_name: string
  role: 'admin' | 'staff'
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
  starts_at: string
  ends_at: string | null
  status: 'scheduled' | 'done' | 'cancelled'
  notes: string
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
}
