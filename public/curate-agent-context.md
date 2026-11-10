# Kleros Curate Agent Context

Load the Curate skill from `/skills/kleros-curate/SKILL.md` before taking action in the app.

## What Curate Is

Curate is a verification layer for policy-driven token-curated registries. A registry can accept submissions, challenges, removals, evidence, arbitration, and governance updates. The app supports discovery, item workflows, address profiles, governed lists, and registry creation.

## Supported Chains

- Ethereum Mainnet: `1`
- Gnosis: `100`
- Sepolia: `11155111`

## Verified Registries

A registry is Kleros Verified when it is one of the Kleros lists of lists below, or a Registered entry
of any of them. Light and Classic lists of lists count the same. New lists are submitted to the Light
one, with Light Curate `addItem(string)` (the skill's light-curate reference); the skill's
list-of-lists notes predate it and describe the Classic ones, which take
`GeneralizedTCR.addItem(bytes)`.

- Ethereum Mainnet, Light: `0x2acf59a420ca888f46d46974f62570f8a38cd4da`
- Ethereum Mainnet, Classic: `0xba0304273a54dfec1fc7f4bccbf4b15519aecf15`
- Gnosis, Light: `0x2418d887d0d0fe03b793a6af4321fa488226a0b5`
- Gnosis, Classic: `0x2442d40b0aecad0298c2724a97f2f1bbdf2c2615`
- Sepolia, Light: `0xd965ce430afe0423ff19a5eb08f7c5722efabcaf`

## Required Agent Behavior

- Read live onchain values before transaction construction.
- Never guess deposits, arbitration costs, challenge periods, courts, policy URIs, MetaEvidence URIs, schemas, or item fields.
- Use the registry policy and MetaEvidence as authoritative.
- Preserve existing contracts, subgraphs, wallet/network logic, factories, and item workflows.
- Validate item JSON before upload.
- Warn users that incorrect MetaEvidence can break frontend visualization.

## Useful Routes

- `/` dashboard and registry discovery.
- `/guide` minimal human and agent guide.
- `/pro` creator support, indexing, and frontend package options.
- `/address/:address` public curator/governor profile.
- `/tcr/:chainId/:registryAddress` registry page.
- `/tcr/:chainId/:registryAddress/:itemID` item page.
- `/factory/:chainId`, `/factory-classic/:chainId`, `/factory-permanent/:chainId` registry creation flows.
