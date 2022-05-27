import { useEffect, useState } from "react"
import { useWeb3Context } from 'web3-react'
import { ethers } from 'ethers'
import { useParams } from 'react-router'
import _gtcr from '../assets/abis/GeneralizedTCR.json'

const useCheckLightCurate = () => {
  const { library, active } = useWeb3Context()
  const { tcrAddress } = useParams<{ tcrAddress: string }>()

  const [isLightCurate, setLightCurate] = useState<boolean>(false)

  useEffect(() => {
    const checkLightCurate = async () => {
      try {
        if (!active) return
        const tcr = new ethers.Contract(tcrAddress, _gtcr, library)

        // Call a function only available on GTCR Classic. If
        // it throws, its not a light curate instance.
        await tcr.itemCount()
        setLightCurate(false)
        // eslint-disable-next-line no-unused-vars
      } catch (err) {
        console.info(
          `Contract call used to verify if this is a Light Curate instance. Ignore exception.`
        )
        setLightCurate(true)
      }
    }
    checkLightCurate()
  }, [active, library, tcrAddress])

  return isLightCurate
}

export default useCheckLightCurate
