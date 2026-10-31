# Shared development patch

`@earendil-works__pi-ai@1.3.0.patch` is copied byte-for-byte from
[DSH source 17eeb2094f](https://github.com/sophon2000/deepseek-harness/blob/17eeb2094fea6e08067fdfd3ab34c3b44c4fdead/patches/%40earendil-works__pi-ai%401.3.0.patch).
Its Git blob is `111e09dceeda04eeb09b034e551a9c495ecff495`; SHA-256 is
`4e1c90fd00aea42989664504668633033c1962e53c07860901edb4f72d843765`.

The frozen DSH runtime patch policy marks this exact dependency patch `shared`.
It defers streamed tool-argument JSON parsing until completion and preserves
Gemini OpenAI-compatible tool-call thought signatures. `dev-host.json` records
the source and digest; pnpm applies the canonical patch to the installed
`@earendil-works/pi-ai@1.3.0` development cohort without changing its public version.

This source development successor does not replace the frozen vh.13 artifact
input `472f4395ceffea69f1372862be2c6c083a443901`. The new vh.14 candidate binds the security-fixed vh.2 Host and its actual shared
patched dependency. It requires a separate artifact, receipt and consumer checks;
the existing vh.13 bytes and source identity remain unchanged.
