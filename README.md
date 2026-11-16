# taskbound-site

The website for Taskbound: a landing page, the privacy policy and the web version of the app, served by GitHub Pages
(Settings > Pages > Deploy from a branch > `main`, folder `/`).

| Path | What it is |
|---|---|
| `index.html` | The landing page. Words and layout; its own styles are inline. |
| `js/world.js` | The night behind the page: the keep drawn as real Gaussian splats from the app's own sculpt (`app/keep-splat.js`), a painted sky with the ringed moon, smoke made of large soft splats and rising embers, all on a small pixel grid with ordered dithering. Scrolling turns the camera, pushes the smoke and wakes the keep's windows. Needs WebGL2; without it the page shows the flat painting. Reduced motion keeps it still. |
| `site.css` | Shared look: tokens from the app, framed gilt buttons, fonts. |
| `privacy.html` | Privacy policy (needed for the Play listing). |
| `app/` | The web version of Taskbound, copied from `offloadapps/taskbound` `dist/web`. |
| `img/shots/` | Phone screenshots of the app (390 x 844 at 2x). |
| `img/art/` | The four heroes, drawn by the app's `ART.hero`. |
| `fonts/` | Jacquard 24 (OFL), subset to Latin, for titles. |

## Updating the web version

In the `taskbound` repository run `python3 tools/build.py web`, then replace this repository's `app/` with
`dist/web/`. Keep `app/fonts/Jacquard24-Regular.ttf` and `app/fonts/OFL-Jacquard24.txt`: the app's `fonts.css` asks for
the font but the app repository doesn't have it yet. If the keep's sculpt changes, the landing page picks it up from
`app/keep-splat.js` with no other change.

Copied from `offloadapps/taskbound` at `1bf820c`.
