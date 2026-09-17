# fieldwm.com — landing mockups (pre-production)

Design-time static HTML/CSS for **fieldwm.com**. **Production site:** [`sites/www/`](../../sites/www/) (mockup **H** — hero + three roles). These folders stay for comparison; do not treat them as the deployable site. Round 3 alternates (I–K) and earlier rounds (A–G) remain for reference only.

## Open locally

From the repo root (you may already have this running):

```bash
npx serve mockups/fieldwm
```

| Mockup | URL |
|--------|-----|
| Hub | `/` |
| **H** — Hero + three roles | `/h-hero-and-roles/` |
| **I** — Full-bleed role bands | `/i-bleed-roles/` |
| **J** — Numbered sections | `/j-numbered-sections/` |
| **K** — Sidebar role map | `/k-sidebar-roles/` |
| **D** — Office + field split | `/d-office-field/` |
| **E** — Task lifecycle | `/e-lifecycle/` |
| **F** — Dispatch, crew, customer | `/f-three-roles/` |
| **G** — Fit check + showcase | `/g-fit-check/` |
| A — Quiet editorial | `/a-editorial/` |
| B — Product-adjacent | `/b-product/` |
| C — Utilitarian | `/c-utilitarian/` |

**H / production screenshots:** [`sites/www/assets/screenshots/`](../../sites/www/assets/screenshots/) — capture guide [`docs/AGENTS/mockup-h-screenshots.md`](../../docs/AGENTS/mockup-h-screenshots.md). Older mockups still use [`shared/ui-snippets.css`](shared/ui-snippets.css). Product positioning: [`shared/product-facts.md`](shared/product-facts.md).

**Forms do not submit.** Contact placeholder: `hello@fieldwm.com`.

---

## Round 3 — D + F hybrid

| Mockup | Layout idea |
|--------|-------------|
| **H** | D-style hero (web + mobile), then F’s three role cards with platform-specific device clusters |
| **I** | F copy in alternating full-width bands; each band shows desktop/mobile pairing where it matters |
| **J** | Sticky “web / mobile / links” bar; roles as 01–03 sections with dual-device visuals |
| **K** | Left sidebar: role jump links + platform legend; main column: hero cluster + three F sections |

Shared device layouts: [`shared/device-cluster.css`](shared/device-cluster.css).

## Round 2 — what each direction tests

| Mockup | Idea |
|--------|------|
| **D** | Hero = web task board + phone overlay; yes/no fit lists |
| **E** | One task through create → assign → field → proof (visual per step) |
| **F** | Three audiences (dispatch, crew, customer) with UI per role |
| **G** | Fit gate first, then three-panel “what you get” |

---

## Round 3 decision

**H** — hero + three role cards; real app screenshots; pitch on product merits (no pain-point copy).

---

## Still omitted (all rounds)

- Stock photos, 3D heroes, icon feature grids, logo strips, fake metrics
- Full-page gradients (logo mark only where already used)
- Carousels, chat widgets, tabbed “solutions”

---

## File layout

```
mockups/fieldwm/
  h-hero-and-roles/
  i-bleed-roles/
  j-numbered-sections/
  k-sidebar-roles/
  shared/device-cluster.css, role-sections.css
  d-office-field/
  e-lifecycle/
  f-three-roles/
  g-fit-check/
  shared/ui-snippets.css, contact-footer.css, product-facts.md
  a-editorial/ … c-utilitarian/   # round 1
```

Not wired into the Vite app or Capacitor build.
