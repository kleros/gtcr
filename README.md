<p align="center">
  <b style="font-size: 32px;">Generalized Token Curated List</b>
</p>

<p align="center">
  <a href="https://standardjs.com"><img src="https://img.shields.io/badge/code_style-standard-brightgreen.svg" alt="JavaScript Style Guide"></a>
  <a href="https://conventionalcommits.org"><img src="https://img.shields.io/badge/Conventional%20Commits-1.0.0-yellow.svg" alt="Conventional Commits"></a>
  <a href="http://commitizen.github.io/cz-cli/"><img src="https://img.shields.io/badge/commitizen-friendly-brightgreen.svg" alt="Commitizen Friendly"></a>
  <a href="https://app.netlify.com/sites/kleros-v2-curate/deploys"><img src="https://api.netlify.com/api/v1/badges/172b66ab-d9f3-4c1f-9b29-f24653369655/deploy-status"></a>
</p>

## Get Started

1.  Clone this repo;
2.  Duplicate `.env.example` and rename it to `.env`. Fill the environment variables.
3.  Run `yarn` to install dependencies and then `yarn build:theme && yarn start` to start the dev server.

> Tested on node version 10.

## Supporting New Field Types

The Generalized TCR clients can learn how to parse and decode data stored onchain by reading what are the field types of each column from the `metadata` object stored on the meta evidence file.

### Important

To support a new field type, it is required to update the evidence display interface as well. Otherwise it might not know how to parse it and crash on arbitrator clients, preventing them from properly judging a case.

The evidence display interface code of the Generalized TCR can be found at [https://github.com/kleros/gtcr-injected-uis](https://github.com/kleros/gtcr-injected-uis).

## Other Scripts

- `yarn format` - Lint, fix and prettify all the project.
- `yarn run cz` - Run commitizen.
- `yarn run build` - Create a production build.

## Netlify Deployment

When setting up the repo for publishing on netlify:
1. Fill the env variables in netlify.toml;
2. Set the following environment variables on the site's build config in netlify's dashboard:
```
REACT_APP_RPC_URLS
REACT_APP_FORMATIC_API_KEYS
REACT_APP_NOTIFICATIONS_API_URL
```
