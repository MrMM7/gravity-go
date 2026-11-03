# Gravity-Go

**v0.6**

A Go implementation of Gravity, my URL shortener project. This is my first project written in Go, built as a hands-on opportunity to learn the language and explore its ecosystem while recreating an existing project.

## Tech Stack

- **Go** — Core application (`embed` for single-binary asset delivery)
- **Gin** — HTTP framework
- **SQLite** — Database
- **JWT** — Authentication (`HttpOnly` session cookies)
- **Argon2id** — Secure password hashing
- **HTML5 / CSS3 / Vanilla JS** — Minimalist monochrome web interface

## Web Interface & Current Status

Gravity-Go includes an embedded, zero-dependency black-and-white web interface served directly by the Go binary at `http://localhost:8080`:

- **URL Compression (`01 // COMPRESS`)** — Validate and shorten long `http://` and `https://` URLs into 11-character cryptographic `base64url` short codes.
- **Gravitational Trajectory & Telemetry (`02 // TRAJECTORY`)** — Inspect character reduction metrics, copy shortened links to the clipboard with one click, and test HTTP `302` redirects directly from the browser.
- **Access Control (`03 // ACCESS CONTROL`)** — Create an account or sign in with Argon2id password verification to receive an `HttpOnly` signed JWT session cookie.

## Getting Started

1. Ensure a `.env` file exists in the project root (see `.env.example`):
   ```env
   JWT_SECURE_KEY=your-secret-key-here
   ```
2. Run the application:
   ```bash
   go run .\cmd\gravity
   ```
   or build a standalone binary (which embeds all frontend assets) and run it:
   ```bash
   go build .\cmd\gravity
   .\gravity.exe
   ```
3. Open **[http://localhost:8080](http://localhost:8080)** in your browser to use Gravity.

### API Endpoints

| Method | Route | Description |
| :--- | :--- | :--- |
| `GET` | `/` | Serves the Gravity web interface |
| `GET` | `/static/*filepath` | Serves embedded CSS and JavaScript assets |
| `POST` | `/api/v1/shorten` | Shortens a destination URL (`{"original_url": "https://..."}`) |
| `GET` | `/:code` | Redirects (`302 Found`) a short code to its original URL |
| `POST` | `/api/v1/signup` | Registers a user and sets an `HttpOnly` `token` cookie |
| `POST` | `/api/v1/signin` | Authenticates a user and sets an `HttpOnly` `token` cookie |

### API Testing

I recommend using [Bruno](https://usebruno.com). It's free and open-source, and you can very easily import the API collection included in the [./api-test](/api-test) directory to get started.

## Project Goals

- [x] Add a front-end
- [ ] Rate Limiting
- ...
