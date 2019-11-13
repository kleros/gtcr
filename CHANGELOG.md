# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

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
