# Manual step required before Phase 5 simulations will run

This placeholder exists because the build sandbox cannot reach cdnjs.cloudflare.com. The vendored Three.js r128 ESM build needs to be fetched manually:

curl -sL https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.min.js -o js/vendor/three.module.min.js

After fetch, verify the file is approximately 600KB and contains valid JavaScript (not an HTML error page). Then delete this placeholder file and commit three.module.min.js. The protocol-simulations page won't render WebGL content until this file exists, but the page shell, engine scaffolding, and SVG fallback will all work without it.
