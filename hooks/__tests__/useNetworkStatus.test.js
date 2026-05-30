import { renderHook, act } from '@testing-library/react'
import { useNetworkStatus, useNetworkRestore, useNetworkLost } from '../useNetworkStatus'

describe('useNetworkStatus', () => {
  let originalOnLine

  beforeEach(() => {
    // Store original value
    originalOnLine = navigator.onLine

    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      writable: true,
      configurable: true
    })
  })

  afterEach(() => {
    // Restore original value
    Object.defineProperty(navigator, 'onLine', {
      value: originalOnLine,
      writable: true,
      configurable: true
    })
  })

  it('should initialize with online status from navigator', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })

    const { result } = renderHook(() => useNetworkStatus())

    expect(result.current.isOnline).toBe(true)
    expect(result.current.wasOffline).toBe(false)
  })

  it('should set wasOffline flag when network is lost', () => {
    const { result } = renderHook(() => useNetworkStatus())

    expect(result.current.wasOffline).toBe(false)

    act(() => {
      // Simulate offline event using real browser event
      window.dispatchEvent(new Event('offline'))
    })

    // wasOffline should be set to true
    expect(result.current.wasOffline).toBe(true)
  })

  it('should maintain wasOffline flag after reconnecting', () => {
    const { result } = renderHook(() => useNetworkStatus())

    // First go offline
    act(() => {
      window.dispatchEvent(new Event('offline'))
    })

    expect(result.current.wasOffline).toBe(true)

    // Then go online
    act(() => {
      window.dispatchEvent(new Event('online'))
    })

    // wasOffline should still be true until explicitly reset
    expect(result.current.wasOffline).toBe(true)
  })

  it('should set lastOfflineAt when going offline', () => {
    const { result } = renderHook(() => useNetworkStatus())

    expect(result.current.lastOfflineAt).toBeNull()

    act(() => {
      window.dispatchEvent(new Event('offline'))
    })

    expect(result.current.lastOfflineAt).toBeInstanceOf(Date)
  })

  it('should set lastOnlineAt when coming back online', () => {
    const { result } = renderHook(() => useNetworkStatus())

    expect(result.current.lastOnlineAt).toBeNull()

    // Go offline first to set wasOffline
    act(() => {
      window.dispatchEvent(new Event('offline'))
    })

    // Then online
    act(() => {
      window.dispatchEvent(new Event('online'))
    })

    expect(result.current.lastOnlineAt).toBeInstanceOf(Date)
  })

  it('should reset wasOffline flag when resetOfflineFlag is called', () => {
    const { result } = renderHook(() => useNetworkStatus())

    // Go offline
    act(() => {
      window.dispatchEvent(new Event('offline'))
    })

    expect(result.current.wasOffline).toBe(true)

    // Reset flag
    act(() => {
      result.current.resetOfflineFlag()
    })

    expect(result.current.wasOffline).toBe(false)
  })

  it('should dispatch network-lost custom event when going offline', () => {
    const eventHandler = jest.fn()
    window.addEventListener('network-lost', eventHandler)

    renderHook(() => useNetworkStatus())

    act(() => {
      window.dispatchEvent(new Event('offline'))
    })

    expect(eventHandler).toHaveBeenCalled()
    expect(eventHandler.mock.calls[0][0].detail).toHaveProperty('timestamp')

    window.removeEventListener('network-lost', eventHandler)
  })

  it('should dispatch network-restored custom event when coming back online after being offline', () => {
    const eventHandler = jest.fn()
    window.addEventListener('network-restored', eventHandler)

    const { result } = renderHook(() => useNetworkStatus())

    // Go offline first
    act(() => {
      window.dispatchEvent(new Event('offline'))
    })

    // Then online
    act(() => {
      window.dispatchEvent(new Event('online'))
    })

    expect(eventHandler).toHaveBeenCalled()
    expect(eventHandler.mock.calls[0][0].detail).toHaveProperty('timestamp')

    window.removeEventListener('network-restored', eventHandler)
  })

  it('should return resetOfflineFlag as stable function', () => {
    const { result, rerender } = renderHook(() => useNetworkStatus())

    const firstResetFn = result.current.resetOfflineFlag

    rerender()

    expect(result.current.resetOfflineFlag).toBe(firstResetFn)
  })
})

describe('useNetworkRestore', () => {
  it('should call callback when network-restored event is fired', () => {
    const callback = jest.fn()
    renderHook(() => useNetworkRestore(callback))

    const event = new CustomEvent('network-restored', {
      detail: { timestamp: new Date() }
    })
    window.dispatchEvent(event)

    expect(callback).toHaveBeenCalledWith(expect.objectContaining({
      timestamp: expect.any(Date)
    }))
  })

  it('should clean up event listener on unmount', () => {
    const callback = jest.fn()
    const { unmount } = renderHook(() => useNetworkRestore(callback))

    unmount()

    // Fire event after unmount
    const event = new CustomEvent('network-restored', {
      detail: { timestamp: new Date() }
    })
    window.dispatchEvent(event)

    // Callback should not be called
    expect(callback).not.toHaveBeenCalled()
  })
})

describe('useNetworkLost', () => {
  it('should call callback when network-lost event is fired', () => {
    const callback = jest.fn()
    renderHook(() => useNetworkLost(callback))

    const event = new CustomEvent('network-lost', {
      detail: { timestamp: new Date() }
    })
    window.dispatchEvent(event)

    expect(callback).toHaveBeenCalledWith(expect.objectContaining({
      timestamp: expect.any(Date)
    }))
  })

  it('should clean up event listener on unmount', () => {
    const callback = jest.fn()
    const { unmount } = renderHook(() => useNetworkLost(callback))

    unmount()

    // Fire event after unmount
    const event = new CustomEvent('network-lost', {
      detail: { timestamp: new Date() }
    })
    window.dispatchEvent(event)

    // Callback should not be called
    expect(callback).not.toHaveBeenCalled()
  })
})
