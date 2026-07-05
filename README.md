# SOUGAT-1 — Portfolio of Sougat Shekhar Hota

Live site: **https://sougatshekhar97-cpu.github.io/portfolio/**

Two pages, built from my Claude Design project:

- [`index.html`](index.html) — the portfolio (hero, proof of work, configurations, benchmarks, model card, contact)
- [`360-analysis.html`](360-analysis.html) — the 360° & 3D self-evaluation teardown
- [`editor.js`](editor.js) — owner edit mode (see below)
- [`assets/`](assets/) — images

## Owner edit mode

Open the site with `#admin` at the end of the URL (or press **Ctrl+Shift+E**):

```
https://sougatshekhar97-cpu.github.io/portfolio/#admin
```

First time in a browser it asks you to **set a passcode**; afterwards it asks to enter it.
Then every component (sections and cards) gets hover controls:

| Control | Action |
|---|---|
| click text | edit it in place |
| double-click image | replace it (path or URL) |
| ↑ ↓ | move component up / down |
| ⧉ | duplicate component |
| 👁 | hide / show component on the site |
| ✕ | delete component |
| ＋ Add section | insert a new blank section |

**Save draft** keeps changes in that browser only (visitors never see drafts).
**Export HTML** downloads the updated file — publish it by replacing the file in this
repo (GitHub → open file → ✏️ edit / upload → commit), or ask Claude Code to push it.

> Honest note: the passcode is a convenience lock in your browser, not server-side
> security. The public site can only change via a commit to this repository — GitHub's
> authentication is what makes the site editable by you alone.
