import React from 'react'
import {
  BoxNode,
  Edge,
  EdgeLabel,
  LoopGlyph,
  RailNode,
  SchematicFrame,
  SchematicSvg as Svg,
  TokenGlow,
  Tokens,
  delay,
  type NodeSpec,
  type TokenRun,
} from './schematic-kit'

/*
 * The Curate lifecycle for Light and Classic lists, drawn as it happens: a
 * request opens a challenge period; unchallenged it is executed, challenged it
 * goes to jurors, then an appeal period that loops into a bigger round when
 * both sides are funded, then a final ruling. Nodes and arrows draw in order,
 * then two requests travel the two paths once. Wide containers get the
 * horizontal map, middle ones a compact version of it, and narrow ones a
 * vertical rail with the same steps.
 */

const NODES: Record<string, NodeSpec> = {
  request: {
    id: 'request',
    title: 'Request',
    lines: ['Submit or remove an', 'entry, with a deposit'],
    delay: 0,
  },
  window: {
    id: 'window',
    title: 'Challenge period',
    lines: ['Set by the list; anyone', 'can challenge'],
    tone: 'window',
    delay: 380,
  },
  executed: {
    id: 'executed',
    title: 'Executed',
    lines: ['Entry registered or removed;', 'deposit back in full'],
    tone: 'registered',
    delay: 960,
  },
  dispute: {
    id: 'dispute',
    title: 'Dispute',
    lines: ['Evidence, then jurors vote', 'on the list’s policy'],
    tone: 'contested',
    delay: 960,
  },
  appeal: {
    id: 'appeal',
    title: 'Appeal period',
    lines: ['Anyone can fund', 'either side'],
    tone: 'contested',
    delay: 1480,
  },
  final: {
    id: 'final',
    title: 'Ruling final',
    lines: ['Winner takes both deposits', 'minus one arbitration cost'],
    tone: 'neutral',
    delay: 2000,
  },
}

const EDGE_DELAY = {
  toWindow: 120,
  noChallenge: 640,
  challenged: 640,
  toAppeal: 1180,
  toFinal: 1700,
  loop: 1720,
}

const LOOP_LABEL = 'Both sides funded: a new round with more jurors'

/** The two requests: one nobody challenges, one that goes to court. */
const runs = (happy: string, dispute: string): TokenRun[] => [
  { d: happy, delay: 2400, duration: 1500 },
  { d: dispute, delay: 2900, duration: 3900 },
]

const WIDE_RUNS = runs(
  'M100 76 H875',
  'M100 76 H380 V256 H640 V322 Q640 334 628 334 H392 Q380 334 380 322 V256 H895',
)

const MID_RUNS = runs(
  'M78 76 H648',
  'M78 76 H272 V256 H447 V322 Q447 334 435 334 H284 Q272 334 272 322 V256 H643',
)

const NARROW_RUNS = runs(
  'M26 20 V128 Q26 156 50 156 Q70 156 70 190',
  'M26 20 V386 H18 Q8 386 8 376 V306 Q8 296 18 296 H26 V488',
)

const GLOW = 'lifecycle-token-glow'

const SUMMARY =
  'How a request moves through a Light or Classic Curate list. A request, with its deposit, opens a challenge period set by the list. If nobody challenges, it is executed: the entry is registered or removed and the deposit comes back in full. If someone challenges, a dispute goes to Kleros jurors, who vote on the list’s policy, followed by an appeal period. If both sides fund an appeal, a new round starts with twice the jurors plus one; otherwise the ruling is final and the winner takes both deposits minus one arbitration cost.'

const WideMap = ({ armed }: { armed: boolean }) => (
  <Svg
    viewBox="0 18 1000 352"
    role="img"
    aria-label={SUMMARY}
    data-on={armed ? 'true' : 'false'}
  >
    <TokenGlow id={GLOW} />
    <Edge
      d="M200 76 H262"
      head="M262 70 L270 76 L262 82"
      ms={EDGE_DELAY.toWindow}
    />
    <Edge
      d="M490 76 H742"
      head="M742 70 L750 76 L742 82"
      ms={EDGE_DELAY.noChallenge}
    />
    <EdgeLabel x={620} y={64} anchor="middle" ms={EDGE_DELAY.noChallenge}>
      No challenge
    </EdgeLabel>
    <Edge
      d="M380 118 V206"
      head="M374 206 L380 214 L386 206"
      ms={EDGE_DELAY.challenged}
    />
    <EdgeLabel x={394} y={171} ms={EDGE_DELAY.challenged}>
      Challenged
    </EdgeLabel>
    <Edge
      d="M490 256 H552"
      head="M552 250 L560 256 L552 262"
      ms={EDGE_DELAY.toAppeal}
    />
    <Edge
      d="M720 256 H782"
      head="M782 250 L790 256 L782 262"
      ms={EDGE_DELAY.toFinal}
    />
    <Edge
      d="M640 298 V322 Q640 334 628 334 H392 Q380 334 380 322 V306"
      head="M374 306 L380 298 L386 306"
      ms={EDGE_DELAY.loop}
    />
    <EdgeLabel x={510} y={360} anchor="middle" ms={EDGE_DELAY.loop}>
      {LOOP_LABEL}
    </EdgeLabel>
    <Tokens runs={WIDE_RUNS} armed={armed} glow={GLOW} />
    <BoxNode spec={NODES.request} x={0} y={34} w={200} />
    <BoxNode spec={NODES.window} x={270} y={34} w={220} />
    <BoxNode spec={NODES.executed} x={750} y={34} w={250} />
    <BoxNode spec={NODES.dispute} x={270} y={214} w={220} />
    <BoxNode spec={NODES.appeal} x={560} y={214} w={160} />
    <BoxNode spec={NODES.final} x={790} y={214} w={210} />
  </Svg>
)

