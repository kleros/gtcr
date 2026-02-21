import React, { createContext, useState } from 'react'

interface StakeContextValue {
  isPermanent: boolean
  setIsPermanent: React.Dispatch<React.SetStateAction<boolean>>
}

const StakeContext = createContext<StakeContextValue | undefined>(undefined)

const StakeProvider = ({ children }: { children: React.ReactNode }) => {
  const [isPermanent, setIsPermanent] = useState(false)

  return (
    <StakeContext.Provider value={{ isPermanent, setIsPermanent }}>
      {children}
    </StakeContext.Provider>
  )
}

export { StakeContext, StakeProvider }
