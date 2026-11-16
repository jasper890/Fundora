# Third-party dependency notices

Task 1 inventory recorded 16 November 2026 from `uv.lock`, installed Python distribution metadata, `package-lock.json`, and npm package metadata; Task 6 browser-test dependencies are listed separately. Version locks are authoritative; recheck licenses before public distribution. Playwright is a development-only browser test dependency, not shipped application code.

No third-party application source code was copied or adapted for this baseline. The separately installed agent skills retain their own upstream license files. Preserve the OpenSpec notice at [docs/OPENSPEC_LICENSE.txt](docs/OPENSPEC_LICENSE.txt). Later adapted Soroban snippets must record the pinned source, path, revision, changes, and required notice here.

## Python runtime and transitive packages

| Package | Version | License metadata |
|---|---:|---|
| annotated-types | 0.8.0 | MIT |
| asgiref | 3.13.0 | BSD-3-Clause |
| certifi | 2026.10.23 | MPL-2.0 |
| cffi | 2.1.1 | MIT-0 |
| charset-normalizer | 3.5.2 | MIT |
| Django | 5.2.19 | BSD-3-Clause |
| idna | 3.20 | BSD-3-Clause |
| mnemonic | 0.21 | MIT |
| psycopg | 3.3.9 | LGPL-3.0-only |
| psycopg-binary | 3.3.9 | LGPL-3.0-only |
| pycparser | 3.12 | BSD-3-Clause |
| pydantic | 2.14.3 | MIT |
| pydantic-core | 2.50.4 | MIT |
| PyNaCl | 1.6.2 | Apache-2.0 |
| requests | 2.34.2 | Apache-2.0 |
| requests-sse | 0.5.3 | Apache-2.0 |
| sqlparse | 0.6.1 | BSD License (package metadata) |
| stellar-sdk | 17.0.1 | Apache-2.0 |
| typing-inspection | 0.4.5 | MIT |
| typing_extensions | 4.16.0 | PSF-2.0 |
| tzdata | 2026.6 | Apache-2.0 |
| urllib3 | 2.8.0 | MIT |
| xdrlib3 | 0.1.1 | Apache Software License (package metadata) |

## Browser automation (development only)

| Package | Version | License metadata/files |
|---|---:|---|
| playwright | 1.64.1 | Apache-2.0 (`LICENSE`) |
| greenlet | 3.5.6 | MIT and PSF-derived source notices (`LICENSE`, `LICENSE.PSF`) |
| pyee | 14.0.0 | MIT |

## Browser bundle and build packages

| Package | Version | License metadata |
|---|---:|---|
| @stellar/freighter-api | 6.0.1 | Apache-2.0 |
| buffer | 6.0.3 | MIT |
| base64-js | 1.5.1 | MIT |
| ieee754 | 1.2.1 | BSD-3-Clause |
| semver | 7.7.1 | ISC |
| esbuild | 0.28.2 | MIT |
| @esbuild/* platform packages in the lockfile | 0.28.2 | MIT |
| typescript | 7.0.2 | Apache-2.0 |
| @typescript/typescript-* platform packages in the lockfile | 7.0.2 | Apache-2.0 |

Freighter API 6.0.1 is pinned by the implementation plan. Its published declaration files contain unresolved internal `@shared` type aliases and a Node `Buffer` type reference. `tsconfig.json` enables `skipLibCheck` for dependency declarations; ProofPay's own TypeScript remains in strict mode. The app's API imports and generated bundle build successfully, but this does not prove compatibility with an installed wallet or a Testnet signing flow.

License identifiers above are transcribed from the locked package metadata. Installed distributions carry their respective license files. Re-review bundled notices and distribution obligations before publishing; this local Testnet baseline is not a public release.
