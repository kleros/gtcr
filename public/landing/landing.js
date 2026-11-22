/*
 * Kleros Curate landing: the theme switch (shared with the app), the
 * figures (the dated snapshot in data.js at once, then the live ones from
 * src/landing/boot.ts), scroll reveals, the headline's changing word, the
 * two dollar figures (value passed through Curate, bounties won) and the
 * dispute flow schematic. Plain DOM, no dependencies. Without data the
 * figures stay as dashes and the panel says so. Reduced motion renders
 * every drawing in its final state.
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

  /* ---------- Reveals ---------- */

  // First of all: the head script's .js class keeps every [data-reveal]
  // block invisible until it is marked in, so nothing that throws further
  // down may stand between the page and this.
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

  /* ---------- Headline: the word that runs through examples, once ---------- */

  // As the app's RotatingWord (src/components/curate/rotating-word.tsx):
  // each word stays 1.6 s, the last one ("anything") stays for good, and it
  // never loops. It only advances while the page is visible, so a
  // background tab does not finish it unseen; under reduced motion it keeps
  // the first word. The word is aria-hidden: the heading's sr-only sentence
  // is what screen readers hear, once.
  const rotating = $('[data-rotating-word]')
  if (rotating) {
    const words = (rotating.dataset.words || '').split(' ').filter(Boolean)
    const suffix = rotating.dataset.suffix || ''
    const last = words.length - 1
    let index = 0
    let timer
    const schedule = () => {
      globalThis.clearTimeout(timer)
      if (index >= last || reducedMotion()) return
      if (doc.visibilityState !== 'visible') return
      timer = globalThis.setTimeout(() => {
        index += 1
        rotating.textContent = `${words[index]}${suffix}`
        // Only a change animates: the first word paints with the page.
        rotating.removeAttribute('data-entering')
        void rotating.offsetWidth
        rotating.setAttribute('data-entering', '')
        schedule()
      }, 1600)
    }
    doc.addEventListener('visibilitychange', schedule)
    schedule()
  }

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

  /* ---------- Figures: live from the indexers, or the dated snapshot ---------- */

  // Each draw is a generation: when live figures replace the snapshot, the
  // snapshot's pending animations and observers stand down.
  let generation = 0
  const watchInView = whenInView
  const runTween = tween
  // What has already made its entrance: a later generation (the live
  // figures replacing the snapshot) updates it in place, without a replay.
  const entered = new WeakSet()
  // Resize watchers of the current draw (a new draw replaces them).
  let stripObserver

  /**
   * A list logo's URL: https as it is, an IPFS path through the app's
   * gateway (src/landing/boot.ts provides the resolver); none without it.
   */
  // Every logo goes through the app's resolver (src/landing/boot.ts), which
  // keeps it on the IPFS gateway: a web address a list names is not loaded,
  // or every visitor's browser would call that host.
  const mediaUrl = (uri) => {
    if (typeof uri !== 'string' || !uri.trim()) return null
    const resolve = globalThis.CURATE_LANDING_MEDIA
    if (typeof resolve !== 'function') return null
    try {
      return resolve(uri)
    } catch {
      return null
    }
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
    const setText = (key, text) => {
      for (const node of $$(`[data-fig="${key}"]`)) node.textContent = text
    }
    setText('window', windowText)
    const live = data?.live === true
    if (hasSnapshot) {
      const when = live ? 'now' : `on ${dayFormat.format(snapshotAt)}`
      setText(
        'openUnit',
        windowKnown
          ? `open for verification ${when}`
          : `unchallenged requests ${when}`,
      )
      setText('inCourtLabel', `In court ${when}`)
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
          ? `Figures: public Curate data, read live at ${stamp}. Bounties and value passed through: all time, the retired Classic lists included, in dollars at today's prices.`
          : `Figures: public Curate data, snapshot of ${stamp}. Bounties and value passed through: all time to that day, the retired Classic lists included, in dollars at that day's prices. The app shows them live.`,
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
        const entries = isCount(list.entries) ? list.entries : undefined
        const open = isCount(list.open) ? list.open : 0
        const item = doc.createElement('li')
        item.style.setProperty('--i', String(index))
        const link = doc.createElement('a')
        link.className = 'vtile'
        link.href = `/tcr/${list.chainId}/${list.address.toLowerCase()}`
        link.title = [
          list.title,
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

        const meta = doc.createElement('span')
        meta.className = 'vtile-meta'
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

    /* ---------- Money: passed through Curate and bounties won, in dollars ---------- */

    // Rounds 14 and 15: two figures, all time, in dollars only at today's
    // prices (src/landing/money.ts); no coin, chain or chart.
    const moneyBox = $('[data-money]')
    if (moneyBox) {
      const money = data?.money ?? {}
      const dollars = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        notation: 'compact',
        maximumSignificantDigits: 3,
      })
      const exact = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      })
      // A figure the live read could not give is the snapshot's: it keeps
      // the snapshot's date and prices (src/landing/boot.ts, dated).
      const dated = Array.isArray(money.dated) ? money.dated : []
      const isLive = (key) => live && !dated.includes(key)
      const whenFor = (key) =>
        isLive(key) || !hasSnapshot
          ? 'all time'
          : `to ${dayYearFormat.format(snapshotAt)}`
      const rows = [
        {
          key: 'bounties',
          value: money.bounties,
          count: money.bountiesPaid,
          plus: money.bountiesCapped === true ? '+' : '',
          who: 'by challengers',
          unit: (n) => (n === 1 ? 'bounty' : 'bounties'),
        },
        {
          key: 'transit',
          value: money.transit,
          count: money.requests,
          plus: '',
          who: 'deposits, challenges and appeals',
          unit: (n) => (n === 1 ? 'request' : 'requests'),
        },
      ]
      // A snapshot's dollars are at its own day's prices.
      const basis = $('[data-money-basis]', moneyBox)
      if (basis)
        basis.textContent = !hasSnapshot
          ? 'In dollars at today’s prices.'
          : !live || dated.length === rows.length
            ? `In dollars at prices of ${dayYearFormat.format(snapshotAt)}.`
            : dated.length > 0
              ? `In dollars at today’s prices; a figure dated ${dayYearFormat.format(snapshotAt)} is at that day’s prices.`
              : 'In dollars at today’s prices.'
      let shown = 0
      for (const row of rows) {
        const figure = $(`[data-money-fig="${row.key}"]`, moneyBox)
        const note = $(`[data-money-note="${row.key}"]`, moneyBox)
        const known = Number.isFinite(row.value) && row.value >= 0
        const host = figure?.closest('.money-row')
        if (host) host.hidden = !known
        if (!figure || !known) continue
        shown += 1
        if (note)
          note.textContent = isCount(row.count)
            ? `${row.who}, ${whenFor(row.key)} · ${integer.format(row.count)}${row.plus} ${row.unit(row.count)}`
            : `${row.who}, ${whenFor(row.key)}`
        const text = (value) => `${dollars.format(value)}${row.plus}`
        figure.title = `${exact.format(row.value)}${row.plus}`
        figure.textContent = text(row.value)
        if (reducedMotion() || entered.has(figure)) continue
        whenInView(
          figure,
          () => {
            entered.add(figure)
            tween({
              duration: 1400,
              ease: easeOutExpo,
              onFrame: (p) => {
                figure.textContent = text(row.value * p)
              },
            })
          },
          0,
        )
      }
      // No figure at all: the card goes and the copy takes the hero.
      moneyBox.hidden = shown === 0
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
