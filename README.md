# BCG 2030 Townhall — Microsite

Static landing page for the BCG 2030 Townhall. Visitors are asked
*"What happens when we combine Strategic Clarity with Action and Applied AI?"*,
type a guess, are shown a teaser video, and then see the event registration
details. Submissions are stored centrally via an Azure Function.

Built for **Thursday 28 May**. 

---

## File map

| File              | Purpose                                                                              |
|-------------------|--------------------------------------------------------------------------------------|
| `index.html`      | Main page — Venn image, guess card, video overlay, event-details overlay              |
| `app.js`          | Guess submit flow + video playback + event overlay + dismiss handlers (Esc / Close)   |
| `wordcloud.html`  | **Archived / optional.** Standalone wordcloud view. Not deployed by default.          |
| `wordcloud.js`    | **Archived / optional.** Wordcloud render logic (spiral layout, BCG palette, fetch). |
| `venn.png`        | Venn-diagram artwork shown above the guess card.                                      |
| `Media2.mp4`      | Teaser video (placeholder — replace before production launch).                       |
| `.gitignore`      | Ignored paths.                                                                        |

> ⚠️ The wordcloud page reads from `GET /api/GetAnswers` with **no authentication** —
> anyone who can reach the URL can read every submission. Keep it out of the
> production deploy unless you've added auth on the endpoint.

---

## Running locally

Any static file server. From the repo root:

```bash
python -m http.server 8000
```

Open `http://localhost:8000/` for the guess page, or
`http://localhost:8000/wordcloud.html` for the archived wordcloud view.

---

## Backend: Azure Function App

This repo is the **frontend only**. It depends on a separate Azure Function
App with two HTTP-triggered functions:

| Endpoint            | Method | Request body                | Response                              |
|---------------------|--------|-----------------------------|---------------------------------------|
| `/api/SubmitAnswer` | POST   | `{ "answer": "<string>" }`  | 2xx on success                        |
| `/api/GetAnswers`   | GET    | —                           | `[{ "answer": "<string>" }, …]`       |

### Function App configuration

- **App setting `STORAGE_CONNECTION_STRING`** — Azure portal → Function App →
  Configuration. Connection string for the Azure Storage account that holds
  submissions.
  - **TODO for handover**: fill in the exact storage type (Table / Blob /
    CosmosDB / Queue) and the row schema once known.
- **CORS** — must allow the origin the page is served from. A misconfigured
  CORS list means submissions fail silently: the browser blocks the response
  and `app.js`'s `.catch` swallows it ([app.js:56-58](app.js#L56)).
- **Authentication** — currently anonymous / public. Anyone with the URL can
  submit (spam risk on consumption pricing) or read all answers via
  `GetAnswers`. Decide before going live: Azure AD-protected Function,
  function-key header, or IP allowlist.



---

## What to change for a new environment

Every environment-specific touchpoint is flagged with a `TODO` comment.
Grep for them:

```bash
grep -rn "TODO" .
```

The four hardcoded Azure Function URLs that need updating once the BCG
Function App is provisioned:

- `app.js` — `SubmitAnswer` fetch URL
- `wordcloud.js` — `GET_ANSWERS_URL` constant
- `index.html` — CSP `connect-src` host
- `wordcloud.html` — CSP `connect-src` host

Plus TODO comments noting the
`STORAGE_CONNECTION_STRING` Azure portal env var.

---



##  notes
- Submissions are also cached in `localStorage` under the key `th_answers`
  so the wordcloud has a fallback view if `GetAnswers` is unreachable.
