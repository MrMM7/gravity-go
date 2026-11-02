# Gravity-Go

**v0.6**

A Go implementation of Gravity, my URL shortener project. This is my first project written in Go, built as a hands-on opportunity to learn the language and explore its ecosystem while recreating an existing project.
## Tech Stack

- **Go** — Core application
- **Gin** — HTTP framework
- **SQLite** — Database
- **JWT** — Authentication
- **Argon2id** — Secure password hashing

## Current Status

Gravity-Go is currently API-only. There is no web interface yet; all functionality is accessed through HTTP requests.

## Getting Started
Simply run:
```bash
go run .\cmd\gravity
```
or alternatively you can build it once and run it immediately using:
```bash
go build .\cmd\gravity
```

### API Testing

I recommend using [Bruno](https://usebruno.com). It's free and open-source, and you can very easily import the API collection included in the [./api-test](/api-test) directory to get started.

## Project Goals

- Add a front-end (This will be done by AI I will take care of the backend)
- Rate Limiting
- ...
