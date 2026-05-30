'use client'
import { Component } from 'react'
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react'

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo })

    // Log to console for development
    console.error('[ErrorBoundary] Error caught:', error)
    console.error('[ErrorBoundary] Component stack:', errorInfo?.componentStack)

    // Send to backend for logging (fire and forget)
    this.logErrorToServer(error, errorInfo)
  }

  async logErrorToServer(error, errorInfo) {
    try {
      await fetch('/api/error-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: error?.message || 'Unknown error',
          stack: error?.stack || '',
          componentStack: errorInfo?.componentStack || '',
          url: typeof window !== 'undefined' ? window.location.href : '',
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
          timestamp: new Date().toISOString(),
          source: 'ErrorBoundary'
        })
      })
    } catch (logError) {
      // Silent fail - don't cause additional errors while handling an error
      console.warn('[ErrorBoundary] Failed to log error to server:', logError)
    }
  }

  handleRefresh = () => {
    if (typeof window !== 'undefined') {
      window.location.reload()
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  handleGoBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back()
    } else {
      window.location.href = '/'
    }
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI from props
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-indusia-bg p-4">
          <div className="bg-indusia-surface p-8 rounded-xl shadow-xl border border-indusia-border max-w-lg w-full">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-indusia-fail/10 rounded-lg">
                <AlertTriangle className="w-8 h-8 text-indusia-fail" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-indusia-text">
                  Something went wrong
                </h1>
                <p className="text-sm text-indusia-textMuted">
                  An unexpected error occurred
                </p>
              </div>
            </div>

            <p className="text-indusia-textMuted mb-6">
              We apologize for the inconvenience. The error has been logged and our team will investigate.
              Please try refreshing the page or contact support if the problem persists.
            </p>

            <div className="flex flex-wrap gap-3 mb-6">
              <button
                onClick={this.handleRefresh}
                className="flex items-center gap-2 px-4 py-2 bg-indusia-primary text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh Page
              </button>
              <button
                onClick={this.handleRetry}
                className="flex items-center gap-2 px-4 py-2 bg-indusia-surface border border-indusia-border text-indusia-text rounded-lg font-medium hover:bg-indusia-surfaceMuted transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={this.handleGoBack}
                className="flex items-center gap-2 px-4 py-2 bg-indusia-surface border border-indusia-border text-indusia-text rounded-lg font-medium hover:bg-indusia-surfaceMuted transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Go Back
              </button>
            </div>

            {/* Show error details in development */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="mt-4 p-4 bg-indusia-bg rounded-lg border border-indusia-border">
                <p className="text-xs font-mono text-indusia-fail mb-2">
                  {this.state.error.message}
                </p>
                <pre className="text-xs font-mono text-indusia-textMuted overflow-x-auto max-h-48 overflow-y-auto">
                  {this.state.error.stack}
                </pre>
                {this.state.errorInfo?.componentStack && (
                  <details className="mt-2">
                    <summary className="text-xs text-indusia-textMuted cursor-pointer hover:text-indusia-text">
                      Component Stack
                    </summary>
                    <pre className="text-xs font-mono text-indusia-textMuted overflow-x-auto mt-2">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * Higher-order component for wrapping components with error boundary
 */
export function withErrorBoundary(WrappedComponent, fallback = null) {
  return function WithErrorBoundaryWrapper(props) {
    return (
      <ErrorBoundary fallback={fallback}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    )
  }
}