const MID_DISPUTE = ['Evidence, then jurors', 'vote on the list’s policy']

/**
 * The same map for middle containers (laptops under ~1310px, tablets): 740
 * units wide and capped at 800px so the text stays near its drawn size, with
 * the second row tucked under the challenge period.
 */
const MidMap = ({ armed }: { armed: boolean }) => (
  <Svg
    viewBox="0 18 740 352"
    role="img"
    aria-label={SUMMARY}
    data-on={armed ? 'true' : 'false'}
    $max={800}
  >
    <TokenGlow id={GLOW} />
    <Edge
      d="M156 76 H180"
      head="M180 70 L188 76 L180 82"
      ms={EDGE_DELAY.toWindow}
    />
    <Edge
      d="M356 76 H548"
      head="M548 70 L556 76 L548 82"
      ms={EDGE_DELAY.noChallenge}
    />
    <EdgeLabel x={456} y={64} anchor="middle" ms={EDGE_DELAY.noChallenge}>
      No challenge
    </EdgeLabel>
    <Edge
      d="M272 118 V206"
      head="M266 206 L272 214 L278 206"
      ms={EDGE_DELAY.challenged}
    />
    <EdgeLabel x={286} y={171} ms={EDGE_DELAY.challenged}>
      Challenged
    </EdgeLabel>
    <Edge
      d="M352 256 H366"
      head="M366 250 L374 256 L366 262"
      ms={EDGE_DELAY.toAppeal}
    />
    <Edge
      d="M520 256 H538"
      head="M538 250 L546 256 L538 262"
      ms={EDGE_DELAY.toFinal}
    />
    <Edge
      d="M447 298 V322 Q447 334 435 334 H284 Q272 334 272 322 V306"
      head="M266 306 L272 298 L278 306"
      ms={EDGE_DELAY.loop}
    />
    <EdgeLabel x={360} y={360} anchor="middle" ms={EDGE_DELAY.loop}>
      {LOOP_LABEL}
    </EdgeLabel>
    <Tokens runs={MID_RUNS} armed={armed} glow={GLOW} />
    <BoxNode spec={NODES.request} x={0} y={34} w={156} />
    <BoxNode spec={NODES.window} x={188} y={34} w={168} />
    <BoxNode
      spec={NODES.executed}
      x={556}
      y={34}
      w={184}
      lines={['Registered or removed;', 'deposit back in full']}
    />
    <BoxNode spec={NODES.dispute} x={188} y={214} w={164} lines={MID_DISPUTE} />
    <BoxNode spec={NODES.appeal} x={374} y={214} w={146} />
    <BoxNode spec={NODES.final} x={546} y={214} w={194} />
  </Svg>
)

const NarrowMap = ({ armed }: { armed: boolean }) => (
  <Svg
    viewBox="0 0 360 544"
    role="img"
    aria-label={SUMMARY}
    data-on={armed ? 'true' : 'false'}
    $max={440}
  >
    <TokenGlow id={GLOW} />
    <Edge d="M26 30 V78" head="M20 77 L26 84 L32 77" ms={EDGE_DELAY.toWindow} />
    <Edge
      d="M26 102 V282"
      head="M20 281 L26 288 L32 281"
      ms={EDGE_DELAY.challenged}
    />
    <EdgeLabel x={38} y={268} ms={EDGE_DELAY.challenged}>
      Challenged
    </EdgeLabel>
    <Edge
      d="M26 128 Q26 156 50 156 Q70 156 70 168 V176"
      head="M64 175 L70 182 L76 175"
      ms={EDGE_DELAY.noChallenge}
    />
    <EdgeLabel x={84} y={160} ms={EDGE_DELAY.noChallenge}>
      No challenge
    </EdgeLabel>
    <Edge
      d="M26 306 V372"
      head="M20 371 L26 378 L32 371"
      ms={EDGE_DELAY.toAppeal}
    />
    <Edge
      d="M26 396 V474"
      head="M20 473 L26 480 L32 473"
      ms={EDGE_DELAY.toFinal}
    />
    <Edge
      d="M17 386 Q8 386 8 376 V306 Q8 296 15 296"
      head="M10 290 L17 296 L10 302"
      ms={EDGE_DELAY.loop}
    />
    {/* Tagged as the loop's outcome, set off from the node text above. */}
    <g className="fade" style={delay(EDGE_DELAY.loop)}>
      <rect className="chip" x={40} y={424} width={244} height={24} rx={12} />
      <LoopGlyph x={56} y={436} />
      <text className="tag" x={70} y={440.5}>
        Both sides funded: a new round
      </text>
    </g>
    <Tokens runs={NARROW_RUNS} armed={armed} glow={GLOW} />
    <RailNode
      spec={NODES.request}
      x={26}
      cy={20}
      lines={['Submit or remove an entry, with a deposit']}
    />
    <RailNode
      spec={NODES.window}
      x={26}
      cy={92}
      lines={['Set by the list; anyone can challenge']}
    />
    <RailNode spec={NODES.executed} x={70} cy={190} />
    <RailNode spec={NODES.dispute} x={26} cy={296} />
    <RailNode
      spec={NODES.appeal}
      x={26}
      cy={386}
      lines={['Anyone can fund either side']}
    />
    <RailNode spec={NODES.final} x={26} cy={488} />
  </Svg>
)

/** The caption sits in the free corner under the request. */
const CORNER = {
  wide: { top: '57%', width: '21%' },
  mid: { top: '57%', width: '21%' },
}

export const LifecycleSchematic = ({
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

export default LifecycleSchematic
