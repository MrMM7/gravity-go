package middlewares

import (
	"gravity-go/internal/auth"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

func rejectUnauthorized(c *gin.Context) {
	if strings.HasPrefix(c.Request.URL.Path, "/api/") {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	c.Redirect(http.StatusFound, "/auth")
	c.Abort()
}

func TokenValidationMiddleware(c *gin.Context) {
	jwtToken, err := c.Cookie("token")
	if err != nil {
		rejectUnauthorized(c)
		return
	}

	isTokenValid, err := auth.ValidateJWTToken(jwtToken)
	if err != nil || !isTokenValid {
		c.SetCookie("token", "", -1, "/", "", false, true)
		rejectUnauthorized(c)
		return
	}

	c.Next()
}
