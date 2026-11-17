# Kleros Curate Agent Context

Load the Curate skill from `/skills/kleros-curate/SKILL.md` before taking action in the app.

## What Curate Is

Curate is a verification layer for policy-driven token-curated registries. A registry can accept submissions, challenges, removals, evidence, arbitration, and governance updates. The app supports discovery, item workflows, address profiles, governed lists, and registry creation.

## Supported Chains

- Ethereum Mainnet: `1`
- Gnosis: `100`
- Sepolia: `11155111`

## Verified Registries

A registry is Kleros Verified when it is its chain's Kleros list of lists below, or a Registered
entry of it. New lists are submitted with `LightGeneralizedTCR.addItem(string)` (the skill's
references/verify-your-list.md).

- Ethereum Mainnet: `0x2acf59a420ca888f46d46974f62570f8a38cd4da`
- Gnosis: `0x2418d887d0d0fe03b793a6af4321fa488226a0b5`
- Sepolia: `0xd965ce430afe0423ff19a5eb08f7c5722efabcaf`

Classic Curate (GeneralizedTCR) is retired: the app shows no Classic list, including the old Classic
lists of lists (Ethereum Mainnet `0xba0304273a54dfec1fc7f4bccbf4b15519aecf15`, Gnosis
`0x2442d40b0aecad0298c2724a97f2f1bbdf2c2615`). Never submit to a Classic list; a list registered on
those is not Kleros Verified.

## Required Agent Behavior

- Read live onchain values before transaction construction.
- Never guess deposits, arbitration costs, challenge periods, courts, policy URIs, MetaEvidence URIs, schemas, or item fields.
- Use the registry policy and MetaEvidence as authoritative.
- Validate item JSON before upload.
- Warn users that incorrect MetaEvidence can break frontend visualization.

## Useful Routes

- `/` dashboard.
- `/browse` registries by chain, kind and standing.
- `/guide` human and agent guide.
- `/address/:address` public curator/governor profile.
- `/tcr/:chainId/:registryAddress` registry page.
- `/tcr/:chainId/:registryAddress/submit` submit an entry.
- `/tcr/:chainId/:registryAddress/:itemID` item page.
- `/launch/:chainId` launch a list: choose Standard or Stake.
- `/factory/:chainId` (Standard) and `/factory-permanent/:chainId` (Stake) registry creation flows.
