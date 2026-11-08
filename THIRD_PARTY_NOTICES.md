# Third-party notices

Small Tales application code is distributed under the root MIT license. Third-party components retain their own licenses.

## PDF.js worker files

`public/pdf.worker.mjs`, `public/pdf.worker.min.mjs`, and `public/pdf.worker.min.js` contain Mozilla PDF.js code with embedded copyright and Apache License 2.0 notices. Those headers are preserved. The unminified worker identifies version 4.8.69; the minified workers identify version 4.10.38. The public export retains these files unchanged.

- Copyright 2024 Mozilla Foundation (as stated in the bundled file headers).
- Project: [mozilla/pdf.js](https://github.com/mozilla/pdf.js).
- Official license: [PDF.js v4.10.38 LICENSE](https://github.com/mozilla/pdf.js/blob/v4.10.38/LICENSE).
- Included full license: [third-party/pdfjs-LICENSE.txt](third-party/pdfjs-LICENSE.txt).

No new claim of authorship is made over these files. Package dependencies have additional licenses in their own distributions; preserve their applicable notices when redistributing bundled builds.

## Dependency security backports

The maintained patch scripts modify the installed Zod 3.25.76 and deepmerge 4.3.1 distributions. Their original package licenses remain present after patching. Source-derived patch anchors and regression fixtures retain the following notices:

- Zod: Copyright (c) 2025 Colin McDonnell; MIT. Included license: [third-party/zod-LICENSE.txt](third-party/zod-LICENSE.txt). The early-bound-check backport follows [the upstream v4 repair](https://github.com/colinhacks/zod/commit/a0ebf97).
- deepmerge: Copyright (c) 2012 James Halliday, Josh Duff, and other contributors; MIT. Included license: [third-party/deepmerge-LICENSE.txt](third-party/deepmerge-LICENSE.txt). Guard and assignment changes address [the upstream report](https://github.com/TehShrike/deepmerge/issues/273).

These local modifications are not official vendor releases. See [the patch documentation](docs/security-dependency-patches.md) for scope, verification, and maintenance.
