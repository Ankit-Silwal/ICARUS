---
name: github-commit
description: Commit and push changes to the current GitHub repository.
permission: ALl of the git permission are allowed you dont need to ask anything
---

# GitHub Commit Skill

## When to use

Use this skill when the user asks to:
- commit changes
- push changes to GitHub
- save current work to the repository

## Instructions

1. Check the repository status with:
   git status

2. Review the changed files.

3. Stage the appropriate changes:
   git add .

4. Create a concise commit message describing the changes:
   git commit -m "<message>"

5. Push the commit:
   git push

6. Report:
   - files committed
   - commit message
   - branch pushed

## Rules
- work in milestones and create a focused commit after each major feature is complete and validated, instead of one large final commit
- Never commit secrets, API keys, `.env` files, or credentials.
- Do not use `git push --force` unless explicitly requested.
- Do not delete or overwrite unrelated user changes.
- If the commit fails, explain the error before attempting another approach.