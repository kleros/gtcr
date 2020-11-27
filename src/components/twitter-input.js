import { Form, Input } from 'antd'
import { Field } from 'formik'
import React, { useEffect, useState } from 'react'
import { useDebounce } from 'use-debounce'
import styled from 'styled-components/macro'
import PropTypes from 'prop-types'
import TwitterUser from './twitter-user'

const CORSProxyURL = process.env.REACT_APP_CORS_PROXY_URL
const authToken = `Bearer ${process.env.REACT_APP_BEARER_TOKEN}`

const StyledTwitterInput = styled.div`
  margin-bottom: 24px;
`

const TwitterUserInput = ({ setFieldValue, name, label }) => {
  const [twitterHandle, setTwitterHandle] = useState()
  const [debouncedTwitterHandle] = useDebounce(twitterHandle, 1200)
  const [twitterUser, setTwitterUser] = useState()

  // Fetch twitter user id if a handle was provided.
  useEffect(() => {
    if (!debouncedTwitterHandle) return
    const twitterEndpoint = 'https://api.twitter.com/2/users/by/username'
    const extra = 'user.fields=profile_image_url'
    const fullURL = `${CORSProxyURL}/${twitterEndpoint}/${debouncedTwitterHandle.replace(
      '@',
      ''
    )}?${extra}`

    ;(async () => {
      try {
        const res = await fetch(fullURL, {
          headers: {
            authorization: authToken
          }
        })
        setTwitterUser(await res.json())
      } catch (err) {
        setTwitterUser({ error: err })
      }
    })()
  }, [debouncedTwitterHandle])

  const { data } = twitterUser || {}
  const { id } = data || {}

  // Set field once we have it.
  useEffect(() => {
    setFieldValue(name, id)
  }, [id, name, setFieldValue])

  return (
    <StyledTwitterInput>
      <Field name={name}>
        {({ field }) => (
          <Form.Item label={label} style={{ display: 'flex' }}>
            <Input
              {...field}
              onChange={e => {
                setTwitterHandle(e.target.value)
              }}
              value={twitterHandle}
            />
          </Form.Item>
        )}
      </Field>
      {id && <TwitterUser userID={id} />}
      Submitting twitter ID: {id}
    </StyledTwitterInput>
  )
}

TwitterUserInput.propTypes = {
  setFieldValue: PropTypes.func.isRequired,
  name: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired
}

export default TwitterUserInput
