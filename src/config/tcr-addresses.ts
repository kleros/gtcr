export type validChains = '1' | '100' | '11155111' | 1 | 100 | 11155111

export const defaultTcrAddresses = {
  '1': '0xba0304273a54dfec1fc7f4bccbf4b15519aecf15',
  '100': '0x2442D40B0aeCad0298C2724A97F2f1BbDF2C2615',
  '11155111': '0xD965Ce430afE0423Ff19A5eb08F7C5722EFabCaF',
} as const

export const defaultEvidenceDisplayUri = {
  '1': '/ipfs/QmQjJio59WkrQDzPC5kSP3EiGaqrWxjGfkvhmD2mWwm41M/index.html',
  '100': '/ipfs/QmNhJXtMrxeJu4fpchPruGrL93bm2M4VmDZ8pj4x6FqnHJ/index.html',
  '11155111': '/ipfs/QmQjJio59WkrQDzPC5kSP3EiGaqrWxjGfkvhmD2mWwm41M/index.html',
} as const

export const defaultEvidenceDisplayUriPermanent = {
  '1': '/ipfs/QmbNJRDrrd5r9cHeApTP7pZaM7jgacDFMLED5Lj1RJMn79/index.html',
  '100': '/ipfs/QmbNJRDrrd5r9cHeApTP7pZaM7jgacDFMLED5Lj1RJMn79/index.html',
  '11155111': '/ipfs/QmbNJRDrrd5r9cHeApTP7pZaM7jgacDFMLED5Lj1RJMn79/index.html',
} as const

export const defaultEvidenceDisplayUriClassic = {
  '1': '/ipfs/QmPJ5H5YF4fbSxA5j53CcmZAhGywxKPPiiWvJM7Zp8Zx9T/index.html',
} as const

export const gtcrViewAddresses = {
  '1': '0xe75a12f40da77d285c08a44f499e597bc5085658',
  '100': '0x27BC296DC0b8a6c3cD39326aE9EC14604e96f7BF',
  '11155111': '0x20E1D44c64Ec03ECe12133743bEc7019f3aAe373',
} as const

export const lightGtcrViewAddresses = {
  '1': '0xe82a69e939e1aB6Dc1868262cfe444F70098cCC8',
  '100': '0xB32e38B08FcC7b7610490f764b0F9bFd754dCE53',
  '11155111': '0x87f58F0dCF3c99BA2F3eB0604e5c335893e2EAf9',
} as const

export const batchWithdrawAddresses = {
  '1': '0x38aa214dc986d0bab53e5861071f3d5a56066b4d',
  '11155111': '0xb01C9DE0e9dE0a6cAb6df586484707b7078De684',
} as const

export const lightBatchWithdrawAddresses = {
  '1': '0x5C6363cFA9462Ae11e22d2A5A0eb15dbB8719E4A',
  '100': '0x36B00c87553330E4351ED0CB287ed3917c12a197',
  '11155111': '0x43458fa7b40Fd7Bb32cC3a2b95186F91A95Ef0c8',
} as const

export const factoryAddresses = {
  '1': '0xe9dd523600b74b8ef0af164687079a6c437f9cd5',
  '100': '0x794Cee5a6e1501b633eC13b8c1e327d9860FE039',
  '11155111': '0xcB4B48d2A7a44247A00048963F169d2b4Ab045a6',
} as const

export const lgtcrFactoryAddresses = {
  '1': '0xb9dDC813AcAF3fD7aBC4C16735A09Bc1C0EE0054',
  '100': '0x08e58Bc26CFB0d346bABD253A1799866F269805a',
  '11155111': '0x3FB8314C628E9afE7677946D3E23443Ce748Ac17',
} as const

export const pgtcrFactoryAddresses = {
  '1': '0x69816b499b0ed9a60ac52cf2beb24827e5f13a89',
  '100': '0x75c0406311bb4C81988602b0c209987188DC5A93',
  '11155111': '0x22a57cd65092da41c5c1dffad03594fffc28ce20',
} as const

export const defaultGovernor = {
  '1': {
    address: '0x3a7edc1eb16cb454e4964ec51642f7d7b35b5292',
    label: 'Kleros Governor',
  },
  '100': {
    label:
      'This is an EOA governor (you probably want to use your own address)',
    address: '0xdC8C1a8CB38F27C188a43CE0eBBC8e42e393D0d3',
  },
  '11155111': {
    label:
      'This is an EOA governor (you probably want to use your own address)',
    address: '0xdC8C1a8CB38F27C188a43CE0eBBC8e42e393D0d3',
  },
} as const

export const defaultArbitrator = {
  '1': {
    label: 'Kleros',
    address: '0x988b3A538b618C7A603e1c11Ab82Cd16dbE28069',
  },
  '100': {
    label: 'Kleros',
    address: '0x9C1dA9A04925bDfDedf0f6421bC7EEa8305F9002',
  },
  '11155111': {
    label: 'Kleros',
    address: '0x90992fb4e15ce0c59aeffb376460fda4ee19c879',
  },
} as const

export const defaultArbitratorExtraData = {
  '1': {
    label:
      'This defines to which court and how many jurors to use for the initial dispute.',
    data: '0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003',
  },
  '100': {
    label:
      'This defines to which court and how many jurors to use for the initial dispute.',
    data: '0x00000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000003',
  },
  '11155111': {
    label:
      'This defines to which court and how many jurors to use for the initial dispute.',
    data: '0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001',
  },
} as const

export const klerosAddresses = {
  '1': {
    arbitrator: '0x988b3a538b618c7a603e1c11ab82cd16dbe28069',
    policy: '0xCf1f07713d5193FaE5c1653C9f61953D048BECe4',
    uiURL: 'https://court.kleros.io/cases/:disputeID',
  },
  '100': {
    arbitrator: '0x9C1dA9A04925bDfDedf0f6421bC7EEa8305F9002',
    policy: '0x9d494768936b6bDaabc46733b8D53A937A6c6D7e',
    uiURL: 'https://court.kleros.io/cases/:disputeID',
  },
  '11155111': {
    arbitrator: '0x90992fb4e15ce0c59aeffb376460fda4ee19c879',
    policy: '0x88Fb25D399310c07d35cB9091b8346d8b1893aa5',
    uiURL: 'https://court.kleros.io/cases/:disputeID',
  },
} as const

export const txBatcherAddresses = {
  '1': '0x82458d1c812d7c930bb3229c9e159cbabd9aa8cb',
  '100': '0xD7572AD1523F3f116258b8d9dDeBA1d5e76235ac',
  '11155111': '0xb5418fc9b536c52c635b4c3a2978de7165b67318',
} as const

export const seerAddresses = {
  '1': '0x4a9f8e73b3c4c9d7fa0210b9de457b1c493a3ada',
  '100': '0x5aaf9e23a11440f8c1ad6d2e2e5109c7e52cc672',
} as const

export const subgraphUrl = {
  '1': process.env.REACT_APP_SUBGRAPH_MAINNET,
  '100': process.env.REACT_APP_SUBGRAPH_GNOSIS,
  '11155111': process.env.REACT_APP_SUBGRAPH_SEPOLIA,
} as const

export const subgraphUrlPermanent = {
  '1': process.env.REACT_APP_SUBGRAPH_MAINNET_PERMANENT,
  '100': process.env.REACT_APP_SUBGRAPH_GNOSIS_PERMANENT,
  '11155111': process.env.REACT_APP_SUBGRAPH_SEPOLIA_PERMANENT,
} as const
