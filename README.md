# NEXORA Browser website

This folder contains the static public landing page. It uses the screenshots in
`assets/screenshots/` and needs no third-party JavaScript dependencies.

## Setup

- For offline checks, use Node.js **24.15.0** (`.nvmrc`). The dependency tree is
  pinned in `package-lock.json` (currently empty; no `npm install` needed to run).
- To serve the site locally, use Python 3's built-in web server or Docker.
- `config.js` owns the repository, release and download URLs. Confirm the real
  release details there before publishing. Leave `gaMeasurementId` empty to keep
  optional website analytics disabled.

## Run locally

From this directory:

```sh
python3 -m http.server 8080
```

On Windows the command may be `python -m http.server 8080`. Open
<http://localhost:8080/>. Refresh after editing HTML, CSS or JavaScript.

## Test offline

```sh
make test
```

This runs JavaScript syntax validation and the local-asset/monitor smoke tests
using only Node's built-in test runner. On Windows without `make`, run:

```sh
node --check app.js
node --test smoke.test.mjs
```

After a visual change, also check a wide and a narrow viewport: power on the
hero display, open the NEXORA app icon, advance screenshots, and inspect all
three Features displays and the Setup Guide controls.

## Build and deploy with Docker

From this directory:

```sh
docker build -t nexora-website .
docker run --rm -p 8080:8080 nexora-website
```

The Dockerfile pins Node 24.15.0, verifies the static site, and serves it on
port 8080 with BusyBox HTTPD (included in the Alpine base image). Deploy the
image with port 8080 exposed. For a static host instead, publish `index.html`,
`styles.css`, `polish.css`, `app.js`, `config.js`, and `assets/` together at the
site root; no backend or build output is required.

## Publishing reminders

- Only advertise features verified in the browser release. The startup desktop
  shown on this site is an interactive **illustration**, not a real OS session.
- The browser preview uses existing NEXORA screenshots. Keep `config.js`
  release metadata accurate and use only official download URLs.
- Publish the Privacy and Security policy documents and contact details when
  available; this site still marks them as pending.
