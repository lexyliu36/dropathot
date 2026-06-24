Create a ship branch from all uncommitted changes since main, commit them with a descriptive message, push, and return to main.

Steps:
1. Run `git status --short` and `git diff --name-only HEAD` to see what's changed
2. Generate a branch name: `ship/YYYY-MM-DD-HHMM` using the current date/time
3. Run `git checkout -b <branch>`
4. Run `git add -A`
5. Write a commit message that lists every changed file and a one-line summary of what changed in each (read the diffs to understand the changes — don't just list filenames)
6. Run `git commit -m "<message>"`
7. Run `git push -u origin <branch>`
8. If the push succeeds, run `git checkout main` and confirm success
9. If the push fails, report the error and stay on the branch
