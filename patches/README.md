# Shared development patch

`@earendil-works__pi-ai@1.3.0.patch` is copied byte-for-byte from
[DSH source 3400c4a110](https://github.com/sophon2000/deepseek-harness/blob/3400c4a11043fbd0ab486561edc23d6309f41463/patches/%40earendil-works__pi-ai%401.3.0.patch).
Its Git blob is `111e09dceeda04eeb09b034e551a9c495ecff495`; SHA-256 is
`4e1c90fd00aea42989664504668633033c1962e53c07860901edb4f72d843765`.

The frozen DSH runtime patch policy marks this exact dependency patch `shared`.
It defers streamed tool-argument JSON parsing until completion and preserves
Gemini OpenAI-compatible tool-call thought signatures. `dev-host.json` records
the source and digest; pnpm applies the canonical patch to the installed
`@earendil-works/pi-ai@1.3.0` development cohort without changing its public version.

This source development successor does not replace the frozen vh.13 artifact
input `472f4395ceffea69f1372862be2c6c083a443901`. Production continues to consume
that artifact and its actual Host-owned patched dependency. Any later change to
the shipped plugin payload requires a new artifact version and receipt.
