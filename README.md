# Gravity-Go

**v0.7**

A Go implementation of Gravity, my URL shortener project. This is my first project written in Go, built as a hands-on opportunity to learn the language and explore its ecosystem while recreating an existing project.

## Tech Stack

- **Go** — Core application
- **Gin** — HTTP framework
- **SQLite** — Database
- **JWT** — Authentication
- **Argon2id** — Secure password hashing
- **HTML / CSS / JS** — Minimalist web interface

## Getting Started

1. Create a `.env` file in the project root (see `.env.example`):
   ```env
   JWT_SECURE_KEY=your-secret-key-here
   ```
2. Run the application:
   ```bash
   go run .\cmd\gravity
   ```
   or build and run the binary:
   ```bash
   go build .\cmd\gravity
   .\gravity.exe
   ```
3. Open **[http://localhost:8080](http://localhost:8080)** in your browser.

### Disclaimer
Currently, authentication through the Web UI may not work because Chrome automatically deletes cookies originating from `localhost` in certain cases. This appears to be one of those cases.

To fully utilize the application, use Bruno for now, or wait until I containerize the project.

### API Testing

I recommend using [Bruno](https://usebruno.com). It's free and open-source, and you can very easily import the API collection included in the [./api-test](/api-test) directory to get started.

## Project Goals

- [x] Add a front-end
- [X] Authentication
- [ ] Rate Limiting
- [ ] Containerize The Application
- ...
