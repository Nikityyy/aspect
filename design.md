# Aspect interface system

This file is the shared visual contract for every screen in Aspect. The app is a private, browser-local adult screening flow, not a marketing site. Keep the consent, questionnaire, result, history, and method screens within the same system.

## Product and structure

- Audience: adults 18 and over who want to reflect on autistic traits.
- Main task: understand what the screening can and cannot say, then decide whether to begin.
- Sequence: introduction → consent → questions → results → method and limitations. History and local-data controls remain available from the header and footer.
- Macrostructure: **Assessment Flow**. The familiar marketing-page templates do not fit a sensitive, task-led questionnaire.
- Tone: clear, calm, direct, and non-clinical. Do not claim diagnosis, validated accuracy, probability, or superiority.
- Preserve the existing question bank, scoring behavior, language choice, local storage, history, and result export.

## Design system

- Library: BeerCSS 5.0.3, checked into `vendor/beercss/`; use its Material 3 roles and components. Do not add a package install or build requirement.
- Theme: use BeerCSS 5.0.3's built-in Material 3 light color scheme and semantic tokens without a hand-built override theme.
- Components and layout: use BeerCSS elements (`article`, `dialog`, `progress`, `grid`, `row`, `list`, `nav`) and its component modifiers and responsive utilities. Do not add app-specific visual component rules.
- Type and icons: use BeerCSS typography and its locally served Material Symbols. Do not add custom font scales or remote fonts.
- Color, shape, spacing, elevation, and control states come from BeerCSS. The app adds no stylesheet or component-specific CSS.
- Motion: switch screens immediately; smooth scrolling respects `prefers-reduced-motion`.

## Interaction and content

- Keep one obvious primary action on the introduction screen. Show the assessment scope as a short, text-first list; avoid decorative chips, repeated cards, and template-like step graphics.
- Language switching remains visible in the top bar at every width. Use native buttons with `aria-pressed` state.
- All important controls have at least 44 px targets, a visible keyboard focus ring, and understandable disabled / selected states.
- Keep answer choices native radios styled through BeerCSS. Use native `dialog` elements for history and confirmation.
- Put the adult-only, screening-only, provisional-model, and local-storage limits in plain language before or alongside starting.
- Keep English and German UI copy equivalent. Avoid unsupported claims such as “best”, “accurate”, or “comprehensive”.

## Responsive and accessibility requirements

- Use BeerCSS responsive grid utilities and its built-in breakpoints. Check widths 320, 375, 414, 768, and desktop.
- Keep the assessment readable at narrow widths: responses stack on phones, use three columns on tablets, and six BeerCSS grid slots on desktop.
- Do not add layout overrides for BeerCSS overflow behavior. Headings and translated strings must wrap without forcing horizontal scrolling.
- Keep reading order and keyboard order aligned. Never make a click target wrap multiple unrelated controls.
- Check both locales, keyboard navigation, reduced motion, focus visibility, and 200% zoom.

## Static delivery

The site must remain a static GitHub Pages project served from the repository root. BeerCSS, fonts, JSON, and ES modules are local files. No runtime npm, bundler, server, remote font, telemetry, or answer upload may be introduced.
