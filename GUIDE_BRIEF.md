# Brief: the interactive guide for Zeta World

Written Sunday 22 Nov 2026, about 2:45 PM, by the session that set up the site. It is for an agent starting with no other context. Everything you need is in this file or in a file it names. A second agent read this brief cold and checked its claims against the repo; its corrections are in.

**Deadlines.** The demo is at 8 PM tonight (Sundai Hack 150). Freeze features at 6:45 PM. `main` is the live site, so it must work at every moment between now and then.

## 1. The job

Turn the Zeta World home page from "a 3D scene with a text box" into a short guided climb that holds the visitor's hand:

1. It opens with an intro in the style of Alex's personal site: flowing ink lines, an italic greeting, and a few choices.
2. The visitor picks one, for example "get started" or "what the paper actually proved".
3. A step-by-step guide follows. Each step is one idea, one thing to do, and one thing that visibly responds. It climbs from "what is a prime" to "what was released in November 2026".
4. The 3D world that already exists is the centre of it, not a separate page.

Keep it short: ten steps at most, about five minutes end to end. Interactive beats long. A visitor who only clicks Next should still get the story.

## 2. What Alex asked for

His words, lightly trimmed:

> Right now it's not really that strong, please make it more interactive and a bit easier to understand. I really want it to be like a build up. It should have a nice intro [like] https://alex-lop.github.io/Alex_Lopez_Website/ and then be a kind of step by step guide. Really try and keep [to] my personal website of flowing lines initially and have an option of things to choose between initially (ideally a couple of options like "Get started", "What the actual paper proved" etc.) and then keep going. Please try and make it on the shorter side and have it be interactive, and really try and hold your hand as it goes through all of the problems, keeping in mind three.js and trying to make it as interactive as possible.

Earlier the same afternoon he also asked for the climb to "start off slow with basic understanding of number theory / group theory / abstract algebra and then build up to the actual proof".

How this brief reads that. These are assumptions; if one is wrong, Alex will say so, but do not stop to ask:

- "My personal website of flowing lines" means the look of the intro at the URL above. It does not mean hosting the guide on that site. The guide lives in this repo, on the Zeta World site.
- "The actual paper" means the proof of the Riemann hypothesis released as Lean code on 20 Nov 2026. Section 5.4 says what is and is not known about it.
- "Hold your hand through all of the problems" means every step tells the visitor exactly what to do and reacts when they do it. Small questions with instant answers are welcome.
- He is busy and multitasking at the hackathon. Make the decisions this brief leaves open, ship in slices, and report at the end.

## 3. Where things stand

**Live:** https://alex-lop.github.io/zeta-world/ . **Repo:** `Alex-lop/zeta-world`, public. GitHub Pages serves `main` from the repo root. A merge is live about 30 seconds later. There is no build step and no check between a push and the public page.

| File | What it is |
|---|---|
| `index.html` | The home page, about 225 lines. A dark full-screen three.js scene: the land of the zeta function from Re(s) = -0.5 to 1.5 and heights 0 to 237, a gold line at Re(s) = 1/2, pins on the first 100 zeros, a roll-call counter, and a text panel at the bottom left. The scene is one inline ES module, from line 62 to the end. |
| `PLAN.md` | The build plan for tonight, written and reviewed today. Steps 1 and 2 are done. Its appendix holds tested code you will need (section 6). |
| `docs/guide-content.json` | Checked text for a 28-step climb, plus sourced research on the 2026 results. Your fact base (section 6). |
| `learn.html` | The same climb as a plain long read, with an anchor for every step id. Link to it as "the long version"; do not rebuild it. |
| `landscape.html`, `main.js`, `zeta.js`, `docs/riemann_graph_v1.md` | A teammate's free zeta/xi explorer. Live. Not yours to edit. |
| `README.md` | Project intro with the dated status sentence. |
| `og.jpg` | Link-preview image, 1200 x 630. |
| `.nojekyll` | Turns Jekyll off. Leave it. |

Everything in this table is on `main`. If `ls docs/guide-content.json learn.html` fails in your worktree, stop and say so: the handoff commit has not landed.

Inside `index.html`'s module, in order: layout constants (`WIDTH`, `LEN`, `RISE`, `T_MAX = 237`, fog, pins), the 100-entry `ZEROS`, `zetaGrid()` (Euler-Maclaurin, the terrain's numbers), a zeta self-check, `xOf` and `zOf` (math coordinates to world coordinates), the terrain fill loop, a mesh self-check, the pins, `rollCall()`, the camera and `OrbitControls`, `resize()`, and the render loop. DOM ids in use: `world` (canvas), `count`, `proof-status`, `status`.

