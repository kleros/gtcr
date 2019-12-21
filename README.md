<p align="center">
  <b style="font-size: 32px;">Generalized Token Curated List</b>
</p>

<p align="center">
  <a href="https://standardjs.com"><img src="https://img.shields.io/badge/code_style-standard-brightgreen.svg" alt="JavaScript Style Guide"></a>
  <a href="https://conventionalcommits.org"><img src="https://img.shields.io/badge/Conventional%20Commits-1.0.0-yellow.svg" alt="Conventional Commits"></a>
  <a href="http://commitizen.github.io/cz-cli/"><img src="https://img.shields.io/badge/commitizen-friendly-brightgreen.svg" alt="Commitizen Friendly"></a>
  <a href="https://app.netlify.com/sites/ecstatic-jackson-749344/deploys"><img src="https://api.netlify.com/api/v1/badges/ff0eb1e7-e70c-4319-9e5c-f8532b053900/deploy-status"></a>
</p>

## Get Started

1.  Clone this repo;
2.  Duplicate `.env.example` and rename it to `.env`. Fill the environment variables.
3.  Run `yarn` to install dependencies and then `yarn start` to start the dev server.

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
REACT_APP_PORTIS_DAPP_ID
REACT_APP_NOTIFICATIONS_API_URL
```