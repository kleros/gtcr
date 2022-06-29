import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import styled from 'styled-components/macro'
import { Result, Skeleton, Button } from 'antd'
import { ItemTypes } from '@kleros/gtcr-encoder'
import DisplaySelector from './display-selector'
import { Link } from 'react-router-dom'
import { useQuery } from '@apollo/client'
import { GQL_META_EVIDENCES } from 'utils/graphql'

const StyledItemCol = styled.div`
  margin-bottom: 8px;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
`

const StyledResult = styled(Result)`
  padding: 0;

  & > .ant-result-title {
    line-height: 1.2;
    font-size: 1.4em;
  }
`

const TCRCardContent = ({
  tcrAddress,
  chainId,
  currentTCRAddress,
  ID,
  hideDetailsButton
}) => {
  const { data, loading, error } = useQuery(GQL_META_EVIDENCES, {
    variables: { tcrAddress }
  })

  const [metaEvidence, setEetaEvidence] = useState()

  useEffect(() => {
    if (!data || loading) return

    const me = data.metaEvidences[data.metaEvidences.length - 2]
    const asyncProc = async () => {
      const ipfsFile = await fetch(process.env.REACT_APP_IPFS_GATEWAY + me.URI)
      const fileContent = await ipfsFile.json()

      setEetaEvidence({ ...me, ...fileContent })
    }
    asyncProc()
  }, [data, loading])

  if (error) {
    const { message } = error
    // this type of error is fixed by itself given a few seconds
    // it occurs because it attempts to look for the following
    // contract: "Error decoding text"
    // more info https://github.com/kleros/gtcr/issues/184
    if (!/UseSTD3ASCIIRules/.test(message))
      return (
        <div
          style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <StyledItemCol>
            <StyledResult
              status="warning"
              title="Errored submission"
              subTitle={message}
            />
          </StyledItemCol>
          <StyledItemCol>
            {!hideDetailsButton && (
              <Link to={`/tcr/${chainId}/${currentTCRAddress}/${ID}`}>
                <Button>Details</Button>
              </Link>
            )}
            <Link
              to={`/tcr/${chainId}/${tcrAddress}`}
              style={{ marginLeft: '12px' }}
            >
              <Button type="primary">Open List</Button>
            </Link>
          </StyledItemCol>
        </div>
      )
  }

  if (!metaEvidence) return <Skeleton active />

  const { metadata } = metaEvidence || {}

  if (!metadata)
    return (
      <StyledResult
        status="warning"
        subTitle="Missing metadata field on list meta evidence."
      />
    )

  try {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}
      >
        <div>
          <StyledItemCol>
            <DisplaySelector type={ItemTypes.IMAGE} value={metadata.logoURI} />
          </StyledItemCol>
          <StyledItemCol>
            <DisplaySelector type={ItemTypes.TEXT} value={metadata.tcrTitle} />
          </StyledItemCol>
        </div>
        <StyledItemCol>
          {!hideDetailsButton && (
            <Link to={`/tcr/${chainId}/${currentTCRAddress}/${ID}`}>
              <Button>Details</Button>
            </Link>
          )}
          <Link
            to={`/tcr/${chainId}/${tcrAddress}`}
            style={{ marginLeft: '12px' }}
          >
            <Button type="primary">Open List</Button>
          </Link>
        </StyledItemCol>
      </div>
    )
  } catch (err) {
    return <StyledResult status="warning" subTitle={err.message} />
  }
}

TCRCardContent.propTypes = {
  tcrAddress: PropTypes.string,
  currentTCRAddress: PropTypes.string,
  ID: PropTypes.string,
  hideDetailsButton: PropTypes.bool
}

TCRCardContent.defaultProps = {
  tcrAddress: null,
  currentTCRAddress: null,
  ID: null,
  hideDetailsButton: false
}

export default TCRCardContent