**Other people and sessions.**

- A teammate (GitHub `andrei-radulescu-banu`) merged PR #2 at 2:10 PM. His explorer is on `main` and live, and `index.html` links to it just after the `</details>` in the text panel.
- He now has **PR #6 open** (branch `andrei-devel`): more explorer tabs (L-functions, primes) and a `proof.html` page on the announced proof. It adds `dirichlet.js`, `primes.js`, `primesView.js`, `proof.html`, `proof.js` and `proofMath.js` at the repo root, and it changes `index.html`, `README.md`, `main.js`, `zeta.js` and his doc. GitHub reports it as conflicting with `main`. Resolving that is his job. Do not merge, edit or comment on it, and do not wait for it.
- His Primes tab and `proof.html` overlap steps 6, 9 and 10 of the guide below. Before you build those steps, read what he has, read-only: `gh pr view 6 --repo Alex-lop/zeta-world` and `gh pr diff 6 --repo Alex-lop/zeta-world`. The guide tells the short story in its own small interactives. His pages are the "go deeper" links from those steps, once they return 200 on the live site. Do not copy his code.
- The session that wrote `PLAN.md` is finished. The session that wrote this brief is finished too. `PLAN.md`'s "Two pages" section still calls PR #2 open; where it differs from this brief, this brief is right.

## 4. The intro to borrow

Open https://alex-lop.github.io/Alex_Lopez_Website/ and read its source. The repo is public, `Alex-lop/Alex_Lopez_Website`, and it is Alex's own, so reusing its code here is fine:

```sh
gh api repos/Alex-lop/Alex_Lopez_Website/contents/js/field.js -H "Accept: application/vnd.github.raw"
gh api repos/Alex-lop/Alex_Lopez_Website/contents/styles.css  -H "Accept: application/vnd.github.raw"
gh api repos/Alex-lop/Alex_Lopez_Website/contents/DESIGN.md   -H "Accept: application/vnd.github.raw" | sed -n '8,80p;256,293p'   # palette, type, motion
```

What that intro is made of:

- **The field of ticks** (`js/field.js`, 210 lines, a 2D canvas fixed behind the page). A grid of short vertical ink ticks, 26 px apart. Each tick springs toward a target angle: a slow idle wave, a lean while scrolling, and a turn toward the pointer and along its wake. Opacity runs from 0.08 to 0.35. It stops when idle and respects `prefers-reduced-motion`.
  - It needs `<canvas id="field">`, the `#field` rule from `styles.css`, and `--ink` on `:root`, which it reads once at load. So hide the canvas when the page goes dark; do not expect it to recolour.
  - To pause it from a button, set `data-motion="off"` on `<html>` and dispatch `motion:change` on `document`. The site's own toggle is in `js/site.js`, lines 545 to 567.
  - `window.__field.comb(x, y, angle)` turns the ticks within 140 px of (x, y) to `angle` (radians from vertical) for 800 ms, one point at a time.
  - Ticks rest upright and are all one colour.
- **Paper and ink.** Ground `#f5f5f0`, ink `#171613`, secondary ink `#55554f`, rule `#d8d7ce`, one blue accent `#1a5fff`.
- **Type.** IBM Plex Serif for the greeting and the choices, IBM Plex Sans for body. That repo ships `assets/fonts/IBMPlexSerif-400.woff2` (upright only) and four Plex Sans files, with `OFL.txt`. The site's italic is the browser's slant of the upright serif. To match it, copy that file and its `@font-face` rule from `styles.css` as they are, and copy the licence with them. The files are Latin subsets with no Greek and no maths symbols: ζ, π, σ, χ, √, ≤ and → will come from the fallback. Put Georgia next in the stack and check that a ζ beside Plex text looks deliberate.
- **The hub** (`.hub`, `.lists`, `.hub-sec`, `.hub-label`, `.hub-list` in `styles.css`). A centred italic greeting ("Helloooo, I'm Alex"), then rows of a grey italic label on the left, one thin vertical rule, and italic links on the right. A blue underline draws in from the left on hover.

The vertical rule and the ticks are that site's signature. Here the same stroke has a meaning: the critical line is a vertical line, and the claim is that every zero stands on it. Use that.

## 5. The experience to build

