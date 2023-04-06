export type validChains = '1' | '5' | '100' | 1 | 5 | 100

export const defaultTcrAddresses = {
  '1': '0xba0304273a54dfec1fc7f4bccbf4b15519aecf15',
  '5': '0x445eceA26d5ec40E177e6Ca2734821D8430a9C1A',
  '100': '0x2442D40B0aeCad0298C2724A97F2f1BbDF2C2615'
} as const

export const defaultEvidenceDisplayUri = {
  '1': '/ipfs/QmQjJio59WkrQDzPC5kSP3EiGaqrWxjGfkvhmD2mWwm41M/index.html',
  '5': '/ipfs/QmQjJio59WkrQDzPC5kSP3EiGaqrWxjGfkvhmD2mWwm41M/index.html',
  '100': '/ipfs/QmNhJXtMrxeJu4fpchPruGrL93bm2M4VmDZ8pj4x6FqnHJ/index.html'
} as const

export const defaultEvidenceDisplayUriClassic = {
  '1': '/ipfs/QmPJ5H5YF4fbSxA5j53CcmZAhGywxKPPiiWvJM7Zp8Zx9T/index.html'
} as const

export const gtcrViewAddresses = {
  '1': '0xe75a12f40da77d285c08a44f499e597bc5085658',
  '5': '0xc0DEc3faBaEC835aC77F1dE683Ce978677fd2217',
  '100': '0x27BC296DC0b8a6c3cD39326aE9EC14604e96f7BF'
} as const

export const lightGtcrViewAddresses = {
  '1': '0xe82a69e939e1aB6Dc1868262cfe444F70098cCC8',
  '5': '0x9738E402fEb8B306cE7C707Ec4ad6D66595A5EF6',
  '100': '0xB32e38B08FcC7b7610490f764b0F9bFd754dCE53'
} as const

export const batchWithdrawAddresses = {
  '1': '0x38aa214dc986d0bab53e5861071f3d5a56066b4d',
  '5': '0x2d4d822CE88947F8C2b250ADcd684ea52dAFEaa7'
} as const

export const lightBatchWithdrawAddresses = {
  '1': '0x5C6363cFA9462Ae11e22d2A5A0eb15dbB8719E4A',
  '5': '0xBA4F30b3ae9d923fC5f82AE7d965c619F92DFffA',
  '100': '0x36B00c87553330E4351ED0CB287ed3917c12a197'
} as const

export const factoryAddresses = {
  '1': '0xe9dd523600b74b8ef0af164687079a6c437f9cd5',
  '5': '0x9AaD77bAb5F18165F9Ca81dA9c3D392D9E382c23',
  '100': '0x794Cee5a6e1501b633eC13b8c1e327d9860FE039'
} as const

export const lgtcrFactoryAddresses = {
  '1': '0xb9dDC813AcAF3fD7aBC4C16735A09Bc1C0EE0054',
  '5': '0x55A3d9Bd99F286F1817CAFAAB124ddDDFCb0F314',
  '100': '0x08e58Bc26CFB0d346bABD253A1799866F269805a'
} as const

export const defaultGovernor = {
  '1': {
    address: '0x3a7edc1eb16cb454e4964ec51642f7d7b35b5292',
    label: 'Kleros Governor'
  },
  '5': {
    address: '0xd74AB183e2B793A68cB3e647D8f4Df60936B59cA',
    label: 'Goerli Kleros Governor'
  },
  '100': {
    label:
      'This is an EOA governor (you probably want to use your own address)',
    address: '0xdC8C1a8CB38F27C188a43CE0eBBC8e42e393D0d3'
  }
} as const

export const defaultArbitrator = {
  '1': {
    label: 'Kleros',
    address: '0x988b3A538b618C7A603e1c11Ab82Cd16dbE28069'
  },
  '5': {
    label: 'Kleros',
    address: '0x1128eD55ab2d796fa92D2F8E1f336d745354a77A'
  },
  '100': {
    label: 'Kleros',
    address: '0x9C1dA9A04925bDfDedf0f6421bC7EEa8305F9002'
  }
} as const

export const defaultArbitratorExtraData = {
  '1': {
    label:
      'This defines to which court and how many jurors to use for the initial dispute.',
    data:
      '0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003'
  },
  '5': {
    label:
      'This defines to which court and how many jurors to use for the initial dispute.',
    data:
      '0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001'
  },
  '100': {
    label:
      'This defines to which court and how many jurors to use for the initial dispute.',
    data:
      '0x00000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000003'
  }
} as const

export const klerosAddresses = {
  '1': {
    arbitrator: '0x988b3a538b618c7a603e1c11ab82cd16dbe28069',
    policy: '0xCf1f07713d5193FaE5c1653C9f61953D048BECe4',
    uiURL: 'https://court.kleros.io/cases/:disputeID'
  },
  '5': {
    arbitrator: '0x1128eD55ab2d796fa92D2F8E1f336d745354a77A',
    policy: '0x2692c903e6bfcc1420b7396ad2841bc199a3bd9f',
    uiURL: 'https://court.kleros.io/cases/:disputeID'
  },
  '100': {
    arbitrator: '0x9C1dA9A04925bDfDedf0f6421bC7EEa8305F9002',
    policy: '0x9d494768936b6bDaabc46733b8D53A937A6c6D7e',
    uiURL: 'https://court.kleros.io/cases/:disputeID'
  }
} as const

export const txBatcherAddresses = {
  '1': '0x82458d1c812d7c930bb3229c9e159cbabd9aa8cb',
  '5': '0x394E870A068E9C623aC6Bc51d53cc4a040420e8e',
  '100': '0xD7572AD1523F3f116258b8d9dDeBA1d5e76235ac'
} as const

export const subgraphUrl = {
  '1': 'https://api.thegraph.com/subgraphs/name/kleros/curate',
  '5': 'https://api.thegraph.com/subgraphs/name/greenlucid/curate-goerli',
  '100': 'https://api.thegraph.com/subgraphs/name/eccentricexit/curate-xdai-ii'
} as const
