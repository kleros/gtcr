# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

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
