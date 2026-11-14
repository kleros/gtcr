/*
 * Kleros Curate landing: the theme switch (shared with the app), the
 * figures (the dated snapshot in data.js at once, then the live ones from
 * src/landing/boot.ts), scroll reveals, the bounty ledger, the glowing line
 * chart and the dispute flow schematic. Plain DOM, no dependencies. Every
 * drawing names what it measures; without data the figures stay as dashes
 * and the panel says so. Reduced motion renders every drawing in its final
 * state.
 */
;(() => {
  const doc = document
  const root = doc.documentElement
  const NS = 'http://www.w3.org/2000/svg'
  const motionQuery = globalThis.matchMedia('(prefers-reduced-motion: reduce)')
  const darkQuery = globalThis.matchMedia('(prefers-color-scheme: dark)')
  const reducedMotion = () => motionQuery.matches
  const $ = (selector, scope = doc) => scope.querySelector(selector)
  const $$ = (selector, scope = doc) => [...scope.querySelectorAll(selector)]

  const integer = new Intl.NumberFormat('en-US')
  const dayFormat = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
  const longDayFormat = new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
  const dayYearFormat = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
  const monthFormat = new Intl.DateTimeFormat('en-GB', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
  const stampFormat = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'UTC',
  })
  const timeFormat = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'UTC',
  })

  const easeOutExpo = (t) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t))
  const easeInOutCubic = (t) =>
    t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2

  /**
   * One rAF tween; returns a cancel function. A timer lands it on its final
   * state if frames never come (background tab, capture, prerender), so a
   * figure or drawing is never left at zero.
   */
  const tween = ({ duration, ease, delay = 0, onFrame, onDone }) => {
    let frame = 0
    let finished = false
    const start = performance.now() + delay
    const finish = () => {
      if (finished) return
      finished = true
      cancelAnimationFrame(frame)
      clearTimeout(guard)
      onFrame(1)
      if (onDone) onDone()
    }
    const step = (now) => {
      const t = Math.min(1, Math.max(0, (now - start) / duration))
      if (t >= 1) {
        finish()
        return
      }
      onFrame(ease(t))
      frame = requestAnimationFrame(step)
    }
    const guard = setTimeout(finish, delay + duration + 600)
    frame = requestAnimationFrame(step)
    return () => {
      finished = true
      cancelAnimationFrame(frame)
      clearTimeout(guard)
    }
  }

  /** Runs once when the element is far enough in view. */
  const whenInView = (element, callback, threshold = 0.35) => {
    if (!element) return
    if (!('IntersectionObserver' in globalThis)) {
      callback()
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect()
          callback()
        }
      },
      { threshold },
    )
    observer.observe(element)
  }

  const svgEl = (name, attributes = {}) => {
    const node = doc.createElementNS(NS, name)
    for (const [key, value] of Object.entries(attributes))
      node.setAttribute(key, String(value))
    return node
  }

  /* ---------- Theme: System / Light / Dark / Kleros, shared with the app ---------- */

  const STORAGE_KEY = 'kleros-curate-theme'
  const MODES = ['system', 'light', 'dark', 'kleros']
  const switches = $$('[data-theme-switch]')
  const resolveMode = (mode) =>
    mode === 'system' ? (darkQuery.matches ? 'dark' : 'light') : mode

  /**
   * Marks the chosen option and moves the lit thumb under it. The thumb is
   * placed by its left and right edges; it travels leading edge first
   * (data-dir) and lands without moving on the first draw and on resize.
   */
  const syncSwitch = (group, instant) => {
    const mode = root.dataset.mode || 'system'
    let active
    for (const button of $$('[role="radio"]', group)) {
      const on = button.dataset.mode === mode
      button.setAttribute('aria-checked', String(on))
      button.tabIndex = on ? 0 : -1
      if (on) active = button
    }
    const thumb = $('.seg-thumb', group)
    // A hidden switch (the bar's, on phones) has no geometry yet.
    if (!thumb || !active || !active.offsetWidth) return
    const left = active.offsetLeft
    const right = group.clientWidth - left - active.offsetWidth
    const previous = Number.parseFloat(thumb.style.left)
    if (instant || !('placed' in thumb.dataset) || reducedMotion())
      thumb.dataset.instant = ''
    else {
      delete thumb.dataset.instant
      if (left !== previous)
        thumb.dataset.dir = left > previous ? 'right' : 'left'
    }
    thumb.style.left = `${left}px`
    thumb.style.right = `${right}px`
    thumb.dataset.placed = ''
    if ('instant' in thumb.dataset)
      requestAnimationFrame(() => {
        delete thumb.dataset.instant
      })
  }

  const applyTheme = (mode, instant = false) => {
    root.dataset.mode = mode
    root.dataset.theme = resolveMode(mode)
    const meta = $('meta[name="theme-color"]')
    if (meta)
      meta.setAttribute(
        'content',
        getComputedStyle(root).getPropertyValue('--stage').trim(),
      )
    for (const group of switches) syncSwitch(group, instant)
  }

  const setMode = (mode) => {
    try {
      localStorage.setItem(STORAGE_KEY, mode)
    } catch {
      // Storage can be blocked; the choice then lasts for this page view.
    }
    applyTheme(mode)
  }

  for (const group of switches) {
    group.addEventListener('click', (event) => {
      const button = event.target.closest('[data-mode]')
      if (button) setMode(button.dataset.mode)
    })
    // A radio group: the arrows move the choice and the focus; Home, End.
    group.addEventListener('keydown', (event) => {
      const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp']
      const current = MODES.indexOf(root.dataset.mode || 'system')
      let next
      if (event.key === 'Home') next = MODES[0]
      else if (event.key === 'End') next = MODES.at(-1)
      else if (keys.includes(event.key)) {
        const step = keys.indexOf(event.key) < 2 ? 1 : -1
        next = MODES[(current + step + MODES.length) % MODES.length]
      } else return
      event.preventDefault()
      setMode(next)
      $(`[data-mode="${next}"]`, group)?.focus()
    })
    if ('ResizeObserver' in globalThis)
      new ResizeObserver(() => syncSwitch(group, true)).observe(group)
  }
  darkQuery.addEventListener('change', () => {
    if ((root.dataset.mode || 'system') === 'system') applyTheme('system')
  })
  applyTheme(root.dataset.mode || 'system', true)
  // Fonts change the options' widths; place the thumb again once they load.
  doc.fonts?.addEventListener('loadingdone', () => {
    for (const group of switches) syncSwitch(group, true)
  })

  /* ---------- Chrome: the bar's fill once scrolled, hover spotlight, paused loops ---------- */

  const bar = $('[data-bar]')
  let barFrame = 0
  const syncBar = () => {
    barFrame = 0
    if (!bar) return
    if (globalThis.scrollY > 4) bar.dataset.scrolled = ''
    else delete bar.dataset.scrolled
  }
  globalThis.addEventListener(
    'scroll',
    () => {
      if (!barFrame) barFrame = requestAnimationFrame(syncBar)
    },
    { passive: true },
  )
  syncBar()

  let spotFrame = 0
  doc.addEventListener('pointermove', (event) => {
    if (spotFrame || event.pointerType !== 'mouse') return
    spotFrame = requestAnimationFrame(() => {
      spotFrame = 0
      const target =
        event.target instanceof Element && event.target.closest('[data-spot]')
      if (!target) return
      const box = target.getBoundingClientRect()
      target.style.setProperty('--mx', `${event.clientX - box.left}px`)
      target.style.setProperty('--my', `${event.clientY - box.top}px`)
    })
  })

  const syncPaused = () => {
    if (doc.hidden) root.dataset.paused = ''
    else delete root.dataset.paused
  }
  doc.addEventListener('visibilitychange', syncPaused)
  syncPaused()
  /* ---------- Reveals ---------- */

  const revealables = $$('[data-reveal]')
  if ('IntersectionObserver' in globalThis && !reducedMotion()) {
    const revealer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting) {
            entry.target.classList.add('in')
            revealer.unobserve(entry.target)
          }
      },
      { threshold: 0.12, rootMargin: '0px 0px -6% 0px' },
    )
    for (const node of revealables) revealer.observe(node)
  } else for (const node of revealables) node.classList.add('in')

  /* ---------- Figures: live from the indexers, or the dated snapshot ---------- */

  // Each draw is a generation: when live figures replace the snapshot, the
  // snapshot's pending animations and observers stand down.
  let generation = 0
  const watchInView = whenInView
  const runTween = tween
  // What has already made its entrance: a later generation (the live
  // figures replacing the snapshot) updates it in place, without a replay.
  const entered = new WeakSet()
  let chartEntered = false
  let ledgerEntered = false
  // Resize watchers of the current draw (a new draw replaces them).
  let stripObserver
  let ledgerObserver

  /**
   * A list logo's URL: https as it is, an IPFS path through the app's
   * gateway (src/landing/boot.ts provides the resolver); none without it.
   */
  const mediaUrl = (uri) => {
    if (typeof uri !== 'string' || !uri.trim()) return null
    if (/^https:\/\//i.test(uri)) return uri
    const resolve = globalThis.CURATE_LANDING_MEDIA
    if (typeof resolve !== 'function') return null
    try {
      return resolve(uri)
    } catch {
      return null
    }
  }

  /*
   * Chain marks on a plate of their hue (as components/chain-logo.tsx), and
   * each chain's data hue (as the dashboard: Gnosis viz-1, Ethereum viz-2).
   */
  const CHAIN_MARKS = {
    1: {
      name: 'ethereum',
      label: 'Ethereum',
      hue: 'var(--viz-2)',
      svg: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><path fill="#8FFCF3" d="M12 3v6.651l5.625 2.516z"/><path fill="#CABCF8" d="m12 3-5.625 9.166L12 9.653z"/><path fill="#CBA7F5" d="M12 16.478V21l5.625-7.784z"/><path fill="#74A0F3" d="M12 21v-4.522l-5.625-3.262z"/><path fill="#CBA7F5" d="m12 15.43 5.625-3.263L12 9.652z"/><path fill="#74A0F3" d="M6.375 12.167 12 15.43V9.652z"/><path fill="#202699" fill-rule="evenodd" d="m12 15.43-5.625-3.263L12 3l5.624 9.166zm-5.252-3.528 5.161-8.41v6.114zm-.077.229 5.238-2.327v5.364zm5.418-2.327v5.364l5.234-3.037zm0-.198 5.161 2.296-5.161-8.41z" clip-rule="evenodd"/><path fill="#202699" fill-rule="evenodd" d="m12 16.406-5.625-3.195L12 21l5.624-7.79zm-4.995-2.633 4.904 2.79v4.005zm5.084 2.79v4.005l4.905-6.795z" clip-rule="evenodd"/></svg>',
    },
    100: {
      name: 'gnosis',
      label: 'Gnosis',
      hue: 'var(--viz-1)',
      svg: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><path fill="#3E6957" d="m19.526 7.5.171.27A8.55 8.55 0 0 1 21 12.303c.009 2.29-.933 4.492-2.62 6.122C16.695 20.055 14.4 20.98 12 21h-.017c-4.954 0-9-3.927-8.983-8.73 0-1.611.463-3.175 1.32-4.533l.154-.245.823.793a3 3 0 0 0-.386.737 3.2 3.2 0 0 0 .121 2.544 3.45 3.45 0 0 0 1.962 1.727 3.6 3.6 0 0 0 1.59.163 3.55 3.55 0 0 0 1.496-.54L12 14.782l2.194-2.127a3.51 3.51 0 0 0 2.91.336c.48-.158.917-.417 1.277-.759a3.2 3.2 0 0 0 .979-2.683 3.2 3.2 0 0 0-.52-1.394zM6.309 9.259l2.58 2.487a1.77 1.77 0 0 1-1.114.377 1.9 1.9 0 0 1-1.302-.526 1.73 1.73 0 0 1-.533-1.25c0-.409.137-.785.369-1.088m9 2.332 2.553-2.463c.198.287.31.63.31.99 0 .982-.824 1.776-1.835 1.776a1.84 1.84 0 0 1-1.028-.303m-3.275 1.865-7.43-7.224.29-.295a9.5 9.5 0 0 1 3.192-2.173A9.9 9.9 0 0 1 11.923 3h.017c2.717 0 5.331 1.129 7.149 3.085l.283.302zM5.811 6.232l6.223 6.038 6.137-5.915a8.8 8.8 0 0 0-2.843-1.85 9.1 9.1 0 0 0-3.37-.662h-.018c-2.314 0-4.474.842-6.129 2.39"/></svg>',
    },
  }

  const chainMark = (chainId) => {
    const mark = CHAIN_MARKS[chainId]
    if (!mark) return null
    const plate = doc.createElement('span')
    plate.className = `chain-mark chain-mark--${mark.name}`
    plate.setAttribute('aria-hidden', 'true')
    const template = doc.createElement('template')
    template.innerHTML = mark.svg
    plate.append(template.content)
    return plate
  }

  const boot = (data) => {
    const gen = ++generation
    const current = () => gen === generation
    const whenInView = (element, callback, threshold) =>
      watchInView(
        element,
        () => {
          if (current()) callback()
        },
        threshold,
      )
    const tween = (options) =>
      runTween({
        ...options,
        onFrame: (p) => {
          if (current()) options.onFrame(p)
        },
        onDone: () => {
          if (current() && options.onDone) options.onDone()
        },
      })
    if (gen > 1) {
      // Fresh hosts: the previous draw's listeners and observers stay on the
      // old elements.
      for (const selector of ['[data-chart]']) {
        const old = $(selector)
        if (old) old.replaceWith(old.cloneNode(false))
      }
      $('[data-chart-table] tbody')?.replaceChildren()
    }
    const isCount = (value) => Number.isFinite(value) && value >= 0
    const series = Array.isArray(data?.series30d)
      ? data.series30d.filter(
          (row) =>
            Number.isFinite(row?.day) &&
            isCount(row.requests) &&
            isCount(row.challenges),
        )
      : []
    const facts = data?.figures ?? {}
    const snapshotAt = data?.snapshotAt ? new Date(data.snapshotAt) : undefined
    const hasSnapshot = snapshotAt && !Number.isNaN(snapshotAt.getTime())
    const hasSeries = series.length > 1
    const totalRequests = series.reduce((sum, row) => sum + row.requests, 0)
    const totalChallenged = series.reduce((sum, row) => sum + row.challenges, 0)
    // Kleros Verified is shown as a count with its lists, never as a share
    // of every list; with none in scope the band simply leaves it out.
    const verifiedLists = Array.isArray(data?.verifiedLists)
      ? data.verifiedLists.filter(
          (list) =>
            list &&
            Number.isFinite(list.chainId) &&
            typeof list.address === 'string' &&
            /^0x[0-9a-f]{40}$/i.test(list.address) &&
            typeof list.title === 'string',
        )
      : []
    const hasVerified =
      isCount(facts.verified) && facts.verified > 0 && verifiedLists.length > 0
    // Challengers: the requests still inside their challenge period when
    // those are known, else every request nobody has challenged yet.
    const windowKnown = isCount(facts.openForVerification)
    const openFigure = windowKnown
      ? facts.openForVerification
      : isCount(facts.unchallenged)
        ? facts.unchallenged
        : undefined
    const openPlus = !windowKnown && facts.unchallengedCapped === true

    const figures = {
      requests: hasSeries ? totalRequests : undefined,
      challenged: hasSeries ? totalChallenged : undefined,
      inCourt: isCount(facts.inCourt) ? facts.inCourt : undefined,
      curators: isCount(facts.curators30d) ? facts.curators30d : undefined,
      entries: isCount(facts.entries) ? facts.entries : undefined,
      openForVerification: openFigure,
      community: isCount(facts.community) ? facts.community : undefined,
      verified: hasVerified ? facts.verified : undefined,
    }
    // A count that hit its query's cap reads "n+".
    const suffixes = { openForVerification: openPlus ? '+' : '' }

    // Live figures say when they were read; a snapshot names its time or
    // window instead of "now" or "the last 30 days".
    const stamp = hasSnapshot ? `${stampFormat.format(snapshotAt)} UTC` : ''
    const shortStamp = hasSnapshot
      ? `${dayFormat.format(snapshotAt)}, ${timeFormat.format(snapshotAt)} UTC`
      : ''
    const lastDay = hasSeries ? new Date(series.at(-1).day * 1000) : undefined
    const windowText = lastDay
      ? `${series.length} days to ${dayYearFormat.format(lastDay)}`
      : '30 days'
    const scope = typeof data?.scope === 'string' ? data.scope : ''
    const setText = (key, text) => {
      for (const node of $$(`[data-fig="${key}"]`)) node.textContent = text
    }
    if (scope) setText('scope', scope)
    setText('window', windowText)
    setText('chartTitle', `Requests and challenges per day, ${windowText}`)
    const live = data?.live === true
    if (hasSnapshot) {
      const when = live ? 'now' : `on ${dayFormat.format(snapshotAt)}`
      setText(
        'openUnit',
        windowKnown
          ? `open for verification ${when}`
          : `unchallenged requests ${when}`,
      )
    }
    setText('verifiedUnit', facts.verified === 1 ? 'list' : 'lists')
    if (stamp) {
      setText(
        'stamp',
        live ? `Live · read ${shortStamp}` : `Snapshot · ${shortStamp}`,
      )
      setText(
        'source',
        live
          ? `Figures: public Curate data on ${scope || 'Ethereum and Gnosis'}, read live from the indexers at ${stamp}. Bounties: every dispute challengers have won, all time.`
          : `Figures: public Curate data on ${scope || 'Ethereum and Gnosis'}, snapshot of ${stamp}. Bounties: every dispute challengers have won, all time to that day. The app shows them live.`,
      )
    }

    const featured = $('[data-featured]')
    if (featured) {
      const empty = $('[data-empty]', featured)
      if (hasSeries) delete featured.dataset.emptyState
      else featured.dataset.emptyState = ''
      if (empty) empty.hidden = hasSeries
      // No figures: a snapshot time beside them would contradict the message.
      for (const node of $$('[data-fig="stamp"]', featured))
        node.hidden = !hasSeries
    }
    // The link to the app says "live" only while the page shows a snapshot.
    for (const link of $$('.featured-live')) {
      const label = [...link.childNodes].find(
        (child) => child.nodeType === 3 && child.textContent.trim(),
      )
      if (label)
        label.textContent = live
          ? 'Open the dashboard '
          : 'Live figures in the app '
    }

    // Kleros Verified: the band with its lists (drawn below, with the figures).
    const verifiedBand = $('[data-verified]')
    if (verifiedBand) verifiedBand.hidden = !hasVerified

    /** Rolls each digit on its own column, then settles into plain text. */
    const roll = (node, value) => {
      const text = integer.format(value)
      if (reducedMotion()) {
        node.textContent = text
        return
      }
      const label = doc.createElement('span')
      label.className = 'sr-only'
      label.textContent = text
      const wrap = doc.createElement('span')
      wrap.className = 'odo'
      wrap.setAttribute('aria-hidden', 'true')
      const stacks = []
      for (const char of text) {
        if (!/\d/.test(char)) {
          const plain = doc.createElement('span')
          plain.textContent = char
          wrap.append(plain)
          continue
        }
        const column = doc.createElement('span')
        column.className = 'odo-col'
        const stack = doc.createElement('span')
        stack.className = 'odo-stack'
        for (let index = 0; index < 20; index++) {
          const digit = doc.createElement('span')
          digit.textContent = String(index % 10)
          stack.append(digit)
        }
        column.append(stack)
        wrap.append(column)
        stacks.push({ stack, digit: Number(char) })
      }
      node.replaceChildren(label, wrap)
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          for (const [index, { stack, digit }] of stacks.entries()) {
            stack.style.transitionDelay = `${index * 45}ms`
            stack.style.transform = `translateY(${-(10 + digit)}em)`
          }
        }),
      )
      setTimeout(
        () => {
          if (current()) node.textContent = text
        },
        1100 + stacks.length * 45 + 150,
      )
    }

    const countUp = (node, value, suffix = '') => {
      if (reducedMotion() || value === 0) {
        node.textContent = `${integer.format(value)}${suffix}`
        return
      }
      tween({
        duration: 1200,
        ease: easeOutExpo,
        onFrame: (p) => {
          node.textContent = `${integer.format(Math.round(value * p))}${suffix}`
        },
      })
    }

    for (const node of $$('[data-fig]')) {
      const value = figures[node.dataset.fig]
      const suffix = suffixes[node.dataset.fig] ?? ''
      const roleRow = node.closest('.role-figure')
      if (roleRow && value !== undefined) roleRow.hidden = false
      if (value === undefined) {
        // A role row without its figure reads better than a lone dash.
        const roleFigure = node.closest('.role-figure')
        if (roleFigure && node.dataset.fig in figures) roleFigure.hidden = true
        continue
      }
      const animated =
        node.hasAttribute('data-odometer') || 'count' in node.dataset
      // The real figure stays in the page until the count starts, the moment
      // it enters the viewport (its row is still fading in then). A figure
      // that has counted once takes later values as they come.
      node.textContent = `${integer.format(value)}${suffix}`
      if (!animated || reducedMotion() || entered.has(node)) continue
      whenInView(
        node,
        () => {
          entered.add(node)
          if (node.hasAttribute('data-odometer')) roll(node, value)
          else countUp(node, value, suffix)
        },
        0,
      )
    }

    /* ---------- Kleros Verified: the lists that carry the seal ---------- */

    const strip = $('[data-verified-lists]')
    stripObserver?.disconnect()
    if (strip && hasVerified) {
      // As the dashboard's band: as many tiles as fit on one row (the last
      // one leads to every Kleros Verified list in Browse); phones scroll.
      const STRIP_MAX = 12
      const TILE_MIN = 136
      const GAP = 12
      const seal = $('[data-seal]')
      const repeated = new Set(
        verifiedLists
          .map((list) => list.title)
          .filter((title, index, titles) => titles.indexOf(title) !== index),
      )
      const glyph = () => {
        const icon = svgEl('svg', {
          viewBox: '0 0 16 16',
          width: 18,
          height: 18,
          'aria-hidden': 'true',
          focusable: 'false',
        })
        icon.append(
          svgEl('path', {
            d: 'M6 4.5h7M6 8h7M6 11.5h7M3 4.5h.01M3 8h.01M3 11.5h.01',
          }),
        )
        return icon
      }
      const tiles = verifiedLists.slice(0, STRIP_MAX).map((list, index) => {
        const chainName = CHAIN_MARKS[list.chainId]?.label ?? ''
        const entries = isCount(list.entries) ? list.entries : undefined
        const open = isCount(list.open) ? list.open : 0
        const item = doc.createElement('li')
        item.style.setProperty('--i', String(index))
        const link = doc.createElement('a')
        link.className = 'vtile'
        link.href = `/tcr/${list.chainId}/${list.address.toLowerCase()}`
        link.title = [
          list.title,
          chainName,
          entries === undefined
            ? ''
            : `${integer.format(entries)} ${entries === 1 ? 'entry' : 'entries'}`,
          open
            ? `${integer.format(open)} open ${open === 1 ? 'request' : 'requests'}`
            : '',
        ]
          .filter(Boolean)
          .join(' · ')

        const logo = doc.createElement('span')
        logo.className = 'vtile-logo'
        const face = doc.createElement('span')
        face.className = 'vtile-face'
        const src = mediaUrl(list.logo)
        if (src) {
          const image = doc.createElement('img')
          image.alt = ''
          image.loading = 'lazy'
          image.decoding = 'async'
          image.referrerPolicy = 'no-referrer'
          image.addEventListener('error', () => image.replaceWith(glyph()), {
            once: true,
          })
          image.src = src
          face.append(image)
        } else face.append(glyph())
        logo.append(face)
        if (seal) {
          // The seal on the logo's corner; it reads the pill's gradients.
          const mark = seal.cloneNode(true)
          mark.removeAttribute('data-seal')
          mark.querySelector('defs')?.remove()
          mark.setAttribute('width', '14')
          mark.setAttribute('height', '14')
          const ring = doc.createElement('span')
          ring.className = 'vtile-seal'
          ring.append(mark)
          logo.append(ring)
        }

        const name = doc.createElement('span')
        name.className = 'vtile-name'
        name.textContent = list.title
        // Lists sharing a name on two chains ("Address Tags") say which.
        if (repeated.has(list.title) && chainName) {
          const where = doc.createElement('small')
          where.textContent = ` on ${chainName}`
          name.append(where)
        }

        const meta = doc.createElement('span')
        meta.className = 'vtile-meta'
        const mark = chainMark(list.chainId)
        if (mark) meta.append(mark)
        if (chainName) {
          const spoken = doc.createElement('span')
          spoken.className = 'sr-only'
          spoken.textContent = `${chainName}, `
          meta.append(spoken)
        }
        if (entries !== undefined)
          meta.append(
            `${integer.format(entries)} ${entries === 1 ? 'entry' : 'entries'}`,
          )
        link.append(logo, name, meta)
        item.append(link)
        return item
      })

      const allItem = doc.createElement('li')
      allItem.style.setProperty('--i', String(tiles.length))
      const allLink = doc.createElement('a')
      allLink.className = 'vtile vtile--all'
      allLink.href = '/browse?trust=verified'
      const arrow = doc.createElement('span')
      arrow.className = 'vtile-arrow'
      const arrowIcon = svgEl('svg', {
        viewBox: '0 0 16 16',
        width: 14,
        height: 14,
        'aria-hidden': 'true',
        focusable: 'false',
      })
      arrowIcon.append(svgEl('path', { d: 'M3.5 8h9M8.5 4l4 4-4 4' }))
      arrow.append(arrowIcon)
      const allName = doc.createElement('span')
      allName.className = 'vtile-name'
      allName.append(
        `All ${integer.format(facts.verified)}`,
        doc.createElement('br'),
        'in Browse',
      )
      allLink.append(arrow, allName)
      allItem.append(allLink)
      strip.replaceChildren(...tiles, allItem)

      const phoneQuery = globalThis.matchMedia('(max-width: 720px)')
      const fit = () => {
        const columns = Math.max(
          2,
          Math.floor((strip.clientWidth + GAP) / (TILE_MIN + GAP)),
        )
        strip.style.setProperty('--cols', String(columns))
        for (const [index, tile] of tiles.entries()) {
          // Past the row: out of view and out of the tab order.
          const over = !phoneQuery.matches && index >= columns - 1
          if (over) tile.dataset.over = ''
          else delete tile.dataset.over
          const link = tile.firstElementChild
          if (over) link.tabIndex = -1
          else link.removeAttribute('tabindex')
        }
      }
      fit()
      if ('ResizeObserver' in globalThis) {
        stripObserver = new ResizeObserver(() => fit())
        stripObserver.observe(strip)
      }
    }

    /* ---------- Bounties won: one figure per coin, and the ledger ---------- */

    const bounty = $('[data-bounty]')
    const reward = data?.bounties
    const hasBounties =
      !!reward &&
      isCount(reward.rulings) &&
      isCount(reward.won) &&
      Array.isArray(reward.coins)
    if (bounty) {
      // No bounty data: no card (an empty one would read as none won); the
      // copy takes the whole hero.
      bounty.hidden = !hasBounties
      $('.hero')?.classList.toggle('hero--solo', !hasBounties)
    }
    ledgerObserver?.disconnect()
    if (bounty && hasBounties) {
      const coins = reward.coins.filter(
        (coin) =>
          coin &&
          typeof coin.symbol === 'string' &&
          isCount(coin.won) &&
          coin.won > 0 &&
          Array.isArray(coin.days) &&
          coin.days.some((day) => Number.isFinite(day)),
      )
      const plus = reward.capped ? '+' : ''
      setText(
        'bountyWhen',
        live || !hasSnapshot
          ? 'All time'
          : `All time to ${dayFormat.format(snapshotAt)}`,
      )
      // Every ruling, all time: how many went to the challenger.
      const rulingsLine = $('[data-bounty-rulings]', bounty)
      if (rulingsLine) {
        rulingsLine.hidden = reward.rulings === 0
        const won = doc.createElement('b')
        won.textContent = `${integer.format(reward.won)}${plus}`
        rulingsLine.replaceChildren(
          won,
          ` of ${integer.format(reward.rulings)}${plus} ${reward.rulings === 1 ? 'ruling' : 'rulings'} went to the challenger`,
        )
      }
      const list = $('[data-bounty-coins]', bounty)
      const axis = $('[data-bounty-axis]', bounty)
      const key = $('.bounty-key', bounty)
      const announce = $('[data-ledger-live]', bounty)
      list.replaceChildren()
      axis.replaceChildren()
      axis.hidden = coins.length === 0
      if (key) key.hidden = coins.length === 0

      if (coins.length === 0) {
        const none = doc.createElement('li')
        none.className = 'bounty-empty'
        none.textContent = reward.rulings
          ? `None yet: the ${plus ? 'first ' : ''}${integer.format(reward.rulings)}${plus} ${reward.rulings === 1 ? 'ruling' : 'rulings'} went to the requester or were refused.`
          : 'No dispute has been ruled on yet.'
        list.append(none)
      } else {
        /*
         * The ledger: bounties won per calendar month (UTC, by the day of
         * the ruling), one bar per month on a time axis shared by every
         * coin, its height the count on one scale shared by every coin, so
         * the rows compare by volume. A month with a bounty never draws
         * under 2px.
         */
        const DAY_MS = 86_400_000
        const monthOf = (day) => {
          const date = new Date(day * DAY_MS)
          return date.getUTCFullYear() * 12 + date.getUTCMonth()
        }
        const monthText = (month) =>
          monthFormat.format(
            new Date(Date.UTC(Math.floor(month / 12), month % 12, 1)),
          )
        const allDays = coins
          .flatMap((coin) => coin.days)
          .filter((day) => Number.isFinite(day))
        const firstMonth = monthOf(Math.min(...allDays))
        const lastMonth = Math.max(
          monthOf(Math.max(...allDays)),
          hasSnapshot
            ? monthOf(Math.floor(snapshotAt.getTime() / DAY_MS))
            : firstMonth,
        )
        const months = lastMonth - firstMonth + 1
        const perMonth = coins.map((coin) => {
          const counts = Array.from({ length: months }, () => 0)
          for (const day of coin.days)
            if (Number.isFinite(day)) counts[monthOf(day) - firstMonth] += 1
          return counts
        })
        let tallest = { count: 0, month: firstMonth }
        for (const counts of perMonth)
          for (const [index, count] of counts.entries())
            if (count > tallest.count)
              tallest = { count, month: firstMonth + index }
        const top = Math.max(1, tallest.count)
        setText(
          'ledgerKey',
          `Bounties per month, by ruling date · tallest bar ${integer.format(tallest.count)} (${monthText(tallest.month)})`,
        )

        const firstYear = Math.floor(firstMonth / 12)
        const lastYear = Math.floor(lastMonth / 12)
        for (let year = firstYear + 1; year <= lastYear; year++) {
          const share = (year * 12 - firstMonth) / months
          if (share < 0.04 || share > 0.96) continue
          const label = doc.createElement('span')
          label.style.left = `${(share * 100).toFixed(2)}%`
          label.textContent = String(year)
          axis.append(label)
        }

        const tip = doc.createElement('div')
        tip.className = 'ledger-tip'
        tip.setAttribute('aria-hidden', 'true')
        bounty.append(tip)
        $$('.ledger-tip', bounty)
          .filter((node) => node !== tip)
          .forEach((node) => node.remove())

        const HEIGHT = 52
        const BASE = HEIGHT - 0.5
        const ZONE = 46
        const settled = reducedMotion() || ledgerEntered
        let progress = settled ? 1 : 0
        const rows = []

        for (const [index, coin] of coins.entries()) {
          const place = `${coin.stake ? 'Stake · ' : ''}${coin.chain || ''}`
          const count = `${integer.format(coin.won)}${plus} ${coin.won === 1 ? 'bounty' : 'bounties'}`
          const hue = CHAIN_MARKS[coin.chainId]?.hue ?? 'var(--color-primary)'
          const item = doc.createElement('li')
          item.className = 'coin'

          const figure = doc.createElement('div')
          figure.className = 'coin-figure'
          const amount = doc.createElement('b')
          amount.className = 'coin-amount'
          const number = doc.createElement('span')
          const hasAmount =
            typeof coin.amount === 'string' && Number.isFinite(coin.value)
          number.textContent = hasAmount ? `${coin.amount}${plus}` : '—'
          const unit = doc.createElement('small')
          unit.textContent = coin.symbol
          amount.append(number, unit)
          const meta = doc.createElement('span')
          meta.className = 'coin-meta'
          const mark = chainMark(coin.chainId)
          if (mark) meta.append(mark)
          const where = doc.createElement('span')
          where.textContent = place
          meta.append(where)
          const won = doc.createElement('span')
          won.className = 'coin-won'
          won.textContent = count
          figure.append(amount, meta, won)

          const counts = perMonth[index]
          const active = counts
            .map((value, month) => (value > 0 ? month : -1))
            .filter((month) => month >= 0)
          const busiest = active.reduce(
            (best, month) => (counts[month] > counts[best] ? month : best),
            active[0],
          )
          const host = doc.createElement('div')
          host.className = 'ledger'
          host.style.setProperty('--ledger-hue', hue)
          host.tabIndex = 0
          host.setAttribute('role', 'group')
          host.setAttribute('aria-roledescription', 'chart')
          host.setAttribute(
            'aria-label',
            `${coin.symbol} bounties won per month, ${place}: ${count} in ${active.length} ${active.length === 1 ? 'month' : 'months'}, at most ${integer.format(counts[busiest])} in ${monthText(firstMonth + busiest)}. Use the arrow keys to read each month.`,
          )
          item.append(figure, host)
          list.append(item)

          const row = { host, counts, active, coin, number, hasAmount, hue }
          row.hover = -1
          row.render = () => {
            const width = Math.max(120, Math.round(host.clientWidth))
            const pitch = width / months
            const gap = pitch >= 3 ? Math.max(0.8, pitch * 0.28) : 0.4
            const barWidth = Math.max(0.8, pitch - gap)
            const svg = svgEl('svg', {
              viewBox: `0 0 ${width} ${HEIGHT}`,
              width,
              height: HEIGHT,
              'aria-hidden': 'true',
              focusable: 'false',
            })
            const clipId = `ledger-${gen}-${index}`
            const defs = svgEl('defs')
            const clip = svgEl('clipPath', { id: clipId })
            const clipRect = svgEl('rect', {
              x: -2,
              y: -2,
              width: 0,
              height: HEIGHT + 4,
            })
            clip.append(clipRect)
            defs.append(clip)
            const focus = svgEl('rect', {
              class: 'ledger-focus',
              x: 0,
              y: 0,
              width: pitch,
              height: BASE,
              rx: Math.min(2, pitch / 2),
            })
            const bars = svgEl('g', {
              class: 'ledger-bars',
              'clip-path': `url(#${clipId})`,
            })
            const rects = new Map()
            for (const month of active) {
              const value = counts[month]
              const height = Math.max(2, (value / top) * ZONE)
              const rect = svgEl('rect', {
                x: (month * pitch + gap / 2).toFixed(2),
                y: (BASE - height).toFixed(2),
                width: barWidth.toFixed(2),
                height: height.toFixed(2),
                rx: Math.min(1, barWidth / 2),
              })
              rects.set(month, rect)
              bars.append(rect)
            }
            const scan = svgEl('line', {
              class: 'ledger-scan',
              x1: 0,
              x2: 0,
              y1: 1,
              y2: BASE,
            })
            svg.append(
              defs,
              focus,
              svgEl('line', {
                class: 'ledger-base',
                x1: 0,
                x2: width,
                y1: BASE,
                y2: BASE,
              }),
              bars,
              scan,
            )
            host.replaceChildren(svg)
            Object.assign(row, { width, pitch, clipRect, scan, focus, rects })
            row.reveal(progress)
            if (row.hover >= 0) row.show(row.hover)
          }
          row.reveal = (p) => {
            if (!row.clipRect) return
            row.clipRect.setAttribute('width', String(p * (row.width + 4)))
            row.scan.setAttribute('x1', String(p * row.width))
            row.scan.setAttribute('x2', String(p * row.width))
            row.scan.style.opacity = p > 0 && p < 1 ? '0.9' : '0'
          }
          row.show = (month, speak = false) => {
            row.hover = month
            if (!row.focus) return
            for (const [key, rect] of row.rects)
              rect.classList.toggle('on', key === month)
            row.focus.setAttribute('x', String(month * row.pitch))
            host.dataset.hovering = ''
            const value = counts[month]
            const when = monthText(firstMonth + month)
            const title = doc.createElement('b')
            title.textContent = when
            const line = doc.createElement('div')
            const label = doc.createElement('span')
            const dot = doc.createElement('i')
            dot.style.background = hue
            label.append(dot, `${coin.symbol} · ${place}`)
            const figureText = doc.createElement('span')
            figureText.textContent = value
              ? `${integer.format(value)} ${value === 1 ? 'bounty' : 'bounties'}`
              : 'None'
            line.append(label, figureText)
            tip.replaceChildren(title, line)
            const card = bounty.getBoundingClientRect()
            const box = host.getBoundingClientRect()
            const tipWidth = tip.offsetWidth || 180
            const tipHeight = tip.offsetHeight || 60
            const centre = box.left - card.left + (month + 0.5) * row.pitch
            const left = Math.min(
              card.width - tipWidth - 8,
              Math.max(8, centre - tipWidth / 2),
            )
            const topPx = box.top - card.top - tipHeight - 8
            tip.style.transform = `translate(${left}px, ${topPx}px)`
            tip.dataset.on = ''
            if (speak && announce)
              announce.textContent = `${when}: ${value ? integer.format(value) : 'no'} ${coin.symbol} ${value === 1 ? 'bounty' : 'bounties'}, ${place}`
          }
          row.hide = () => {
            row.hover = -1
            delete host.dataset.hovering
            delete tip.dataset.on
            if (row.rects)
              for (const rect of row.rects.values()) rect.classList.remove('on')
          }
          const monthAt = (clientX) => {
            const box = host.getBoundingClientRect()
            const local = ((clientX - box.left) / box.width) * row.width
            return Math.max(
              0,
              Math.min(months - 1, Math.floor(local / row.pitch)),
            )
          }
          const fromPointer = (event) => {
            if (progress < 1) return
            row.show(monthAt(event.clientX))
          }
          host.addEventListener('pointerdown', fromPointer)
          host.addEventListener('pointermove', fromPointer)
          host.addEventListener('pointerleave', (event) => {
            if (event.pointerType === 'mouse') row.hide()
          })
          host.addEventListener('pointercancel', row.hide)
          host.addEventListener('blur', row.hide)
          host.addEventListener('keydown', (event) => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key))
              return
            event.preventDefault()
            // The arrows step through the months with a bounty.
            const at = active.indexOf(row.hover)
            let next
            if (event.key === 'Home') next = 0
            else if (event.key === 'End') next = active.length - 1
            else if (at < 0)
              next = event.key === 'ArrowLeft' ? active.length - 1 : 0
            else
              next = Math.max(
                0,
                Math.min(
                  active.length - 1,
                  at + (event.key === 'ArrowLeft' ? -1 : 1),
                ),
              )
            row.show(active[next], true)
          })
          rows.push(row)
        }
        for (const row of rows) row.render()
        if ('ResizeObserver' in globalThis) {
          let lastWidth = list.clientWidth
          ledgerObserver = new ResizeObserver(() => {
            if (Math.abs(list.clientWidth - lastWidth) < 1) return
            lastWidth = list.clientWidth
            for (const row of rows) row.render()
          })
          ledgerObserver.observe(list)
        }

        const reveal = (p) => {
          progress = p
          for (const row of rows) row.reveal(p)
        }
        /** The amount counts up with the decimals it settles on. */
        const countAmount = (row) => {
          if (!row.hasAmount) return
          const decimals = (row.coin.amount.split('.')[1] ?? '').length
          const format = new Intl.NumberFormat('en-US', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
          })
          tween({
            duration: 1300,
            ease: easeOutExpo,
            onFrame: (p) => {
              row.number.textContent =
                p >= 1
                  ? `${row.coin.amount}${plus}`
                  : format.format(row.coin.value * p)
            },
          })
        }
        if (settled) reveal(1)
        else {
          reveal(0)
          whenInView(
            list,
            () => {
              ledgerEntered = true
              for (const row of rows) countAmount(row)
              tween({
                duration: 1600,
                delay: 150,
                ease: easeInOutCubic,
                onFrame: reveal,
              })
            },
            0.2,
          )
        }
      }
    }
    /* ---------- Line chart: requests per day, challenges made below the baseline ---------- */

    /** Monotone cubic (Fritsch–Carlson): never overshoots the counts. */
    const monotonePath = (points) => {
      const n = points.length
      if (n < 2) return ''
      const dx = []
      const slope = []
      const tangent = []
      for (let index = 0; index < n - 1; index++) {
        dx[index] = points[index + 1][0] - points[index][0]
        slope[index] = (points[index + 1][1] - points[index][1]) / dx[index]
      }
      tangent[0] = slope[0]
      tangent[n - 1] = slope[n - 2]
      for (let index = 1; index < n - 1; index++) {
        if (slope[index - 1] * slope[index] <= 0) {
          tangent[index] = 0
          continue
        }
        const w1 = 2 * dx[index] + dx[index - 1]
        const w2 = dx[index] + 2 * dx[index - 1]
        tangent[index] = (w1 + w2) / (w1 / slope[index - 1] + w2 / slope[index])
      }
      let d = `M${points[0][0]},${points[0][1]}`
      for (let index = 0; index < n - 1; index++) {
        const h = dx[index] / 3
        const [x0, y0] = points[index]
        const [x1, y1] = points[index + 1]
        d += `C${x0 + h},${y0 + tangent[index] * h} ${x1 - h},${y1 - tangent[index + 1] * h} ${x1},${y1}`
      }
      return d
    }

    // Below this many challenges in a day, each one gets its own block.
    const MAX_BLOCKS = 4

    /**
     * A round top for the scale with a little headroom, so the tallest day
     * never runs into the labelled top tick ("160 requests").
     */
    const niceTop = (max) => {
      if (max <= 9) return 10
      const step = max <= 100 ? 10 : 20
      const top = Math.ceil(max / step) * step
      return max > top * 0.9 ? top + step : top
    }

    const buildChart = (host, rows) => {
      // The head lights the whole focal panel, so its wash fades out inside the
      // panel's rim instead of being cut at the chart's own box.
      const lit = host.closest('[data-featured]')
      const count = rows.length
      const requests = rows.map((row) => row.requests)
      const challenges = rows.map((row) => row.challenges)
      const lastDay = rows.at(-1).day
      // The newest day is cut at the snapshot time; say so in its tooltip.
      const partialLast =
        hasSnapshot && snapshotAt.getTime() / 1000 < lastDay + 86_400
      const average = totalRequests / count
      const challengeMax = Math.max(1, ...challenges)
      // Challenges use their own scale below the baseline: one block per
      // challenge while they fit, otherwise bars with their maximum labelled.
      const stacked = challengeMax <= MAX_BLOCKS
      const live = $('[data-chart-live]')
      // Drawn once already (live figures replacing the snapshot): no replay.
      const settled = reducedMotion() || chartEntered
      let progress = settled ? 1 : 0
      let geometry
      let hoverIndex = -1

      const tip = doc.createElement('div')
      tip.className = 'chart-tip'
      tip.setAttribute('aria-hidden', 'true')

      const render = () => {
        const width = Math.max(260, Math.round(host.clientWidth))
        const height = width < 560 ? 220 : 260
        const padLeft = 34
        // The average's label sits right of the plot, clear of the curve.
        const padRight = 48
        const padTop = 14
        const barZone = 30
        const axisZone = 24
        const base = height - barZone - axisZone
        const top = niceTop(Math.max(1, ...requests))
        const x = (index) =>
          padLeft + (index / (count - 1)) * (width - padLeft - padRight)
        const y = (value) => base - (value / top) * (base - padTop)
        const points = requests.map((value, index) => [x(index), y(value)])
        const line = monotonePath(points)
        const area = `${line}L${x(count - 1)},${base}L${x(0)},${base}Z`
        const barWidth = Math.max(
          3,
          Math.min(8, ((width - padLeft) / count) * 0.36),
        )

        const svg = svgEl('svg', {
          viewBox: `0 0 ${width} ${height}`,
          width,
          height,
          role: 'img',
          'aria-label': `Requests per day, ${windowText}: ${integer.format(totalRequests)} in total, ${integer.format(Math.round(average))} a day on average, at most ${integer.format(Math.max(...requests))} in a day. Challenges made per day are drawn on a separate scale below the baseline${stacked ? ', one block per challenge' : ''}: ${integer.format(totalChallenged)} in total.`,
        })
        const defs = svgEl('defs')

        const wash = svgEl('linearGradient', {
          id: 'c-wash',
          x1: 0,
          y1: 0,
          x2: 0,
          y2: 1,
        })
        wash.append(
          svgEl('stop', {
            offset: '0',
            style: 'stop-color: var(--color-primary); stop-opacity: 0.24',
          }),
          svgEl('stop', {
            offset: '0.6',
            style: 'stop-color: var(--color-primary); stop-opacity: 0.06',
          }),
          svgEl('stop', {
            offset: '1',
            style: 'stop-color: var(--color-primary); stop-opacity: 0',
          }),
        )
        const dots = svgEl('pattern', {
          id: 'c-dots',
          width: 6,
          height: 6,
          patternUnits: 'userSpaceOnUse',
        })
        dots.append(
          svgEl('circle', {
            cx: 1.5,
            cy: 1.5,
            r: 0.9,
            style: 'fill: var(--color-primary); fill-opacity: 0.5',
          }),
        )
        const fadeDown = svgEl('linearGradient', {
          id: 'c-fade',
          x1: 0,
          y1: 0,
          x2: 0,
          y2: 1,
        })
        fadeDown.append(
          svgEl('stop', {
            offset: '0',
            style: 'stop-color: var(--white-core); stop-opacity: 1',
          }),
          svgEl('stop', {
            offset: '1',
            style: 'stop-color: var(--white-core); stop-opacity: 0',
          }),
        )
        const dotMask = svgEl('mask', {
          id: 'c-dot-mask',
          maskUnits: 'userSpaceOnUse',
          x: 0,
          y: 0,
          width,
          height,
        })
        dotMask.append(
          svgEl('rect', {
            x: 0,
            y: padTop,
            width,
            height: base - padTop,
            fill: 'url(#c-fade)',
          }),
        )
        const stroke = svgEl('linearGradient', {
          id: 'c-stroke',
          gradientUnits: 'userSpaceOnUse',
          x1: padLeft,
          y1: 0,
          x2: width - padRight,
          y2: 0,
        })
        stroke.append(
          svgEl('stop', {
            offset: '0',
            style: 'stop-color: var(--color-primary); stop-opacity: 0.25',
          }),
          svgEl('stop', {
            offset: '0.3',
            style: 'stop-color: var(--color-primary); stop-opacity: 0.7',
          }),
          svgEl('stop', {
            offset: '1',
            style: 'stop-color: var(--color-primary); stop-opacity: 1',
          }),
        )
        const blur = svgEl('filter', {
          id: 'c-glow',
          filterUnits: 'userSpaceOnUse',
          x: 0,
          y: 0,
          width,
          height,
        })
        blur.append(svgEl('feGaussianBlur', { stdDeviation: 3 }))
        const headGlow = svgEl('radialGradient', { id: 'c-head' })
        headGlow.append(
          svgEl('stop', {
            offset: '0',
            style: 'stop-color: var(--color-primary); stop-opacity: 0.45',
          }),
          svgEl('stop', {
            offset: '1',
            style: 'stop-color: var(--color-primary); stop-opacity: 0',
          }),
        )
        const clip = svgEl('clipPath', { id: 'c-reveal' })
        const clipRect = svgEl('rect', {
          x: 0,
          y: -40,
          width: 0,
          height: height + 80,
        })
        clip.append(clipRect)
        defs.append(wash, dots, fadeDown, dotMask, stroke, blur, headGlow, clip)
        svg.append(defs)

        // Scale: three labels at most, the top one with its unit, no
        // gridlines; one dashed average line.
        for (const value of [0, top / 2, top]) {
          const label = svgEl('text', {
            class: 'axis',
            x: 0,
            y: y(value) + 4,
          })
          label.textContent =
            value === top
              ? `${integer.format(value)} requests`
              : integer.format(value)
          svg.append(label)
        }
        const averageY = y(average)
        const guideLabel = svgEl('text', {
          class: 'guide-label',
          x: width - padRight + 10,
          y: averageY + 4,
        })
        guideLabel.textContent = `avg ${integer.format(Math.round(average))}`
        svg.append(
          svgEl('line', {
            class: 'guide',
            x1: padLeft,
            x2: width - padRight,
            y1: averageY,
            y2: averageY,
          }),
        )

        const revealed = svgEl('g', { 'clip-path': 'url(#c-reveal)' })
        revealed.append(
          svgEl('path', { d: area, fill: 'url(#c-wash)' }),
          svgEl('path', {
            d: area,
            fill: 'url(#c-dots)',
            mask: 'url(#c-dot-mask)',
          }),
        )
        svg.append(revealed)

        const glowPath = svgEl('path', {
          d: line,
          fill: 'none',
          filter: 'url(#c-glow)',
          'stroke-width': 6,
          style: 'stroke: var(--color-primary); stroke-opacity: 0.35',
        })
        const linePath = svgEl('path', {
          d: line,
          fill: 'none',
          stroke: 'url(#c-stroke)',
          'stroke-width': 2.2,
        })
        svg.append(glowPath, linePath, guideLabel)
        svg.append(
          svgEl('line', {
            class: 'baseline',
            x1: padLeft,
            x2: width - padRight,
            y1: base,
            y2: base,
          }),
        )

        const bars = []
        const zone = barZone - 8
        const gap = 2
        const block = stacked
          ? Math.min(6, (zone + gap) / challengeMax - gap)
          : 0
        for (const [index, value] of challenges.entries()) {
          if (value <= 0) continue
          // Drawn already (a resize): no second entrance.
          const group = svgEl('g', { class: progress >= 1 ? 'bar on' : 'bar' })
          const left = x(index) - barWidth / 2
          if (stacked)
            for (let unit = 0; unit < value; unit++)
              group.append(
                svgEl('rect', {
                  x: left,
                  y: base + 4 + unit * (block + gap),
                  width: barWidth,
                  height: block,
                  rx: Math.min(1.5, barWidth / 2),
                }),
              )
          else
            group.append(
              svgEl('rect', {
                x: left,
                y: base + 4,
                width: barWidth,
                height: Math.max(2, (value / challengeMax) * zone),
                rx: Math.min(2, barWidth / 2),
              }),
            )
          bars.push({ rect: group, at: x(index) })
          svg.append(group)
        }
        if (!stacked) {
          // The bars' own scale: their maximum, next to the tallest one's foot.
          const scaleLabel = svgEl('text', {
            class: 'axis axis--challenges',
            x: 0,
            y: base + 4 + zone,
          })
          scaleLabel.textContent = integer.format(challengeMax)
          svg.append(scaleLabel)
        }

        const ticks =
          width < 560
            ? [0, Math.round((count - 1) / 2), count - 1]
            : [0, 7, 14, 21, count - 1]
        const tickIndexes = ticks.filter(
          (index, position, list) =>
            index < count && list.indexOf(index) === position,
        )
        const xLabels = new Map()
        for (const index of tickIndexes) {
          const anchor =
            index === 0 ? 'start' : index === count - 1 ? 'end' : 'middle'
          const label = svgEl('text', {
            class: 'axis-x',
            x:
              index === 0
                ? x(0) - 2
                : index === count - 1
                  ? x(index) + 2
                  : x(index),
            y: height - 6,
            'text-anchor': anchor,
          })
          label.textContent = dayFormat.format(new Date(rows[index].day * 1000))
          xLabels.set(index, label)
          svg.append(label)
        }

        const cross = svgEl('line', {
          class: 'cross',
          x1: 0,
          x2: 0,
          y1: padTop - 6,
          y2: base,
        })
        const hoverDot = svgEl('circle', { class: 'hover-dot', r: 4 })
        svg.append(cross, hoverDot)

        const head = svgEl('g')
        const halo = svgEl('circle', { class: 'head-halo', r: 5 })
        head.append(
          svgEl('circle', { r: 36, fill: 'url(#c-head)' }),
          halo,
          svgEl('circle', { class: 'head-core', r: 4.5 }),
        )
        svg.append(head)

        host.replaceChildren(svg, tip)
        const length = linePath.getTotalLength()
        for (const path of [glowPath, linePath])
          path.style.strokeDasharray = `${length} ${length}`

        geometry = {
          width,
          height,
          base,
          padTop,
          x,
          y,
          length,
          glowPath,
          linePath,
          clipRect,
          head,
          halo,
          bars,
          cross,
          hoverDot,
          xLabels,
        }
        setProgress(progress)
        if (hoverIndex >= 0) showHover(hoverIndex)
      }

      const setProgress = (p) => {
        progress = p
        if (!geometry) return
        const { length, glowPath, linePath, clipRect, head, bars } = geometry
        const offset = String(length * (1 - p))
        glowPath.style.strokeDashoffset = offset
        linePath.style.strokeDashoffset = offset
        const point = linePath.getPointAtLength(Math.max(0.001, p * length))
        clipRect.setAttribute('width', String(point.x))
        head.setAttribute('transform', `translate(${point.x} ${point.y})`)
        head.style.opacity = p > 0.01 ? '1' : '0'
        for (const bar of bars)
          bar.rect.classList.toggle('on', bar.at <= point.x + 0.5)
        if (lit) {
          const hostBox = host.getBoundingClientRect()
          const litBox = lit.getBoundingClientRect()
          lit.style.setProperty(
            '--hx',
            `${hostBox.left - litBox.left + point.x}px`,
          )
          lit.style.setProperty(
            '--hy',
            `${hostBox.top - litBox.top + point.y}px`,
          )
        }
      }

      const showHover = (index, announce = false) => {
        hoverIndex = index
        if (!geometry) return
        const { x, y, cross, hoverDot, width, padTop, xLabels } = geometry
        const cx = x(index)
        const cy = y(requests[index])
        cross.setAttribute('x1', String(cx))
        cross.setAttribute('x2', String(cx))
        hoverDot.setAttribute('cx', String(cx))
        hoverDot.setAttribute('cy', String(cy))
        for (const [labelIndex, label] of xLabels)
          label.classList.toggle('x-on', labelIndex === index)
        const day = new Date(rows[index].day * 1000)
        const partial =
          index === count - 1 && partialLast
            ? ` · to ${timeFormat.format(snapshotAt)} UTC`
            : ''
        tip.replaceChildren()
        const title = doc.createElement('b')
        title.textContent = longDayFormat.format(day)
        if (partial) {
          const small = doc.createElement('small')
          small.textContent = partial
          title.append(small)
        }
        const row = (color, labelText, value) => {
          const line = doc.createElement('div')
          const name = doc.createElement('span')
          const dot = doc.createElement('i')
          dot.style.background = color
          name.append(dot, labelText)
          const amount = doc.createElement('span')
          amount.textContent = integer.format(value)
          line.append(name, amount)
          return line
        }
        tip.append(
          title,
          row('var(--color-primary)', 'Requests', requests[index]),
          row('var(--status-contested)', 'Challenges', challenges[index]),
        )
        if (announce && live)
          live.textContent = `${longDayFormat.format(day)}${partial}: ${integer.format(requests[index])} requests, ${integer.format(challenges[index])} challenges`
        const tipWidth = tip.offsetWidth || 170
        const tipHeight = tip.offsetHeight || 80
        const left = Math.min(width - tipWidth, Math.max(0, cx - tipWidth / 2))
        const above = cy - tipHeight - 14
        const topPx = above >= padTop - 14 ? above : cy + 16
        tip.style.transform = `translate(${left}px, ${topPx}px)`
        host.dataset.hovering = ''
      }

      const hideHover = () => {
        hoverIndex = -1
        delete host.dataset.hovering
        if (geometry)
          for (const label of geometry.xLabels.values())
            label.classList.remove('x-on')
      }

      const indexAt = (clientX) => {
        if (!geometry) return -1
        const box = host.getBoundingClientRect()
        const local = ((clientX - box.left) / box.width) * geometry.width
        const ratio =
          (local - geometry.x(0)) / (geometry.x(count - 1) - geometry.x(0))
        return Math.max(0, Math.min(count - 1, Math.round(ratio * (count - 1))))
      }

      // A tap opens the day's readout too (touch fires no pointermove), and a
      // horizontal drag moves through the days (touch-action: pan-y). Only a
      // mouse leaving hides it: a lifted finger keeps it open until a tap
      // elsewhere blurs the chart, or the swipe becomes a page scroll.
      const fromPointer = (event) => {
        if (progress < 1) return
        showHover(indexAt(event.clientX))
      }
      host.addEventListener('pointerdown', fromPointer)
      host.addEventListener('pointermove', fromPointer)
      host.addEventListener('pointerleave', (event) => {
        if (event.pointerType === 'mouse') hideHover()
      })
      host.addEventListener('pointercancel', hideHover)
      host.addEventListener('blur', hideHover)
      host.addEventListener('keydown', (event) => {
        if (progress < 1) return
        const moves = { ArrowLeft: -1, ArrowRight: 1, Home: -count, End: count }
        if (!(event.key in moves)) return
        event.preventDefault()
        // A first arrow lands on an end: Left the newest day, Right the oldest.
        const step = moves[event.key]
        const next =
          hoverIndex < 0 && Math.abs(step) === 1
            ? step < 0
              ? count - 1
              : 0
            : (hoverIndex < 0 ? count - 1 : hoverIndex) + step
        showHover(Math.max(0, Math.min(count - 1, next)), true)
      })
      host.setAttribute('role', 'group')
      host.setAttribute('aria-roledescription', 'chart')
      host.setAttribute(
        'aria-label',
        `Requests and challenges per day, ${windowText}. Use the arrow keys to read each day.`,
      )

      render()
      if ('ResizeObserver' in globalThis) {
        let lastWidth = host.clientWidth
        new ResizeObserver(() => {
          if (Math.abs(host.clientWidth - lastWidth) < 1) return
          lastWidth = host.clientWidth
          render()
        }).observe(host)
      }

      if (settled) return
      whenInView(host, () => {
        chartEntered = true
        tween({
          duration: 1300,
          delay: 150,
          ease: easeInOutCubic,
          onFrame: setProgress,
          onDone: () => {
            const halo = geometry?.halo
            if (!halo) return
            halo.classList.remove('ping')
            // Restart the one-shot ping that marks the newest day.
            void halo.getBoundingClientRect()
            halo.classList.add('ping')
          },
        })
      })
    }

    const chartHost = $('[data-chart]')
    if (chartHost && hasSeries) {
      buildChart(chartHost, series)
      const perDay = integer.format(Math.round(totalRequests / series.length))
      const blocks =
        Math.max(...series.map((row) => row.challenges)) <= MAX_BLOCKS
      setText('average', `${perDay} a day on average`)
      setText(
        'challengeKey',
        blocks ? 'Challenges, one block each' : 'Challenges, own scale',
      )
      setText(
        'chartCaption',
        `Requests and challenges made per day, ${windowText}. Requests average ${perDay} a day; challenges are drawn on a separate scale below the baseline.`,
      )
      const body = $('[data-chart-table] tbody')
      if (body)
        for (const row of series) {
          const tr = doc.createElement('tr')
          for (const text of [
            dayFormat.format(new Date(row.day * 1000)),
            integer.format(row.requests),
            integer.format(row.challenges),
          ]) {
            const cell = doc.createElement('td')
            cell.textContent = text
            tr.append(cell)
          }
          body.append(tr)
        }
    }
  }

  // The dated snapshot (data.js) is drawn at once and labelled as such; the
  // live query src/landing/boot.ts starts replaces it when it answers in
  // full, and resolves to null on any failure or after a few seconds. Module
  // scripts run before DOMContentLoaded, so the promise is there by then.
  let figuresStarted = false
  const startFigures = () => {
    if (figuresStarted) return
    figuresStarted = true
    boot(globalThis.CURATE_LANDING_DATA)
    const pending = globalThis.CURATE_LANDING_LIVE
    if (pending && typeof pending.then === 'function')
      pending
        .then((live) => (live ? boot(live) : undefined))
        .catch(() => undefined)
  }
  if (doc.readyState === 'loading')
    doc.addEventListener('DOMContentLoaded', startFigures, { once: true })
  else startFigures()

  /* ---------- Dispute flow schematic ---------- */

  const flow = $('[data-flow]')
  if (flow) {
    const wires = $('[data-flow-wires]', flow)
    const node = (name) => $(`[data-node="${name}"]`, flow)
    const links = [
      { from: 'submit', to: 'window', tone: 'window' },
      { from: 'window', to: 'accepted', tone: 'registered' },
      { from: 'window', to: 'court', tone: 'contested' },
      { from: 'court', to: 'ruling', tone: 'contested' },
    ]
    const drawnLinks = new Set()

    const boxOf = (element) => {
      const outer = flow.getBoundingClientRect()
      const box = element.getBoundingClientRect()
      const left = box.left - outer.left
      const top = box.top - outer.top
      return {
        left,
        top,
        right: left + box.width,
        bottom: top + box.height,
        cx: left + box.width / 2,
        cy: top + box.height / 2,
      }
    }

    /** Orthogonal path through the given corners, with rounded joints. */
    const rounded = (points, radius = 12) => {
      let d = `M${points[0][0]},${points[0][1]}`
      for (let index = 1; index < points.length - 1; index++) {
        const [px, py] = points[index - 1]
        const [cx, cy] = points[index]
        const [nx, ny] = points[index + 1]
        const inLength = Math.hypot(cx - px, cy - py)
        const outLength = Math.hypot(nx - cx, ny - cy)
        const r = Math.min(radius, inLength / 2, outLength / 2)
        const ax = cx - ((cx - px) / inLength) * r
        const ay = cy - ((cy - py) / inLength) * r
        const bx = cx + ((nx - cx) / outLength) * r
        const by = cy + ((ny - cy) / outLength) * r
        d += `L${ax},${ay}Q${cx},${cy} ${bx},${by}`
      }
      const [lx, ly] = points.at(-1)
      return `${d}L${lx},${ly}`
    }

    const route = (from, to) => {
      const a = boxOf(node(from))
      const b = boxOf(node(to))
      const sameRow = b.top < a.bottom - 4 && b.bottom > a.top + 4
      if (sameRow) {
        const y = Math.max(a.top, b.top) + 30
        return rounded([
          [a.right, y],
          [b.left, y],
        ])
      }
      const sameColumn = b.left < a.right - 4 && b.right > a.left + 4
      const blocked = links
        .flatMap((link) => [link.from, link.to])
        .filter((name, index, list) => list.indexOf(name) === index)
        .filter((name) => name !== from && name !== to)
        .map((name) => boxOf(node(name)))
        .some(
          (box) =>
            box.top >= a.bottom - 1 &&
            box.bottom <= b.top + 1 &&
            box.left < a.right &&
            box.right > a.left,
        )
      if (sameColumn && !blocked)
        return rounded([
          [a.left + 30, a.bottom],
          [b.left + 30, b.top],
        ])
      if (sameColumn) {
        // Phones: run down the left rail around the node in between.
        const rail = Math.max(6, a.left - 14)
        return rounded([
          [a.left, a.top + 30],
          [rail, a.top + 30],
          [rail, b.top + 30],
          [b.left, b.top + 30],
        ])
      }
      const midY = (a.bottom + b.top) / 2
      return rounded([
        [a.left + 30, a.bottom],
        [a.left + 30, midY],
        [b.left + 30, midY],
        [b.left + 30, b.top],
      ])
    }

    const parts = links.map((link) => {
      const bed = svgEl('path', { class: 'wire-bed' })
      const wire = svgEl('path', {
        class: `wire wire--${link.tone}`,
        pathLength: 1,
      })
      const glowSpark = svgEl('circle', {
        class: 'spark-glow',
        r: 9,
        style: `fill: var(--status-${link.tone}); fill-opacity: 0.35`,
      })
      const spark = svgEl('circle', { class: 'spark', r: 3 })
      wires.append(bed, wire, glowSpark, spark)
      return { ...link, bed, wire, spark, glowSpark }
    })

    const layout = () => {
      const outer = flow.getBoundingClientRect()
      wires.setAttribute('viewBox', `0 0 ${outer.width} ${outer.height}`)
      for (const part of parts) {
        const d = route(part.from, part.to)
        part.bed.setAttribute('d', d)
        part.wire.setAttribute('d', d)
        part.wire.style.strokeDashoffset = drawnLinks.has(part) ? '0' : '1'
      }
    }

    const light = (name) => node(name)?.classList.add('lit')
    const settle = (name) => {
      const item = node(name)
      item?.classList.remove('lit')
      item?.classList.add('done')
    }

    const drawLink = (part, duration) =>
      new Promise((resolve) => {
        const length = part.wire.getTotalLength()
        for (const dot of [part.spark, part.glowSpark]) dot.style.opacity = '1'
        tween({
          duration,
          ease: easeInOutCubic,
          onFrame: (p) => {
            part.wire.style.strokeDashoffset = String(1 - p)
            const point = part.wire.getPointAtLength(p * length)
            for (const dot of [part.spark, part.glowSpark])
              dot.setAttribute('transform', `translate(${point.x} ${point.y})`)
          },
          onDone: () => {
            drawnLinks.add(part)
            for (const dot of [part.spark, part.glowSpark])
              dot.style.opacity = '0'
            resolve()
          },
        })
      })

    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
    const replay = $('[data-replay]', flow)
    let running = false

    const play = async () => {
      if (running) return
      running = true
      if (replay) replay.hidden = true
      drawnLinks.clear()
      for (const item of $$('.node', flow)) item.classList.remove('lit', 'done')
      flow.dataset.armed = ''
      layout()
      await wait(120)
      light('submit')
      await wait(320)
      await drawLink(parts[0], 650)
      settle('submit')
      light('window')
      await wait(1250)
      await drawLink(parts[1], 650)
      light('accepted')
      await wait(450)
      await drawLink(parts[2], 650)
      settle('window')
      light('court')
      await wait(500)
      await drawLink(parts[3], 650)
      settle('court')
      light('ruling')
      running = false
      if (replay) replay.hidden = false
    }

    const showAll = () => {
      for (const part of parts) drawnLinks.add(part)
      delete flow.dataset.armed
      layout()
    }

    if ('ResizeObserver' in globalThis) new ResizeObserver(layout).observe(flow)
    doc.fonts?.addEventListener('loadingdone', layout)

    if (reducedMotion()) showAll()
    else {
      flow.dataset.armed = ''
      layout()
      whenInView(flow, play, 0.25)
      replay?.addEventListener('click', play)
    }
  }
})()
