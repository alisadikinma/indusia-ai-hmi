/**
 * Defect Trend Chart Component
 * Line chart showing defect trends over time
 */

'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts'

export function DefectTrendChart({ data, loading }) {
  if (loading) {
    return (
      <div className="bg-indusia-surface rounded-xl border border-indusia-border p-6">
        <div className="h-4 w-32 bg-indusia-border rounded mb-4 animate-pulse"></div>
        <div className="h-64 bg-indusia-surfaceMuted rounded animate-pulse"></div>
      </div>
    )
  }

  const hasData = data && data.length > 0

  return (
    <div className="bg-indusia-surface rounded-xl border border-indusia-border p-6">
      <h3 className="text-lg font-semibold text-indusia-text mb-4">Defect Trend</h3>
      {hasData ? (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2D3E56" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12, fill: '#8A95A8' }}
              tickFormatter={(date) =>
                new Date(date).toLocaleDateString('id-ID', {
                  day: '2-digit',
                  month: 'short'
                })
              }
              stroke="#2D3E56"
            />
            <YAxis tick={{ fontSize: 12, fill: '#8A95A8' }} stroke="#2D3E56" />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1A2942',
                borderRadius: '8px',
                border: '1px solid #2D3E56',
                color: '#E8EDF2'
              }}
              labelStyle={{ color: '#E8EDF2' }}
              labelFormatter={(date) =>
                new Date(date).toLocaleDateString('id-ID', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long'
                })
              }
            />
            <Legend
              wrapperStyle={{ color: '#8A95A8' }}
              formatter={(value) => <span style={{ color: '#8A95A8' }}>{value}</span>}
            />
            <Line
              type="monotone"
              dataKey="totalDefect"
              name="Defects"
              stroke="#EF4444"
              strokeWidth={2}
              dot={{ fill: '#EF4444', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, fill: '#EF4444' }}
            />
            <Line
              type="monotone"
              dataKey="defectRate"
              name="Defect Rate (%)"
              stroke="#F59E0B"
              strokeWidth={2}
              dot={{ fill: '#F59E0B', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, fill: '#F59E0B' }}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-64 flex items-center justify-center text-indusia-textMuted">
          No trend data available
        </div>
      )}
    </div>
  )
}

export default DefectTrendChart