### 5.1 Intro and choices

The first screen is paper, ticks, a greeting in Alex's voice, and a rail of choices. It must appear at once, before any WebGL work starts.

Choices, at least these five. The labels are yours to word in the personal site's lowercase italic manner:

| Choice | Goes to |
|---|---|
| get started | step 1 of the climb |
| what the paper actually proved | the first step of the 2026 chapter |
| just let me fly | the 3D world with free controls, as the page is today |
| the explorer | `./landscape.html`, the teammate's page. It is live, and a link to it must survive on the home page |
| read / source | `learn.html` (the long version), `PLAN.md` on GitHub, the repo |

One suggestion for the hand-off from intro to guide, not a requirement: when a choice is made, the ticks swing upright, the centre column turns gold, and that column becomes the gold line of the world. The gold needs new code; `comb` cannot do it.

### 5.2 The climb

Every step has the same anatomy, so the visitor learns the rhythm once:

1. **A title and one sentence**, at most 25 words. The idea.
2. **One instruction**, in the imperative: "drag the slider", "type a number", "press the pin". Never more than one thing to do.
3. **One thing that responds** to that action, at once and visibly.
4. **A short payoff line**, at most 40 words, shown after the visitor has acted or after a few seconds if they have not.
5. **Next and Back**, a progress mark, and the step's name in the URL hash so a reload lands on the same step. Use names, not numbers, so cutting a step does not break a link.
6. **Keys.** The arrow keys and Space move between steps, but only when focus is not on a slider, text field or button. When one of those has focus, the keys belong to it.

At most 60 words on screen per step. Ten steps at most. If a step needs more words, it is two ideas: cut one. A step may link to its long version at `./learn.html#<step id>`.

### 5.3 Suggested steps

A starting point, built from what already exists. Reorder, merge or cut, but keep the two marked **must**.

| # | Idea | The visitor does | Build from |
|---|---|---|---|
| 1 | Primes are the atoms of whole numbers | types or taps a number and sees it split into primes | content `primes` |
| 2 | Primes look random, but their count is smooth | scrubs along a number line; a staircase climbs next to the smooth guess x / ln x. This staircase is the plain count of primes, one step of 1 at each prime: compute it directly. `psiTrue` and `psiK` in `PLAN.md` are a different staircase | content `irregular`, `counting` |
| 3 | One function knows every prime | drags the height t at a fixed real part above 1 (say 2); arrows 1/n^s chain head to tail and spin, and the chain closes in on zeta. Do not draw this on the critical line: the sum does not settle there | content `complex`, `euler-product`, `continuation` |
| 4 | Zeta as a landscape, zeros as wells | the paper gives way to the 3D world; drags to look around | the existing scene; content `landscape` |
| 5 | **must:** every well stands on one line | rides north up the road with a slider or the scroll wheel; a counter shows zeros passed | the existing scene; `PLAN.md` step 5 on moving the camera |
| 6 | **must:** the zeros build the primes | keeps riding; each zero passed adds a wave, and spikes rise at 2, 3, 5, 7, 11 | `spikes()` in the `PLAN.md` appendix; `PLAN.md` step 3; content `waves` |
| 7 | The hypothesis, and the walls closing in | steps through 1896 (walls at 0 and 1), October 2026 (slabs in to 1/8 and 7/8), and the line | `PLAN.md` step 4; content `strip`, `statement`, `y2026-october` |
| 8 | Sorting primes by remainder: groups and characters | turns a clock mod n and sees primes sorted into remainder classes; one character colours them | content stage `algebra`: `units`, `characters`, `l-functions` |
| 9 | 20 November 2026: what was released and what was checked | opens each of the four checks to see what it rules out and what it does not | content `y2026-release`, `y2026-checks` |
| 10 | The shape of the argument, and what is still needed | toggles primes into a number and watches its size be forced up, the idea the argument turns on | content `y2026-size`, `y2026-shape`, `y2026-needed` |

Steps 1 to 3 can stay on paper, drawn in ink on 2D canvases in the intro's style, and step 4 can be the moment the page goes dark and three-dimensional. That gives the three.js scene an entrance. It is a suggestion.

Step 8 is where the group theory and abstract algebra Alex asked for come in, and it is not decoration: the research found that one step of the 2026 argument averages over the characters of a finite abelian group. Keep it to one step. The heavier machinery the argument uses (theta lifts between unitary groups, Iwasawa theory, a relative trace formula) is named in step 10 and not taught.

