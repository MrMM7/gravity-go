package routes_test

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"gravity-go/internal/database"
	"gravity-go/internal/models"
	"gravity-go/internal/routes"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	_ "github.com/mattn/go-sqlite3"
)

func setupTestRouter(t *testing.T) *gin.Engine {
	t.Helper()
	gin.SetMode(gin.TestMode)

	os.Setenv("JWT_SECURE_KEY", "test-secret-key-for-gravity")

	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatalf("failed to open in-memory sqlite db: %v", err)
	}

	schema := `
	CREATE TABLE IF NOT EXISTS urls (
	    short_code TEXT NOT NULL UNIQUE PRIMARY KEY,
	    original_url TEXT NOT NULL
	);
	CREATE TABLE IF NOT EXISTS users (
	    email TEXT NOT NULL UNIQUE,
	    password TEXT NOT NULL
	);`
	if _, err := db.Exec(schema); err != nil {
		t.Fatalf("failed to initialize schema: %v", err)
	}

	database.DB = db
	t.Cleanup(func() {
		db.Close()
	})

	r := gin.New()
	routes.Setup(r)
	return r
}

func TestFrontendAndStaticRoutes(t *testing.T) {
	r := setupTestRouter(t)

	// 1. Root route serves HTML frontend
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected GET / status 200, got %d", w.Code)
	}
	if !strings.Contains(w.Header().Get("Content-Type"), "text/html") {
		t.Errorf("expected text/html content-type, got %q", w.Header().Get("Content-Type"))
	}
	if !strings.Contains(w.Body.String(), "Gravity") {
		t.Errorf("expected index.html body to contain Gravity")
	}

	// 2. CSS asset loads
	wCSS := httptest.NewRecorder()
	reqCSS, _ := http.NewRequest(http.MethodGet, "/static/css/style.css", nil)
	r.ServeHTTP(wCSS, reqCSS)

	if wCSS.Code != http.StatusOK {
		t.Fatalf("expected GET /static/css/style.css status 200, got %d", wCSS.Code)
	}
	if !strings.Contains(wCSS.Body.String(), "--bg-canvas") {
		t.Errorf("expected style.css to contain design tokens")
	}

	// 3. JS asset loads
	wJS := httptest.NewRecorder()
	reqJS, _ := http.NewRequest(http.MethodGet, "/static/js/app.js", nil)
	r.ServeHTTP(wJS, reqJS)

	if wJS.Code != http.StatusOK {
		t.Fatalf("expected GET /static/js/app.js status 200, got %d", wJS.Code)
	}
	if !strings.Contains(wJS.Body.String(), "/api/v1/shorten") {
		t.Errorf("expected app.js to reference /api/v1/shorten")
	}
}

func TestShortenAndRedirectFlow(t *testing.T) {
	r := setupTestRouter(t)

	// 1. Valid URL shortening
	body := []byte(`{"original_url":"https://golang.org/doc"}`)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/api/v1/shorten", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected status 201 Created, got %d: %s", w.Code, w.Body.String())
	}

	var created models.ShortenedURL
	if err := json.Unmarshal(w.Body.Bytes(), &created); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}
	if created.ShortCode == "" {
		t.Fatalf("expected non-empty short_code")
	}
	if created.OriginalURL != "https://golang.org/doc" {
		t.Errorf("expected original_url https://golang.org/doc, got %s", created.OriginalURL)
	}

	// 2. Redirect using short code
	wRedir := httptest.NewRecorder()
	reqRedir, _ := http.NewRequest(http.MethodGet, "/"+created.ShortCode, nil)
	r.ServeHTTP(wRedir, reqRedir)

	if wRedir.Code != http.StatusFound {
		t.Fatalf("expected status 302 Found for GET /%s, got %d", created.ShortCode, wRedir.Code)
	}
	if loc := wRedir.Header().Get("Location"); loc != "https://golang.org/doc" {
		t.Errorf("expected Location header https://golang.org/doc, got %s", loc)
	}

	// 3. Invalid URL returns clean 400 JSON error without trailing output
	badBody := []byte(`{"original_url":"not-a-valid-url"}`)
	wBad := httptest.NewRecorder()
	reqBad, _ := http.NewRequest(http.MethodPost, "/api/v1/shorten", bytes.NewReader(badBody))
	reqBad.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(wBad, reqBad)

	if wBad.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400 Bad Request, got %d", wBad.Code)
	}
	var errResp map[string]string
	if err := json.Unmarshal(wBad.Body.Bytes(), &errResp); err != nil {
		t.Fatalf("expected valid single JSON object on error, got %q: %v", wBad.Body.String(), err)
	}
}

func TestAuthenticationFlow(t *testing.T) {
	r := setupTestRouter(t)

	// 1. Signup new user
	creds := []byte(`{"email":"architect@gravity.dev","password":"strong-password-123"}`)
	wSignup := httptest.NewRecorder()
	reqSignup, _ := http.NewRequest(http.MethodPost, "/api/v1/signup", bytes.NewReader(creds))
	reqSignup.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(wSignup, reqSignup)

	if wSignup.Code != http.StatusFound {
		t.Fatalf("expected 302 Found on signup, got %d: %s", wSignup.Code, wSignup.Body.String())
	}

	cookies := wSignup.Result().Cookies()
	var tokenCookie *http.Cookie
	for _, c := range cookies {
		if c.Name == "token" {
			tokenCookie = c
			break
		}
	}
	if tokenCookie == nil || tokenCookie.Value == "" {
		t.Fatalf("expected HttpOnly token cookie on signup")
	}
	if !tokenCookie.HttpOnly {
		t.Errorf("expected token cookie to be HttpOnly")
	}

	// 2. Signin existing user
	wSignin := httptest.NewRecorder()
	reqSignin, _ := http.NewRequest(http.MethodPost, "/api/v1/signin", bytes.NewReader(creds))
	reqSignin.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(wSignin, reqSignin)

	if wSignin.Code != http.StatusFound {
		t.Fatalf("expected 302 Found on signin, got %d: %s", wSignin.Code, wSignin.Body.String())
	}

	// 3. Signin with non-existent user returns 400 "Failed to get user from database"
	unknownCreds := []byte(`{"email":"nobody@gravity.dev","password":"strong-password-123"}`)
	wUnknown := httptest.NewRecorder()
	reqUnknown, _ := http.NewRequest(http.MethodPost, "/api/v1/signin", bytes.NewReader(unknownCreds))
	reqUnknown.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(wUnknown, reqUnknown)

	if wUnknown.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 on unknown user signin, got %d", wUnknown.Code)
	}
	if !strings.Contains(wUnknown.Body.String(), "Failed to get user from database") {
		t.Errorf("expected 'Failed to get user from database', got %s", wUnknown.Body.String())
	}
}
