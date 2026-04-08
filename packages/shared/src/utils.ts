export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function formatCurrency(amount: number): string {
  return `GH₵${amount.toLocaleString('en-GH', { maximumFractionDigits: 0 })}`
}

export function getTimeAgo(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return date.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function getOrderId(id: string): string {
  return `#${id.slice(-6).toUpperCase()}`
}

export function parseNumber(v: unknown): number {
  return parseFloat(String(v || 0)) || 0
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}
