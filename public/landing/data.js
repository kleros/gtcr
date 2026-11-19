// A frozen snapshot of public Curate data (Ethereum and Gnosis mainnets),
// read on 19 Nov 2026 through src/landing/boot.ts. The landing page draws it
// at once, then swaps in the live figures when the indexers answer; while it
// shows this object, a figure that would say "now" says `snapshotAt`
// instead, and the money figures say "to" that day rather than "all time".
// figures: verified counts the lists registered on the chain's Kleros list
// of lists and community every list off it, by the shared Kleros Verified
// rule (components/curate/verified-rule.ts; the lists of lists themselves
// grant the badge and are in neither count); unchallenged counts
// unresolved requests nobody has challenged, openForVerification those
// still inside their challenge period (absent when the periods could not
// be read).
// verifiedLists: the Kleros Verified lists, most open requests first; logo
// is the IPFS path the list published (the page resolves it through the
// app's gateway).
// series30d: one row per UTC day, the last one the day of the read so far;
// requests = submissions + removal requests made that day; challenges =
// challenges made that day, whenever the request was made (Standard: the
// challenge time; Stake: the challenge), each of which opened a dispute in
// Kleros Court. The app's dashboard counts the same way. The page shows
// their 30-day sums (round 14 dropped the chart).
// money (round 14, src/landing/money.ts): bounties = what challengers have
// won, all time, the retired Classic lists included, bountiesPaid the
// winning rulings that carried an amount; deposits = what submitters have
// locked to submit an entry, all time (Standard and Classic: the first
// round's requester payment; Stake: stake and arbitration deposit),
// submissions their count. Every amount is in dollars at the time it was
// paid (ETH at its month's average price, xDAI as one dollar, a Stake
// token at the day's price).
// Refresh by replacing the whole object with a new read of
// window.CURATE_LANDING_LIVE (minus `live`); never edit single figures by
// hand.
window.CURATE_LANDING_DATA = {
  snapshotAt: '2026-11-19T13:39:08.425Z',
  figures: {
    registries: 181,
    verified: 10,
    community: 168,
    entries: 31331,
    requestsOpen: 174,
    unchallenged: 170,
    unchallengedCapped: false,
    openForVerification: 170,
    inCourt: 4,
    curators30d: 16,
  },
  verifiedLists: [
    {
      chainId: 100,
      address: '0x66260c69d03837016d88c9877e61e08ef74c59f2',
      kind: 'standard',
      title: 'Address Tags',
      logo: '/ipfs/QmP1hU1LaheHVGxcSJWg5sC3g25vs5snam3qP1bVVAa7mT/address-tag-2-1.png',
      entries: 9467,
      open: 94,
    },
    {
      chainId: 100,
      address: '0x957a53a994860be4750810131d9c876b2f52d6e1',
      kind: 'standard',
      title: 'Ledger Contract Domain Name registry v2',
      logo: '/ipfs/QmNNSDkpyDX1wB4NNFdAzaHsJihpvgNVV89zCH8FH9CVAz/ledger-white.png',
      entries: 8489,
      open: 68,
    },
    {
      chainId: 100,
      address: '0xee1502e29795ef6c2d60f8d7120596abe3bad990',
      kind: 'standard',
      title: 'Kleros Tokens',
      logo: '/ipfs/QmZ5VC8FHMjs92yQEn9dnJottspM5JUbJUkPtno1hPPYks/t2cr-logo.974d9285.png',
      entries: 7248,
      open: 12,
    },
    {
      chainId: 100,
      address: '0xae6aaed5434244be3699c56e7ebc828194f26dc3',
      kind: 'standard',
      title: 'Address Tags Query (ATQ) Registry',
      logo: '/ipfs/QmStzoYeV9nfJSms47TLo9f5t1fVrxjvvRf9GspCduXhE4/kleros-symbol.png',
      entries: 366,
      open: 0,
    },
    {
      chainId: 100,
      address: '0x5aaf9e23a11440f8c1ad6d2e2e5109c7e52cc672',
      kind: 'standard',
      title: 'Seer Markets',
      logo: '/ipfs/QmckmpMuWGiGHCzbYgPqLPcCvLDj4YDPRZB63p7VaAjrbB/seer-logo-2-.png',
      entries: 364,
      open: 0,
    },
    {
      chainId: 1,
      address: '0x479083b5343ab89bb39608e3176d750c8a6957b5',
      kind: 'standard',
      title: 'Consensus Layer Withdrawal Protection',
      logo: '/ipfs/QmXkGcS9Nw7jqaSaZZoKh3UQo8pwE8LWsdoUtjx1zTFLmJ/clwp-100-100-px-.svg',
      entries: 52,
      open: 0,
    },
    {
      chainId: 1,
      address: '0x6e31d83b0c696f7d57241d3dffd0f2b628d14c67',
      kind: 'standard',
      title: 'Address Tags',
      logo: '/ipfs/QmP1hU1LaheHVGxcSJWg5sC3g25vs5snam3qP1bVVAa7mT/address-tag-2-1.png',
      entries: 31,
      open: 0,
    },
    {
      chainId: 1,
      address: '0xda03509bb770061a61615ad8fc8e1858520ebd86',
      kind: 'standard',
      title: 'Decentralized frontend registry',
      logo: '/ipfs/QmSgoRrhmCtRvvxJp44TvSEuFfdmyTzj8xfCJe56B3VwN2/frontend.jpeg',
      entries: 5,
      open: 0,
    },
    {
      chainId: 1,
      address: '0x4a9f8e73b3c4c9d7fa0210b9de457b1c493a3ada',
      kind: 'standard',
      title: 'Seer Markets',
      logo: '/ipfs/QmUXJ5yGg5PxzyaaokZzZJpiPsCGzJ98pgusYoCzuDmopo/seer-logo-1x1.png',
      entries: 4,
      open: 0,
    },
    {
      chainId: 100,
      address: '0x7305c57b731876f452da8574a77d05957820e588',
      kind: 'permanent',
      title: 'Battletested DeFi Vaults',
      logo: '/ipfs/QmZBbaX4rjwE4fwrR6DPcY9Hgu3J3ffHWLJBCnffCMoMmN',
      entries: 2,
      open: 0,
    },
  ],
  series30d: [
    {
      day: 1792540800,
      requests: 62,
      challenges: 0,
    },
    {
      day: 1792627200,
      requests: 20,
      challenges: 1,
    },
    {
      day: 1792713600,
      requests: 68,
      challenges: 1,
    },
    {
      day: 1792800000,
      requests: 31,
      challenges: 0,
    },
    {
      day: 1792886400,
      requests: 18,
      challenges: 0,
    },
    {
      day: 1792972800,
      requests: 93,
      challenges: 0,
    },
    {
      day: 1793059200,
      requests: 58,
      challenges: 0,
    },
    {
      day: 1793145600,
      requests: 115,
      challenges: 20,
    },
    {
      day: 1793232000,
      requests: 3,
      challenges: 0,
    },
    {
      day: 1793318400,
      requests: 75,
      challenges: 2,
    },
    {
      day: 1793404800,
      requests: 50,
      challenges: 0,
    },
    {
      day: 1793491200,
      requests: 8,
      challenges: 0,
    },
    {
      day: 1793577600,
      requests: 26,
      challenges: 1,
    },
    {
      day: 1793664000,
      requests: 49,
      challenges: 0,
    },
    {
      day: 1793750400,
      requests: 15,
      challenges: 2,
    },
    {
      day: 1793836800,
      requests: 8,
      challenges: 0,
    },
    {
      day: 1793923200,
      requests: 22,
      challenges: 1,
    },
    {
      day: 1794009600,
      requests: 27,
      challenges: 0,
    },
    {
      day: 1794096000,
      requests: 9,
      challenges: 0,
    },
    {
      day: 1794182400,
      requests: 34,
      challenges: 1,
    },
    {
      day: 1794268800,
      requests: 24,
      challenges: 1,
    },
    {
      day: 1794355200,
      requests: 6,
      challenges: 0,
    },
    {
      day: 1794441600,
      requests: 6,
      challenges: 0,
    },
    {
      day: 1794528000,
      requests: 15,
      challenges: 0,
    },
    {
      day: 1794614400,
      requests: 26,
      challenges: 0,
    },
    {
      day: 1794700800,
      requests: 8,
      challenges: 0,
    },
    {
      day: 1794787200,
      requests: 64,
      challenges: 0,
    },
    {
      day: 1794873600,
      requests: 86,
      challenges: 1,
    },
    {
      day: 1794960000,
      requests: 21,
      challenges: 1,
    },
    {
      day: 1795046400,
      requests: 18,
      challenges: 0,
    },
  ],
  money: {
    bounties: 44651.26045986466,
    bountiesPaid: 696,
    bountiesCapped: false,
    deposits: 2223977.0706623187,
    submissions: 32569,
  },
}
