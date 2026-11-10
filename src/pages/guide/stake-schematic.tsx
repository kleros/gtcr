import React from 'react'
import {
  BoxNode,
  Edge,
  EdgeLabel,
  RailNode,
  SchematicFrame,
  SchematicSvg as Svg,
  TokenGlow,
  Tokens,
  type NodeSpec,
  type TokenRun,
} from './schematic-kit'

/*
 * An entry's life in a Stake Curate list, drawn in the same hand as the
 * Light and Classic lifecycle: the stake goes in and stays locked while the
 * entry is listed; a challenge can come at any time, also while the
 * submitter is withdrawing (its own edge); jurors either remove the entry,
 * and the challenger takes its whole stake, or keep it, and the challenge
 * stake is added to its stake. Without a challenge the withdrawal runs out
 * its period and the stake goes back. Withdrawn is drawn neutral, not red:
 * the entry leaves the list but nobody loses anything. On the phone rail the
 * kept outcome is a branch of its own, like the withdrawal. Three tokens
 * travel the three outcomes once. Mechanism per PermanentGTCR (addItem,
 * challengeItem, rule, startWithdrawItem, withdrawItem) and the Stake
 * Curate docs.
 */

const NODES: Record<string, NodeSpec> = {
  submit: {
    id: 'submit',
    title: 'Submit',
    lines: ['Token stake, plus an', 'arbitration deposit'],
    delay: 0,
  },
  listed: {
    id: 'listed',
    title: 'Listed',
    lines: ['Stake locked; open to', 'challenge at any time'],
    tone: 'registered',
    delay: 380,
  },
  withdrawing: {
    id: 'withdrawing',
    title: 'Withdrawing period',
    lines: ['Started by the submitter;', 'still open to challenge'],
    tone: 'window',
    delay: 960,
  },
  withdrawn: {
    id: 'withdrawn',
    title: 'Withdrawn',
    lines: ['Stake and deposit', 'back to the submitter'],
    tone: 'neutral',
    delay: 1480,
  },
  dispute: {
    id: 'dispute',
    title: 'Dispute',
    lines: ['Evidence, then jurors vote', 'on the list’s policy'],
    tone: 'contested',
    delay: 960,
  },
  removed: {
    id: 'removed',
    title: 'Removed',
    lines: ['The challenger takes the', 'entry’s whole stake'],
    tone: 'off',
    delay: 1480,
  },
  /** The phone rail's branch for the kept outcome. */
  kept: {
    id: 'kept',
    title: 'Listed again',
    lines: ['The challenge stake joins its stake'],
    tone: 'registered',
    delay: 1480,
  },
}

const EDGE_DELAY = {
  toListed: 120,
  withdraw: 640,
  challenged: 640,
  toWithdrawn: 1180,
  withdrawChallenged: 1180,
  toRemoved: 1180,
  kept: 1720,
}

const KEPT = 'Jurors keep it'
const KEPT_DETAIL = 'the challenge stake joins its stake'
const REMOVED = 'Jurors remove it'

/** A withdrawal nobody challenges, a challenge that wins, one that fails. */
const runs = (withdrawn: string, removed: string, kept: string): TokenRun[] => [
  { d: withdrawn, delay: 2400, duration: 1900 },
  { d: removed, delay: 2900, duration: 2600 },
  { d: kept, delay: 3500, duration: 2600 },
]

const WIDE_RUNS = runs(
  'M95 76 H920',
  'M95 76 H340 V256 H870',
  'M95 76 H340 V256 H400 V76 H370',
)

const MID_RUNS = runs(
  'M75 76 H680',
  'M75 76 H240 V256 H650',
  'M75 76 H240 V256 H290 V76 H264',
)

const NARROW_RUNS = runs(
  'M26 20 V128 Q26 156 50 156 Q70 156 70 190 V282',
  'M26 20 V580',
  'M26 20 V424 Q26 452 50 452 Q70 452 70 486',
)

const GLOW = 'stake-token-glow'

const SUMMARY =
  'How an entry moves through a Stake Curate list. The submitter stakes the list’s token, plus an arbitration deposit in the chain’s currency, and the entry is listed with its stake locked. Anyone can challenge it at any time, which opens a dispute where Kleros jurors vote on the list’s policy. If they remove it, the challenger takes the entry’s whole stake. If they keep it, the challenger’s stake is added to the entry’s stake and the entry stays listed. The submitter can start a withdrawal: the entry stays open to challenge for the withdrawing period, then the stake and the arbitration deposit go back to the submitter. An entry kept while it is withdrawing is withdrawn at the ruling.'

