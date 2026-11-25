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

The build reads only the `REACT_APP_` variables listed in `.env.example`. The app does not render without `REACT_APP_REOWN_PROJECT_ID`, and it shows no Standard list without the Envio indexer URLs. Without `REACT_APP_ALCHEMY_API_KEY` it uses public RPC endpoints. The optional `REACT_APP_SUBGRAPH_KLEROS_DISPLAY_*_ENDPOINT` variables point at the Kleros Display subgraphs (The Graph), as on Scout, for court details; without them those details read from the court contract only.

## Before a Release

Two snapshots ship with the app and are refreshed by hand:

- `public/landing/data.js`: the figures the landing page draws before its live read answers. Open `/landing/`, wait until the activity panel reads "Live", run `copy(JSON.stringify(await window.CURATE_LANDING_LIVE, null, 2))` in the browser console and paste the result over the whole object in the file, minus its `live` field. Update the date in the file's header comment; never edit single figures by hand.
- `src/config/registry-creation-snapshot.json`: when each list was created. Run `node scripts/registry-creation-snapshot.mjs`; it reads `REACT_APP_ALCHEMY_API_KEY` from `.env`.

## Testing

`.github/workflows/tests.yml` runs both suites on every pull request.

- `yarn test`: unit tests for the app's logic (`src/**/*.test.ts`, in Node) and component tests (`src/**/*.test.tsx`, in jsdom with Testing Library), next to the code they cover. They read no `.env` and touch no network. `yarn test:watch` reruns them as you edit, `yarn test:coverage` writes `coverage/`.
- `yarn test:e2e`: browser tests (`e2e/`, Playwright) against a production build at desktop and phone size. Run `yarn playwright install chromium` once. The build talks to placeholder services (`e2e/e2e.env`), and every request is answered from `e2e/recordings`, so the tests need no keys and never spend the indexers' shared request budget. Each test also fails on a page error, a console error, a request with no recording, or a request to an unknown host. `yarn test:e2e:report` opens the last report. Each run builds the app first (about a minute); keep `yarn test:e2e:serve` running in another terminal and runs reuse it.
- `yarn test:e2e:record` re-records `e2e/recordings` against the real services named in your `.env`: run it when the app asks the services something new (the tests then fail with "requests with no recording"), and commit the result. It records the whole suite at once, because the browser clock is pinned to the time of the recording, and it keeps no secret: requests are filed under the variable that names their service, never under a URL. While recording, every list in an indexer's answer is cut to 25 rows.

A test that pins a known bug is written as `it.fails(…)` with a `// BUG:` comment: it passes while the bug is there and fails once it is fixed, as a reminder to make it a normal test.

## Supporting New Field Types

The Generalized TCR clients can learn how to parse and decode data stored onchain by reading what are the field types of each column from the `metadata` object stored on the meta evidence file.

### Important

To support a new field type, it is required to update the evidence display interface as well. Otherwise it might not know how to parse it and crash on arbitrator clients, preventing them from properly judging a case.

The evidence display interface code of the Generalized TCR can be found at [https://github.com/kleros/gtcr-injected-uis](https://github.com/kleros/gtcr-injected-uis).

## Other Scripts

- `yarn build` - Type check, then create a production build in `build/`.
- `yarn preview` - Serve the production build.
- `yarn typecheck` - Type check only (the app, its tests and `e2e/`).
- `yarn lint` - Lint the sources.
- `yarn format` - Lint, fix and prettify the sources.

## Netlify Deployment

`netlify.toml` sets the build command, the Node version and the public variables. Set the other variables from `.env.example` in the site's environment variables on Netlify.
