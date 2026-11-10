import React from 'react'
import styled from 'styled-components'
import TelegramIcon from 'assets/icons/telegram.svg'
import BugIcon from 'assets/icons/bug.svg'
import EthIcon from 'assets/icons/eth.svg'

/* The help menu: glass rows like SelectMenu's, external links only. */
const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 232px;
  padding: 6px;
`

const ListItem = styled.a`
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 38px;
  padding: 0 12px;
  border-radius: 10px;
  color: var(--color-muted);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
  font-weight: 500;
  text-decoration: none;
  cursor: pointer;
  transition:
    background var(--motion),
    color var(--motion);

  &:hover,
  &:focus-visible {
    color: var(--color-text);
    background: var(--hover-fill);
  }

  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: -2px;
  }

  &:hover svg {
    fill: var(--color-text);
  }
`

const Icon = styled.svg`
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  fill: var(--color-muted);
  transition: fill var(--motion);
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
