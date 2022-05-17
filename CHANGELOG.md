# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [3.0.0](https://github.com/kleros/gtcr/compare/v2.2.0...v3.0.0) (2022-05-17)


### ⚠ BREAKING CHANGES

* mapping old tcr urls to chainId packed ones
* adding chainId into path for tcr views
* improving performance and cleaning messy code

### Features

* chainId in every url ([bec2e60](https://github.com/kleros/gtcr/commit/bec2e60492fb9bf4dc041d5c7f7b2fc87b06c683))
* rich address support ([bde7a92](https://github.com/kleros/gtcr/commit/bde7a92f0ab3641faa50a0e94a99ccfaf6b2394c))
* rich address support ([ab84f20](https://github.com/kleros/gtcr/commit/ab84f20d1a2226289b5ea4246359ec28de90690e))


### Bug Fixes

* adding chainId into path for tcr views ([9b05e2a](https://github.com/kleros/gtcr/commit/9b05e2ad2eed07757fc945033e068ce6652f043a))
* decoded data is now in order ([776eee1](https://github.com/kleros/gtcr/commit/776eee1fce9a3bfa7613c00fee83f6652f13f90f))
* eliminating unexpected behaviour of routing for tcr view ([dd50f82](https://github.com/kleros/gtcr/commit/dd50f82cc911e149fcdf4190340a94b61a53307a))
* eth-amount not to display decimal points if its value is integer ([fffb086](https://github.com/kleros/gtcr/commit/fffb086429af99b903486b536657c64e8cdeb939))
* factory crash on 0 jurors ([bf8a876](https://github.com/kleros/gtcr/commit/bf8a8760cc438f8a69f7dceddafbd32283786a4e))
* infura getlogs outage ([decf39d](https://github.com/kleros/gtcr/commit/decf39da3a1ccfbdd8dae415ede8ee165d83b68c))
* mapping old tcr urls to chainId packed ones ([368a446](https://github.com/kleros/gtcr/commit/368a4467e32bd0f539eb7fd95843a42480c8f2f9))
* network routes when accessing without provider ([461a526](https://github.com/kleros/gtcr/commit/461a526e2bbee6cd2d109c21160f1c19240eab52))
* only reload to network for non-provided ([740174c](https://github.com/kleros/gtcr/commit/740174ca5386a4e56359737b182f3e17c0c33c07))
* path validation to consider registry too ([9ced18a](https://github.com/kleros/gtcr/commit/9ced18a4faee90fb4ee8d250d66f68be4e33cc38))
* protocolRegex works properly ([1956b3a](https://github.com/kleros/gtcr/commit/1956b3a696a67885397cfbd45415f33ce608491e))
* remove curate-rinkeby from env ([69a98bb](https://github.com/kleros/gtcr/commit/69a98bb738ebd649ccad682b38099d762d4f794b))
* remove rich address in form ([81bebb7](https://github.com/kleros/gtcr/commit/81bebb7968a49b3d78b6b09e88e1407a2706d49a))
* renaming `useNetworkEnvVariable` to `getNetworkEnv` ([fd6a43a](https://github.com/kleros/gtcr/commit/fd6a43a4b61e968a70f7b670350bc3461ff16a84))
* replace instead of pushing chainId ([dfb064b](https://github.com/kleros/gtcr/commit/dfb064b1f34ffb5e9693f095d1d94afeada193f1))
* routing issue of non-metamask provider ([b1b33af](https://github.com/kleros/gtcr/commit/b1b33af02a7a6c2c7821c2165dfe89a956766889))
* schema is shown from item ([da8a13e](https://github.com/kleros/gtcr/commit/da8a13eff7c099005fcbbdd5ca7f00220b2fc020))
* show unfilled fields again ([0a2f49e](https://github.com/kleros/gtcr/commit/0a2f49ea2c91cbe7670b05c258ee8189b1bced28))
* stop showing unfilled fields ([f666b30](https://github.com/kleros/gtcr/commit/f666b3083f017fef638cb00c34582f800d2e3d48))
* switching network bug of avatar ([78f76df](https://github.com/kleros/gtcr/commit/78f76dfd740ae39e677c95181f5991f7c6f8b1b8))
* switching network flexibly on metamask ([b4b2b75](https://github.com/kleros/gtcr/commit/b4b2b75980be08bece36297790789acfe0746e09))
* tcr item details to use chainId from path ([6778438](https://github.com/kleros/gtcr/commit/6778438d17aaf27f8c2bca110729493dc1cb5724))
* tcr-view gets the metaevidence again ([bf1d50f](https://github.com/kleros/gtcr/commit/bf1d50f37c986ca0bee2b16e10162dc4fe017066))
* top bar switch redirection without metamask ([7d94104](https://github.com/kleros/gtcr/commit/7d9410404832d7a2c373b48fbb12052e25177e3d))
* twitter api cors proxy ([38a9255](https://github.com/kleros/gtcr/commit/38a9255688385e420ca3e4f126df8c0aa3aa959a))
* use getLogs as dependency in useEffects ([40fe4ec](https://github.com/kleros/gtcr/commit/40fe4ec48b956a88192c48c1616fffa0ab0682ff))
* useTcrNetwork to keep redirecting url ([b87a4b8](https://github.com/kleros/gtcr/commit/b87a4b8009fd7a28c7780872696d252571cb9f03))
* xdai network wrong redirection ([3458c72](https://github.com/kleros/gtcr/commit/3458c7213f2d0d440bf7cd55e56c893d3130bb0c))
* xdai shows proper explorer links ([7fbd665](https://github.com/kleros/gtcr/commit/7fbd6655492ba18a33553125b4a67123ece14e8f))


* improving performance and cleaning messy code ([c8a9e1c](https://github.com/kleros/gtcr/commit/c8a9e1cfff6f5fe8d0e91adf2378bc332d783424)), closes [#215](https://github.com/kleros/gtcr/issues/215)

## [2.2.0](https://github.com/kleros/gtcr/compare/v2.1.0...v2.2.0) (2022-02-02)


### Features

* support long text fields ([6d727f7](https://github.com/kleros/gtcr/commit/6d727f7554a956801efdd2efdd5d3283e51beddc))

## [2.1.0](https://github.com/kleros/gtcr/compare/v2.0.1...v2.1.0) (2022-02-01)


### Features

* add default list for rinkeby ([19f23bb](https://github.com/kleros/gtcr/commit/19f23bb4c9457d203cc68fd6a51b828f503103de))
* allow creating classic ([7dca20b](https://github.com/kleros/gtcr/commit/7dca20b9960467c9b0a5ad6190e6a62b7f5d9308))
* avoid mistakes with address case ([57461b0](https://github.com/kleros/gtcr/commit/57461b0d68a4379286e014d820f3c5aff8c15b8e))
* increase number of indexed files ([4e43599](https://github.com/kleros/gtcr/commit/4e43599be730c8c9b410081fb6bff582f15b08df))
* support webp images ([3d54110](https://github.com/kleros/gtcr/commit/3d5411004fd962e942d285356b99bec2925731d6))
* update latest contracts ([ffa2d87](https://github.com/kleros/gtcr/commit/ffa2d87d0cfa23d6f274a1f1836441a0fc6e11c1))
* update to latest contract ([9b90da0](https://github.com/kleros/gtcr/commit/9b90da066af9fbdbc59d548ebe488297fc0fe624))


### Bug Fixes

* add max description length ([583d8d5](https://github.com/kleros/gtcr/commit/583d8d52ce079b33a2cf3a87e17f0da73d2f9b78))
* add missing dots ([2eb6129](https://github.com/kleros/gtcr/commit/2eb61292ab2e809210d1dac5a9532bf6570b5626))
* badge display ([6cdc163](https://github.com/kleros/gtcr/commit/6cdc163b4c7d5d31de76efe292b017166331f0e2))
* broken link assignment ([d264f0c](https://github.com/kleros/gtcr/commit/d264f0c4cb12e1125f9500c9f3307f2350e05f45))
* default value for field input as types ([3901267](https://github.com/kleros/gtcr/commit/3901267cea34e7154d61589ab3ff78c17451fcac))
* don't wait for tx to mine to subscribe ([60a8171](https://github.com/kleros/gtcr/commit/60a8171dbeb19cdb2bdf7c6268b03efb6ebf7183))
* env variables ([2565a02](https://github.com/kleros/gtcr/commit/2565a028f84f3c7849ad08fcda12e1d990902686))
* evidence display interface ([5a30697](https://github.com/kleros/gtcr/commit/5a3069792391f87badd96ea4852d9dc54b6c0d73))
* light curate badge activation ([8c5dbe3](https://github.com/kleros/gtcr/commit/8c5dbe38a5f6aa5dedd41bb02e1829b9944edfdc))
* light curate enabled badges query ([242c2b2](https://github.com/kleros/gtcr/commit/242c2b2c2347abf7b972990f1a7e35c514556e0f))
* meta evidence standard and evidence display ([51f69e2](https://github.com/kleros/gtcr/commit/51f69e22bf2ad73f30d59e862065f76fadf47f13))
* missing dot in list description ([2631aec](https://github.com/kleros/gtcr/commit/2631aecc76860bb1097b1878fae43cbc2eec31ad))
* missing redirect on connect testnet ([5a54fc0](https://github.com/kleros/gtcr/commit/5a54fc062aed73314bf0ef7bb265968d63fb1f4e))
* notification crash ([1ac295b](https://github.com/kleros/gtcr/commit/1ac295ba6579e446723393f80bcdf342c94f2ffb))
* remove extra chars ([737f91d](https://github.com/kleros/gtcr/commit/737f91d64a93645b1c9505e1dcfe86995a884af7))
* typos and add link to tour ([96aacf4](https://github.com/kleros/gtcr/commit/96aacf4689127ec522c741ccf26f485a1b1bde74))
* update abi and badge col selection ([d486f2e](https://github.com/kleros/gtcr/commit/d486f2e699791b5db4bcbafd076eb8a9ddaabf25))
* user can no longer submit classic items while uploading ([8d4b609](https://github.com/kleros/gtcr/commit/8d4b6090f9f26fb612f6d69debfad09d5b3c3c7e))
* weirdness on links protocol ([d8b8a44](https://github.com/kleros/gtcr/commit/d8b8a445231eef2a3163510bfb431095c9d13fa8))

### [2.0.1](https://github.com/kleros/gtcr/compare/v2.0.0...v2.0.1) (2021-09-28)


### Bug Fixes

* cache selection in factory ([f1af91a](https://github.com/kleros/gtcr/commit/f1af91a7d7105829817103c26e7397c31081577a))
* connect wallet in factory button not working ([89b4592](https://github.com/kleros/gtcr/commit/89b4592e000d46c00bfbf1edfe1cf89f6c82ecc6))

## [2.0.0](https://github.com/kleros/gtcr/compare/v1.0.0...v2.0.0) (2021-09-28)


### Features

* adapt item details view for light curate ([daf9f9c](https://github.com/kleros/gtcr/commit/daf9f9ca8e65871f82df3d886eeda6804ef32911))
* add back paging ([6e50ea5](https://github.com/kleros/gtcr/commit/6e50ea50e35ce3fbf99855de9fe97d096550fee9))
* add chain switch buttons ([65b70f8](https://github.com/kleros/gtcr/commit/65b70f8a380c50e13e8f8dc1c386fb2d8ef1ca79))
* add challenge time hover and close [#136](https://github.com/kleros/gtcr/issues/136) ([272f9e5](https://github.com/kleros/gtcr/commit/272f9e5d0a93ae93addf86ae92856f162eb20693))
* add filter options back ([b4d6b9a](https://github.com/kleros/gtcr/commit/b4d6b9ab6e436bee449e81dd73eede7c0630c9f1))
* add link dispute for known arbitrators and close [#162](https://github.com/kleros/gtcr/issues/162) ([12a34b1](https://github.com/kleros/gtcr/commit/12a34b133e3cafc92e90a0219ed37dd7d1e5a616))
* add links to txes in timeline ([54a2e2a](https://github.com/kleros/gtcr/commit/54a2e2a0b199655b5045a106378d3b0e62762361))
* add note on chain-specific notifications ([76b6042](https://github.com/kleros/gtcr/commit/76b604233ae2375897ce286fff757299f00d44ea))
* add opera wallet ([d7d0656](https://github.com/kleros/gtcr/commit/d7d0656d8851616be252bac66105835af735b3ed))
* add searchbar to items page ([6f87dbe](https://github.com/kleros/gtcr/commit/6f87dbe912e1b4c2304fb1bd85efae3955517802))
* add support for frame wallet ([801a081](https://github.com/kleros/gtcr/commit/801a081105b98c922dd1896e5220844396ba0832))
* add support for twitter profile fields ([ac1a496](https://github.com/kleros/gtcr/commit/ac1a49678f910c4a7972696fd3145ea5cf733d2a))
* add support for xDai ([a113fd7](https://github.com/kleros/gtcr/commit/a113fd74455c1248b502d70dade6ae4ad1a71f83))
* add switch button for users without wallets ([7876545](https://github.com/kleros/gtcr/commit/78765453f12d796a4c5d4e8fbf2960e2b124eceb))
* add twitter user TCR support ([0d41bfc](https://github.com/kleros/gtcr/commit/0d41bfcc9007b9ce7f8f7f0cf7a6814a8a53ba94))
* add URL actions ([5ab99ef](https://github.com/kleros/gtcr/commit/5ab99ef7ee3692ba9cf08dd3e87a18e29b1e8903))
* add xdai bridge link and fix typo ([f152e71](https://github.com/kleros/gtcr/commit/f152e71b65519f9cc5febbce1db6390cb85275c9))
* add xDai reminder ([0911278](https://github.com/kleros/gtcr/commit/0911278fdcf0944b4188d0420996fd4334aa7596))
* allow setting network in URL ([f439c68](https://github.com/kleros/gtcr/commit/f439c68fe09dd85b155b94a16c9652f60d03fada))
* bring back filters ([e2727fa](https://github.com/kleros/gtcr/commit/e2727fa94762bb8ae18d3cbc60cb1692756c5a08))
* classic items are now cached ([758fecb](https://github.com/kleros/gtcr/commit/758fecb9deef310e19ce63410aa20293c311bb5b))
* display challenge period when submitting, removing and close [#142](https://github.com/kleros/gtcr/issues/142) ([52f5327](https://github.com/kleros/gtcr/commit/52f5327006ed02879378216b0ab3ae17fe57c5d1))
* display challenger and case number even if dispute is resolved ([84217e3](https://github.com/kleros/gtcr/commit/84217e339193aed7b7da1ced474312a747a89690))
* display executed request date ([5b2321a](https://github.com/kleros/gtcr/commit/5b2321ae85904f119f4c0c2d0d05940ebae59269))
* display item details even if request is resolved ([a93217b](https://github.com/kleros/gtcr/commit/a93217b7df6aba9872c972c267368bbcef289b62))
* dispĺay item file link and close [#158](https://github.com/kleros/gtcr/issues/158), close [#159](https://github.com/kleros/gtcr/issues/159) ([b664e22](https://github.com/kleros/gtcr/commit/b664e220269f7b0d4e5412d90c63c2b760bab21a))
* don't require waiting for deployment and close [#154](https://github.com/kleros/gtcr/issues/154) ([949f83a](https://github.com/kleros/gtcr/commit/949f83ad327383c5d3ee0354e08dfd89970c81d2))
* first n elements and filter by registry using gql ([6dbb2b3](https://github.com/kleros/gtcr/commit/6dbb2b33eacec85935be5090406dc77cf867af00))
* handle updates to item column structure ([31732a3](https://github.com/kleros/gtcr/commit/31732a3a610aa18162c5fe674843d6454d76ffe2))
* hide badges section if badges are disabled and close [#145](https://github.com/kleros/gtcr/issues/145) ([f5afc08](https://github.com/kleros/gtcr/commit/f5afc08798f12ec110ac8ae294c599cac3334fb5))
* implemented IPFS mirroring ([da8026c](https://github.com/kleros/gtcr/commit/da8026c496d91aa365262397a7bdacc3e2ff7c72))
* item details queries to subgraph are cached ([ca303ca](https://github.com/kleros/gtcr/commit/ca303caddbf28634d4e368b14cae57a01325f032))
* load items view ([f132d7f](https://github.com/kleros/gtcr/commit/f132d7f1f48b9665da05e19d9438ccdf9cfb6f14))
* merge light curate ([ee9388d](https://github.com/kleros/gtcr/commit/ee9388d43d686087abde90de5401a5e48b9ed67c))
* migrate to new contracts ([06efe90](https://github.com/kleros/gtcr/commit/06efe907d4a396121bd96ae49b64e42d28510c9d))
* react to page in url ([cbfff67](https://github.com/kleros/gtcr/commit/cbfff678694f75b1401041ef36ea230768a05b13))
* support link column type and close [#131](https://github.com/kleros/gtcr/issues/131) ([9446f34](https://github.com/kleros/gtcr/commit/9446f346bf19895d90c23aa2efe1eec6b4798a25))
* swap warning for info alert and close [#143](https://github.com/kleros/gtcr/issues/143) ([b823dab](https://github.com/kleros/gtcr/commit/b823dab8db159f85c35956f91d94b21f6fe3495a))
* unfinished searchbar ([8b0ab6d](https://github.com/kleros/gtcr/commit/8b0ab6dc0ec8fec30288b46abb593080674b2717))
* use apollo and take props from graph ([595a733](https://github.com/kleros/gtcr/commit/595a7331cb2aa34be49a38d84887324d1875763d))
* use latest evidence display ([eca3484](https://github.com/kleros/gtcr/commit/eca3484d1ed9061468c441f50aeab1b3d549a6a8))
* use query parameters when fetching items ([bd64344](https://github.com/kleros/gtcr/commit/bd643449fb6c8e79702feb56a0609e8b2d485ec5))
* use subgraph to display items ([30cc86c](https://github.com/kleros/gtcr/commit/30cc86ce0279e9ae97f203958b770c1fbe865ec8))


### Bug Fixes

* add isIdentifier to itemSearch gql query ([73c2fe3](https://github.com/kleros/gtcr/commit/73c2fe32caee57a22f99eeec595cee74407887a9))
* add return to arrow function ([01f2633](https://github.com/kleros/gtcr/commit/01f2633c3b4840338f9e0ae5bdd629612bafe494))
* add return to arrow function ([f0cc2a4](https://github.com/kleros/gtcr/commit/f0cc2a43dc02df1210cb40b725e2f7a68f6e77b7))
* appeal crowdfunding permaloading ([799e55c](https://github.com/kleros/gtcr/commit/799e55cdf6107c62ae225556e79a8021fbd5adaa))
* broken links on url ([392b8af](https://github.com/kleros/gtcr/commit/392b8af2bb5b01ac12c534f9f0d9fe34fb1de89f))
* bug fixes to make the searchbar work ([b8c426e](https://github.com/kleros/gtcr/commit/b8c426e40b71b58fde358d915beac03b07fd73f1))
* bump deposit limit on factory to 30 and close [#156](https://github.com/kleros/gtcr/issues/156) ([fe7e1e1](https://github.com/kleros/gtcr/commit/fe7e1e1580a558e4df194928f368185b7ef845b7))
* bump gas limit for submissions ([1432f63](https://github.com/kleros/gtcr/commit/1432f631cdf9ebc43f274fe2bfe6ae816412b0ce))
* cache now works for light curate items ([69c76d8](https://github.com/kleros/gtcr/commit/69c76d8d2ac7871f76ee86521f3e7d67f82ab901))
* card data rendering ([11bce71](https://github.com/kleros/gtcr/commit/11bce717364da2b4d329e59501adae7f2a5d76eb))
* challenged filters ([600547c](https://github.com/kleros/gtcr/commit/600547c86d485c5e8c1320490924fd321dda64c8))
* changing lists fast no longer bugs cards ([98aec7d](https://github.com/kleros/gtcr/commit/98aec7de1611e2b503e697368d11979814929e18)), closes [#184](https://github.com/kleros/gtcr/issues/184)
* classic items view query ([bd1f0a5](https://github.com/kleros/gtcr/commit/bd1f0a5656289b11ef1bc8d0c3833ce468c914f7))
* contrast in action button and close [#139](https://github.com/kleros/gtcr/issues/139) ([b708d44](https://github.com/kleros/gtcr/commit/b708d44e42d5559966d964156677a0e1a0739310))
* crash on page if one of the sides is fully funded ([3f6bfad](https://github.com/kleros/gtcr/commit/3f6bfad6a15f09cdeab903f14ced935b872b9dd9))
* crashes from gtcraddress when loading new list ([af1505b](https://github.com/kleros/gtcr/commit/af1505bc6fc166a26d6df397ee41f06bf6c7bc25))
* currency label ticker ([fa23c09](https://github.com/kleros/gtcr/commit/fa23c0957f06870f684707f9db65f3057a694608))
* disable multi filter selection for classic ([91762cb](https://github.com/kleros/gtcr/commit/91762cbd894879955667e51b7bec46c4d00360f0))
* disallow columns with the same name ([d8c8109](https://github.com/kleros/gtcr/commit/d8c8109d6bb8c02b1a98e76eaddfec36531ca4e3))
* don't notify of new app versions ([a2d9ada](https://github.com/kleros/gtcr/commit/a2d9adad8545789a9723b2a7be89a6dce02cf2b8))
* evidence display URI ([b3eee5b](https://github.com/kleros/gtcr/commit/b3eee5b6809a6589b779163b1a07e54cd79edb94))
* evidence submission time and close [#130](https://github.com/kleros/gtcr/issues/130) ([575c439](https://github.com/kleros/gtcr/commit/575c439e7274d341dd1f66ffb5e27e9d0e97ef3a))
* exceptions for links in new tabs and close [#147](https://github.com/kleros/gtcr/issues/147) ([50cabfa](https://github.com/kleros/gtcr/commit/50cabfad536b19b28e28b04d7161cfea0c14e624))
* fix non disputed filters ([6f341f5](https://github.com/kleros/gtcr/commit/6f341f51fc868a981d0789207b29e1a0d5e4e9de))
* formatting on submission modal title ([6dc3186](https://github.com/kleros/gtcr/commit/6dc3186c295bba34b03dcf224a24c4c510d23c38))
* hardcoded gas limit causing scary price predictions ([63f342f](https://github.com/kleros/gtcr/commit/63f342fa3c9598bd2c03e6eeb1b2d4cbc5260e29))
* hook dependencies ([d3a8f7a](https://github.com/kleros/gtcr/commit/d3a8f7a82adc1821943db1eb8da15cff7b4f6e51))
* ignore metamask error if arbitration cost is set ([d09e5a2](https://github.com/kleros/gtcr/commit/d09e5a2b2afc325c4a744ed93147559e8bce942b))
* improve fee reward wording ([e4a482f](https://github.com/kleros/gtcr/commit/e4a482f71d2a59dcc3e51213e8abea282f3ac999))
* improve state name ([2c0a937](https://github.com/kleros/gtcr/commit/2c0a9378e9b2417c6cd14b9709c6c0003069fa0f))
* improve wording and close [#134](https://github.com/kleros/gtcr/issues/134) ([52b5fd2](https://github.com/kleros/gtcr/commit/52b5fd2325faa72f0f66c6c350373c36a96564a8))
* incorrect case in submission alert ([2d1d3d9](https://github.com/kleros/gtcr/commit/2d1d3d9ae3246143c577eed3dc58a23b651b1caa))
* incorrect court label in list factory ([ecf3e5c](https://github.com/kleros/gtcr/commit/ecf3e5cbb2e6de03a96a612b40d45c94fa5562e2))
* incorrect crowdfunding reward display ([235d41d](https://github.com/kleros/gtcr/commit/235d41dee3bff747ce6cb8a231c347417a306604))
* incorrect loser remaining time display ([9be328c](https://github.com/kleros/gtcr/commit/9be328c2de8fe8c34a59b6ce168c39127f632e8a))
* infinite rerender in light-items view ([b76d8fe](https://github.com/kleros/gtcr/commit/b76d8fe33bcb198321c49c9d35f73a547e8659d4))
* infinite return loop in tcr view hook ([9c8c153](https://github.com/kleros/gtcr/commit/9c8c1531d19c0a4e82c5b8d1dd24a8937e9c11b4))
* infinte run on wallet context ([7b81ff4](https://github.com/kleros/gtcr/commit/7b81ff41ff4a45d8dfedc7f17b6a0edca899dd0e))
* items array in wrong format ([8bca531](https://github.com/kleros/gtcr/commit/8bca531ccfd5471d4e29fb236c37dd49ae9c8a7b))
* items not showing due to lregistry ([b68de9c](https://github.com/kleros/gtcr/commit/b68de9c0b7f930cbf997d0b49822a88dff20f5b7))
* light items view not rendering items ([6919e50](https://github.com/kleros/gtcr/commit/6919e50b8f3b3d0d5b4a0a60382c416a9d19dd44))
* limit number of results returned ([9199623](https://github.com/kleros/gtcr/commit/9199623e36a169c144e1d0d4a5970d67134cee9e))
* links without a protocol are broken ([64f0193](https://github.com/kleros/gtcr/commit/64f0193d093643799e2a496dccc52e6f7dcb6247))
* missing rejected items and close [#152](https://github.com/kleros/gtcr/issues/152) ([38195d2](https://github.com/kleros/gtcr/commit/38195d2af3dba9305730968983b7b9869cafed74))
* native currency display ([1fd1544](https://github.com/kleros/gtcr/commit/1fd15442fed8645313aed1debe857bdee2592552))
* new window overshoot and remove beta warning ([45e5834](https://github.com/kleros/gtcr/commit/45e5834d52ebd1646d3197ea422668a033bd29f9))
* node version in build ([6f42af8](https://github.com/kleros/gtcr/commit/6f42af89147c2fcfdb80c23c3c42ebab22ba7d86))
* outdate env variables ([beb8166](https://github.com/kleros/gtcr/commit/beb816689b0ac6fcc8fb739d0fb6e0b3e476f54d))
* outdated deposit values after navigating between TCRs ([84b5f3f](https://github.com/kleros/gtcr/commit/84b5f3ff05c0aae0a2e5c1e4561885e29531ec42))
* outdated deposits after navigating to another list ([adeba6c](https://github.com/kleros/gtcr/commit/adeba6cf093704c6c83688dd3c14396cec66a3de))
* outdated testnet view contract addresses ([b486bf2](https://github.com/kleros/gtcr/commit/b486bf2c616fd2aed6da1ad38452db166fb8f8d1))
* permaloading in action modals ([4249015](https://github.com/kleros/gtcr/commit/424901590ca750aa5c8763691ffd6ef2af964246))
* reactour scroll lock and close [#135](https://github.com/kleros/gtcr/issues/135) ([6b981a0](https://github.com/kleros/gtcr/commit/6b981a08054a6c6e93e56af42afa6cf8f238525e))
* reload and send user to default registry on chain change ([c9ab9af](https://github.com/kleros/gtcr/commit/c9ab9afc58ea812b8be536dbf386809c79e2708f))
* remove broken components ([3be43a4](https://github.com/kleros/gtcr/commit/3be43a4a54513b2972d07d383268194f41040e48))
* remove capitalization from details card ([50c95a3](https://github.com/kleros/gtcr/commit/50c95a391dcad47e6ea21a9aba77e001ca95c70d))
* remove deprecated filter ([7930c55](https://github.com/kleros/gtcr/commit/7930c55b640e9c77ee068098cc6fae3cb8e59a63))
* remove deprecated search bar ([78f4b6e](https://github.com/kleros/gtcr/commit/78f4b6e80a5d39c43dfc55d94b4e5763cebaf0af))
* remove misleading loading indicator and close [#157](https://github.com/kleros/gtcr/issues/157) ([34f0a20](https://github.com/kleros/gtcr/commit/34f0a202c39c3a06fe5d4b48d1e3b8da8a97d3de))
* removing items showing as challenged ([6e57318](https://github.com/kleros/gtcr/commit/6e5731878685984077d2897b35bfbb4132f6e749))
* require wallet for factory ([230df5f](https://github.com/kleros/gtcr/commit/230df5f0c9e41dc41abd47ce81d8fb4778720c0d))
* responsiveness and close [#91](https://github.com/kleros/gtcr/issues/91), close [#92](https://github.com/kleros/gtcr/issues/92) ([8ca6738](https://github.com/kleros/gtcr/commit/8ca67384a37b3dcbc480320bc38cd1c4a7b1aab0))
* responsiveness for evidence with large titles ([aac7ec9](https://github.com/kleros/gtcr/commit/aac7ec90c72694bd0e1e648d06c1c8c32e66fac1))
* scroll issue after reactour ([a112fc6](https://github.com/kleros/gtcr/commit/a112fc6a98c2daa5c85d82329c5ce54a1fbf984d))
* send users seeking help to the curate support group ([09ba81e](https://github.com/kleros/gtcr/commit/09ba81e965865021b15ab76859717ff5d9db4385))
* show challenged requests by default ([581bb2a](https://github.com/kleros/gtcr/commit/581bb2adb6905bfdf3362a1a37ac6cb8a9d75881))
* switch to npm and replace ovm on rinkeby ([a15cb33](https://github.com/kleros/gtcr/commit/a15cb336fad564994102421f54528897700d4be2))
* tcr detection on submission ([e4f3e08](https://github.com/kleros/gtcr/commit/e4f3e0878b80f72a3d72734ba678b96965bd6c65))
* text issue for light curate ([1ff5f5c](https://github.com/kleros/gtcr/commit/1ff5f5c89ef206a9f2ab17b934c81ff0f60c290d)), closes [#184](https://github.com/kleros/gtcr/issues/184)
* typo in tour and close [#153](https://github.com/kleros/gtcr/issues/153) ([f75dd3a](https://github.com/kleros/gtcr/commit/f75dd3ad7e4cc63a565514cfe12eb2d6e6fd6cc8))
* update default evidence display uri ([9a468e6](https://github.com/kleros/gtcr/commit/9a468e66dff0fdfa7f4a31e79449f7a349dca63f))
* update default evidence display uri ([5cf95ad](https://github.com/kleros/gtcr/commit/5cf95adde408c48d579fcad398e3310767c7efe3))
* update get help link and close [#132](https://github.com/kleros/gtcr/issues/132) ([d952c5e](https://github.com/kleros/gtcr/commit/d952c5e1bfd35abd029dc7d94988f293cba44008))
* update to latest version abi ([fd71cc6](https://github.com/kleros/gtcr/commit/fd71cc6ca2077991160ff38e77980c95fb4127d4))
* use latest contracts ([ee8446c](https://github.com/kleros/gtcr/commit/ee8446cb077ef9cb073ee3c56b34d52a4c4beae7))
* use title case and close [#144](https://github.com/kleros/gtcr/issues/144) ([fb87520](https://github.com/kleros/gtcr/commit/fb87520b730dc73405358afd5a1f6b36992ab9db))
* user can no longer submit while uploading ([d49255c](https://github.com/kleros/gtcr/commit/d49255ce851dc1664399dd83e2bae056c0b466d0))
* welcome video url ([19cc545](https://github.com/kleros/gtcr/commit/19cc545c3f831f5993da294a0ef2c53514880837))
* when no account ([704315b](https://github.com/kleros/gtcr/commit/704315bbdce24e0e8b64324484c8f77f302213a9))
* withdraw rewards button not requesting signature ([97b22d2](https://github.com/kleros/gtcr/commit/97b22d286fdc7acd45089ad1b81f47966c91ba3d))
* work around ethers-utils decoder bug ([3cc2d2d](https://github.com/kleros/gtcr/commit/3cc2d2d7920e8aeddbc025e0c3684b0f30bbb5e2))
* work around gas estimation error ([d6e9269](https://github.com/kleros/gtcr/commit/d6e9269859b91fe2a70e774e8d9193433e727d14))
* wrong factory address on xdai ([7bf1e19](https://github.com/kleros/gtcr/commit/7bf1e1943074520cdbf44b04d0b91f95fe4f9810))
* wrong graph URL ([76a119a](https://github.com/kleros/gtcr/commit/76a119a729377326bd2b999b77e707476c7eef7e))
* wrong page count after navigating between lists ([ddfde11](https://github.com/kleros/gtcr/commit/ddfde11b418c720e142ee1ba93b6180fb3aa1172))
* xdai items not loading ([ae07d03](https://github.com/kleros/gtcr/commit/ae07d03006a0faa7233cb4da2f31b2579f1cf6e2))

## [1.1.0](https://github.com/kleros/gtcr/compare/v1.0.0...v1.1.0) (2020-07-30)


### Features

* add challenge time hover and close [#136](https://github.com/kleros/gtcr/issues/136) ([272f9e5](https://github.com/kleros/gtcr/commit/272f9e5d0a93ae93addf86ae92856f162eb20693))
* display challenge period when submitting, removing and close [#142](https://github.com/kleros/gtcr/issues/142) ([52f5327](https://github.com/kleros/gtcr/commit/52f5327006ed02879378216b0ab3ae17fe57c5d1))
* display item details even if request is resolved ([a93217b](https://github.com/kleros/gtcr/commit/a93217b7df6aba9872c972c267368bbcef289b62))
* hide badges section if badges are disabled and close [#145](https://github.com/kleros/gtcr/issues/145) ([f5afc08](https://github.com/kleros/gtcr/commit/f5afc08798f12ec110ac8ae294c599cac3334fb5))
* support link column type and close [#131](https://github.com/kleros/gtcr/issues/131) ([9446f34](https://github.com/kleros/gtcr/commit/9446f346bf19895d90c23aa2efe1eec6b4798a25))
* swap warning for info alert and close [#143](https://github.com/kleros/gtcr/issues/143) ([b823dab](https://github.com/kleros/gtcr/commit/b823dab8db159f85c35956f91d94b21f6fe3495a))
* use latest evidence display ([eca3484](https://github.com/kleros/gtcr/commit/eca3484d1ed9061468c441f50aeab1b3d549a6a8))


### Bug Fixes

* appeal crowdfunding permaloading ([799e55c](https://github.com/kleros/gtcr/commit/799e55cdf6107c62ae225556e79a8021fbd5adaa))
* bump gas limit for submissions ([1432f63](https://github.com/kleros/gtcr/commit/1432f631cdf9ebc43f274fe2bfe6ae816412b0ce))
* contrast in action button and close [#139](https://github.com/kleros/gtcr/issues/139) ([b708d44](https://github.com/kleros/gtcr/commit/b708d44e42d5559966d964156677a0e1a0739310))
* crash on page if one of the sides is fully funded ([3f6bfad](https://github.com/kleros/gtcr/commit/3f6bfad6a15f09cdeab903f14ced935b872b9dd9))
* disallow columns with the same name ([d8c8109](https://github.com/kleros/gtcr/commit/d8c8109d6bb8c02b1a98e76eaddfec36531ca4e3))
* evidence submission time and close [#130](https://github.com/kleros/gtcr/issues/130) ([575c439](https://github.com/kleros/gtcr/commit/575c439e7274d341dd1f66ffb5e27e9d0e97ef3a))
* hardcoded gas limit causing scary price predictions ([63f342f](https://github.com/kleros/gtcr/commit/63f342fa3c9598bd2c03e6eeb1b2d4cbc5260e29))
* ignore metamask error if arbitration cost is set ([d09e5a2](https://github.com/kleros/gtcr/commit/d09e5a2b2afc325c4a744ed93147559e8bce942b))
* improve wording and close [#134](https://github.com/kleros/gtcr/issues/134) ([52b5fd2](https://github.com/kleros/gtcr/commit/52b5fd2325faa72f0f66c6c350373c36a96564a8))
* incorrect crowdfunding reward display ([235d41d](https://github.com/kleros/gtcr/commit/235d41dee3bff747ce6cb8a231c347417a306604))
* incorrect loser remaining time display ([9be328c](https://github.com/kleros/gtcr/commit/9be328c2de8fe8c34a59b6ce168c39127f632e8a))
* infinite return loop in tcr view hook ([9c8c153](https://github.com/kleros/gtcr/commit/9c8c1531d19c0a4e82c5b8d1dd24a8937e9c11b4))
* infinte run on wallet context ([7b81ff4](https://github.com/kleros/gtcr/commit/7b81ff41ff4a45d8dfedc7f17b6a0edca899dd0e))
* missing rejected items and close [#152](https://github.com/kleros/gtcr/issues/152) ([38195d2](https://github.com/kleros/gtcr/commit/38195d2af3dba9305730968983b7b9869cafed74))
* outdated deposits after navigating to another list ([adeba6c](https://github.com/kleros/gtcr/commit/adeba6cf093704c6c83688dd3c14396cec66a3de))
* permaloading in action modals ([4249015](https://github.com/kleros/gtcr/commit/424901590ca750aa5c8763691ffd6ef2af964246))
* responsiveness for evidence with large titles ([aac7ec9](https://github.com/kleros/gtcr/commit/aac7ec90c72694bd0e1e648d06c1c8c32e66fac1))
* show challenged requests by default ([581bb2a](https://github.com/kleros/gtcr/commit/581bb2adb6905bfdf3362a1a37ac6cb8a9d75881))
* typo in tour and close [#153](https://github.com/kleros/gtcr/issues/153) ([f75dd3a](https://github.com/kleros/gtcr/commit/f75dd3ad7e4cc63a565514cfe12eb2d6e6fd6cc8))
* update default evidence display uri ([9a468e6](https://github.com/kleros/gtcr/commit/9a468e66dff0fdfa7f4a31e79449f7a349dca63f))
* update default evidence display uri ([5cf95ad](https://github.com/kleros/gtcr/commit/5cf95adde408c48d579fcad398e3310767c7efe3))
* update get help link and close [#132](https://github.com/kleros/gtcr/issues/132) ([d952c5e](https://github.com/kleros/gtcr/commit/d952c5e1bfd35abd029dc7d94988f293cba44008))
* use title case and close [#144](https://github.com/kleros/gtcr/issues/144) ([fb87520](https://github.com/kleros/gtcr/commit/fb87520b730dc73405358afd5a1f6b36992ab9db))
* welcome video url ([19cc545](https://github.com/kleros/gtcr/commit/19cc545c3f831f5993da294a0ef2c53514880837))
* work around ethers-utils decoder bug ([3cc2d2d](https://github.com/kleros/gtcr/commit/3cc2d2d7920e8aeddbc025e0c3684b0f30bbb5e2))
* work around gas estimation error ([d6e9269](https://github.com/kleros/gtcr/commit/d6e9269859b91fe2a70e774e8d9193433e727d14))

## [1.0.0](https://github.com/kleros/gtcr/compare/v0.9.7...v1.0.0) (2020-06-10)


### Features

* display reward proportional to contribution and close [#99](https://github.com/kleros/gtcr/issues/99) ([d752a49](https://github.com/kleros/gtcr/commit/d752a4945b13f632fdfdc8807f77580a482514df))
* set default network to mainnet 🚀 ([c5166e1](https://github.com/kleros/gtcr/commit/c5166e18d069e381f9e7f59393b6e5303ada39dc))
* use percentage for multipliers, closes [#111](https://github.com/kleros/gtcr/issues/111), closes [#120](https://github.com/kleros/gtcr/issues/120) ([2037bce](https://github.com/kleros/gtcr/commit/2037bce58a0a8f17cd7531027cd8c36729eadc8e))


### Bug Fixes

* clarify tooltips, closes [#113](https://github.com/kleros/gtcr/issues/113), closes [#115](https://github.com/kleros/gtcr/issues/115), closes [#116](https://github.com/kleros/gtcr/issues/116) ([99dabba](https://github.com/kleros/gtcr/commit/99dabba06fb5ac397974813e5590c0c35e513f6d))
* clarify tooltips, closes [#117](https://github.com/kleros/gtcr/issues/117), closes [#118](https://github.com/kleros/gtcr/issues/118), closes [#119](https://github.com/kleros/gtcr/issues/119) ([7b8d2a0](https://github.com/kleros/gtcr/commit/7b8d2a093940c9bde9d489b95475ece964dec6c3))
* don't link disabled badges list and fix typos ([74b105b](https://github.com/kleros/gtcr/commit/74b105b79e0e1d7449e9cc07cce3319112d15a28))
* dont display details button on deployed tcrs card ([7c052d0](https://github.com/kleros/gtcr/commit/7c052d0cd44bac0c54df948cf0810947efeadcca))
* empty field error message and close [#105](https://github.com/kleros/gtcr/issues/105) ([55f5cd4](https://github.com/kleros/gtcr/commit/55f5cd403715ae25e83af6534180b7e177746f17))
* hide button if there is no error as well ([e1919a5](https://github.com/kleros/gtcr/commit/e1919a5766ed1434533bb872b1488dbf29a6300a))
* improve item cards button arrangement ([0951b40](https://github.com/kleros/gtcr/commit/0951b40827e456c4d2c63bf556fcaa52175a65b7))
* improve wording and close [#121](https://github.com/kleros/gtcr/issues/121) ([c5fd974](https://github.com/kleros/gtcr/commit/c5fd9744fc19b45c1425cef0e10f7efdf6f326ee))
* improve wording and close [#122](https://github.com/kleros/gtcr/issues/122) ([7212a72](https://github.com/kleros/gtcr/commit/7212a7227b4af6e1195cbf49fe7eb6971dfd5094))
* improve wording and close [#124](https://github.com/kleros/gtcr/issues/124) ([859887b](https://github.com/kleros/gtcr/commit/859887b072e556f6eddad7f71b24be5ce82e14e3))
* improve wording and close [#125](https://github.com/kleros/gtcr/issues/125) ([f10e305](https://github.com/kleros/gtcr/commit/f10e3050b9b516155f3f8c935d999274038fffda))
* improve wording and close [#126](https://github.com/kleros/gtcr/issues/126) ([fc57ac8](https://github.com/kleros/gtcr/commit/fc57ac89dce1a61afd462dd58272ef947aaa137a))
* improve wording and close [#127](https://github.com/kleros/gtcr/issues/127) ([3b93e62](https://github.com/kleros/gtcr/commit/3b93e62411ef8abcf81d346f3db69e006dfad86e))
* item card content alignment ([83d96e0](https://github.com/kleros/gtcr/commit/83d96e0c7bb1ca1f58f64537cbb8caf651baeefa))
* loading indicator while deploying ([2e5c313](https://github.com/kleros/gtcr/commit/2e5c313245f4cf72b26f0617708942aa3926f811))
* make removal evidence mandatory and close [#110](https://github.com/kleros/gtcr/issues/110) ([1083468](https://github.com/kleros/gtcr/commit/10834686b8321f65e87890e73fbd31fffb4af8ca))
* wording improvements and close [#109](https://github.com/kleros/gtcr/issues/109) ([81cc40c](https://github.com/kleros/gtcr/commit/81cc40c122b7e620072b69406466a73dfe988fb4))

### [0.9.7](https://github.com/kleros/gtcr/compare/v0.9.6...v0.9.7) (2020-06-08)


### Features

* update default list ([5fc555b](https://github.com/kleros/gtcr/commit/5fc555bd57ef73c117ce876d0f110e1c0801bd02))


### Bug Fixes

* case in submit item buttons ([64a0c1c](https://github.com/kleros/gtcr/commit/64a0c1c940f94db72d45606d3dede0df0b3c0a6a))
* incorrect form constraint ([5f34083](https://github.com/kleros/gtcr/commit/5f34083f22f00012ccc38758df0e4bc0b25c81f2))

### [0.9.6](https://github.com/kleros/gtcr/compare/v0.9.5...v0.9.6) (2020-06-08)


### Features

* add back button to details view and close [#58](https://github.com/kleros/gtcr/issues/58) ([a86eec0](https://github.com/kleros/gtcr/commit/a86eec07b27a14d149686d0b757b1867670a5a0d))
* add item details view tour ([aa3bc85](https://github.com/kleros/gtcr/commit/aa3bc8585019fd8d11595f0eae444de1b27c7448))
* add item name plural field and close [#74](https://github.com/kleros/gtcr/issues/74) ([b70b72a](https://github.com/kleros/gtcr/commit/b70b72a7ceeb5d3faefcdbeb7d5b8ae0501389d8))
* add links to twitter, telegram channel and close [#75](https://github.com/kleros/gtcr/issues/75), close [#65](https://github.com/kleros/gtcr/issues/65) ([544d017](https://github.com/kleros/gtcr/commit/544d017589c19959495fd6f74ba07f7dd450baef))
* add tour to items view ([aba15ed](https://github.com/kleros/gtcr/commit/aba15edbeb609a5520a5fe925dfefa5519d9f3b5))
* add welcome modal and close [#59](https://github.com/kleros/gtcr/issues/59) ([a0d2b55](https://github.com/kleros/gtcr/commit/a0d2b557b546a9c506a9eaac327bf337a0968156))
* allow hiding cards again if filter is enabled ([39ccd4a](https://github.com/kleros/gtcr/commit/39ccd4a3359748336b50670f298bb4afd8b51e76))
* allow skipping badges step and close [#95](https://github.com/kleros/gtcr/issues/95) ([5fedf64](https://github.com/kleros/gtcr/commit/5fedf64d3911aafbbc9f884c21c7ed383b704d1c))
* clear form on submission and close [#48](https://github.com/kleros/gtcr/issues/48) ([d3fa6d3](https://github.com/kleros/gtcr/commit/d3fa6d3a513fa011e249982e6f9f06dd136618af))
* deploy TCR in a single transaction and close [#69](https://github.com/kleros/gtcr/issues/69) ([6fae7f8](https://github.com/kleros/gtcr/commit/6fae7f8ce3a96151f9c997a9db24c223622a5cce))
* deploy TCR in a single transaction and close [#96](https://github.com/kleros/gtcr/issues/96) ([776eb34](https://github.com/kleros/gtcr/commit/776eb345c720d8d0f6ff3ad5de4979c9e15cf6f0))
* display notifications tour ([7d33e3e](https://github.com/kleros/gtcr/commit/7d33e3e0e38c1b759ef8fe1bfe6865bdde4bfb7d))
* display predicted arbitration costs and close [#54](https://github.com/kleros/gtcr/issues/54) ([dc1ed59](https://github.com/kleros/gtcr/commit/dc1ed5973360c245f7d32c5048d107bbaa20541b))
* display remaining challenge time and close [#87](https://github.com/kleros/gtcr/issues/87) ([0f79fce](https://github.com/kleros/gtcr/commit/0f79fce80edf99b87bf871d678aa3067b3e07bca))
* display request bounty and close [#86](https://github.com/kleros/gtcr/issues/86) ([bf27927](https://github.com/kleros/gtcr/commit/bf27927d1394679b63584a63cacba1b0059ec07b))
* don't use nickname for email notifications ([3107235](https://github.com/kleros/gtcr/commit/310723514b20596dc651f4aa08db31e5a2906fe5))
* factory final step revamp and close [#34](https://github.com/kleros/gtcr/issues/34) ([d95689c](https://github.com/kleros/gtcr/commit/d95689cfdf508fd13c4a925dedd7974a041ac544))
* friendlier extra data for kleros and close [#51](https://github.com/kleros/gtcr/issues/51) ([8f8d0ae](https://github.com/kleros/gtcr/commit/8f8d0ae5c0981c2eb1bd8241538c040f15d0341a))
* improve poorly encoded data and non-TCR addresses ([b661aed](https://github.com/kleros/gtcr/commit/b661aedc7f100e8c6564b9be53ec5ef870c82b13))
* improve search results and close [#64](https://github.com/kleros/gtcr/issues/64) ([7735b8b](https://github.com/kleros/gtcr/commit/7735b8b796912761db5c8881f8a265d48d5957c2))
* improve submission modal with suggestions from [#104](https://github.com/kleros/gtcr/issues/104) ([5fbb519](https://github.com/kleros/gtcr/commit/5fbb519f72a45600cf83bddcd5576a8e146dd1cc))
* labels in item details card should be bold ([4175804](https://github.com/kleros/gtcr/commit/4175804c424a59b3eee823633f7a143e14107415))


### Bug Fixes

* add divider between upload and text params ([2fa2616](https://github.com/kleros/gtcr/commit/2fa2616e7869a28de24480ebfc1ae75bdbfb76b2))
* banner would flash for users that dismissed it ([8337306](https://github.com/kleros/gtcr/commit/833730641c5d47b57053cb3dfbd03e3eca5731f7))
* clarify item navigation and close [#71](https://github.com/kleros/gtcr/issues/71) ([9fca322](https://github.com/kleros/gtcr/commit/9fca322768264efc346f483147564478afb50889))
* clarify settings save button label ([8315b93](https://github.com/kleros/gtcr/commit/8315b9360f7675ca0e2e11d6ad9789a238d45e47))
* crowdfunding card margins ([687c040](https://github.com/kleros/gtcr/commit/687c0404cb48f540ddf27917d1992fd2f6813e82))
* default stake values ([5dc4667](https://github.com/kleros/gtcr/commit/5dc4667c3f0680562a72540b415c3c897755b4aa))
* deploying a factory was clearing out previous deployments box ([ab26f22](https://github.com/kleros/gtcr/commit/ab26f22e6ccdbf526c7d2bced412578adf832968))
* display tour after welcome modal closed ([a37a3de](https://github.com/kleros/gtcr/commit/a37a3de672cb466ec0de58caab3310c64c49216f))
* don't hide the governor in the advanced options ([32fe167](https://github.com/kleros/gtcr/commit/32fe1678c4d78ab8f2c4dac282e886703a2b429c))
* don't use dark pattern ([4c63731](https://github.com/kleros/gtcr/commit/4c63731c71f2e04895b69e44ce31637257ce0f6d))
* dont show modal again by default ([5e36851](https://github.com/kleros/gtcr/commit/5e368517bce193170c2589cf5e6814eb6fc4eaef))
* error deploying list ([fa753c8](https://github.com/kleros/gtcr/commit/fa753c8e9378d7a5b150f75e767ce487ed8d5812))
* improve factory steps wording and typos ([e71b29b](https://github.com/kleros/gtcr/commit/e71b29b106a20fcbaaaa165a10d0abb71f9db437))
* improve labels and default values ([3071033](https://github.com/kleros/gtcr/commit/3071033a406b6fed61f3ecc125c6ad867ad2cc1d))
* improve list deployment costs info and close [#80](https://github.com/kleros/gtcr/issues/80) ([0d5955f](https://github.com/kleros/gtcr/commit/0d5955f7eaaecc029d4a93f430850e10efed3f9b))
* improve malformed submission error message ([2ca4f32](https://github.com/kleros/gtcr/commit/2ca4f32ee33a21d4080863c8b24ca35e54fb960f))
* incorrect badge selection and close [#67](https://github.com/kleros/gtcr/issues/67) ([c3b0f6f](https://github.com/kleros/gtcr/commit/c3b0f6f1379307d93af79d42d959d5321a05a342))
* incorrect submission and challenge deposits ([4c85c3d](https://github.com/kleros/gtcr/commit/4c85c3d2d095b0d07237f17eb9df83c2018dc1a9))
* label improvements and typos ([201e1a6](https://github.com/kleros/gtcr/commit/201e1a609cf0e4bdc402afe532a9ac47aee0b4d8))
* link integration channel instead of the main kleros channel ([4f067a7](https://github.com/kleros/gtcr/commit/4f067a79285a232257dd2a287a147e9c97cb1917))
* modal styling and remove built css from repo ([656550d](https://github.com/kleros/gtcr/commit/656550d7e904831d6ef45b7073a6b1e1a4767234))
* move upload fields to the top and close [#76](https://github.com/kleros/gtcr/issues/76) ([5dba03f](https://github.com/kleros/gtcr/commit/5dba03fb5598c3c4193dee217677a633989ae88d))
* my challenges/my submissions filter being used without an account ([60acd8a](https://github.com/kleros/gtcr/commit/60acd8a9e073ecbd9348bb5c08f3643fededd7cf))
* navigate to item details instead of opening a new tab, typo ([2d347f5](https://github.com/kleros/gtcr/commit/2d347f5e61670c6de8745da27f263526fc427892))
* prop type errors and refactor ([64635e6](https://github.com/kleros/gtcr/commit/64635e63b218cae45ca65e0177e47413c2c50ff3))
* prop-type checks, improve labels and hide unused UIs ([206e4dc](https://github.com/kleros/gtcr/commit/206e4dc9e4f59b6b3303aade9076cef47b79e698))
* proptypes error and close [#60](https://github.com/kleros/gtcr/issues/60) ([17bc6c8](https://github.com/kleros/gtcr/commit/17bc6c8a04317788ae512dc5328fe0eebad85a35))
* remove cost notice ([38edd37](https://github.com/kleros/gtcr/commit/38edd37aac062bf8e82fad805448f72a16d251f2))
* remove redundant text on notifications and close [#102](https://github.com/kleros/gtcr/issues/102) ([c9f822e](https://github.com/kleros/gtcr/commit/c9f822e67dccf5bcb8089fe543d9470204c48a46))
* replace all user-facing string from TCR to list ([d81a2b8](https://github.com/kleros/gtcr/commit/d81a2b8c7158d94b15fd726ca314c466af9a9928))
* request timeline styling ([1380a5a](https://github.com/kleros/gtcr/commit/1380a5a2293acc0c1bb46b87b58d9cd5590e602d))
* require at least one ID and close [#53](https://github.com/kleros/gtcr/issues/53) ([f59643f](https://github.com/kleros/gtcr/commit/f59643f9fb87bad05ce0c473d3c44a21656b7087))
* responsiveness on mobile devices ([4737dcb](https://github.com/kleros/gtcr/commit/4737dcb25e043d69e975d3c8e49382b96cee077d))
* search results on list of lists ([3231ef7](https://github.com/kleros/gtcr/commit/3231ef7615f8a0cd272f7c4d210484e1f6d8b35c))
* simplify factory and close [#77](https://github.com/kleros/gtcr/issues/77) ([7535901](https://github.com/kleros/gtcr/commit/7535901dc425d1dddf2d613fc3d0b961f3d28ab9))
* styling and control labels ([9dd88b0](https://github.com/kleros/gtcr/commit/9dd88b0f155c9783c974a51bbe545e77bc0d37e1))
* submit button styling on mobile ([e96617b](https://github.com/kleros/gtcr/commit/e96617b8424062ea9da0ea3bbf3e873d38c4a4c0))
* swap 'remove' for 'send' in removal modal and close [#103](https://github.com/kleros/gtcr/issues/103) ([76eb2aa](https://github.com/kleros/gtcr/commit/76eb2aa19673f9e4efb237782c0498d87fdfbea4))
* swap 'reveal' for 'show' button in hidden cards, closes [#100](https://github.com/kleros/gtcr/issues/100) ([cd2cc89](https://github.com/kleros/gtcr/commit/cd2cc8978556a718bef2030bfac60b474cbe4c93))
* tcr card button styling ([52ad029](https://github.com/kleros/gtcr/commit/52ad029b8d5d4751f222cf84ce68fdd7926e1c6f))
* top bar layout on ipad and close [#90](https://github.com/kleros/gtcr/issues/90) ([72dd2e7](https://github.com/kleros/gtcr/commit/72dd2e7a8d452d81606dcb9d341ff5abf3188bfd))
* update warning banner ([145da15](https://github.com/kleros/gtcr/commit/145da154b2a9e55f23c3558f5bf21a82dc7d3c2a))
* use legacy sign and close [#32](https://github.com/kleros/gtcr/issues/32) ([724c273](https://github.com/kleros/gtcr/commit/724c273d2c7aa5e3412d7418c4668b62daa85299))
* visit link should open in a new tab ([b755393](https://github.com/kleros/gtcr/commit/b7553934b09ba405c751e30803f3ed5f51d6a4d1))

### [0.9.5](https://github.com/kleros/gtcr/compare/v0.9.4...v0.9.5) (2020-05-20)


### Features

* add a NSFW switch ([9cf0d0e](https://github.com/kleros/gtcr/commit/9cf0d0e060b35ad791e8b06702dc0ad35552b6e9))
* add note on deployment costs, close [#33](https://github.com/kleros/gtcr/issues/33), close [#39](https://github.com/kleros/gtcr/issues/39) ([0086245](https://github.com/kleros/gtcr/commit/0086245a9e1a3aa73d1e2af1e24b11831ba3fe20))
* display arbitrator and challenger, if available ([cb79939](https://github.com/kleros/gtcr/commit/cb79939767f30e1ec91efa3461df41d010980683))
* display challenged and crowdfunding cards facing down ([82c0c3d](https://github.com/kleros/gtcr/commit/82c0c3d0295a5dcfaf9599bd2dc0d8651a69e74e))
* display items with pending requests first ([2306396](https://github.com/kleros/gtcr/commit/2306396cf56d07ac068728321a47f617360405ca))
* display link in details view ([514a569](https://github.com/kleros/gtcr/commit/514a569429ef825843e0aaa70a235ebc7f7ee960))
* display TCR information in details view and close [#63](https://github.com/kleros/gtcr/issues/63) ([bce7871](https://github.com/kleros/gtcr/commit/bce7871b05c42d69f500bc29ae6e05aa771d5375))
* fix viewport measurements, display tcr logo and close [#62](https://github.com/kleros/gtcr/issues/62) ([befdcd2](https://github.com/kleros/gtcr/commit/befdcd2e0e0eeddcee7e497f29abf5bec94bda3a))
* handle HasPaidFees event notification ([ab978eb](https://github.com/kleros/gtcr/commit/ab978eb74fffcc62038ec686dcc667576b9ee0e4))
* improve factory field descriptions and close [#46](https://github.com/kleros/gtcr/issues/46) ([f850b7f](https://github.com/kleros/gtcr/commit/f850b7f335e409e0e625882eda0fa2b3ca353339))
* improve fee stake multipliers explanation and close [#47](https://github.com/kleros/gtcr/issues/47) ([5100130](https://github.com/kleros/gtcr/commit/51001303f5c2ce117546485d1b7dd490e298bca4))
* improve item name description and close [#44](https://github.com/kleros/gtcr/issues/44) ([f959d1f](https://github.com/kleros/gtcr/commit/f959d1f29c8b8d6fc16883c8e671ecf89a67a6ae))
* improve primary document field description and close [#45](https://github.com/kleros/gtcr/issues/45) ([89c2720](https://github.com/kleros/gtcr/commit/89c272078dba44b962f35a8137948649d9fcf5be))
* improve stake multipliers description and close [#52](https://github.com/kleros/gtcr/issues/52) ([9ae169e](https://github.com/kleros/gtcr/commit/9ae169efb8c76de2bba5daafac9fa945279366a4))
* prevent submitting non GTCRs to TCRs of TCRs and close [#43](https://github.com/kleros/gtcr/issues/43) ([881a76f](https://github.com/kleros/gtcr/commit/881a76fdf42539f2af5125b64724dde0af92ffad))
* remember nsfw user setting ([f276cb2](https://github.com/kleros/gtcr/commit/f276cb26626a663952d17c09f4986088f9987f34))
* update mainnet governor to latest contract ([48a6617](https://github.com/kleros/gtcr/commit/48a66175d08c105127b9232aa554715ca7dff2c2))
* use button for 'navigate to tcr' link ([9e843a7](https://github.com/kleros/gtcr/commit/9e843a7e5e9067513bb82dbc31a952c3b5e95406))


### Bug Fixes

* default tcr and extra data ([374608d](https://github.com/kleros/gtcr/commit/374608d7dda685224ddad617d3c4500e2e262878))
* disable badge address field if parent is not set ([3445184](https://github.com/kleros/gtcr/commit/3445184921d0d8731bbfa0417e01e9051711355e))
* don't show old active items if the filter hides it ([2c7ccb3](https://github.com/kleros/gtcr/commit/2c7ccb3c9f547eee5bfbbf692a7834fc7de291f8))
* error when navigating from tcr with items to empty tcr ([5277c9b](https://github.com/kleros/gtcr/commit/5277c9bdc0f3775a209e41fa4f514cc4b6d404fd))
* fetch request type from logs ([4b3cf71](https://github.com/kleros/gtcr/commit/4b3cf71b6384e5c90c56e516bbd9c1b3bbc325d5))
* fetch request type from logs and close [#49](https://github.com/kleros/gtcr/issues/49) ([b7f80b1](https://github.com/kleros/gtcr/commit/b7f80b1bafadca4399c2d42d87b00cd92f2d37fd))
* handle improperly encoded submissions ([8debf4c](https://github.com/kleros/gtcr/commit/8debf4c6d0505d7a22cba94930a936e5921bab05))
* improve challenge deposit labels and close [#42](https://github.com/kleros/gtcr/issues/42) ([884c1b5](https://github.com/kleros/gtcr/commit/884c1b5d9b8992447b5b3acaf5f05c19d846fbba))
* improve deposit descriptions and card styling ([4ccb6e2](https://github.com/kleros/gtcr/commit/4ccb6e2a3ccdc43cafd70fe13d6199452a507233))
* improve UI explanations and close [#56](https://github.com/kleros/gtcr/issues/56) ([bff6336](https://github.com/kleros/gtcr/commit/bff633657dafcb03c1e47cb973f458ccc8c2ccf5))
* incorrect badge status handling ([c3c45ba](https://github.com/kleros/gtcr/commit/c3c45baa60f35517ef05c8254470c2094ffef44c))
* listing criteria link ([cd62574](https://github.com/kleros/gtcr/commit/cd62574233692120c47824b525407b307952f3de))
* outdated contract api call ([2bb1d9b](https://github.com/kleros/gtcr/commit/2bb1d9bcc230b92f01fdbd967a920f4a076226b5))
* outdated contract api call ([d55a710](https://github.com/kleros/gtcr/commit/d55a71094dc0395b7cdd3cbb277552845ecf5cd5))
* request timeline loading forever ([11aad0d](https://github.com/kleros/gtcr/commit/11aad0d506fe78f5d5cd301df9fae721127d4159))
* return badges filtering by state and column matched ([ef71d7a](https://github.com/kleros/gtcr/commit/ef71d7a0a13d4b2de64aa6ae8912b744138a71ec))
* styling issue on item cards header ([3e0bbe3](https://github.com/kleros/gtcr/commit/3e0bbe3872a70cf7e5f2dee4b31c711ef754d79b))
* timeline loading indicator handling ([0ffb76c](https://github.com/kleros/gtcr/commit/0ffb76cf8a0193d9118b5ec3c2573b71db7f78c5))
* use kovan as the default network ([671bcbf](https://github.com/kleros/gtcr/commit/671bcbfde3a91a529015ce010ee13fb371cf3375))
* use latest governor contract as the default governor ([2a67601](https://github.com/kleros/gtcr/commit/2a67601a8e15a25b31e6dbc7250b7e18ead27345))
* use latest tcr view contract ([9da112a](https://github.com/kleros/gtcr/commit/9da112aca280c9f98611aff195a2b2a5c7a2f00e))
* view tcr button not working ([4422d93](https://github.com/kleros/gtcr/commit/4422d93dee2dd3049bd48b8d5ae1486a6613de74))
* **encoder:** handle small ethereum addresses ([2cebd7e](https://github.com/kleros/gtcr/commit/2cebd7e034c7737e130ef05e6d22219949bd5e63))
* **factory:** crash on opening ([e2a2e71](https://github.com/kleros/gtcr/commit/e2a2e71f725239043c42e93eb0dc8eb900afa4ff))

### [0.9.4](https://github.com/kleros/gtcr/compare/v0.9.2...v0.9.4) (2020-04-30)


### Features

* add beta warning banner ([eae9755](https://github.com/kleros/gtcr/commit/eae975593cb4d9f2ea2fe71cc1f5c30857383a4a))
* display arbitrator and dispute ID, if any ([3120e2e](https://github.com/kleros/gtcr/commit/3120e2ee8277149429b5a82b5b5e811209563b53))
* display timestamps for every request event, closes [#35](https://github.com/kleros/gtcr/issues/35) ([a5b3b95](https://github.com/kleros/gtcr/commit/a5b3b95cd8f2cd761890eab0f13cdbcaae6bab5f))
* for TCRs of TCRs, display information from the TCR. Closes [#30](https://github.com/kleros/gtcr/issues/30) ([4588b5f](https://github.com/kleros/gtcr/commit/4588b5f25f8f2f4a35459d1770e3e9320a79763f))
* set default deployment to mainnet ([a150883](https://github.com/kleros/gtcr/commit/a15088310d2048e85e08d0ce1e08d3836dac5365))
* update to latest contract version ([1267ff5](https://github.com/kleros/gtcr/commit/1267ff5bf9343630941f8e6575122595e3338c96))
* upgrade to latest contract version ([1b60ffe](https://github.com/kleros/gtcr/commit/1b60ffea910f9f1165ff3a2bc7257632e692ad74))
* use latest evidence display ([5d6b30c](https://github.com/kleros/gtcr/commit/5d6b30c5a763b1f5e0760265b67a354d13b0829a))


### Bug Fixes

* banner responsiveness ([33f4830](https://github.com/kleros/gtcr/commit/33f48300de65e865adf856bec4f8912f43d2a036))
* display correct listing criteria for listing badges and close [#38](https://github.com/kleros/gtcr/issues/38) ([4daa036](https://github.com/kleros/gtcr/commit/4daa0369c302d00d5616c5d8e7dbccf46f70c116))
* error handling and card styling ([b992f8c](https://github.com/kleros/gtcr/commit/b992f8c8cf9717d367b4179fc1bb6918ee351114))
* evidence subscription api call ([7ebef22](https://github.com/kleros/gtcr/commit/7ebef2257afc26620544e503338bef8772af1f1c))
* filter submission events by evidence group ID ([b59fdad](https://github.com/kleros/gtcr/commit/b59fdadac3d0c2a26bc15c074040fd35da84b428))
* handle network-based notifications ([a814116](https://github.com/kleros/gtcr/commit/a814116cf6355876de145dbfc46d8ccb1a93c138))
* hide badges already added from options. Closes [#37](https://github.com/kleros/gtcr/issues/37) ([75350d8](https://github.com/kleros/gtcr/commit/75350d816e5208bfe9cb543e7d4c523638fc8ae2))
* hide challenged requests by default ([33420b5](https://github.com/kleros/gtcr/commit/33420b5657d0c6d98b68cdd461e6db7c4a5b0339))
* image selector aspect ratio ([30d8db3](https://github.com/kleros/gtcr/commit/30d8db38beb2a76f38fd971278f95ae5aefbc8c4))
* improve warning banner ([ebcb1c6](https://github.com/kleros/gtcr/commit/ebcb1c660436bb180d2897f92143754ea0e30ae8))
* improve warning banner styling ([482cb2e](https://github.com/kleros/gtcr/commit/482cb2e01c9a30d2674172fd4441d6238335792d))
* incorrect proptype check ([b9628f3](https://github.com/kleros/gtcr/commit/b9628f34e10ca02684789fc46cc318b233a09cf6))
* make whole card clickable ([f3fd3ca](https://github.com/kleros/gtcr/commit/f3fd3ca7ebf0d9f25d001094da12f9391135dcba))
* my challenges and my submissions filters ([2dbbe46](https://github.com/kleros/gtcr/commit/2dbbe46ebb81f1eff5a52e0a8979236655807a38))
* notification service api ([1514562](https://github.com/kleros/gtcr/commit/15145622534340061a5e8ad8e30dd930bd2cf4bf))
* sort items by oldest first ([1de8e20](https://github.com/kleros/gtcr/commit/1de8e2012437af23d2b54ed3534de53d93f00066))
* typo in environment variables ([6899ad6](https://github.com/kleros/gtcr/commit/6899ad6d556aac6e8d6d3a0ed13a74c7d0593afc))
* update logo and contract package ([fcf3daf](https://github.com/kleros/gtcr/commit/fcf3dafb679fbbcbea6cc705e64ffe21521b4326))
* use latest tcr contract version ([437a2d8](https://github.com/kleros/gtcr/commit/437a2d86589860ab9da41b6064f912c8477814e4))

### [0.9.3](https://github.com/kleros/gtcr/compare/v0.9.2...v0.9.3) (2020-04-06)


### Features

* display arbitrator and dispute ID, if any ([3120e2e](https://github.com/kleros/gtcr/commit/3120e2ee8277149429b5a82b5b5e811209563b53))
* display timestamps for every request event, closes [#35](https://github.com/kleros/gtcr/issues/35) ([a5b3b95](https://github.com/kleros/gtcr/commit/a5b3b95cd8f2cd761890eab0f13cdbcaae6bab5f))
* for TCRs of TCRs, display information from the TCR. Closes [#30](https://github.com/kleros/gtcr/issues/30) ([4588b5f](https://github.com/kleros/gtcr/commit/4588b5f25f8f2f4a35459d1770e3e9320a79763f))
* update to latest contract version ([1267ff5](https://github.com/kleros/gtcr/commit/1267ff5bf9343630941f8e6575122595e3338c96))
* upgrade to latest contract version ([1b60ffe](https://github.com/kleros/gtcr/commit/1b60ffea910f9f1165ff3a2bc7257632e692ad74))
* use latest evidence display ([5d6b30c](https://github.com/kleros/gtcr/commit/5d6b30c5a763b1f5e0760265b67a354d13b0829a))


### Bug Fixes

* display correct listing criteria for listing badges and close [#38](https://github.com/kleros/gtcr/issues/38) ([4daa036](https://github.com/kleros/gtcr/commit/4daa0369c302d00d5616c5d8e7dbccf46f70c116))
* error handling and card styling ([b992f8c](https://github.com/kleros/gtcr/commit/b992f8c8cf9717d367b4179fc1bb6918ee351114))
* evidence subscription api call ([7ebef22](https://github.com/kleros/gtcr/commit/7ebef2257afc26620544e503338bef8772af1f1c))
* filter submission events by evidence group ID ([b59fdad](https://github.com/kleros/gtcr/commit/b59fdadac3d0c2a26bc15c074040fd35da84b428))
* handle network-based notifications ([a814116](https://github.com/kleros/gtcr/commit/a814116cf6355876de145dbfc46d8ccb1a93c138))
* hide badges already added from options. Closes [#37](https://github.com/kleros/gtcr/issues/37) ([75350d8](https://github.com/kleros/gtcr/commit/75350d816e5208bfe9cb543e7d4c523638fc8ae2))
* image selector aspect ratio ([30d8db3](https://github.com/kleros/gtcr/commit/30d8db38beb2a76f38fd971278f95ae5aefbc8c4))
* incorrect proptype check ([b9628f3](https://github.com/kleros/gtcr/commit/b9628f34e10ca02684789fc46cc318b233a09cf6))
* make whole card clickable ([f3fd3ca](https://github.com/kleros/gtcr/commit/f3fd3ca7ebf0d9f25d001094da12f9391135dcba))
* my challenges and my submissions filters ([2dbbe46](https://github.com/kleros/gtcr/commit/2dbbe46ebb81f1eff5a52e0a8979236655807a38))
* notification service api ([1514562](https://github.com/kleros/gtcr/commit/15145622534340061a5e8ad8e30dd930bd2cf4bf))
* sort items by oldest first ([1de8e20](https://github.com/kleros/gtcr/commit/1de8e2012437af23d2b54ed3534de53d93f00066))
* use latest tcr contract version ([437a2d8](https://github.com/kleros/gtcr/commit/437a2d86589860ab9da41b6064f912c8477814e4))

### [0.9.2](https://github.com/kleros/gtcr/compare/v0.9.1...v0.9.2) (2020-02-26)


### Features

* also display images on items view ([a952c66](https://github.com/kleros/gtcr/commit/a952c66e382934ea6893cf0d49f67cd1aea5d06e))
* make TCR Browser the default TCR ([1b781f2](https://github.com/kleros/gtcr/commit/1b781f242b1cda65f62d1f39a7335b65db276630))


### Bug Fixes

* allow jpeg as well ([1109899](https://github.com/kleros/gtcr/commit/11098992c38f8a3c6e9166bc43d5aa9b11a8ee4d))
* fetch items on switching tcrs. Closes [#36](https://github.com/kleros/gtcr/issues/36) ([b08a7ff](https://github.com/kleros/gtcr/commit/b08a7ff118616fbb88244b8b38b8c3d16479d5e0))

### [0.9.1](https://github.com/kleros/gtcr/compare/v0.9.0...v0.9.1) (2020-02-03)


### Features

* add arbitrator extra data to advanced options ([ef03cfc](https://github.com/kleros/gtcr/commit/ef03cfcbcc487dbc1a258fd9a0ffce598e81ccec))
* add gtcr logo ([1b84c78](https://github.com/kleros/gtcr/commit/1b84c7842bc488cfb2db2497bf79d3bd18612142))
* add related tcr configuration step to factory and logo selection ([88096b9](https://github.com/kleros/gtcr/commit/88096b903fcc4f811b2fcc1006119f3989a84cea)), closes [#22](https://github.com/kleros/gtcr/issues/22)
* add support for image columns and close [#28](https://github.com/kleros/gtcr/issues/28) ([1d3ffa1](https://github.com/kleros/gtcr/commit/1d3ffa1b7b228f4b27e6d06951b7592a4828ac56))
* allow setting email notification settings ([55883b0](https://github.com/kleros/gtcr/commit/55883b03c897e519f5f5942b1086eac0f1890630))
* allow submitting and enabling badges. Closes [#23](https://github.com/kleros/gtcr/issues/23), [#24](https://github.com/kleros/gtcr/issues/24) ([f985ff4](https://github.com/kleros/gtcr/commit/f985ff4aa55e2b13b399e226507976d118884517))
* allow users to withdraw fee contribution rewards ([26bde20](https://github.com/kleros/gtcr/commit/26bde205efea9edde1cee7371866de19d97d1197)), closes [#12](https://github.com/kleros/gtcr/issues/12)
* closes [#29](https://github.com/kleros/gtcr/issues/29), closes [#27](https://github.com/kleros/gtcr/issues/27), closes [#26](https://github.com/kleros/gtcr/issues/26) ([179e655](https://github.com/kleros/gtcr/commit/179e655cceaae260f9f4fd94e88d01f2e7d1408f))
* use factory contract for deployments and close [#25](https://github.com/kleros/gtcr/issues/25) ([8896901](https://github.com/kleros/gtcr/commit/8896901f26ffc7e9b2b3799d9cb01c8c72f7e186))
* use localstorage for user settings and field add hint ([c83d1c1](https://github.com/kleros/gtcr/commit/c83d1c115abeb75ba4af03f6d16a4ffc591c49f3))


### Bug Fixes

* don't display crowdfunding card if item is waiting ruling execution ([4233d78](https://github.com/kleros/gtcr/commit/4233d7881c51f3bede2a773a6486aa52abfb2ea8))
* don't require a tcr context for this for details card ([e93b879](https://github.com/kleros/gtcr/commit/e93b8794c6c14833e681c7159829b31c934d3f01))
* filter out empty items ([08cfd21](https://github.com/kleros/gtcr/commit/08cfd217bb0111740db2ad2f24fb12d51d9b07d2))
* incorrect property access and remove unused script ([24b3a35](https://github.com/kleros/gtcr/commit/24b3a3567807ccac9d412d965ae1d5f6d8288e5d))
* interface hashing ([fb28bb8](https://github.com/kleros/gtcr/commit/fb28bb85105ee1dc5a0474dd6fff8a1408347542))
* missing capital letter on description ([9c7b693](https://github.com/kleros/gtcr/commit/9c7b69307a72ac4f36ab71ccf7d94865496990ac))
* missing error handlers and lint issues ([d67239e](https://github.com/kleros/gtcr/commit/d67239efaef0963e8b31c6b4f7bfe1b8d75eee00))
* remove portis to avoid trackers and errors in brave ([dc31fbc](https://github.com/kleros/gtcr/commit/dc31fbc3d4fb46b9cf20c8c4ad0fa30219de09c9))
* request wallet connection before displaying form to user ([bae975a](https://github.com/kleros/gtcr/commit/bae975a80cbfdfdb6840ce323adb6dde02dbb1a7))
* the match file URI is not an identifier field ([7dbfa85](https://github.com/kleros/gtcr/commit/7dbfa8589121e27c7e8a95bea47424c12ebce9b3))
* typo and obsolete docs ([3f63978](https://github.com/kleros/gtcr/commit/3f63978f36f28181a6281101f1d0bf1a6e4a084a))
* typo in evidence display field name ([b0be379](https://github.com/kleros/gtcr/commit/b0be37980ed4acf32419914006715763a0c228bc))
* typo in field label ([c3a0723](https://github.com/kleros/gtcr/commit/c3a0723ebc8ae1f0e8593fa655de039be1b0daca))
* typos, labels and firefox styling issues ([b239552](https://github.com/kleros/gtcr/commit/b23955204011f0545a4e9642d2243e4ebaab7232))
* update evidence display and use env variable ([448dc4c](https://github.com/kleros/gtcr/commit/448dc4ccc3bf2750d4907c842c7230d7a9a9e777))

## [0.9.0](https://github.com/kleros/gtcr/compare/v0.8.0...v0.9.0) (2019-12-21)


### Bug Fixes

* notification information icon color ([abd71ab](https://github.com/kleros/gtcr/commit/abd71ab))


### Features

* notify network changes and close [#21](https://github.com/kleros/gtcr/issues/21) ([5db64fe](https://github.com/kleros/gtcr/commit/5db64fe))



## [0.8.0](https://github.com/kleros/gtcr/compare/v0.7.0...v0.8.0) (2019-12-21)


### Bug Fixes

* add gtcr address field type and close [#13](https://github.com/kleros/gtcr/issues/13) ([e056fed](https://github.com/kleros/gtcr/commit/e056fed))
* allow setting the challenge period duration and display units ([4c1fba2](https://github.com/kleros/gtcr/commit/4c1fba2))
* be rpc node agnostic ([94404b6](https://github.com/kleros/gtcr/commit/94404b6))
* blank meta evidence loaded from cache ([15bf7ac](https://github.com/kleros/gtcr/commit/15bf7ac))
* cannot navigate back from items view ([3ed124a](https://github.com/kleros/gtcr/commit/3ed124a))
* close [#17](https://github.com/kleros/gtcr/issues/17) and allow setting the governor on the factory ([db1c5a1](https://github.com/kleros/gtcr/commit/db1c5a1))
* close [#19](https://github.com/kleros/gtcr/issues/19) ([734f453](https://github.com/kleros/gtcr/commit/734f453))
* decoding error on tcr navigation ([39835e6](https://github.com/kleros/gtcr/commit/39835e6))
* display missing provider message on all routes ([58cd440](https://github.com/kleros/gtcr/commit/58cd440))
* error messages and submission log decoding error ([fc3856a](https://github.com/kleros/gtcr/commit/fc3856a))
* formatic popup and footer ([4ca1e43](https://github.com/kleros/gtcr/commit/4ca1e43))
* handle overflow in search results ([762839a](https://github.com/kleros/gtcr/commit/762839a))
* incorrect deposit math for requests and challenges ([36b488c](https://github.com/kleros/gtcr/commit/36b488c))
* incosistent casing in tx messages ([0d7954d](https://github.com/kleros/gtcr/commit/0d7954d))
* let user upload primary document on factory and close [#7](https://github.com/kleros/gtcr/issues/7) ([d64bf86](https://github.com/kleros/gtcr/commit/d64bf86))
* missing evidence after connecting a wallet ([c68a646](https://github.com/kleros/gtcr/commit/c68a646))
* missing key in search results ([2d6b157](https://github.com/kleros/gtcr/commit/2d6b157))
* outdated meta evidence when switching tcrs ([75d23e9](https://github.com/kleros/gtcr/commit/75d23e9))
* prevent crash on decoding errors ([3f14db2](https://github.com/kleros/gtcr/commit/3f14db2))
* set kleros as the default arbitrator and close [#20](https://github.com/kleros/gtcr/issues/20) ([62d23aa](https://github.com/kleros/gtcr/commit/62d23aa))
* update evidenceDisplayURI, hash and close [#11](https://github.com/kleros/gtcr/issues/11) ([5fab41b](https://github.com/kleros/gtcr/commit/5fab41b))
* use shared footer from @kleros/react-components ([0a55325](https://github.com/kleros/gtcr/commit/0a55325))


### Features

* add search bar and close [#14](https://github.com/kleros/gtcr/issues/14) ([ee5c9fe](https://github.com/kleros/gtcr/commit/ee5c9fe))
* display current network and fix missing logo ([6ed2bcb](https://github.com/kleros/gtcr/commit/6ed2bcb))
* footer from shared components ([b59737b](https://github.com/kleros/gtcr/commit/b59737b))
* implement in-app notifications ([d8b3cb1](https://github.com/kleros/gtcr/commit/d8b3cb1))
* save tcr information in metadata field of meta evidence file ([374c034](https://github.com/kleros/gtcr/commit/374c034))



### [0.7.1](https://github.com/kleros/gtcr/compare/v0.7.0...v0.7.1) (2019-11-13)


### Bug Fixes

* close [#19](https://github.com/kleros/gtcr/issues/19) ([734f453](https://github.com/kleros/gtcr/commit/734f453))
* incorrect deposit math for requests and challenges ([36b488c](https://github.com/kleros/gtcr/commit/36b488c))
* incosistent casing in tx messages ([0d7954d](https://github.com/kleros/gtcr/commit/0d7954d))
* set kleros as the default arbitrator and close [#20](https://github.com/kleros/gtcr/issues/20) ([62d23aa](https://github.com/kleros/gtcr/commit/62d23aa))
* update evidenceDisplayURI, hash and close [#11](https://github.com/kleros/gtcr/issues/11) ([5fab41b](https://github.com/kleros/gtcr/commit/5fab41b))



## [0.7.0](https://github.com/kleros/gtcr/compare/v0.5.0...v0.7.0) (2019-11-12)


### Bug Fixes

* build script and readme ([8b17ba0](https://github.com/kleros/gtcr/commit/8b17ba0))
* build script running out of memory ([aae9cd1](https://github.com/kleros/gtcr/commit/aae9cd1))
* card design ([1592a77](https://github.com/kleros/gtcr/commit/1592a77))
* crowdfunding progressbar percentage ([8125219](https://github.com/kleros/gtcr/commit/8125219))
* disputeID should be BN prop-type ([f717348](https://github.com/kleros/gtcr/commit/f717348))
* don't return anything if there are no required fees ([43a2e0b](https://github.com/kleros/gtcr/commit/43a2e0b))
* event listener in item list and details ([bd9127e](https://github.com/kleros/gtcr/commit/bd9127e))
* event missing listeners ([875764e](https://github.com/kleros/gtcr/commit/875764e))
* evidence files and close [#1](https://github.com/kleros/gtcr/issues/1) ([38d4f08](https://github.com/kleros/gtcr/commit/38d4f08))
* footer not sticking to bottom ([3f82a9d](https://github.com/kleros/gtcr/commit/3f82a9d))
* handle errors in tcr view ([3e4ea6b](https://github.com/kleros/gtcr/commit/3e4ea6b))
* handle waiting enforcement state ([fa14315](https://github.com/kleros/gtcr/commit/fa14315))
* ignore required fees for resolved items ([ad83eee](https://github.com/kleros/gtcr/commit/ad83eee))
* item status card header color ([95e2d6b](https://github.com/kleros/gtcr/commit/95e2d6b))
* meta evidence fields and closes [#10](https://github.com/kleros/gtcr/issues/10) ([b734bbe](https://github.com/kleros/gtcr/commit/b734bbe))
* missing primary document URI in challenge modal ([c379b7d](https://github.com/kleros/gtcr/commit/c379b7d))
* production build failing ([d422148](https://github.com/kleros/gtcr/commit/d422148))
* remove BN from window and update comments ([f3ac20e](https://github.com/kleros/gtcr/commit/f3ac20e))
* remove event listeners to avoid infinite rerender cycle ([816c2d4](https://github.com/kleros/gtcr/commit/816c2d4))
* remove item message ([f2c6953](https://github.com/kleros/gtcr/commit/f2c6953))
* setup listeners only after metaevidence is ready ([30b703b](https://github.com/kleros/gtcr/commit/30b703b))
* signed integer number encoding ([efce4ff](https://github.com/kleros/gtcr/commit/efce4ff))
* styling and word issues ([4349a97](https://github.com/kleros/gtcr/commit/4349a97))
* tcr deposit parsing ([5046918](https://github.com/kleros/gtcr/commit/5046918))
* word wrap and card display fields ([3dbd692](https://github.com/kleros/gtcr/commit/3dbd692))


### Features

* add action button ([d0a0cb4](https://github.com/kleros/gtcr/commit/d0a0cb4))
* add challenge and appeal periods countdowns ([3314750](https://github.com/kleros/gtcr/commit/3314750))
* add challenge request scaffolding ([c66ce11](https://github.com/kleros/gtcr/commit/c66ce11))
* add crowdfunding card ([1ac95d7](https://github.com/kleros/gtcr/commit/1ac95d7)), closes [#6](https://github.com/kleros/gtcr/issues/6) [#16](https://github.com/kleros/gtcr/issues/16) [#16](https://github.com/kleros/gtcr/issues/16)
* add deposit and listing criteria to submission modal ([978fbd6](https://github.com/kleros/gtcr/commit/978fbd6))
* add modals and initial tx scaffolding ([cb10a32](https://github.com/kleros/gtcr/commit/cb10a32))
* add relatedTCRR and organize mock contracts ([b310d48](https://github.com/kleros/gtcr/commit/b310d48))
* add resubmit flow ([fcc3ec6](https://github.com/kleros/gtcr/commit/fcc3ec6))
* add sorting and filter controls ([7f31620](https://github.com/kleros/gtcr/commit/7f31620))
* add support for challenges in the mock contracts ([4fde232](https://github.com/kleros/gtcr/commit/4fde232))
* add support for other wallets ([28bba46](https://github.com/kleros/gtcr/commit/28bba46))
* allow different deposits for different request/challenge types ([4972ec5](https://github.com/kleros/gtcr/commit/4972ec5))
* allow submitting evidence ([fd2406a](https://github.com/kleros/gtcr/commit/fd2406a))
* batch tcr information request ([c90a604](https://github.com/kleros/gtcr/commit/c90a604))
* cache tcr and meta evidence ([e14cb79](https://github.com/kleros/gtcr/commit/e14cb79))
* display current ruling and dispute status in item details view ([e6448ed](https://github.com/kleros/gtcr/commit/e6448ed))
* display item status in item list ([39f0cbb](https://github.com/kleros/gtcr/commit/39f0cbb))
* display requests timeline ([4d169b8](https://github.com/kleros/gtcr/commit/4d169b8))
* enable adding items and fetch items from TCR ([377a6b2](https://github.com/kleros/gtcr/commit/377a6b2))
* enable crowdfunding appeals ([8b43f73](https://github.com/kleros/gtcr/commit/8b43f73))
* enable executing pending requests ([cc756b1](https://github.com/kleros/gtcr/commit/cc756b1))
* enable removal requests ([e71c401](https://github.com/kleros/gtcr/commit/e71c401))
* evidence form and validation ([42353b6](https://github.com/kleros/gtcr/commit/42353b6))
* handle uri paging, filtering and sorting ([73a4072](https://github.com/kleros/gtcr/commit/73a4072))
* initial details view and status handling ([aa9def8](https://github.com/kleros/gtcr/commit/aa9def8))
* listen for events and refetch items to improve UX ([1df1201](https://github.com/kleros/gtcr/commit/1df1201))
* move findItem example to GTCRMock ([718e226](https://github.com/kleros/gtcr/commit/718e226))
* move submission modal to containers ([15520b7](https://github.com/kleros/gtcr/commit/15520b7))
* rename containers to pages ([047abbe](https://github.com/kleros/gtcr/commit/047abbe))
* rename tcr view context to avoid confusion ([b307ec4](https://github.com/kleros/gtcr/commit/b307ec4))
* request wallet connection and update latest tcr2 ([f910d3e](https://github.com/kleros/gtcr/commit/f910d3e))
* swap mock contract for gtcr package ([af7183c](https://github.com/kleros/gtcr/commit/af7183c))
* truncate ETH address in items view ([aa6fe61](https://github.com/kleros/gtcr/commit/aa6fe61))
* update theme colors ([e511d11](https://github.com/kleros/gtcr/commit/e511d11))
* update to latest color scheme ([67ef25a](https://github.com/kleros/gtcr/commit/67ef25a))
* update to latest contract ([98e4e0f](https://github.com/kleros/gtcr/commit/98e4e0f))
* update to latest contract version ([4eb282c](https://github.com/kleros/gtcr/commit/4eb282c))
* update to latest view contract ([fde6290](https://github.com/kleros/gtcr/commit/fde6290))
* upload evidence and challenge item ([ceac88e](https://github.com/kleros/gtcr/commit/ceac88e))
* use a grid of cards to display tcr items ([c8a7252](https://github.com/kleros/gtcr/commit/c8a7252))
* use addItem and removeItem proxy functions to avoid accidents ([a75568f](https://github.com/kleros/gtcr/commit/a75568f))
* use header banner ([cd39e25](https://github.com/kleros/gtcr/commit/cd39e25))
* use number input and cleanup code" ([c0044ab](https://github.com/kleros/gtcr/commit/c0044ab))
* use rlp encoding to store item data ([9668a95](https://github.com/kleros/gtcr/commit/9668a95))



## [0.6.0](https://github.com/kleros/gtcr/compare/v0.5.0...v0.6.0) (2019-08-05)


### Bug Fixes

* only try executing onTxMined if it was provided ([dfbd7b5](https://github.com/kleros/gtcr/commit/dfbd7b5))
* remove longtext for now ([01992eb](https://github.com/kleros/gtcr/commit/01992eb))
* sider link height ([d6d91e4](https://github.com/kleros/gtcr/commit/d6d91e4))
* use signed numbers ([cd0723d](https://github.com/kleros/gtcr/commit/cd0723d))


### Features

* add basic submission modal fields ([eead85e](https://github.com/kleros/gtcr/commit/eead85e))
* add item name field and require title and description ([a0108c2](https://github.com/kleros/gtcr/commit/a0108c2))
* add submit item button ([d5de495](https://github.com/kleros/gtcr/commit/d5de495))
* add upload criteria field ([934d8ad](https://github.com/kleros/gtcr/commit/934d8ad))
* build submission form from tcr metadata ([5ec7f56](https://github.com/kleros/gtcr/commit/5ec7f56))
* display identicon ([e7c7731](https://github.com/kleros/gtcr/commit/e7c7731))
* enable item submission, swap fixed length columns to abi encoding ([ec7cf5f](https://github.com/kleros/gtcr/commit/ec7cf5f))
* fetch and parse items from tcr ([af53a70](https://github.com/kleros/gtcr/commit/af53a70))
* get values from submission form ([a979072](https://github.com/kleros/gtcr/commit/a979072))
* remove prev block number and scan from 0 ([a4f743b](https://github.com/kleros/gtcr/commit/a4f743b))



## [0.5.0](https://github.com/kleros/gtcr/compare/v0.2.0...v0.5.0) (2019-07-31)


### Bug Fixes

* app manifest ([ecf9fc1](https://github.com/kleros/gtcr/commit/ecf9fc1))
* cancel connect to wallet modal ([28b6df4](https://github.com/kleros/gtcr/commit/28b6df4))
* dependency compatibility ([649b69d](https://github.com/kleros/gtcr/commit/649b69d))
* invalid fields message display on submit ([b9721a6](https://github.com/kleros/gtcr/commit/b9721a6))


### Features

* add 404 page ([0c55c77](https://github.com/kleros/gtcr/commit/0c55c77))
* add a view to get multiple items at once ([d054e70](https://github.com/kleros/gtcr/commit/d054e70))
* add clickaway side menu ([40bfd23](https://github.com/kleros/gtcr/commit/40bfd23))
* add env variables to netlify.toml and update docs ([0e41044](https://github.com/kleros/gtcr/commit/0e41044))
* add item column labels and id ([9925843](https://github.com/kleros/gtcr/commit/9925843))
* add proptypes checking ([ac637d0](https://github.com/kleros/gtcr/commit/ac637d0))
* add TCR table and handle fetching items ([686ee75](https://github.com/kleros/gtcr/commit/686ee75))
* add web3 connector ([79aca94](https://github.com/kleros/gtcr/commit/79aca94))
* allow custom error codes and messages for error page ([7071f56](https://github.com/kleros/gtcr/commit/7071f56))
* build and upload metadata on deploy ([5cbfecb](https://github.com/kleros/gtcr/commit/5cbfecb))
* cache steps and add item preview ([ad24ba8](https://github.com/kleros/gtcr/commit/ad24ba8))
* cache wizard state and enforce code styling ([59d8935](https://github.com/kleros/gtcr/commit/59d8935))
* connect through infura for viewing ([105e198](https://github.com/kleros/gtcr/commit/105e198))
* fetch meta evidence logs and file ([06d3b23](https://github.com/kleros/gtcr/commit/06d3b23))
* let user select which fields to display on the list view ([b4de368](https://github.com/kleros/gtcr/commit/b4de368))
* redirect to tcr2 from home ([74a1594](https://github.com/kleros/gtcr/commit/74a1594))
* remove redux files ([c87adae](https://github.com/kleros/gtcr/commit/c87adae))
* reset form on deploy click ([492b62d](https://github.com/kleros/gtcr/commit/492b62d))
* save wizard state ([22f683c](https://github.com/kleros/gtcr/commit/22f683c))
* support multiple tx submissions ([dbd664b](https://github.com/kleros/gtcr/commit/dbd664b))
* update contract to store deployment latest blocknumber ([199dfaf](https://github.com/kleros/gtcr/commit/199dfaf))



## [0.4.0](https://github.com/kleros/gtcr/compare/v0.2.0...v0.4.0) (2019-07-22)


### Bug Fixes

* app manifest ([ecf9fc1](https://github.com/kleros/gtcr/commit/ecf9fc1))
* dependency compatibility ([649b69d](https://github.com/kleros/gtcr/commit/649b69d))
* invalid fields message display on submit ([b9721a6](https://github.com/kleros/gtcr/commit/b9721a6))


### Features

* add clickaway side menu ([40bfd23](https://github.com/kleros/gtcr/commit/40bfd23))
* add item column labels and id ([9925843](https://github.com/kleros/gtcr/commit/9925843))
* add mock contract and enable deploying to kovan ([750afa9](https://github.com/kleros/gtcr/commit/750afa9))
* add proptypes checking ([ac637d0](https://github.com/kleros/gtcr/commit/ac637d0))
* add web3 connector ([79aca94](https://github.com/kleros/gtcr/commit/79aca94))
* cache steps and add item preview ([ad24ba8](https://github.com/kleros/gtcr/commit/ad24ba8))
* cache wizard state and enforce code styling ([59d8935](https://github.com/kleros/gtcr/commit/59d8935))
* footer and minor UI corrections ([5676289](https://github.com/kleros/gtcr/commit/5676289))
* remove redux files ([c87adae](https://github.com/kleros/gtcr/commit/c87adae))
* reset form on deploy click ([492b62d](https://github.com/kleros/gtcr/commit/492b62d))
* save wizard state ([22f683c](https://github.com/kleros/gtcr/commit/22f683c))



## [0.3.0](https://github.com/kleros/gtcr/compare/v0.2.0...v0.3.0) (2019-07-15)


### Bug Fixes

* app manifest ([ecf9fc1](https://github.com/kleros/gtcr/commit/ecf9fc1))
* dependency compatibility ([649b69d](https://github.com/kleros/gtcr/commit/649b69d))
* dependency compatibility ([ac9ef3e](https://github.com/kleros/gtcr/commit/ac9ef3e))
* invalid fields message display on submit ([b9721a6](https://github.com/kleros/gtcr/commit/b9721a6))
* merge changelog ([84b797b](https://github.com/kleros/gtcr/commit/84b797b))
* proptypes and enforce code style with linting ([bc5c724](https://github.com/kleros/gtcr/commit/bc5c724))


### Features

* add clickaway side menu ([40bfd23](https://github.com/kleros/gtcr/commit/40bfd23))
* add item column labels and id ([9925843](https://github.com/kleros/gtcr/commit/9925843))
* add proptypes checking ([ac637d0](https://github.com/kleros/gtcr/commit/ac637d0))
* also cache what step the user is on ([49314cc](https://github.com/kleros/gtcr/commit/49314cc))
* cache user input ([4439b7e](https://github.com/kleros/gtcr/commit/4439b7e))
* cache wizard state and enforce code styling ([59d8935](https://github.com/kleros/gtcr/commit/59d8935))
* remove redux files ([c87adae](https://github.com/kleros/gtcr/commit/c87adae))
* reset form on deploy click ([492b62d](https://github.com/kleros/gtcr/commit/492b62d))
* save wizard state ([22f683c](https://github.com/kleros/gtcr/commit/22f683c))



## 0.2.0 (2019-07-11)


### Bug Fixes

* field validation and item columns ([0160747](https://github.com/kleros/gtcr/commit/0160747))
* item columns validation ([2812d04](https://github.com/kleros/gtcr/commit/2812d04))
* lint issues and commitlint ([d270241](https://github.com/kleros/gtcr/commit/d270241))
* responsiveness on gutter ([867a3c3](https://github.com/kleros/gtcr/commit/867a3c3))
* responsiveness on item params ([e1ebf8f](https://github.com/kleros/gtcr/commit/e1ebf8f))


### Features

* add navbar and routing scaffolding ([7c42461](https://github.com/kleros/gtcr/commit/7c42461))
* add validation ([726ce22](https://github.com/kleros/gtcr/commit/726ce22))
* add validation and remove kathari ([a4f2d07](https://github.com/kleros/gtcr/commit/a4f2d07))
* reset forms and use formik ([2da41d0](https://github.com/kleros/gtcr/commit/2da41d0))
* save state and add prop-types checking ([8b3ef73](https://github.com/kleros/gtcr/commit/8b3ef73))
* wizzard steps preview ([f1109ea](https://github.com/kleros/gtcr/commit/f1109ea))



## 0.1.0 (2019-07-08)

### Features

- scaffold theme and navigation 2e8179d
