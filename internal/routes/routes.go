package routes

import (
	"gravity-go/internal/handlers"

	"github.com/gin-gonic/gin"
)

func Setup(r *gin.Engine) {
	r.POST("/shorten", handlers.ShortenHandler)
	r.GET("/:code", handlers.RedirectHandler)
}
