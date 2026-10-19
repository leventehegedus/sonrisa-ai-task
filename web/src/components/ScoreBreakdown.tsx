import { Badge } from '@/components/ui/badge'
import type { ScoreBreakdown as B } from '@/types'

export default function ScoreBreakdown({ b }: { b: B }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
      <span>
        {b.severity.toFixed(2)} × {b.proximity.toFixed(2)} ({b.proximityReason}) = {b.importance.toFixed(2)}
      </span>
      <span>{b.fires ? '≥' : '<'} {b.threshold}</span>
      {b.override && <Badge variant="destructive">critical override</Badge>}
    </span>
  )
}
