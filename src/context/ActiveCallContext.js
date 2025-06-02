"use client"

import { createContext, useState, useCallback, useMemo, useContext } from "react"

// Create the context
const ActiveCallContext = createContext(null)

// Export the context so it can be imported by name
export { ActiveCallContext }

export const ActiveCallProvider = ({ children }) => {
  const [activeCallDetails, setActiveCallDetailsState] = useState(null)

  const setActiveCallDetails = useCallback((details) => {
    // If details is a function, it's an updater function
    if (typeof details === "function") {
      setActiveCallDetailsState(details)
    } else {
      // Otherwise, it's new details. Only update if they are different.
      // This is a shallow comparison, for deeper changes, the component setting them should be careful.
      setActiveCallDetailsState((prevDetails) => {
        if (JSON.stringify(prevDetails) !== JSON.stringify(details)) {
          return details
        }
        return prevDetails
      })
    }
  }, [])

  const clearActiveCallDetails = useCallback(() => {
    setActiveCallDetailsState(null)
  }, [])

  const formatCallDuration = useCallback((duration) => {
    if (isNaN(duration) || duration < 0) return "0:00"
    const minutes = Math.floor(duration / 60)
    const seconds = duration % 60
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`
  }, [])

  const contextValue = useMemo(
    () => ({
      activeCallDetails,
      setActiveCallDetails,
      clearActiveCallDetails,
      formatCallDuration,
    }),
    [activeCallDetails, setActiveCallDetails, clearActiveCallDetails, formatCallDuration],
  )

  return <ActiveCallContext.Provider value={contextValue}>{children}</ActiveCallContext.Provider>
}

export const useActiveCall = () => {
  const context = useContext(ActiveCallContext)
  if (!context) {
    throw new Error("useActiveCall must be used within an ActiveCallProvider")
  }
  return context
}
