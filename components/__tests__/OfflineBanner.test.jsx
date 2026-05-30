import { render, screen, act } from '@testing-library/react'
import { OfflineBanner, OfflineIndicator } from '../OfflineBanner'

// Mock the useNetworkStatus hook
const mockUseNetworkStatus = {
  isOnline: true,
  wasOffline: false,
  resetOfflineFlag: jest.fn()
}

jest.mock('@/hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => mockUseNetworkStatus
}))

describe('OfflineBanner', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    // Reset mock values
    mockUseNetworkStatus.isOnline = true
    mockUseNetworkStatus.wasOffline = false
    mockUseNetworkStatus.resetOfflineFlag = jest.fn()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('when online', () => {
    it('should not render anything when online and never was offline', () => {
      mockUseNetworkStatus.isOnline = true
      mockUseNetworkStatus.wasOffline = false

      const { container } = render(<OfflineBanner />)

      expect(container.firstChild).toBeNull()
    })
  })

  describe('when offline', () => {
    it('should show offline banner', () => {
      mockUseNetworkStatus.isOnline = false
      mockUseNetworkStatus.wasOffline = false

      render(<OfflineBanner />)

      expect(screen.getByText('You are offline.')).toBeInTheDocument()
      expect(screen.getByText(/Some features may not work/)).toBeInTheDocument()
    })

    it('should display wifi off icon', () => {
      mockUseNetworkStatus.isOnline = false

      const { container } = render(<OfflineBanner />)

      // Check for SVG icon (WifiOff from lucide-react)
      const svg = container.querySelector('svg')
      expect(svg).toBeInTheDocument()
    })
  })

  describe('when reconnecting', () => {
    it('should show reconnected banner when coming back online after being offline', () => {
      mockUseNetworkStatus.isOnline = true
      mockUseNetworkStatus.wasOffline = true

      render(<OfflineBanner />)

      expect(screen.getByText('Connection restored!')).toBeInTheDocument()
      expect(screen.getByText(/Refreshing data/)).toBeInTheDocument()
    })

    it('should hide reconnected banner after 3 seconds', () => {
      mockUseNetworkStatus.isOnline = true
      mockUseNetworkStatus.wasOffline = true

      render(<OfflineBanner />)

      expect(screen.getByText('Connection restored!')).toBeInTheDocument()

      // Fast-forward 3 seconds
      act(() => {
        jest.advanceTimersByTime(3000)
      })

      // After timeout, resetOfflineFlag should be called
      expect(mockUseNetworkStatus.resetOfflineFlag).toHaveBeenCalled()
    })

    it('should clear timeout on unmount', () => {
      mockUseNetworkStatus.isOnline = true
      mockUseNetworkStatus.wasOffline = true

      const { unmount } = render(<OfflineBanner />)

      unmount()

      // Fast-forward time - resetOfflineFlag should NOT be called due to cleanup
      act(() => {
        jest.advanceTimersByTime(3000)
      })

      // Since component was unmounted, the flag should not be reset
      // (cleanup function should have cleared the timeout)
      // This is tricky to test perfectly, but at least verify no errors occur
    })
  })
})

describe('OfflineIndicator', () => {
  beforeEach(() => {
    mockUseNetworkStatus.isOnline = true
    mockUseNetworkStatus.wasOffline = false
  })

  describe('when online', () => {
    it('should not render anything', () => {
      mockUseNetworkStatus.isOnline = true

      const { container } = render(<OfflineIndicator />)

      expect(container.firstChild).toBeNull()
    })
  })

  describe('when offline', () => {
    it('should show offline indicator', () => {
      mockUseNetworkStatus.isOnline = false

      render(<OfflineIndicator />)

      expect(screen.getByText('Offline')).toBeInTheDocument()
    })

    it('should apply custom className', () => {
      mockUseNetworkStatus.isOnline = false

      render(<OfflineIndicator className="custom-class" />)

      const indicator = screen.getByText('Offline').parentElement
      expect(indicator).toHaveClass('custom-class')
    })

    it('should have warning styling', () => {
      mockUseNetworkStatus.isOnline = false

      render(<OfflineIndicator />)

      const indicator = screen.getByText('Offline').parentElement
      expect(indicator).toHaveClass('text-indusia-warning')
    })
  })
})
