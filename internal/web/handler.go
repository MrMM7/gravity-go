package web

import (
	"embed"
	"gravity-go/internal/middlewares"
	"io/fs"
	"net/http"

	"github.com/gin-gonic/gin"
)

//go:embed static
var staticEmbedFS embed.FS

// RegisterRoutes mounts the embedded frontend pages and static asset handlers onto the Gin router.
func RegisterRoutes(r *gin.Engine) {
	subFS, err := fs.Sub(staticEmbedFS, "static")
	if err != nil {
		panic("failed to initialize embedded static filesystem: " + err.Error())
	}

	indexHTML, err := fs.ReadFile(subFS, "index.html")
	if err != nil {
		panic("failed to read embedded index.html: " + err.Error())
	}

	authHTML, err := fs.ReadFile(subFS, "auth.html")
	if err != nil {
		panic("failed to read embedded auth.html: " + err.Error())
	}

	serveIndex := func(c *gin.Context) {
		c.Data(http.StatusOK, "text/html; charset=utf-8", indexHTML)
	}

	serveAuth := func(c *gin.Context) {
		c.Data(http.StatusOK, "text/html; charset=utf-8", authHTML)
	}

	r.GET("/", middlewares.TokenValidationMiddleware, serveIndex)
	r.HEAD("/", serveIndex)

	r.GET("/auth", serveAuth)
	r.HEAD("/auth", serveAuth)
	r.GET("/signin", serveAuth)
	r.GET("/signup", serveAuth)

	fileServer := http.StripPrefix("/static", http.FileServer(http.FS(subFS)))
	serveStatic := func(c *gin.Context) {
		fileServer.ServeHTTP(c.Writer, c.Request)
	}

	r.GET("/static/*filepath", serveStatic)
	r.HEAD("/static/*filepath", serveStatic)
}
