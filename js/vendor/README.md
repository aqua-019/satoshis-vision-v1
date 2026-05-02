# Vendored libraries

This directory contains third-party libraries vendored locally to comply with xmr.irish's privacy posture (zero third-party network requests).

## three.module.js

- **Project:** Three.js
- **Version:** r128 (`REVISION = '128'`)
- **License:** MIT
- **Source:** https://github.com/mrdoob/three.js
- **Vendored from:** the official npm tarball at `https://registry.npmjs.org/three/-/three-0.128.0.tgz`, file `package/build/three.module.js`
- **Used by:** GenUI WebGL renderer (`js/genui/renderer-webgl.js`) via the importmap in `protocol-simulations.html`

### Why the unminified ESM build

Three.js r128 ships only an unminified ESM (`three.module.js`) — the minified ESM (`three.module.min.js`) was added to the official build pipeline in later releases. CDN distributions like cdnjs/jsdelivr/unpkg post-process r128 to produce `.min.js` themselves; using the canonical npm artifact here avoids depending on third-party transformations.

The file is ~1.1 MB unminified. Compression at the HTTP layer (gzip/brotli) brings the wire size to roughly 200 KB, which is comparable to the minified+compressed alternative for r128. Future GenUI work can re-vendor a minified build if the file size becomes a measurable problem.

### Notes

Three.js r128 was selected for compatibility with documented examples and to avoid r142+ APIs (CapsuleGeometry, etc.) that don't exist in this version. If a newer version is needed for v5.0, audit usage sites first.

### License excerpt

```
The MIT License

Copyright © 2010-2021 three.js authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction…
```

Full license text bundled at the head of `three.module.js`.
