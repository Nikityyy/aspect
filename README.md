# Aspect

Aspect is a bilingual, browser-local adult autism screening assessment. It is a screening tool, not a diagnosis. The scoring model is provisional and has not been clinically validated.

## Publish on GitHub Pages

The website is already a static site in the repository root. It has no server-side code, install step, build step, or runtime dependency on npm.

1. Push the repository to GitHub.
2. Open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, select the branch to publish, and choose **/(root)**.

The app, BeerCSS stylesheet, Material Symbols fonts, assessment questions, and translations are all served from this repository. Site paths are relative, so the same files work on a GitHub Pages project URL.

## Run locally

From the project folder, run a static file server, for example:

```sh
python3 -m http.server 4173
```

Then open `http://localhost:4173`. The app saves answers and result history in this browser on this device. It does not upload them.

## Design library

The UI uses [BeerCSS](https://www.beercss.com/) 5.0.3 components, responsive utilities, Material 3 theme, and locally served Material Symbols. The BeerCSS MIT license is included at `vendor/beercss/LICENSE`. BeerCSS JavaScript and Material Dynamic Colors are optional; this site uses the CSS library with native HTML elements.

## Scoring checks

The scoring unit tests can be run with Node.js:

```sh
node --test src/tests/*.test.js
```
