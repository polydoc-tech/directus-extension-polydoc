# Changelog

This file starts at 0.1.4. The changes of earlier versions are in the git history between
the version tags (https://github.com/polydoc-tech/directus-extension-polydoc/tags). 0.1.0 is
on npm without a tag. Dates are the npm publish date, in UTC.

## 0.1.4 - 2026-06-18

- The Advanced (JSON) option is merged into the request without its `__proto__`,
  `constructor` and `prototype` keys, a guard against prototype pollution.
- `examples/import.mjs` loads one of the example Flows into a Directus instance through the
  Flows API, since Directus has no one-click Flow import. It is in the repository, not in
  the npm package.
