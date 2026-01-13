# Netlify Email Signature Configurator

A lightweight React + Vite app that discovers `.mustache` email signature templates, lets you populate their variables, and previews the fully rendered HTML with one-click copy support. The project is configured for Netlify and ships with two example templates in `email-templates/`.

## Getting Started

Ensure you've setup a `.env` file in the root directory with the following properties:
```
VITE_AUTH0_CLIENT_ID = "<found in Auth0 configuration>"
VITE_AUTH0_DOMAIN = "<found in Auth0 configuration>"
```

```bash
npm install
npm run dev
```

- The app fetches template metadata from `/.netlify/functions/list-templates`.
- Select a template, click **Load**, fill in the generated form fields, and copy the rendered HTML from the preview pane.

To validate builds locally:

```bash
npm run build
npm run lint
```

## Template Management

- Add `.mustache` files to `email-templates/`.
- Template display names are inferred automatically:
  - `kebab-case` and `snake_case` become Title Case.
  - `camelCase` splits into words (`exampleSignature` → `Example Signature`).
  - Any other casing remains unchanged (extension removed).
- Template content is served through `/.netlify/functions/get-template?slug=...`.
- Files prefixed with `skip-` are ignored (useful for drafts or disabled templates).
- If only one template remains after filtering, it loads automatically and the selector is hidden.
- Optional metadata can be provided via a Mustache comment at the top of the file:
  ```mustache
  {{! config {"copyHtmlButton":false,"assetHost":"https://cdn.example.com"} }}
  ```
  - `copyHtmlButton` defaults to `true`. Set to `false` to hide the HTML copy button for clients like Gmail.
  - Additional keys are reserved for future use (e.g., asset hosting hints).

If you rename the template directory (e.g., to `signature-templates/`), update the `TEMPLATE_DIR` constant in `netlify/functions/utils/templates.ts`.

## Netlify Deployment

The repository includes `netlify.toml` with defaults:

```
[build]
  command = "npm run build"
  publish = "dist"
  functions = "netlify/functions"
```

Deploy by connecting the repo to Netlify and using the standard build command above. Netlify’s runtime bundles the TypeScript functions automatically.

## Project Structure

- `email-templates/` – Source `.mustache` templates (kept out of the client bundle).
- `netlify/functions/` – Serverless functions for listing and loading templates.
- `src/` – React front end with dynamic form generation and live preview.

## Future Enhancements

- Optional asset management: upload template assets to Netlify and inject hosted URLs during build.
- Persist user input locally to streamline repeat edits.
- Allow exporting a ready-to-use `.html` file alongside clipboard copy.
