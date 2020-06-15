# muninn

`muninn` is a set of utilities helping me build and navigate my personal flat-file markdown wiki.

This is personal software project, shared mainly as a reference point. I wont be fixing bugs that don't happen to me, or add functionalities I don't want/need.

I'm using it in combination with [`muninn-vim`](https://github.com/szymonkaliski/muninn-vim).

## Assumptions

- wiki is markdown based
- links between notes are made using standard markdown linking: `linking to [this note](./this-note.md)` (spaces in filename should be escaped with `\`)
- todos are create with [`gfm`](https://github.github.com/gfm/): `- [ ] a todo`, `- [x] done todo`
- additional support for `@tags`: `- [ ] a todo with scheduled date @due(2020-02-17) @important`
  - `@due()` tag value is formatted `YYYY-MM-DD`
  - `@due()` tags matching todays date are highlighted in green in the UI
  - `muninn tasks` depends on `@due()` tags

## Installation

`npm install -g muninn-cli`

## Usage

- `muninn --root WIKI_DIR tasks` - lists tasks (using `- [ ] some task @due(YYYY-MM-DD)` format) `n` days into the future:
  - `--days 2` displays tasks for today and tomorrow
  - `--vim` displays vim-formatted list

- `muninn --root WIKI_DIR backlinks` - [roam](https://roamresearch.com/)-like backlinks (both markdown-links and text search)
  - `--file Notes/Zettels/memex.md` displays all backlinks linking to this file, assuming first line starting with `# title` is the title
  - `--file Notes/Zettels/memex.md --vim` same as above but vim-formatted

