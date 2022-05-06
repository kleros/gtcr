import React, { useEffect, useState } from 'react'
import { Alert, Avatar, Skeleton } from 'antd'
import PropTypes from 'prop-types'
import styled from 'styled-components/macro'
import Meta from 'antd/lib/card/Meta'

const CORSProxyURL = process.env.REACT_APP_CORS_PROXY_URL
const authToken = `Bearer ${process.env.REACT_APP_BEARER_TOKEN}`

const StyledMeta = styled(Meta)`
  margin: 12px 0;
  display: flex;
  text-align: start;
  align-items: center;
  & > .ant-card-meta-detail > .ant-card-meta-title {
    color: #4d00b4;
  }
`

const StyledSkeleton = styled(Skeleton)`
  min-width: 170px;
`

const TwitterUser = ({ userID }) => {
  const [user, setUser] = useState()
  // Fetch user
  useEffect(() => {
    if (!userID) return
    ;(async () => {
      try {
        const res = await fetch(
          `${CORSProxyURL}/https://api.twitter.com/2/users/${userID}?user.fields=profile_image_url`,
          {
            headers: {
              authorization: authToken
            }
          }
        )
        setUser(await res.json())
      } catch (err) {
        setUser({ error: err.toString() })
      }
    })()
  }, [userID])

  if (!user) return <StyledSkeleton loading active />

  const { data, error } = user

  if (error || !data)
    return (
      <Alert
        type="error"
        message={`Error fetching user for id ${userID}`}
        description={error}
      />
    )

  const { id, name, profile_image_url: imageURL, username } = data

  return (
    <StyledMeta
      avatar={<Avatar size={64} src={imageURL.replace('normal', 'bigger')} />}
      title={name}
      description={
        <>
          <a alt="twitter-username" href={`https://twitter.com/${username}`}>
            @{username}
          </a>{' '}
          - {id}
        </>
      }
    />
  )
}

TwitterUser.propTypes = {
  userID: PropTypes.string
}

TwitterUser.defaultProps = {
  userID: ''
}

export default TwitterUser
