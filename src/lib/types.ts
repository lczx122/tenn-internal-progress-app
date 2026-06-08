export interface Job {
  id: string
  customer_name: string
  address: string
  phone: string
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
}
