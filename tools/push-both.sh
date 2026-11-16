#!/bin/sh
# Push the project to both places.
#   1. The organization (HEWAL3/imaginehewal3-26): the full, shared history.
#   2. Your personal repo (doanane/imaginehewal3-26-main), which Render deploys from: the same files, added as ONE new commit on top of
#      what is already there. The organization's older history contains keys that GitHub's push protection blocks, so the personal repo
#      never receives that history; it receives the current files only. Nothing is ever forced.
# Run from anywhere inside the repo, on the main branch:  git pushall
set -e
cd "$(git rev-parse --show-toplevel)"
BRANCH=main
if [ "$(git rev-parse --abbrev-ref HEAD)" != "$BRANCH" ]; then echo "Switch to $BRANCH first (git checkout $BRANCH)."; exit 1; fi
if [ -n "$(git status --porcelain)" ]; then echo "You have uncommitted changes. Commit them first."; exit 1; fi

echo "== 1/2 organization (HEWAL3) =="
git push hewal3 $BRANCH || echo "!! The organization push failed (see above). Continuing to your personal repo."

echo "== 2/2 personal repo (Render deploys from this) =="
git fetch origin
PARENT=$(git rev-parse origin/main)
TREE=$(git rev-parse $BRANCH^{tree})
if [ "$(git rev-parse origin/main^{tree})" = "$TREE" ]; then echo "Your personal repo already has these files."; exit 0; fi
MSG="Deploy: $(git log -1 --format=%s $BRANCH)"
COMMIT=$(git commit-tree "$TREE" -p "$PARENT" -m "$MSG")
git push origin "$COMMIT":refs/heads/main
git fetch origin
echo "Done. Render will redeploy from the personal repo."