const WideMap = ({ armed }: { armed: boolean }) => (
  <Svg
    viewBox="0 18 1000 286"
    role="img"
    aria-label={SUMMARY}
    data-on={armed ? 'true' : 'false'}
  >
    <TokenGlow id={GLOW} />
    <Edge
      d="M190 76 H252"
      head="M252 70 L260 76 L252 82"
      ms={EDGE_DELAY.toListed}
    />
    <Edge
      d="M480 76 H542"
      head="M542 70 L550 76 L542 82"
      ms={EDGE_DELAY.withdraw}
    />
    <Edge
      d="M770 76 H832"
      head="M832 70 L840 76 L832 82"
      ms={EDGE_DELAY.toWithdrawn}
    />
    <Edge
      d="M340 118 V206"
      head="M334 206 L340 214 L346 206"
      ms={EDGE_DELAY.challenged}
    />
    <EdgeLabel x={326} y={171} anchor="end" ms={EDGE_DELAY.challenged}>
      Challenged
    </EdgeLabel>
    <Edge
      d="M660 118 V190 Q660 198 652 198 H468 Q460 198 460 206"
      head="M454 206 L460 214 L466 206"
      ms={EDGE_DELAY.withdrawChallenged}
    />
    <EdgeLabel x={674} y={163} ms={EDGE_DELAY.withdrawChallenged}>
      Challenged
    </EdgeLabel>
    <Edge
      d="M400 214 V126"
      head="M394 126 L400 118 L406 126"
      ms={EDGE_DELAY.kept}
    />
    <EdgeLabel x={414} y={163} ms={EDGE_DELAY.kept}>
      {KEPT}
    </EdgeLabel>
    <EdgeLabel x={414} y={181} ms={EDGE_DELAY.kept}>
      {KEPT_DETAIL}
    </EdgeLabel>
    <Edge
      d="M480 256 H732"
      head="M732 250 L740 256 L732 262"
      ms={EDGE_DELAY.toRemoved}
    />
    <EdgeLabel x={610} y={244} anchor="middle" ms={EDGE_DELAY.toRemoved}>
      {REMOVED}
    </EdgeLabel>
    <Tokens runs={WIDE_RUNS} armed={armed} glow={GLOW} />
    <BoxNode spec={NODES.submit} x={0} y={34} w={190} />
    <BoxNode spec={NODES.listed} x={260} y={34} w={220} />
    <BoxNode spec={NODES.withdrawing} x={550} y={34} w={220} />
    <BoxNode spec={NODES.withdrawn} x={840} y={34} w={160} />
    <BoxNode spec={NODES.dispute} x={260} y={214} w={220} />
    <BoxNode spec={NODES.removed} x={740} y={214} w={260} />
  </Svg>
)

const MID_DISPUTE = ['Evidence, then jurors', 'vote on the list’s policy']

/** The same map for middle containers, 760 units wide and capped at 820px. */
const MidMap = ({ armed }: { armed: boolean }) => (
  <Svg
    viewBox="0 18 760 286"
    role="img"
    aria-label={SUMMARY}
    data-on={armed ? 'true' : 'false'}
    $max={820}
  >
    <TokenGlow id={GLOW} />
    <Edge
      d="M150 76 H168"
      head="M168 70 L176 76 L168 82"
      ms={EDGE_DELAY.toListed}
    />
    <Edge
      d="M352 76 H370"
      head="M370 70 L378 76 L370 82"
      ms={EDGE_DELAY.withdraw}
    />
    <Edge
      d="M574 76 H592"
      head="M592 70 L600 76 L592 82"
      ms={EDGE_DELAY.toWithdrawn}
    />
    <Edge
      d="M240 118 V206"
      head="M234 206 L240 214 L246 206"
      ms={EDGE_DELAY.challenged}
    />
    <EdgeLabel x={226} y={171} anchor="end" ms={EDGE_DELAY.challenged}>
      Challenged
    </EdgeLabel>
    <Edge
      d="M540 118 V190 Q540 198 532 198 H340 Q332 198 332 206"
      head="M326 206 L332 214 L338 206"
      ms={EDGE_DELAY.withdrawChallenged}
    />
    <EdgeLabel x={554} y={163} ms={EDGE_DELAY.withdrawChallenged}>
      Challenged
    </EdgeLabel>
    <Edge
      d="M290 214 V126"
      head="M284 126 L290 118 L296 126"
      ms={EDGE_DELAY.kept}
    />
    <EdgeLabel x={304} y={163} ms={EDGE_DELAY.kept}>
      {KEPT}
    </EdgeLabel>
    <EdgeLabel x={304} y={181} ms={EDGE_DELAY.kept}>
      {KEPT_DETAIL}
    </EdgeLabel>
    <Edge
      d="M352 256 H532"
      head="M532 250 L540 256 L532 262"
      ms={EDGE_DELAY.toRemoved}
    />
    <EdgeLabel x={446} y={244} anchor="middle" ms={EDGE_DELAY.toRemoved}>
      {REMOVED}
    </EdgeLabel>
    <Tokens runs={MID_RUNS} armed={armed} glow={GLOW} />
    <BoxNode spec={NODES.submit} x={0} y={34} w={150} />
    <BoxNode spec={NODES.listed} x={176} y={34} w={176} />
    <BoxNode spec={NODES.withdrawing} x={378} y={34} w={196} />
    <BoxNode spec={NODES.withdrawn} x={600} y={34} w={160} />
    <BoxNode spec={NODES.dispute} x={176} y={214} w={176} lines={MID_DISPUTE} />
    <BoxNode spec={NODES.removed} x={540} y={214} w={220} />
  </Svg>
)

