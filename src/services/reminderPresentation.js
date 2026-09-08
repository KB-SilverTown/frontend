export function reminderItems(value) {
  if (Array.isArray(value)) return value.filter(Boolean)
  if (Array.isArray(value?.items)) return value.items.filter(Boolean)
  if (Array.isArray(value?.data)) return value.data.filter(Boolean)
  return []
}

export function reminderId(reminder) {
  return String(reminder?.reminderId ?? reminder?.id ?? '').trim()
}

export function reminderScheduledAt(reminder) {
  return reminder?.scheduledAt ?? reminder?.remindAt ?? reminder?.dateTime
}

export function reminderTitle(reminder) {
  return String(reminder?.title ?? '').trim() || '제목 없는 알림'
}

export function reminderStatusLabel(status) {
  const labels = {
    SCHEDULED: '예약됨',
    ACTIVE: '진행 중',
    COMPLETED: '완료',
    CANCELLED: '취소됨',
    CANCELED: '취소됨',
  }
  const normalizedStatus = String(status ?? '')
    .trim()
    .toUpperCase()
  return labels[normalizedStatus] || (normalizedStatus ? String(status) : '상태 확인 중')
}

export function formatReminderDateTime(value) {
  if (!value) return '예약일시 확인 중'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)

  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function reminderInputValues(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return { date: '', time: '' }

  const pad = (part) => String(part).padStart(2, '0')
  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  }
}

export function buildReminderScheduledAt(dateValue, timeValue) {
  if (!dateValue || !timeValue) return null
  const date = new Date(`${dateValue}T${timeValue}:00`)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export function reminderSortTime(reminder) {
  const time = new Date(reminderScheduledAt(reminder)).getTime()
  return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY
}
