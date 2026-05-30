'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const ThemeContext = createContext(null)

const STORAGE_KEY = 'indusia_theme'
const VALID_THEMES = ['dark', 'light']

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState('light')
  const [isClient, setIsClient] = useState(false)

  // Initialize from localStorage and apply class
  useEffect(() => {
    setIsClient(true)
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && VALID_THEMES.includes(saved)) {
      setThemeState(saved)
      if (saved === 'dark') {
        document.documentElement.classList.remove('light')
      } else {
        document.documentElement.classList.add('light')
      }
    } else {
      // No saved preference — default to light
      document.documentElement.classList.add('light')
    }
  }, [])

  const setTheme = useCallback((newTheme) => {
    if (!VALID_THEMES.includes(newTheme)) return
    setThemeState(newTheme)
    if (isClient) {
      localStorage.setItem(STORAGE_KEY, newTheme)
    }
    if (newTheme === 'light') {
      document.documentElement.classList.add('light')
    } else {
      document.documentElement.classList.remove('light')
    }
  }, [isClient])

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }, [theme, setTheme])

  const value = {
    theme,
    setTheme,
    toggleTheme,
    isDark: theme === 'dark',
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
