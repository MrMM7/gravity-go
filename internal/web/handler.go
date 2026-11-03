package web

import (
	"embed"
	"io/fs"
	"net/http"

	"github.com/gin-gonic/gin"
)

//go:embed static
var staticEmbedFS embed.FS

// RegisterRoutes mounts the embedded frontend root view and static asset handlers onto the Gin router.
func RegisterRoutes(r *gin.Engine) {
	subFS, err := fs.Sub(staticEmbedFS, "static")
	if err != nil {
		panic("failed to initialize embedded static filesystem: " + err.Error())
	}

	indexHTML, err := fs.ReadFile(subFS, "index.html")
	if err != nil {
		panic("failed to read embedded index.html: " + err.Error())
	}

	serveIndex := func(c *gin.Context) {
		c.Data(http.StatusOK, "text/html; charset=utf-8", indexHTML)
	}

	r.GET("/", serveIndex)
	r.HEAD("/", serveIndex)

	fileServer := http.StripPrefix("/static", http.FileServer(http.FS(subFS)))
	serveStatic := func(c *gin.Context) {
		fileServer.ServeHTTP(c.Writer, c.Request)
	}

	r.GET("/static/*filepath", serveStatic)
	r.HEAD("/static/*filepath", serveStatic)
}
