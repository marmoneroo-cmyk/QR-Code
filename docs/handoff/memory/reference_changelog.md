---
name: reference-changelog
description: CHANGELOG.md at project root tracks every feature added with date — single source of truth for what shipped when
metadata: 
  node_type: memory
  type: reference
  originSessionId: f00f8822-a2c6-4061-8d50-863cebe3ce6c
---

The project's source-of-truth feature log lives at `CHANGELOG.md` in the project root (C:\Users\shlom\Desktop\Qr_Code\cocktail-demo\CHANGELOG.md).

**How to apply:** Every time a feature ships or a substantive change is made, append a dated entry under the current unreleased section. Use semantic categories: Added, Changed, Removed, Fixed, Tech.

Format: Keep a Changelog convention (https://keepachangelog.com). Date the entry, group by category, link to the relevant component/file. The user explicitly asked for this so they can see "what we added and when" inside the system.

If the user asks "what did we ship recently" or "when did we add X" — read this file rather than recalling. Memory snapshots of past activity decay; the file is authoritative.

There is also an in-app `/changelog` route that renders the same content for end users / the restaurant owner.
