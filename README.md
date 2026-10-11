# NEXORA Browser — THE WEB, REIMAGINED.

A modern desktop browsing experience designed for speed, productivity, customization, and AI-powered workflows.

🌐 **Live website:** https://khanhishan70-stack.github.io/NEXORA-Browser/

## ⬇️ Download NEXORA here

**Easiest: one-click Setup** (tiny download, installs the latest automatically)

👉 **[Download NEXORA-Setup.exe](https://github.com/khanhishan70-stack/NEXORA-Browser/releases/download/v1.0.8/NEXORA-Setup.exe)**

Or pick any version: **[All releases](https://github.com/khanhishan70-stack/NEXORA-Browser/releases)**

Prefer portable? **[Direct ZIP (Windows x64, 338 MB)](https://github.com/khanhishan70-stack/NEXORA-Browser/releases/latest/download/NEXORA-Browser-Windows-x64.zip)** — extract anywhere, double-click **launch.bat**.

1. Run the Setup, keep clicking Next
2. NEXORA opens by itself — first run sets up Python + free offline AI automatically
3. Done — browse. Updates announce themselves inside the browser.

> Download NEXORA only from the official links above. Never trust third-party installers.

## ✨ What's inside

- 🗂️ Vertical tabs + Stage Manager-style live preview fan
- ✨ ESTA AI assistant side panel (summaries, code help, offline chat)
- 🕓 Full-page history with password lock
- 🎥 1-click camera / mic / screen-share for calls
- ▶️ YouTube saver (360p → 4K + MP3), ⬇️ download manager, 📄 pic-to-PDF
- 🛡️ Ad & tracker shields + AI phishing checks
- 🧰 Toolbox rail: translator, volume boost, voice, Pomodoro, LeetCode tutor, video editor
- 🔄 Chrome-style auto-updates with one-click install

![NEXORA home](website/assets/screenshots/nexora-home.png)
![ESTA assistant](website/assets/screenshots/nexora-esta.png)
![YouTube saver](website/assets/screenshots/nexora-yt.png)

## 🖥️ Requirements

- Windows 10/11, 64-bit
- That's it. Python, Ollama and the offline AI model install themselves on first launch (free, one time).

## 🛠️ Run from source (developers)

```bat
open-browser.bat
```

Needs Node.js + the `electron/` dependencies (`npm install` inside `electron/`), and Python 3.13 with the backend requirements for AI features (see `ai UI DESIGN/backend/requirements.txt`).

## 🔒 Security

Found a vulnerability? Open a GitHub issue marked **security** and we'll respond fast. Never commit API keys or personal data — use `.env` files (see `.env.example` templates).