### 5.4 "What the paper actually proved"

This choice lands on the first step of the 2026 chapter. It has to be honest above all. The content file has the facts with their sources. In short:

- **Released:** 20 Nov 2026, by the mathematician Levent Alpöge, working with Claude, Anthropic's AI model, as Lean code only. About 17 million lines. No paper.
- **The statement** is Mathlib's own definition `RiemannHypothesis`.
- **Four separate checks**, each ruling out a different way of being wrong: the statement is the right one, the code compiles, the code proves that statement, and independent checkers accept the exported proof. Two long-running checks were still in progress on 22 Nov.
- **Certified:** 21 Nov, in a joint statement of the Lean and Mathlib communities.
- **Scope:** the generalized hypothesis is covered for Dirichlet L-functions only.
- **Explained so far:** two third-party guides describe the shape of the argument. Neither proves its central inequality; both take it from the Lean code.
- **Not yet:** the author's paper, peer review, and a human account of the central inequality.
- **October 2026:** a separate, earlier result, released by OpenAI and checked in Lean: no zeros with real part above 7/8.

The site's status sentence is the paragraph with id `proof-status` in `index.html`. Copy it into the guide word for word, link included. It does not count toward the 60-word cap, and in the guide it must be visible at 390 px wide (today's page hides it there). The same sentence is in `learn.html` and `README.md`. If you change it, change all three and say so in your report.

### 5.5 Keep from the current page

- The 3D scene as it is: the land, the gold line, the 100 pins, the roll call, the start view. It was tuned today in a real browser. The reasons are in `PLAN.md` under "The world".
- Both `console.assert` self-checks. They must stay silent.
- The link-preview tags. Make a new 1200 x 630 `og.jpg` of the first screen in the last slice.
- A way to simply fly around with no guide.
- The link to the teammate's explorer.

## 6. Content: where every fact comes from

Do not write mathematics or news from memory. The events of October and November 2026 are after your training data.

**`docs/guide-content.json`** (168 KB: do not read it whole)

- `stages`: five stages, named by `key` (`numbers`, `zeta`, `hypothesis`, `algebra`, `proof`). Each has `steps`. Each step has `id`, `title`, `idea` (one sentence), `body` (paragraphs), and sometimes `formula`, `example`, `try_it`, `in_the_world` and `sources`.
- Every stage was written by one agent and checked by a second, who recomputed the examples and looked up the dates. `changes` and `unresolved` are lists on each stage, with most items prefixed by a step id. Read a stage's `unresolved` before using its steps.
- Strings contain inline HTML (`<sup>`, `<em>`, `<strong>`), so set them with `innerHTML`. Each `try_it` is a question and its answer separated by " — ".
- `research`: three reports, named by `key` (`argument`, `release`, `october`). Each has a `summary`, a list of `facts` with a `source_url` and a `basis` (`primary`, `third-party-exposition`, `press` or `unconfirmed`), `prerequisites`, and `not_yet_explained`.

```sh
jq -r '.stages[].steps[] | [.id, .idea] | @tsv' docs/guide-content.json      # every step in one line each
jq '.stages[].steps[] | select(.id=="waves")' docs/guide-content.json         # one step in full
jq -r '.stages[] | .key, (.unresolved[] | "  " + .)' docs/guide-content.json   # what the checkers could not verify
```

The file holds about 7,900 words of step text for a guide that should show about 500. Your job with it is to **cut**, not to add. Take the `idea` lines and the examples; leave the paragraphs to `learn.html`.

**`PLAN.md`**

- **Appendix, "tested code":** `spikes(x, T, zeros)`, the prime spikes for step 6; `psiK` and `psiTrue`, the weighted staircase; and the `ZEROS` table. All were run against mpmath today.
- **Step 3, "Zeros to primes":** how to draw the panel, measured counts of how many primes show at each height, and why the axis starts at 1.5.
- **Step 5, "The tour":** how to move the camera.
- **"The demo":** five tour captions, already reviewed for accuracy.
- **"Wording rules for captions".** Follow them.

**Wording rules that are not negotiable**

- Say "nontrivial zeros", or "zeros in this strip", wherever a sentence would be false for the zeros at -2, -4, -6.
- Never say flatly that the hypothesis is proved, or that it is unproved. Say what was released, what was checked, and what has not happened yet, with the date.
- A fact whose `basis` is `press` or `unconfirmed` is worded as a report, not as established.
- Do not explain anything the research lists under `not_yet_explained` as if it were understood.
- The page shows what the statement says. It proves nothing, and it says so.

