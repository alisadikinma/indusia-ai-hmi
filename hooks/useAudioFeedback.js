'use client'

/**
 * useAudioFeedback Hook
 * Provides voice feedback for inspection results using Web Speech API
 * 
 * Features:
 * - Voice announcement for GOOD/NG results
 * - Volume control (0-100)
 * - Mute toggle
 * - Persists settings to localStorage
 */

import { useState, useEffect, useCallback, useRef } from 'react'

const STORAGE_KEY = 'indusia-audio-settings'

const DEFAULT_SETTINGS = {
  volume: 80,
  isMuted: false,
  voice: null, // Will use system default
  rate: 0.9,   // Slightly slower for clarity
  pitch: 1.0
}

// Voice messages
const MESSAGES = {
  GOOD: 'GOOD',
  NG: 'NOT GOOD',
  PASS: 'PASS',
  FAIL: 'FAIL'
}

export function useAudioFeedback() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [isSupported, setIsSupported] = useState(false)
  const [voices, setVoices] = useState([])
  const synthRef = useRef(null)

  // Initialize speech synthesis
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      setIsSupported(true)
      synthRef.current = window.speechSynthesis

      // Load voices
      const loadVoices = () => {
        const availableVoices = synthRef.current.getVoices()
        setVoices(availableVoices)
        
        // Prefer English voices
        const englishVoice = availableVoices.find(v => 
          v.lang.startsWith('en') && v.localService
        ) || availableVoices.find(v => v.lang.startsWith('en'))
        
        if (englishVoice && !settings.voice) {
          setSettings(prev => ({ ...prev, voice: englishVoice.name }))
        }
      }

      loadVoices()
      synthRef.current.onvoiceschanged = loadVoices

      // Load settings from localStorage
      try {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) {
          const parsed = JSON.parse(saved)
          setSettings(prev => ({ ...prev, ...parsed }))
        }
      } catch (e) {
        console.warn('[AudioFeedback] Failed to load settings:', e)
      }
    }

    return () => {
      if (synthRef.current) {
        synthRef.current.cancel()
      }
    }
  }, [])

  // Save settings to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          volume: settings.volume,
          isMuted: settings.isMuted,
          voice: settings.voice,
          rate: settings.rate,
          pitch: settings.pitch
        }))
      } catch (e) {
        console.warn('[AudioFeedback] Failed to save settings:', e)
      }
    }
  }, [settings])

  /**
   * Speak a message
   */
  const speak = useCallback((message) => {
    if (!isSupported || !synthRef.current || settings.isMuted) {
      return
    }

    // Cancel any ongoing speech
    synthRef.current.cancel()

    const utterance = new SpeechSynthesisUtterance(message)
    
    // Apply settings
    utterance.volume = settings.volume / 100
    utterance.rate = settings.rate
    utterance.pitch = settings.pitch

    // Set voice if specified
    if (settings.voice) {
      const selectedVoice = voices.find(v => v.name === settings.voice)
      if (selectedVoice) {
        utterance.voice = selectedVoice
      }
    }

    synthRef.current.speak(utterance)
  }, [isSupported, settings, voices])

  /**
   * Announce inspection result
   */
  const announceResult = useCallback((result) => {
    const message = result === 'GOOD' || result === 'PASS' 
      ? MESSAGES.GOOD 
      : MESSAGES.NG
    
    console.log('[AudioFeedback] Announcing:', message)
    speak(message)
  }, [speak])

  /**
   * Set volume (0-100)
   */
  const setVolume = useCallback((volume) => {
    const clampedVolume = Math.max(0, Math.min(100, volume))
    setSettings(prev => ({ 
      ...prev, 
      volume: clampedVolume,
      isMuted: clampedVolume === 0 ? true : prev.isMuted
    }))
  }, [])

  /**
   * Toggle mute
   */
  const toggleMute = useCallback(() => {
    setSettings(prev => ({ ...prev, isMuted: !prev.isMuted }))
  }, [])

  /**
   * Set mute state
   */
  const setMuted = useCallback((muted) => {
    setSettings(prev => ({ ...prev, isMuted: muted }))
  }, [])

  /**
   * Test audio
   */
  const testAudio = useCallback(() => {
    speak('Audio test. Volume ' + settings.volume + ' percent.')
  }, [speak, settings.volume])

  return {
    // State
    volume: settings.volume,
    isMuted: settings.isMuted,
    isSupported,
    voices,
    
    // Actions
    announceResult,
    speak,
    setVolume,
    toggleMute,
    setMuted,
    testAudio
  }
}

export default useAudioFeedback
