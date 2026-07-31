package domain

import "time"

// User represents a registered user in the system.
type User struct {
	ID        string    `json:"id"`
	Email     string    `json:"email"`
	Password  string    `json:"-"` // Never expose the hashed password to clients
	CreatedAt time.Time `json:"createdAt"`
}
