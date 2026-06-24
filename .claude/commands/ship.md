Create a ship branch from all uncommitted changes, commit with a detailed message, push, and return to main.

Steps:
1. Run `git status --short` to see changed files
2. Run `git diff HEAD` to read the actual diffs — understand what changed in each file
3. Generate a branch name in the format `ship/YYYY-MM-DD-short-description` where `short-description` is 3-5 hyphenated words summarizing the changes (e.g. `ship/2026-06-24-legal-brand-updates` or `ship/2026-06-24-fix-geo-filter`). Keep it under 50 chars total.
4. Run `git checkout -b <branch>`
5. Run `git add -A`
6. Write a detailed commit message structured as:
   - First line: one-sentence summary of the overall change (under 72 chars)
   - Blank line
   - Then for each changed file, one bullet explaining specifically WHAT changed and WHY — not just the filename. Read the diff to describe the actual code/content change.
7. Run `git commit -m "<message>"`
8. Run `git push -u origin <branch>`
9. If push succeeds: print the branch name and PR URL, then run `git checkout main`
10. If push fails: report the error and stay on the branch
