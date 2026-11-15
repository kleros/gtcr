import React, { useState } from 'react'
import styled from 'styled-components'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import Icon from 'components/ui/Icon'
import { isOpenedHere } from 'hooks/use-attachment'
import { buttonReset } from 'styles/button-reset'
import PolicyHistoryModal from './policy-history-modal'

const Container = styled.div`
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  gap: 8px;
  flex-wrap: wrap;
`

const TitleContainer = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  color: ${({ theme }) => theme.primaryColor};
`

const Title = styled.h1`
  margin: 0;
  font-size: 20px;
  color: ${({ theme }) => theme.primaryColor};
`

const RightActions = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`

const HeaderButton = styled.button`
  ${buttonReset}
  color: ${({ theme }) => theme.primaryColor};
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  padding: 8px 14px;
  border-radius: 8px;
  transition: color 0.2s ease;

  &:hover {
    color: ${({ theme }) => theme.primaryColorHover};
  }
`

const Header: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { state } = useLocation()
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)

  const isPolicy = searchParams.has('isPolicy') || searchParams.has('policyTx')

  const handleReturn = () => {
    // Opened from the page under it: step back to that page, as the
    // browser's Back does, so the viewer leaves no entry behind. A viewer
    // reached by a link has no such entry: its page is the same address
    // without the viewer's parameters.
    if (isOpenedHere(state)) {
      navigate(-1)
      return
    }
    setSearchParams(
      (prev) => {
        const newParams = new URLSearchParams(prev)
        newParams.delete('attachment')
        newParams.delete('policyTx')
        newParams.delete('isPolicy')
        return newParams
      },
      { replace: true },
    )
  }

  return (
    <>
      <Container>
        <TitleContainer>
          <Icon type="paper-clip" />
          <Title>File</Title>
        </TitleContainer>
        <RightActions>
          {isPolicy ? (
            <HeaderButton onClick={() => setIsHistoryOpen(true)}>
              Previous Policies
            </HeaderButton>
          ) : null}
          <HeaderButton onClick={handleReturn}>
            <Icon type="left" />
            Return
          </HeaderButton>
        </RightActions>
      </Container>
      {isHistoryOpen && (
        <PolicyHistoryModal onClose={() => setIsHistoryOpen(false)} />
      )}
    </>
  )
}

export default Header
