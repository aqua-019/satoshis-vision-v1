# Vendored libraries

This directory contains third-party libraries vendored locally to comply with xmr.irish's privacy posture (zero third-party network requests).

## three.module.min.js

- **Project:** Three.js
- **Version:** r128
- **License:** MIT
- **Source:** https://github.com/mrdoob/three.js
- **Vendored from:** https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.min.js (one-time fetch; not loaded at runtime)
- **Used by:** GenUI WebGL renderer (`js/genui/renderer-webgl.js`)

### Status: PENDING MANUAL FETCH

The build sandbox used for the foundation commit (Prompt S) does not have
egress access to `cdnjs.cloudflare.com`. The actual `three.module.min.js`
binary has not yet been committed. See `THREE_JS_PLACEHOLDER.md` in this
directory for the manual fetch instructions. Until the binary is in place,
the WebGL renderer (`js/genui/renderer-webgl.js`) parses fine but its
`import * as THREE from 'three'` will 404 at runtime; the page shell never
exercises that path because no simulation is mounted yet.

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

Full license text bundled in three.module.min.js.
