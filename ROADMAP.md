# Directus PolyDoc connector - implementation roadmap

Living roadmap for the Directus connector, built per `../../CONNECTOR-PLAYBOOK.md`,
mirroring the n8n reference (`../../n8n-nodes-polydoc`) and the sibling
`../pipedream-polydoc`. Fresh standalone repo at
`~/Projects/polydoc/tools/directus-extension-polydoc/`.

Status legend: ☐ todo · ◐ in progress · ☑ done

---

## 0. Decision record (why this shape)

Directus's automation surface is **Flows**, and the step type inside a Flow is an
**operation**. So the direct analog of an n8n node is a single **operation
extension** with an `operation` dropdown (pdf / screenshot / einvoice). Not a bundle,
not three extensions. "Converge the product, diverge the content" holds.

### Standard (non-sandboxed) extension - the load-bearing decision

Directus has two mutually exclusive execution models per package:

| Model | Capabilities | Install | Verdict |
|---|---|---|---|
| **Sandboxed** | `request` / `log` / `sleep` only. No `FilesService`, no DB, no clean binary handling. | One-click on Directus Cloud + self-hosted | Would gut the core value (can't save a PDF) |
| **Standard** | Full handler `context`: `services` (incl. `FilesService`), `getSchema`, `database`, `accountability`, `env`; global `fetch`. | Self-hosted (npm / Marketplace with `MARKETPLACE_TRUST=all`); **not** Directus Cloud | **Chosen** |

Standard wins: it lets the operation save the generated file **straight into Directus
Files** and return the `fileId`, which is the genuinely useful, database-native
integration. Trade-off accepted with the user: no one-click install on Directus Cloud.

### Two findings that diverge from the n8n build

1. **No binary "download" on the wire.** A Flow operation returns JSON into the data
   chain, not a file attachment. So n8n's `download` delivery becomes **Save to
   Directus File** (default) via `FilesService.uploadOne`, returning `{ fileId, ... }`;
   `base64` returns the bytes inline; `cloudStorage` / `webhook` pass through the
   PolyDoc JSON receipt.
2. **No credential-test gate.** The mandatory-credential-test rule is n8n-verification
   specific; Directus has no portal requiring it. A bad key surfaces as the operation's
   own 401. The API key is an operation option, or blank to read `POLYDOC_API_KEY` env
   (recommended, keeps the secret out of the flow definition).

### Naming

Folder + npm package = `directus-extension-polydoc`. Marketplace discovery requires
the `directus-extension-` name prefix, and for Directus the repo root *is* the
published package. This intentionally deviates from the `<platform>-polydoc` sibling
folder name. Icon is a Material Symbols name (`picture_as_pdf`), not a bundled SVG, so
there is no copy-icons build step.

---

## 1. Product model (mirror the n8n node exactly)

PolyDoc API = 2 endpoints: `POST /pdf/convert`, `POST /screenshot/convert`.
Auth: `Authorization: Bearer <API_KEY>`. Sandbox: `X-Sandbox: true` header.
Field definitions: `../../polydoc-gateway/src/schemas/{common,pdf,screenshot}.ts`.

Operations (single dropdown): **PDF** `/pdf/convert` · **Screenshot**
`/screenshot/convert` · **E-Invoice** `/pdf/convert` with an `eInvoice` payload.
Source mode: URL / inline HTML / Template (`source: "[template:<id>]"` +
`templateData`). Delivery: **Directus File (default)** / Base64 / Cloud Storage
(presigned) / Webhook, plus an **Advanced (JSON)** deep-merge escape hatch.

The pure body builder is lifted verbatim from the n8n/pipedream core
(`buildRequestBody`, `mergeDeep`, `resolveSource`, `buildLayout`, `buildScreenshot`,
`defaultFilename`, `extractApiErrorMessage`) into `src/lib/build-request-body.ts`, so
the unit suite transfers 1:1.

### Directus value-add

The database-native fit: **save the result into Directus Files** and return the
`fileId`, so a following Flow operation can attach it to a record (the equivalent of
Airtable's field-mapping angle and n8n's binary download).

### Three angle-split assets (analog of the n8n templates)

| n8n template | Directus example flow | Angle |
|---|---|---|
| `invoice-pdf-from-template.json` | `examples/pdf-from-template.flow.json` | PDF |
| `url-screenshot-scheduled.json` | `examples/url-screenshot.flow.json` | Screenshot |
| `einvoice-webhook-to-pdf.json` | `examples/einvoice-from-record.flow.json` | E-Invoice |

Directus has no one-click Flow import, so `examples/import.mjs` (zero deps) POSTs a
chosen example through the Flows API and wires the entry point. Validated against
Directus 11 for all three angles.

---

## 2. Build checklist (this pass: build + verify locally only)

- ☑ Scaffold repo, `git init`, `package.json` (`directus:extension` operation block),
  `tsconfig`, `.eslintrc`, `.gitignore`.
- ☑ `src/lib/constants.ts` + `src/lib/build-request-body.ts` (pure TS port).
- ☑ Unit tests `test/build-request-body.test.ts` (ported 1:1, + base64/directusFile
  cases), green.
- ☑ `src/app.ts` (`defineOperationApp`): operation/source/delivery dropdowns + per-op
  option groups, conditional via `meta.conditions`, API key / sandbox / base URL /
  advanced escape hatch, `overview()`.
- ☑ `src/api.ts` (`defineOperationApi`) + `src/lib/deliver.ts`: build params ->
  `buildRequestBody` -> `fetch` (Bearer + X-Sandbox) -> deliver (Directus File /
  base64 / cloud / webhook), error extraction -> throw to reject path.
- ☑ Live sandbox smoke `test/integration.test.ts` gated on `POLYDOC_API_KEY`.
- ☑ Per-angle example flows + `examples/import.mjs` one-command loader, README, this roadmap.
- ☑ `npm run build` + `directus-extension validate` + eslint + em-dash sweep.
- ☐ Real-instance check: load `dist/` into a throwaway Directus, run each operation.

## Out of scope this pass (follow-ups, need external coordination)

- ☑ Pushed to `polydoc-tech/directus-extension-polydoc` (public), `release.yml`,
  published `0.1.3` to npm with the `directus-extension-operation` keyword so it is
  Marketplace-indexable.
- ◐ Docs guide
  (`../../polydoc-web/documentation/docs/guides/integrations/directus.md`) rewritten
  to the native-extension path (install + 3 use cases + the `import.mjs` loader; old
  webhook/presigned approach dropped). Prose-only for now; native-operation
  screenshots pending a live capture session (see the user-facing shot list).
- ☐ Record Directus gotchas back into `../../CONNECTOR-PLAYBOOK.md`.

## Notes / known unknowns

- `FilesService.uploadOne` storage location: uses the first entry of
  `env.STORAGE_LOCATIONS` (falls back to `local`). Confirm against a multi-storage
  install.
- Operation-options `meta.conditions` reliably hide/show fields in the Flow panel;
  verified shape locally, confirm rendering during the real-instance check.
- Directus Cloud is out of reach by design (sandbox-only). Revisit if the sandbox ever
  gains a Files API + binary responses.
