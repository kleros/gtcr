import React from 'react'
import {
  AtlasProvider as KlerosAtlasProvider,
  Products,
} from '@kleros/kleros-app'
import { useConfig } from 'wagmi'

const AtlasProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const wagmiConfig = useConfig()
  return (
    <KlerosAtlasProvider
      config={{
        uri: import.meta.env.REACT_APP_ATLAS_URI,
        product: Products.Curate,
        wagmiConfig,
      }}
    >
      {children}
    </KlerosAtlasProvider>
  )
}

export default AtlasProvider
