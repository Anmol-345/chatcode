# ChatCode — build docs for OpenCode

Drop these files into an empty project folder (keep the structure):

```
AGENTS.md            ← OpenCode loads this automatically
opencode.json        ← also loads docs/*.md as instructions
docs/SPEC.md
docs/ARCHITECTURE.md
docs/XMTP_NOTES.md
docs/TASKS.md
docs/REFERENCE_IMPLEMENTATION.md
```

Then run `opencode` in that folder and paste the kickoff prompt below.

## Kickoff prompt
> Read AGENTS.md and everything in docs/. Execute Phase 0 of docs/TASKS.md: scaffold the Next.js project in the current directory, install and pin dependencies, verify the XMTP Browser SDK API against the installed types, and fill in "Verified API (this repo)" in docs/XMTP_NOTES.md. Stop after Phase 0 and summarize what you verified and any deviations from the reference code.

Then continue one phase at a time: "Proceed to Phase N."
