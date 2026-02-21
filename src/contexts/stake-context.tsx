import React, { createContext, useState } from 'react'

const StakeContext = createContext<any>(undefined)

const StakeProvider = ({ children }: { children: React.ReactNode }) => {
  const [isPermanent, setIsPermanent] = useState(false)

  return (
    <StakeContext.Provider value={{ isPermanent, setIsPermanent }}>
      {children}
    </StakeContext.Provider>
  )
}

export { StakeContext, StakeProvider }
