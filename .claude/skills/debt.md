---
name: debt
description: View, add, or update items in DEBT.md
user_invocable: true
---

# Technical Debt Tracker

Manage the project's DEBT.md file.

## Arguments

- No args: display the current debt list, prioritized
- `add <description>`: add a new item to the appropriate section
- `done <item>`: mark an item as completed and remove it
- `priorities`: re-sort items by priority within each section

## Behavior

1. Read `DEBT.md` from the project root
2. If it doesn't exist, create it with sections: Testing, Documentation, Features, Infrastructure
3. Each item should have a priority tag: `P0` (critical), `P1` (important), `P2` (nice-to-have)
4. When adding, ask which section and priority if not obvious from context
5. When displaying, group by section, sort by priority within each section
6. After any changes, write the file back and show the updated list
