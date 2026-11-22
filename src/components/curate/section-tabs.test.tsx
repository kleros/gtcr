import React, { useState } from 'react'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from 'test/render'
import {
  SectionTabs,
  sectionPanelId,
  sectionTabId,
  type SectionTab,
} from './section-tabs'

type Section = 'activity' | 'governed' | 'drafts'

const TABS: SectionTab<Section>[] = [
  { value: 'activity', label: 'Activity', count: 1234 },
  { value: 'governed', label: 'Governed lists', count: 3 },
  { value: 'drafts', label: 'Drafts' },
]

const BASE = 'profile-sections'

/*
 * The panels are the page's own, as on the profile (pages/address): each
 * takes the id from sectionPanelId, is labelled with sectionTabId, and a
 * closed one is hidden, never unmounted.
 */
const Harness = ({
  initial = 'activity',
  onChange,
}: {
  initial?: Section
  onChange?: (value: Section) => void
}) => {
  const [value, setValue] = useState<Section>(initial)
  return (
    <>
      <SectionTabs
        ariaLabel="Profile section"
        idBase={BASE}
        value={value}
        tabs={TABS}
        onChange={(next) => {
          setValue(next)
          onChange?.(next)
        }}
      />
      {TABS.map((tab) => (
        <div
          key={tab.value}
          role="tabpanel"
          id={sectionPanelId(BASE, tab.value)}
          aria-labelledby={sectionTabId(BASE, tab.value)}
          hidden={tab.value !== value}
        >
          <label>
            Note for {tab.label}
            <input />
          </label>
        </div>
      ))}
    </>
  )
}

const tab = (label: string) =>
  screen.getByRole('tab', { name: new RegExp(`^${label}`) })

describe('SectionTabs', () => {
  it('is a named tablist whose open tab is selected and the only tab stop', () => {
    renderWithProviders(<Harness initial="governed" />)
    expect(
      screen.getByRole('tablist', { name: 'Profile section' }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('tab')).toHaveLength(3)
    expect(tab('Governed lists')).toHaveAttribute('aria-selected', 'true')
    expect(tab('Governed lists')).toHaveAttribute('tabindex', '0')
    expect(tab('Activity')).toHaveAttribute('aria-selected', 'false')
    expect(tab('Activity')).toHaveAttribute('tabindex', '-1')
    expect(tab('Drafts')).toHaveAttribute('tabindex', '-1')
  })

  it('shows each count, formatted, beside its label', () => {
    renderWithProviders(<Harness />)
    expect(tab('Activity')).toHaveTextContent(/^Activity\s*1,234$/)
    expect(tab('Governed lists')).toHaveTextContent(/^Governed lists\s*3$/)
    expect(tab('Drafts')).toHaveTextContent(/^Drafts$/)
  })

  it('ties every tab to its panel, both ways', () => {
    renderWithProviders(<Harness />)
    for (const { value, label } of TABS) {
      const element = tab(label)
      expect(element).toHaveAttribute('id', sectionTabId(BASE, value))
      expect(element).toHaveAttribute(
        'aria-controls',
        sectionPanelId(BASE, value),
      )
    }
    const open = screen.getByRole('tabpanel')
    expect(open).toHaveAttribute('id', sectionPanelId(BASE, 'activity'))
    expect(open).toHaveAccessibleName(/^Activity/)
  })

  it('opens a clicked tab, and a click on the open tab changes nothing', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderWithProviders(<Harness onChange={onChange} />)
    await user.click(tab('Activity'))
    expect(onChange).not.toHaveBeenCalled()

    await user.click(tab('Governed lists'))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('governed')
    expect(tab('Governed lists')).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName(/^Governed lists/)
  })

  it('moves the choice and the focus with Left and Right, wrapping at the ends', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderWithProviders(<Harness onChange={onChange} />)
    await user.tab()
    expect(tab('Activity')).toHaveFocus()

    await user.keyboard('{ArrowRight}')
    expect(onChange).toHaveBeenLastCalledWith('governed')
    expect(tab('Governed lists')).toHaveFocus()
    expect(tab('Governed lists')).toHaveAttribute('aria-selected', 'true')

    await user.keyboard('{ArrowRight}{ArrowRight}')
    expect(onChange).toHaveBeenLastCalledWith('activity')
    expect(tab('Activity')).toHaveFocus()

    await user.keyboard('{ArrowLeft}')
    expect(onChange).toHaveBeenLastCalledWith('drafts')
    expect(tab('Drafts')).toHaveFocus()
    expect(tab('Drafts')).toHaveAttribute('aria-selected', 'true')
  })

  it('goes to the first and last tabs with Home and End', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderWithProviders(<Harness initial="governed" onChange={onChange} />)
    await user.tab()
    expect(tab('Governed lists')).toHaveFocus()
    await user.keyboard('{End}')
    expect(onChange).toHaveBeenLastCalledWith('drafts')
    expect(tab('Drafts')).toHaveFocus()
    await user.keyboard('{Home}')
    expect(onChange).toHaveBeenLastCalledWith('activity')
    expect(tab('Activity')).toHaveFocus()
  })

  it('leaves the other keys alone', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderWithProviders(<Harness onChange={onChange} />)
    await user.tab()
    await user.keyboard('{ArrowDown}{ArrowUp}a')
    expect(onChange).not.toHaveBeenCalled()
    expect(tab('Activity')).toHaveFocus()
  })

  it('tabs out of the row from the open tab into its panel', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Harness initial="governed" />)
    await user.tab()
    expect(tab('Governed lists')).toHaveFocus()
    await user.tab()
    // The closed panels are hidden: Tab lands in the open one.
    expect(
      screen.getByRole('textbox', { name: 'Note for Governed lists' }),
    ).toHaveFocus()
  })

  it('keeps a closed panel mounted, with what was typed in it', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Harness />)
    await user.type(
      screen.getByRole('textbox', { name: 'Note for Activity' }),
      'half-written',
    )
    await user.click(tab('Governed lists'))

    const panels = screen.getAllByRole('tabpanel', { hidden: true })
    expect(panels).toHaveLength(3)
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1)
    // A hidden panel has no accessible name: reach it from its tab.
    const controls = tab('Activity').getAttribute('aria-controls')
    const activity = panels.find((panel) => panel.id === controls)
    expect(activity).toBeInTheDocument()
    expect(activity).not.toBeVisible()

    await user.click(tab('Activity'))
    expect(
      screen.getByRole('textbox', { name: 'Note for Activity' }),
    ).toHaveValue('half-written')
  })
})