const NarrowMap = ({ armed }: { armed: boolean }) => (
  <Svg
    viewBox="0 0 360 620"
    role="img"
    aria-label={SUMMARY}
    data-on={armed ? 'true' : 'false'}
    $max={440}
  >
    <TokenGlow id={GLOW} />
    <Edge d="M26 30 V78" head="M20 77 L26 84 L32 77" ms={EDGE_DELAY.toListed} />
    <Edge
      d="M26 102 V356"
      head="M20 355 L26 362 L32 355"
      ms={EDGE_DELAY.challenged}
    />
    <EdgeLabel x={38} y={342} ms={EDGE_DELAY.challenged}>
      Challenged
    </EdgeLabel>
    <Edge
      d="M26 128 Q26 156 50 156 Q70 156 70 168 V176"
      head="M64 175 L70 182 L76 175"
      ms={EDGE_DELAY.withdraw}
    />
    <EdgeLabel x={84} y={160} ms={EDGE_DELAY.withdraw}>
      Submitter withdraws
    </EdgeLabel>
    <Edge
      d="M70 244 V262"
      head="M64 261 L70 268 L76 261"
      ms={EDGE_DELAY.toWithdrawn}
    />
    {/* The two rulings: removed straight down, kept as a branch. */}
    <Edge
      d="M26 380 V566"
      head="M20 565 L26 572 L32 565"
      ms={EDGE_DELAY.toRemoved}
    />
    <EdgeLabel x={38} y={556} ms={EDGE_DELAY.toRemoved}>
      {REMOVED}
    </EdgeLabel>
    <Edge
      d="M26 424 Q26 452 50 452 Q70 452 70 464 V472"
      head="M64 471 L70 478 L76 471"
      ms={EDGE_DELAY.toRemoved}
    />
    <EdgeLabel x={84} y={456} ms={EDGE_DELAY.toRemoved}>
      {KEPT}
    </EdgeLabel>
    <Tokens runs={NARROW_RUNS} armed={armed} glow={GLOW} />
    <RailNode
      spec={NODES.submit}
      x={26}
      cy={20}
      lines={['Token stake, plus an arbitration deposit']}
    />
    <RailNode
      spec={NODES.listed}
      x={26}
      cy={92}
      lines={['Stake locked; open to challenge at any time']}
    />
    <RailNode spec={NODES.withdrawing} x={70} cy={190} />
    <RailNode
      spec={NODES.withdrawn}
      x={70}
      cy={282}
      lines={['Stake and deposit back to the submitter']}
    />
    <RailNode spec={NODES.dispute} x={26} cy={370} />
    <RailNode spec={NODES.kept} x={70} cy={486} />
    <RailNode
      spec={NODES.removed}
      x={26}
      cy={580}
      lines={['The challenger takes the entry’s whole stake']}
    />
  </Svg>
)

/** The caption sits in the free corner under the submit node. */
const CORNER = {
  // Row two starts at y 214 of a 286-unit box that begins at y 18.
  wide: { top: '68%', width: '23%' },
  mid: { top: '68%', width: '21%' },
}

export const StakeSchematic = ({
  play,
  run,
  caption,
}: {
  /** Start drawing (the panel came into view). */
  play: boolean
  /** Bump to replay the drawing from the start. */
  run: number
  /** What the drawing shows; rendered inside the figure's figcaption. */
  caption: React.ReactNode
}) => (
  <SchematicFrame play={play} run={run} caption={caption} corner={CORNER}>
    {(layout, armed) =>
      layout === 'wide' ? (
        <WideMap key={`w-${run}`} armed={armed} />
      ) : layout === 'mid' ? (
        <MidMap key={`m-${run}`} armed={armed} />
      ) : (
        <NarrowMap key={`n-${run}`} armed={armed} />
      )
    }
  </SchematicFrame>
)

export default StakeSchematic