## 7. Ground rules and traps

Each of these cost time today.

**Hosting**

- The site is served under `/zeta-world/`. Every local path is relative (`./guide/x.js`). A root-absolute path (`/guide/x.js`) is a 404. The Open Graph tags are the one exception: they need absolute URLs.
- No build step, no framework, no bundler, no package.json. Plain ES modules.
- three.js is pinned: `three@0.187.0` from jsDelivr through the import map in `index.html`. Add-ons come from `three/addons/`. Do not upgrade it today. `landscape.html` pins 0.160.0 for itself; leave that alone.
- Pages sends `cache-control: max-age=600`. After a merge, a browser that loaded the page in the last ten minutes can pair new HTML with an old module. When you change what a module exports, add or bump `?v=N` on its import URL in the same merge. Hard-reload on the demo machine before 8 PM.

**three.js 0.187**

- `OrbitControls.update()` ends by pointing the camera at `controls.target`, every frame, whether or not the controls are enabled. To move the camera under program control, ease `camera.position` and `controls.target` and keep calling `update()`. A rotation set by hand is overwritten.
- `PlaneGeometry(...).rotateX(-Math.PI / 2)` numbers its rows from the **north** end. The terrain is baked north to south for that reason. If you touch the bake, keep the mesh self-check.
- `THREE.Clock` is deprecated in this version. Use the timestamp the animation loop passes in.
- A second `const ZEROS` anywhere in the same module is a syntax error that blanks the page.

**The page**

- `<main>` has `pointer-events: none` so drags reach the canvas. Any button, slider or link inside it needs `pointer-events: auto`.
- In portrait, `resize()` frames the scene in the space above the text panel using `camera.setViewOffset`. If the panel's height changes, call `resize()` again.
- The road ends at height 237 on purpose: zeros 101 and 102 are at 237.77 and 239.56.
- `spikes` already returns 0 at T = 0. The hazard is x = 1, where ln x = 0 gives Infinity in `spikes`, `psiK` and x / ln x. Start every x axis at 1.5 or above.
- Start WebGL only when a step needs it, so the intro is instant and still works where WebGL does not.

**Motion and access**

- Honour `prefers-reduced-motion`, and give a visible "Pause motion" control as the personal site does.
- Everything reachable by keyboard. Visible focus. Body text at 4.5:1 contrast or better, on paper and on the dark scene.
- Check a phone in portrait (390 x 664) and in landscape (667 x 375).

**Staying out of the teammate's way**

Do not edit `landscape.html`, `main.js`, `zeta.js` or `docs/riemann_graph_v1.md`. Do not create `dirichlet.js`, `primes.js`, `primesView.js`, `proof.html`, `proof.js` or `proofMath.js`: PR #6 adds them. Put your modules in a folder of their own, `./guide/`. In `README.md`, edit only above `## Getting started`, plus the one `index.html` line under `## Running`. Before each merge:

```sh
git fetch origin && git diff --name-only origin/main...HEAD | grep -xE 'landscape\.html|main\.js|zeta\.js|dirichlet\.js|primes\.js|primesView\.js|proof\.html|proof\.js|proofMath\.js|docs/riemann_graph_v1\.md' && echo "TOUCHES TEAMMATE FILES" || echo clear
```

PR #6 also changes `index.html`, and so will you. You cannot avoid that conflict and should not try. Say in your report what you changed in `index.html` so he knows what to rebase onto.

## 8. How to work

**Shipping rule.** Work on a branch in a git worktree, so the main checkout stays on `main` and clean. Look at it locally with `python3 -m http.server 8000 --bind 127.0.0.1`. Open a PR with `gh pr create`. Merge from the main checkout, by number: `gh pr merge <number> --squash --delete-branch --repo Alex-lop/zeta-world`, then `git pull --ff-only` there. (Run from inside the worktree, the merge command fails trying to switch branches.) Check the deploy with `gh run list --repo Alex-lop/zeta-world --limit 1` and load the live URL once. If the live page is broken, revert first and debug after. Alex has asked for work to be pushed as it is done, so merging your own PRs is expected.

**Never break the front door.** Build the new experience at a new URL first, `guide.html`. Merge it early and often so Alex and his teammate can watch it grow. Make it the home page only at the end. The current `index.html` stays the home page until then.

