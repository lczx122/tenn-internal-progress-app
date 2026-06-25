import type { JobEventType } from './types'

// The Icon name used for each job-event type in the activity timeline.
// Shared by JobDetail and Dashboard so the two stay in sync.
export function eventIconName(type: JobEventType): string {
  switch (type) {
    case 'stage':
      return 'trending-up'
    case 'key':
      return 'key'
    case 'created':
      return 'flag'
    default:
      return 'note'
  }
}
