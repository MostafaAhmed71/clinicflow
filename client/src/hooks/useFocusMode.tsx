import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

const STORAGE_KEY = 'cf-consultation-focus'

type FocusModeContextValue = {
  focusMode: boolean
  setFocusMode: (value: boolean) => void
  toggleFocusMode: () => void
}

const FocusModeContext = createContext<FocusModeContextValue | null>(null)

export function FocusModeProvider({ children }: { children: ReactNode }) {
  const [focusMode, setFocusModeState] = useState(() => {
    try {
      return sessionStorage.getItem(STORAGE_KEY) === '1'
    } catch {
      return false
    }
  })

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, focusMode ? '1' : '0')
    } catch {
      /* ignore */
    }
    document.body.classList.toggle('cf-focus-mode', focusMode)
    return () => document.body.classList.remove('cf-focus-mode')
  }, [focusMode])

  const value = useMemo<FocusModeContextValue>(
    () => ({
      focusMode,
      setFocusMode: setFocusModeState,
      toggleFocusMode: () => setFocusModeState((v) => !v),
    }),
    [focusMode],
  )

  return <FocusModeContext.Provider value={value}>{children}</FocusModeContext.Provider>
}

export function useFocusMode() {
  const ctx = useContext(FocusModeContext)
  if (!ctx) {
    return {
      focusMode: false,
      setFocusMode: (_value: boolean) => undefined,
      toggleFocusMode: () => undefined,
    }
  }
  return ctx
}