**One scene, two pages.** The first merge of slice 1 is a refactor and nothing else: move the scene from `index.html`'s inline script into `./guide/scene.js`, exporting one function that takes the canvas and returns the camera, the controls and the zeros. `index.html` imports it and must look and behave exactly as before. Merge that alone and load the live page. `guide.html` then loads the same module with a dynamic `import()` when step 4 opens. Never keep two copies of `ZEROS` or `zetaGrid`.

**The swap.** The guide becomes `index.html`. "Just let me fly" is a state of that page at `#fly`, not a second HTML file. `guide.html` stays as a redirect to `./`. In `learn.html`, point the links to `./` at `./#fly`, since they are labelled "the 3D world".

**Slices, in order of what the demo needs.** Check the clock when you start. These budgets assume a 3 PM start and end at 6:30 PM.

| Slice | Contains | Budget |
|---|---|---|
| 1 | The scene refactor; then the intro (paper, ticks, greeting, choices) and the step shell (Next, Back, progress, hash, keys), with steps 4 and 5 driving the scene | 60 min |
| 2 | Step 6, the zeros building the primes. This is the centre of the demo | 50 min |
| 3 | Steps 9 and 10, the 2026 chapter | 40 min |
| 4 | Steps 1 to 3 on paper, then steps 7 and 8 | 30 min |
| 5 | The swap, phone and reduced-motion passes, README, `PLAN.md`, a new `og.jpg` | 30 min |

**Cut rules.**

- If slice 1 is not merged by 4:15 PM, drop the paper drawings for steps 1 to 3 and give those steps text and a small static figure.
- If slice 2 is not merged by 5:15 PM, stop everything else until it is.
- At 6:00 PM stop building steps and start slice 5 with what exists. Steps not built are cut, in this order: 8, 7, then 1 to 3.
- The swap is the last merge and must be merged by 6:45 PM. If slices 1 and 2 are not both live by 6:15 PM, do not swap: leave `index.html` as it is and add one link to `./guide.html` in its text panel.
- After 6:45 PM, reverts only.

**Checking in a browser.** If the Claude in Chrome tools are available, use them: load the local URL, read the console with pattern `.`, and take screenshots. That Chrome window is maximized and will not resize, so check phone sizes by injecting an `<iframe>` of the page at 390 x 664 and 667 x 375 into a local tab. Do not trigger `alert` or `confirm` dialogs.

**If you run agents in parallel,** these stages have earned their cost today: three independent designs for the intro and the step shell with a judge, before any code; an independent check of every sentence against `docs/guide-content.json` before each merge; and a cold reader who clicks only Next and reports where they got lost.

## 9. Done when

- **First screen:** paper ground, ticks that react to the pointer, an italic greeting, and at least five choices including "get started" and "what the paper actually proved". It is on screen within a second on a laptop and does not wait for WebGL.
- **The climb:** ten steps or fewer. Each has one sentence, one instruction, one interaction that visibly changes something, and Next and Back. The keys work as in 5.2. The hash holds the step. A cold visitor finishes in about five minutes.
- **The two must-haves:** one step rides the camera north up the road, and one step shows spikes rising at the primes as zeros are passed, with no prime given to the sum.
- **The 2026 chapter** is one click from the first screen. It shows the four checks and what is still needed, and carries the status sentence word for word.
- **Clean:** no console errors or warnings, both self-checks silent, reduced motion honoured with a pause control, usable at 390 x 664 and 667 x 375.
- **Honest:** every mathematical and news sentence on screen traces to `docs/guide-content.json` or `PLAN.md`.
- **Safe:** the teammate-file check prints `clear`, the live site was loaded after every merge, `#fly` still gives the plain 3D world, and the explorer link is still there.
- **Recorded:** `README.md` says what the home page now is, and `PLAN.md`'s "Where things stand" and "Two pages" are brought up to date.

## 10. Do not

- Add a build step, a framework or a dependency beyond three.js.
- Merge, edit or comment on PR #6, or touch the teammate's files listed in section 7.
- Change the status sentence or its date without saying so in your report.
- Post the project card on sundai.club, or anything else under Alex's name outside this repo.
- Put local file paths in committed files. The repo is public.
- Leave `main` broken to finish something.

## 11. Report back

When you stop, give Alex, in this order: the live URL and what a visitor now sees first; the PRs you merged, one line each; which steps of the climb are built and which were cut; what you did not test; and what you changed in `index.html` that the teammate must rebase PR #6 onto.
