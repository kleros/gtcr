import React from 'react'
import styled from 'styled-components'
import TelegramIcon from 'assets/icons/telegram.svg?react'
import BugIcon from 'assets/icons/bug.svg?react'
import EthIcon from 'assets/icons/eth.svg?react'

const Container = styled.div`
  display: flex;
  flex-direction: column;
  padding: 8px 0;
  min-width: 220px;
`

const ListItem = styled.a`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  cursor: pointer;
  text-decoration: none;
  transition: background-color 0.15s;
  color: ${({ theme }) => theme.textPrimary};
  font-size: 14px;
  font-weight: 400;

  &:hover {
    background-color: ${({ theme }) => theme.dropdownHoverBg};
  }

  &:hover svg {
    fill: ${({ theme }) => theme.primaryColor};
  }
`

const Icon = styled.svg`
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  fill: ${({ theme }) => theme.textTertiary};
  transition: fill 0.15s;
`

const ITEMS = [
  {
    text: 'Get Help',
    Icon: TelegramIcon,
    url: 'https://t.me/KlerosCurate',
  },
  {
    text: 'Report a Bug',
    Icon: BugIcon,
    url: 'https://github.com/kleros/gtcr/issues',
  },
  {
    text: "Crypto Beginner's Guide",
    Icon: EthIcon,
    url: 'https://ethereum.org/wallets/',
  },
]

const Help: React.FC = () => (
  <Container>
    {ITEMS.map((item) => (
      <ListItem
        href={item.url}
        key={item.text}
        target="_blank"
        rel="noopener noreferrer"
      >
        <Icon as={item.Icon} />
        {item.text}
      </ListItem>
    ))}
  </Container>
)

export default Help
