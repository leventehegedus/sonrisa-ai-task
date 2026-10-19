import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import ScoreBreakdown from './ScoreBreakdown'

afterEach(cleanup)
const base = { severity: 0.7, proximity: 0.75, proximityReason: 'subregion', override: false, importance: 0.525, threshold: 0.5, fires: true } as const

describe('ScoreBreakdown', () => {
  it('shows severity × proximity (reason) = importance and the threshold comparison', () => {
    render(<ScoreBreakdown b={base} />)
    expect(screen.getByText(/0\.70 × 0\.75 \(subregion\) = 0\.53/)).toBeTruthy()
    expect(screen.getByText('≥ 0.5')).toBeTruthy()
    expect(screen.queryByText('critical override')).toBeNull()
  })

  it('shows < threshold when it does not fire', () => {
    render(<ScoreBreakdown b={{ ...base, importance: 0.2, fires: false }} />)
    expect(screen.getByText('< 0.5')).toBeTruthy()
  })

  it('shows the critical override badge', () => {
    render(<ScoreBreakdown b={{ ...base, severity: 0.95, proximity: 0.2, proximityReason: 'elsewhere', override: true, importance: 0.19, fires: true }} />)
    expect(screen.getByText('critical override')).toBeTruthy()
  })
})
