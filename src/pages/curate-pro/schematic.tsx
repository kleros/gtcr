import React from 'react'

/*
 * Curate Pro schematic (the explainer's drawing): the pieces a production
 * registry is made of and how they talk. The policy feeds the contract, the
 * contract sends disputes to the court and jurors rule by the policy, the
 * indexer reads the contract's events, the front end reads the indexer and
 * sends its transactions (submit, challenge) back to the contract. Structure
 * only, no figures. Sentence case, 12-unit text in a 320-unit box, so it never
 * renders below about 11.5px even on a phone.
 */

const TITLE: React.CSSProperties = {
  fill: 'var(--color-text)',
  fontFamily: 'var(--font-sans)',
  fontSize: 12,
  fontWeight: 500,
}

const NOTE: React.CSSProperties = {
  fill: 'var(--color-muted)',
  fontFamily: 'var(--font-sans)',
  fontSize: 12,
  fontWeight: 400,
}

const LINE: React.CSSProperties = {
  fill: 'none',
  stroke: 'var(--color-border-strong)',
  strokeWidth: 1.25,
}

const Node = ({
  x,
  y,
  width,
  height = 48,
  title,
  detail,
  strong = false,
}: {
  x: number
  y: number
  width: number
  height?: number
  title: string
  detail: string
  strong?: boolean
}) => (
  <g>
    <rect
      x={x}
      y={y}
      width={width}
      height={height}
      rx="10"
      style={{
        fill: 'var(--color-raised)',
        stroke: strong ? 'var(--color-border-strong)' : 'var(--glass-border)',
      }}
    />
    <text
      x={x + width / 2}
      y={y + height / 2 - 3}
      textAnchor="middle"
      style={TITLE}
    >
      {title}
    </text>
    <text
      x={x + width / 2}
      y={y + height / 2 + 13}
      textAnchor="middle"
      style={NOTE}
    >
      {detail}
    </text>
  </g>
)

export const ProductionStackSchematic = () => (
  <svg viewBox="0 0 320 284" xmlns="http://www.w3.org/2000/svg" role="img">
    <title>What a production registry is made of</title>
    <defs>
      <marker
        id="curate-pro-arrow"
        viewBox="0 0 8 8"
        refX="7"
        refY="4"
        markerWidth="6"
        markerHeight="6"
        orient="auto-start-reverse"
      >
        <path
          d="M0 0 8 4 0 8Z"
          style={{ fill: 'var(--color-border-strong)' }}
        />
      </marker>
      <marker
        id="curate-pro-arrow-tx"
        viewBox="0 0 8 8"
        refX="7"
        refY="4"
        markerWidth="6"
        markerHeight="6"
        orient="auto-start-reverse"
      >
        <path d="M0 0 8 4 0 8Z" style={{ fill: 'var(--color-primary)' }} />
      </marker>
    </defs>

    {/* Jurors read the policy when they rule. */}
    <text x="165" y="14" textAnchor="middle" style={NOTE}>
      Jurors rule by the policy
    </text>
    <path
      d="M285 38 V30 Q285 22 277 22 H53 Q45 22 45 30 V36"
      markerEnd="url(#curate-pro-arrow)"
      style={{ ...LINE, strokeDasharray: '3 4' }}
    />

    <g markerEnd="url(#curate-pro-arrow)" style={LINE}>
      <path d="M86 62 H102" />
      <path d="M236 62 H252" />
      <path d="M200 90 V134" />
      <path d="M200 184 V230" />
    </g>

    {/* Writes: the front end sends submissions and challenges to the contract. */}
    <path
      d="M104 256 H96 Q88 256 88 248 V110 Q88 102 96 102 H132 Q140 102 140 94 V92"
      markerEnd="url(#curate-pro-arrow-tx)"
      style={{
        fill: 'none',
        stroke: 'color-mix(in srgb, var(--color-primary) 75%, transparent)',
        strokeWidth: 1.25,
      }}
    />

    <Node x={4} y={38} width={82} title="Policy" detail="PDF on IPFS" />
    <Node
      x={104}
      y={34}
      width={132}
      height={56}
      title="Registry contract"
      detail="Deposits · window"
      strong
    />
    <Node x={254} y={38} width={62} title="Court" detail="Jurors" />
    <Node
      x={104}
      y={136}
      width={132}
      title="Indexer"
      detail="Subgraph or API"
    />
    <Node
      x={104}
      y={232}
      width={132}
      title="Front end"
      detail="Submit · challenge"
    />

    <text x="316" y="106" textAnchor="end" style={NOTE}>
      Disputes only
    </text>
    <text x="193" y="117" textAnchor="end" style={NOTE}>
      Events
    </text>
    <text x="80" y="184" textAnchor="end" style={NOTE}>
      Transactions
    </text>
  </svg>
)

export default ProductionStackSchematic
