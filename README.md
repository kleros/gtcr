<p align="center">
  <b style="font-size: 32px;">Generalized Token Curated List</b>
</p>

<p align="center">
  <a href="https://standardjs.com"><img src="https://img.shields.io/badge/code_style-standard-brightgreen.svg" alt="JavaScript Style Guide"></a>
  <a href="https://conventionalcommits.org"><img src="https://img.shields.io/badge/Conventional%20Commits-1.0.0-yellow.svg" alt="Conventional Commits"></a>
  <a href="http://commitizen.github.io/cz-cli/"><img src="https://img.shields.io/badge/commitizen-friendly-brightgreen.svg" alt="Commitizen Friendly"></a>
  <a href="https://app.netlify.com/sites/gtcr-dev/deploys"><img src="https://api.netlify.com/api/v1/badges/ff0eb1e7-e70c-4319-9e5c-f8532b053900/deploy-status"></a>
</p>

## Get Started

1.  Clone this repo.
2.  Use Node 20.19 (`NODE_VERSION` in `netlify.toml`) and run `corepack enable`, so that the Yarn version `package.json` names (`packageManager`) is the one that runs.
3.  Run `yarn` to install the dependencies.
4.  Copy `.env.example` to `.env` and fill it in (see below).
5.  Run `yarn dev` and open http://localhost:3000. The landing page is at http://localhost:3000/landing/.

## Environment Variables

The build reads only the `REACT_APP_` variables listed in `.env.example`. The app does not render without `REACT_APP_REOWN_PROJECT_ID`, and it shows no Standard list without the Envio indexer URLs. Without `REACT_APP_ALCHEMY_API_KEY` it uses public RPC endpoints.

## Before a Release

Two snapshots ship with the app and are refreshed by hand:

- `public/landing/data.js`: the figures the landing page draws before its live read answers. Open `/landing/`, wait until the activity panel reads "Live", run `copy(JSON.stringify(await window.CURATE_LANDING_LIVE, null, 2))` in the browser console and paste the result over the whole object in the file, minus its `live` field. Update the date in the file's header comment; never edit single figures by hand.
- `src/config/registry-creation-snapshot.json`: when each list was created. Run `node scripts/registry-creation-snapshot.mjs`; it reads `REACT_APP_ALCHEMY_API_KEY` from `.env`.

## Supporting New Field Types

The Generalized TCR clients can learn how to parse and decode data stored onchain by reading what are the field types of each column from the `metadata` object stored on the meta evidence file.

### Important

To support a new field type, it is required to update the evidence display interface as well. Otherwise it might not know how to parse it and crash on arbitrator clients, preventing them from properly judging a case.

The evidence display interface code of the Generalized TCR can be found at [https://github.com/kleros/gtcr-injected-uis](https://github.com/kleros/gtcr-injected-uis).

## Other Scripts

- `yarn build` - Type check, then create a production build in `build/`.
- `yarn preview` - Serve the production build.
- `yarn typecheck` - Type check only.
- `yarn lint` - Lint the sources.
- `yarn format` - Lint, fix and prettify the sources.

## Netlify Deployment

`netlify.toml` sets the build command, the Node version and the public variables. Set the other variables from `.env.example` in the site's environment variables on Netlify.
