# SeatOpen Notifier

Automates the Virginia Tech course search page with Puppeteer, keeps the CS 3214 filters pre-filled, and pings a webhook whenever a watched CRN reports open seats.

## Quick start

1. Copy `.env.example` to `.env` and drop in your values (keep the real webhook secret!).
2. Install dependencies:
	```powershell
	cd notifier
	npm install
	```
3. Run the watcher (add `--once` if you only need a single check):
	```powershell
	npm start -- --once
	```

## Configuration

| Variable | Description | Default |
| --- | --- | --- |
| `WEBHOOK_URL` | HTTPS endpoint that will receive JSON payloads when seats are open (Discord, Slack, etc.). | _(required for notifications)_ |
| `COURSE_SEARCH_URL` | Course search form URL. | Virginia Tech search page |
| `CAMPUS_LABEL` | Text of the campus option to select. | `Blacksburg` |
| `TERM_LABEL` | Term dropdown text. | `Spring 2026` |
| `SUBJECT_LABEL` | Subject dropdown text. | `CS - Computer Science` |
| `COURSE_NUMBER` | Course number text input. | `3214` |
| `TARGET_CRNS` | Comma-separated CRNs to monitor. | `13470,13471` |
| `POLL_INTERVAL_MS` | Interval between checks. | `300000` (5 min) |
| `HEADLESS` | `true` to keep Chromium headless, `false` for visible runs. | `true` |
| `NOTIFY_EVERY_POLL` | `true` to send webhook on every open poll (not only transitions). | `false` |
| `DISABLE_PUPPETEER_SANDBOX` | Add `--no-sandbox` flags automatically (needed when running as root/within some containers). | auto-detected (set `true` in WSL) |
| `INTERACTIVE_LOGIN` | When `true`, the script pauses after `page.goto` so you can log in manually before automation continues. Forces `HEADLESS=false`. | `false` |
| `AUTH_TIMEOUT_MS` | How long to wait for the course search form to appear while you're logging in. | `180000` |
| `USER_DATA_DIR` | Chromium profile directory for Puppeteer. Logging in once with this profile keeps the session for future headless runs. | `.chrome-profile` |
| `*_SELECTOR` vars | Override DOM selectors if the page markup changes. | defaults tuned to VT form (`CAMPUS`, `TERMYEAR`, `subj_code`, etc.) |

Example one-shot run in PowerShell:

```powershell
cp .env.example .env
# edit .env to include your Discord webhook, CRNs, etc.
npm start -- --once
```

Discord webhooks receive a simple `content` message; Slack/web-compatible endpoints receive a `text` field. Adjust `sendWebhook` if you need embeds or richer formatting.

### Authenticating against Hokie SPA

Because `HZSKVTSC.P_DispRequest` sits behind the Hokie SPA login, you need to provide an authenticated session once:

1. Set `HEADLESS=false`, `INTERACTIVE_LOGIN=true`, and point `USER_DATA_DIR` at a writable folder (default `.chrome-profile`).
2. Run `npm start -- --interactive-login`.
3. A Chromium window opens; log in (Duo, etc.) until the course search form loads.
4. The script resumes automatically and stores cookies in the profile directory. Future runs can flip `HEADLESS=true` again while reusing the same `USER_DATA_DIR` so you stay logged in.

If the session ever expires, repeat the steps above or delete the profile directory to start fresh.

## Testing

`npm test` runs a lightweight parser test that mimics the HTML table shown in the screenshot to ensure seat-state detection works as expected.

```powershell
npm test
```

## Notes

- The script parses the rendered HTML with Cheerio after Puppeteer submits the form, so it is resilient to small DOM changes.
- If the site uses different labels or selectors, override them with env vars without changing code.
- Add your scheduler (cron, Windows Task Scheduler, GitHub Actions, etc.) to run the script continuously.
