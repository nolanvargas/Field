# SVG `<img>` with `width/height: auto`

Org logos such as `assets/org-logos/sandbocks.svg` have a `viewBox` and no `width`/`height`. Chrome uses the viewBox as intrinsic size; Responsively’s Electron webviews often do not.

`max-height` / `max-width` never enlarge. In a flex row (`overflow: hidden`), the img can collapse (~24×5 for Sandbocks) while looking fine in Chrome/Brave.

Give the img a definite `height` and `flex-shrink: 0` (see `.field-compact-nav-org-logo`). Do not rely on `height: auto`. `BrandLogo` is fine because it sets HTML `width`/`height`.
