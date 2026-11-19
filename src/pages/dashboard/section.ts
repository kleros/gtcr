import styled from 'styled-components'

/*
 * The dashboard's section heading: a 30px Urbanist title with room above it,
 * and whatever belongs on the right (a link, a window, a state line). It
 * lives here rather than in index.tsx so a section that owns its own file
 * (open-for-verification.tsx) heads itself the same way, without importing
 * the page back.
 *
 * The 80px is what separates one section from the next. A heading that
 * belongs to the box above it rather than to a new section overrides that
 * margin where it is used (index.tsx's LiveHead), never here.
 */

export const SectionHead = styled.div`
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
  margin: 80px 0 20px;
`

export const SectionTitle = styled.h2`
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0;
  color: var(--color-text);
  font-family: var(--font-display);
  font-size: 30px;
  line-height: 34px;
  font-weight: 500;
  letter-spacing: -0.03em;
`
