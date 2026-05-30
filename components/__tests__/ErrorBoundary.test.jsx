import { render, screen, fireEvent } from '@testing-library/react'
import { ErrorBoundary, withErrorBoundary } from '../ErrorBoundary'

// Component that throws an error
const ThrowError = ({ shouldThrow = true }) => {
  if (shouldThrow) {
    throw new Error('Test error message')
  }
  return <div>No error</div>
}

// Suppress console.error for cleaner test output
const originalError = console.error
beforeAll(() => {
  console.error = jest.fn()
})
afterAll(() => {
  console.error = originalError
})

describe('ErrorBoundary', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Reset fetch mock
    global.fetch.mockReset()
  })

  describe('when no error occurs', () => {
    it('should render children normally', () => {
      render(
        <ErrorBoundary>
          <div>Child content</div>
        </ErrorBoundary>
      )

      expect(screen.getByText('Child content')).toBeInTheDocument()
    })
  })

  describe('when an error occurs', () => {
    it('should display error UI', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      )

      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
      expect(screen.getByText('An unexpected error occurred')).toBeInTheDocument()
    })

    it('should display refresh button', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      )

      expect(screen.getByRole('button', { name: /refresh page/i })).toBeInTheDocument()
    })

    it('should display try again button', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      )

      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
    })

    it('should display go back button', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      )

      expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument()
    })

    it('should log error to server', () => {
      global.fetch.mockResolvedValueOnce({ ok: true })

      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      )

      expect(global.fetch).toHaveBeenCalledWith('/api/error-log', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('Test error message')
      }))
    })

    it('should reset error state when Try Again is clicked', () => {
      // Use a controlled component that we can change
      let throwError = true
      const ConditionalError = () => {
        if (throwError) throw new Error('Test error')
        return <div>Success after retry</div>
      }

      const { rerender } = render(
        <ErrorBoundary>
          <ConditionalError />
        </ErrorBoundary>
      )

      expect(screen.getByText('Something went wrong')).toBeInTheDocument()

      // Stop throwing before clicking retry
      throwError = false

      // Click try again - this resets the error boundary state
      fireEvent.click(screen.getByRole('button', { name: /try again/i }))

      // The error boundary should re-render children (which now doesn't throw)
      expect(screen.getByText('Success after retry')).toBeInTheDocument()
    })

    it('should have clickable refresh button', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      )

      const refreshButton = screen.getByRole('button', { name: /refresh page/i })
      expect(refreshButton).toBeInTheDocument()

      // Verify button is clickable (doesn't throw)
      expect(() => fireEvent.click(refreshButton)).not.toThrow()
    })
  })

  describe('with custom fallback', () => {
    it('should render custom fallback when provided', () => {
      const customFallback = <div>Custom error message</div>

      render(
        <ErrorBoundary fallback={customFallback}>
          <ThrowError />
        </ErrorBoundary>
      )

      expect(screen.getByText('Custom error message')).toBeInTheDocument()
      expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument()
    })
  })

  describe('error logging', () => {
    it('should handle logging failure gracefully', () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'))
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation()

      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      )

      // Error UI should still be displayed
      expect(screen.getByText('Something went wrong')).toBeInTheDocument()

      warnSpy.mockRestore()
    })
  })
})

describe('withErrorBoundary HOC', () => {
  it('should wrap component with error boundary', () => {
    const WrappedComponent = withErrorBoundary(() => <div>Wrapped content</div>)

    render(<WrappedComponent />)

    expect(screen.getByText('Wrapped content')).toBeInTheDocument()
  })

  it('should catch errors from wrapped component', () => {
    const WrappedThrowError = withErrorBoundary(ThrowError)

    render(<WrappedThrowError shouldThrow={true} />)

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  it('should use custom fallback when provided', () => {
    const customFallback = <div>HOC fallback</div>
    const WrappedThrowError = withErrorBoundary(ThrowError, customFallback)

    render(<WrappedThrowError shouldThrow={true} />)

    expect(screen.getByText('HOC fallback')).toBeInTheDocument()
  })

  it('should pass props through to wrapped component', () => {
    const TestComponent = ({ message }) => <div>{message}</div>
    const WrappedComponent = withErrorBoundary(TestComponent)

    render(<WrappedComponent message="Hello from props" />)

    expect(screen.getByText('Hello from props')).toBeInTheDocument()
  })
})
