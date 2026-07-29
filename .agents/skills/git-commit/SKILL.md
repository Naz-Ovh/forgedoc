---
name: git-commit
description: Generate a git commit message and ready-to-run git commit command from the actual staged/working diff. Use whenever the user asks for a commit message, commit command, "/git-commit", or "commit this"; supports one-line commits, detailed commits, single-repo projects, and monorepo scoped commit bodies.
---

# Git Commit

## Inspect

- Inspect `git status` and the relevant staged/working diffs before writing anything.
- Detect the actual change from the diff; do not guess from open tabs or filenames only.
- Exclude files the user explicitly says not to commit or not to include in the message.

## Pick Command Shape

- Use one line for one coherent intent, even when it touches several files.
- Use one line for focused updates such as one UI behavior change, repeated CSS cleanup, or one variable/API rename.
- Use a detailed commit for multiple independent intents, risky behavior changes, migrations, broad feature work, or context future readers need.

## Subject

- Treat the first `-m` as the commit subject. It must summarize the whole commit.
- For one-line commits, use Conventional Commits: `type(scope): concise summary`.
- For detailed commits, use a plain-English overall subject without `type(scope)`.
- Keep detailed subjects readable in `git log --oneline`, for example `Add passkey authentication support`.
- Prefer imperative mood when natural.

## Body

- Add a body only when it helps explain why the change was needed and what changed.
- Use a second `-m` argument for the body.
- Use literal newlines for paragraphs and bullets.
- Write the body paragraph in descriptive English.

## Monorepos

- If the repo is a monorepo or the diff spans apps/packages, prefer scoped body bullets: `type(scope): specific change`.
- Use concrete scopes from affected apps/packages/domains, such as `admin`, `server`, `website`, `docs`, or `shared`.
- Do not use vague labels like `Both`, `Frontend`, or `Backend` when concrete scopes exist.
- Sort scoped bullets by type, then scope, then importance.
- Prefer this type order: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `style`, `chore`.

## Single Repos

- For single-repo detailed commits, plain body bullets are fine.
- Keep bullets specific and ordered by importance.

## Guardrails

- Return only a ready-to-run `git commit` command.
- Do not include a `git add` command.
- Do not run the commit unless explicitly asked.
- Do not add AI or agent co-author lines.

## Templates

One-line:

```bash
git commit -m "type(scope): concise overall summary"
```

Detailed monorepo:

```bash
git commit -m "Plain-English overall summary" -m "Describe the problem or motivation and what the full commit changes in normal English.

- type(scope): first specific change
- type(scope): second specific change
- type(scope): third specific change"
```

Detailed single-repo:

```bash
git commit -m "Plain-English overall summary" -m "Describe the problem or motivation and what the full commit changes in normal English.

- type(scope): first specific change
- type(scope): second specific change
- type(scope): third specific change"
```

NOTE: you must give the git commit format inside `bash {...determined git commit format} `, do not give raw text. becuase output will be copied and pasted in terminal
