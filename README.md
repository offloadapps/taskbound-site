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

Only through a **release**: the Release workflow in `offloadapps/taskbound` (run only when the developer asks) publishes a
numbered APK and then copies `dist/web` into `app/` here, committed as `Taskbound <app.taskbound@gmail.com>`
("Web version: Taskbound <version>"). Ordinary pushes to taskbound don't touch the site. It uses the deploy key described
in the taskbound README ("Builds, releases and the website"). Don't edit `app/` by hand: the next release replaces it.
If the keep's sculpt changes, the landing page picks it up from `app/keep-splat.js` with no other change.
