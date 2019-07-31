<p align="center">
  <b style="font-size: 32px;">Generalized Token Curated List</b>
</p>

<p align="center">
  <a href="https://standardjs.com"><img src="https://img.shields.io/badge/code_style-standard-brightgreen.svg" alt="JavaScript Style Guide"></a>
  <a href="https://conventionalcommits.org"><img src="https://img.shields.io/badge/Conventional%20Commits-1.0.0-yellow.svg" alt="Conventional Commits"></a>
  <a href="http://commitizen.github.io/cz-cli/"><img src="https://img.shields.io/badge/commitizen-friendly-brightgreen.svg" alt="Commitizen Friendly"></a>
</p>

## Get Started

1.  Clone this repo;
2.  Duplicate `.env.example` and rename it to `.env`. Fill the env variables.
3.  Run `yarn` to install dependencies and then `yarn start` to start the dev server.

## Other Scripts

- `yarn run prettify` - Apply prettier to the entire project.
- `yarn run lint` - Lint the entire project's .js files.
- `yarn run cz` - Run commitizen.
- `yarn run build` - Create a production build.

## Netlify Deployment

When setting up the repo for publishing on netlify:
1. Fill the env variables in netlify.toml;
2. Set the REACT_APP_INFURA_PROJECT_ID environment variable via the netlify UI.