---
name: setup-obsidian
description: Configure Obsidian vault integration — set vault path, create project folder, symlink memory directory
argument-hint: "[optional: vault path]"
disable-model-invocation: true
---

Set up Obsidian integration for this project.

## Step 1: Get the vault path

Check if `obsidianVaultPath` is already set in `settings.local.json` (project-level `.claude/settings.local.json` first, then user-level `~/.claude/settings.local.json`).

If already set, confirm with the user:
> Obsidian vault is configured at: `<path>`. Use this path? (yes / new path)

If not set, or if the user provided a path as $ARGUMENTS, use that path. Otherwise ask:
> What is the absolute path to your Obsidian vault? (e.g. `/Users/you/Documents/MyVault`)

## Step 2: Validate the vault

Verify the path exists and is an Obsidian vault:
- Run: `ls "<vault_path>/.obsidian"` — if `.obsidian/` folder exists, it's a valid vault
- If `.obsidian/` doesn't exist, tell the user:
  > That path doesn't appear to be an Obsidian vault (no `.obsidian/` folder found). Please check the path and try again.
  Then stop.

## Step 3: Determine project name

Extract the project name from the current working directory:
- Use the last component of the current directory path (e.g. `/Users/me/Dev/SpotHopper` → `SpotHopper`)
- Confirm with the user:
  > Project name for Obsidian folder: `<name>`. This will create `Claude/<name>/memory/` in your vault. OK? (yes / different name)

## Step 4: Create vault folder structure

```bash
mkdir -p "<vault_path>/Claude/<project_name>/memory"
```

## Step 5: Set up memory symlink

First, determine the Claude Code memory path for this project. The memory path follows the pattern:
```
~/.claude/projects/<encoded-project-path>/memory
```

Where `<encoded-project-path>` is the absolute project path with `/` replaced by `-` (e.g. `/Users/me/Dev/SpotHopper` becomes `-Users-me-Dev-SpotHopper`).

Check if the memory directory already exists:
- If it exists and is already a symlink → tell the user it's already linked, show where it points
- If it exists and is a real directory with files → warn the user:
  > Memory directory already exists with files. I'll move existing memories to the vault and replace with a symlink. OK?
  If confirmed, move files: `mv <memory_path>/* "<vault_path>/Claude/<project_name>/memory/"` then `rmdir <memory_path>`
- If it exists and is a real directory, empty → remove it: `rmdir <memory_path>`
- If it doesn't exist → proceed

Create the symlink:
```bash
ln -s "<vault_path>/Claude/<project_name>/memory" "<memory_path>"
```

Verify:
```bash
ls -la "<memory_path>"
```

## Step 6: Save configuration

Write `obsidianVaultPath` to `settings.local.json`. Check which level to write to:

If `.claude/settings.local.json` exists in the project, update it there. Otherwise, ask the user:
> Save vault path to:
> A) Project settings (`.claude/settings.local.json`) — only this project
> B) User settings (`~/.claude/settings.local.json`) — all projects
>
> Recommended: B (user settings) — vault path is the same for all projects

Read the existing `settings.local.json` content (or start with `{}` if it doesn't exist). Add/update:
```json
{
  "obsidianVaultPath": "<vault_path>",
  "obsidianExclude": ["Daily Notes", "Journal", "Private"]
}
```

Ask the user if they want to customize the exclude list:
> These folders will be excluded from `/context` searches: Daily Notes, Journal, Private
> Want to change this list? (keep defaults / customize)

## Step 7: Summary

```
Obsidian integration configured:

  Vault:   <vault_path>
  Project: Claude/<project_name>/memory/
  Symlink: <memory_path> → <vault_path>/Claude/<project_name>/memory/
  Exclude: <exclude_list>

Your Claude memories will now appear in Obsidian.
Use /context <keywords> to search your vault for relevant notes.
```

## Rules

- ALWAYS validate the vault path before doing anything
- ALWAYS confirm with the user before moving existing memory files
- NEVER delete memory files — only move them to the vault
- NEVER write the vault path to `settings.json` (committed) — only `settings.local.json` (gitignored)
- If any step fails, explain what went wrong and stop — don't continue with a partial setup
