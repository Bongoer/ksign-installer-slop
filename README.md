# ksign-installer-slop

Minimal KSign installer catalog, adapted from the approved clean v5 design for **GitHub Pages**.

### Deploy on GitHub Pages

1. Create a public repository named `ksign-installer-slop` with **no generated README**.
2. Upload the entire contents of this folder, including `.github/workflows/pages.yml`, to the default `main` branch.
3. Go to **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. The **Publish KSign Pages** workflow deploys the site (or run it manually from **Actions**).
5. Site URL: `https://Bongoer.github.io/ksign-installer-slop/` after successful deployment.

This is **static hosting**: the old Node server and `/api/catalog` are NOT used. `site/catalog.json` is fetched by browsers every **two minutes** while the page remains open. GitHub Actions checks the AppleJr source on a five-minute cron (the shortest GitHub supports), saves updates to `site/catalog.json`, and publishes the new site. Scheduled runs may be delayed, and changes won't be instantaneous.

If AppleJr cannot be fetched or the extraction output is incomplete, the previously saved list remains available. Links are supplied from the source where available; missing direct install links point to the source rather than masquerading as working downloads.

### Test locally (no npm install needed)

```bash
cd site
python -m http.server 8507
```

Then visit `http://localhost:8507`.

### Project layout

- `site/`: all published Pages files (simple light-mode v5 design)
- `site/catalog.json`: client-readable catalog snapshot
- `lib/scrape.mjs`: HTML extraction helper
- `scripts/update-catalog.mjs`: updater for scheduled workflow
- `.github/workflows/pages.yml`: updater and site deployment
- `tests/`: parser tests

Not affiliated with Apple, AppleJr, or the KSign developers.

### Optional: publish directly from Termux

The connected ChatGPT GitHub integration can't create repositories. As an alternative, the included `publish-termux.sh` can create the exact public repo and push the files through the official GitHub CLI (which requires a separate interactive GitHub sign-in in Termux):

```bash
bash publish-termux.sh
```

It installs `git` and `gh` in Termux if missing; no npm packages are required. The initial Pages settings may still require selecting **GitHub Actions** manually.
