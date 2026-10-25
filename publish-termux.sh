#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

REPO="Bongoer/ksign-installer-slop"
if ! command -v pkg >/dev/null 2>&1; then
  echo 'This publish helper is for Termux.'
  exit 1
fi
if ! command -v git >/dev/null 2>&1 || ! command -v gh >/dev/null 2>&1; then
  echo 'Installing the missing Git/GitHub CLI tools...'
  pkg install -y git gh
fi
if ! gh auth status >/dev/null 2>&1; then
  echo 'Sign in to GitHub for Termux. Your ChatGPT GitHub connection does not sign in this terminal.'
  gh auth login --hostname github.com --git-protocol https --web
fi
if [ ! -d .git ]; then git init -b main; fi
git config user.name "Bongoer"
git config user.email "297351406+Bongoer@users.noreply.github.com"
git add .
if ! git diff --cached --quiet; then git commit -m "Publish KSign minimal for GitHub Pages"; fi
if gh repo view "$REPO" >/dev/null 2>&1; then
  git remote remove origin >/dev/null 2>&1 || true
  git remote add origin "https://github.com/$REPO.git"
  git push -u origin main
else
  gh repo create "$REPO" --public --source=. --remote=origin --push --description "Minimal KSign installer catalog for GitHub Pages"
fi
# Pages registration may not be allowed by the token; then manually select GitHub Actions source.
if gh api --method POST "repos/$REPO/pages" -f build_type=workflow >/dev/null 2>&1; then
  echo 'GitHub Pages registered for GitHub Actions.'
else
  echo 'If Pages is not enabled, open Settings > Pages > Source: GitHub Actions.'
fi
echo "Repository: https://github.com/$REPO"
echo "After the Pages workflow succeeds: https://Bongoer.github.io/ksign-installer-slop/"
