/**
 * Defect Pareto Chart Component
 * Bar chart showing top defect types (Pareto analysis)
 */

'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts'

export function DefectPareto({ data, loading }) {
  if (loading) {
    return (
      <div className="bg-indusia-surface rounded-xl border border-indusia-border p-6">
        <div className="h-4 w-32 bg-indusia-border rounded mb-4 animate-pulse"></div>
        <div className="h-64 bg-indusia-surfaceMuted rounded animate-pulse"></div>
      </div>
    )
  }

  const severityColors = {
    critical: '#DC2626',
    major: '#F97316',
    minor: '#FBBF24',
    cosmetic: '#6B7280',
    unknown: '#3B82F6'
  }

  const hasData = data && data.length > 0

  return (
    <div className="bg-indusia-surface rounded-xl border border-indusia-border p-6">
      <h3 className="text-lg font-semibold text-indusia-text mb-4">
        Top Defect Types (Pareto)
      </h3>
      {hasData ? (
        <>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#2D3E56" />
              <XAxis
                type="number"
                tick={{ fontSize: 12, fill: '#8A95A8' }}
                stroke="#2D3E56"
              />
              <YAxis
                type="category"
                dataKey="defectName"
                tick={{ fontSize: 12, fill: '#8A95A8' }}
                width={120}
                stroke="#2D3E56"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1A2942',
                  borderRadius: '8px',
                  border: '1px solid #2D3E56',
                  color: '#E8EDF2'
                }}
                formatter={(value, name) => [
                  value,
                  name === 'count' ? 'Count' : name
                ]}
                labelStyle={{ color: '#E8EDF2' }}
              />
              <Bar dataKey="count" name="Count" radius={[0, 4, 4, 0]}>
                {data?.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color || severityColors[entry.severity] || '#3B82F6'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Legend */}
          <div className="flex gap-4 mt-4 justify-center text-sm flex-wrap">
            {Object.entries(severityColors)
              .filter(([key]) => key !== 'unknown')
              .map(([severity, color]) => (
                <div key={severity} className="flex items-center gap-1">
                  <div
                    className="w-3 h-3 rounded"
                    style={{ backgroundColor: color }}
                  ></div>
                  <span className="capitalize text-indusia-textMuted">{severity}</span>
                </div>
              ))}
          </div>
        </>
      ) : (
        <div className="h-64 flex items-center justify-center text-indusia-textMuted">
          No pareto data available
        </div>
      )}
    </div>
  )
}

export default DefectPareto
