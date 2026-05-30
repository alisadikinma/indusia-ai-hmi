/**
 * Defect Heatmap Component
 * Canvas-based heatmap showing defect locations on PCB
 */

'use client'

import { useRef, useEffect } from 'react'

export function DefectHeatmap({ data, loading, pcbWidth = 400, pcbHeight = 300 }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (loading || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    // Clear canvas
    ctx.clearRect(0, 0, pcbWidth, pcbHeight)

    // Fill background
    ctx.fillStyle = '#152033'
    ctx.fillRect(0, 0, pcbWidth, pcbHeight)

    // Draw PCB outline
    ctx.strokeStyle = '#2D3E56'
    ctx.lineWidth = 2
    ctx.strokeRect(10, 10, pcbWidth - 20, pcbHeight - 20)

    // Draw grid
    ctx.strokeStyle = '#1A2942'
    ctx.lineWidth = 0.5
    for (let x = 30; x < pcbWidth - 10; x += 20) {
      ctx.beginPath()
      ctx.moveTo(x, 10)
      ctx.lineTo(x, pcbHeight - 10)
      ctx.stroke()
    }
    for (let y = 30; y < pcbHeight - 10; y += 20) {
      ctx.beginPath()
      ctx.moveTo(10, y)
      ctx.lineTo(pcbWidth - 10, y)
      ctx.stroke()
    }

    if (!data?.length) {
      // Draw "No data" text
      ctx.fillStyle = '#8A95A8'
      ctx.font = '14px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('No defect location data', pcbWidth / 2, pcbHeight / 2)
      return
    }

    // Find max count for normalization
    const maxCount = Math.max(...data.map((d) => d.count), 1)

    // Draw defect hotspots
    data.forEach((point) => {
      const intensity = point.intensity || point.count / maxCount
      const radius = 8 + intensity * 12

      // Scale coordinates to canvas size (assuming data is in 0-100 range)
      const x = (point.x / 100) * (pcbWidth - 40) + 20
      const y = (point.y / 100) * (pcbHeight - 40) + 20

      // Gradient from yellow to red based on intensity
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius)
      gradient.addColorStop(0, `rgba(239, 68, 68, ${0.6 + intensity * 0.4})`)
      gradient.addColorStop(0.5, `rgba(249, 115, 22, ${0.4 + intensity * 0.3})`)
      gradient.addColorStop(1, 'rgba(239, 68, 68, 0)')

      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.fillStyle = gradient
      ctx.fill()
    })
  }, [data, loading, pcbWidth, pcbHeight])

  if (loading) {
    return (
      <div className="bg-indusia-surface rounded-xl border border-indusia-border p-6">
        <div className="h-4 w-32 bg-indusia-border rounded mb-4 animate-pulse"></div>
        <div className="h-64 bg-indusia-surfaceMuted rounded animate-pulse"></div>
      </div>
    )
  }

  return (
    <div className="bg-indusia-surface rounded-xl border border-indusia-border p-6">
      <h3 className="text-lg font-semibold text-indusia-text mb-4">
        Defect Location Heatmap
      </h3>
      <div className="flex justify-center">
        <canvas
          ref={canvasRef}
          width={pcbWidth}
          height={pcbHeight}
          className="rounded border border-indusia-border"
        />
      </div>
      <div className="flex justify-center gap-6 mt-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-yellow-400"></div>
          <span className="text-indusia-textMuted">Low</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-orange-500"></div>
          <span className="text-indusia-textMuted">Medium</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-red-600"></div>
          <span className="text-indusia-textMuted">High</span>
        </div>
      </div>
    </div>
  )
}

export default DefectHeatmap
