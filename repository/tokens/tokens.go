package tokens

// TokenRecord -
type TokenRecord struct {
	AuthToken    string
	RefreshToken string
	TokenExpiry  int64
}

// Token -
type Token struct {
	UserGUID  string
	TokenType string
	Record    TokenRecord
}

// Repository is an application of the repository pattern for storing tokens
type Repository interface {
	FindUAAToken(userGUID string) (TokenRecord, error)
	SaveUAAToken(userGUID string, tokenRecord TokenRecord) error

	FindCNSIToken(cnsiGUID string, userGUID string) (TokenRecord, error)
	DeleteCNSIToken(cnsiGUID string, userGUID string) error
	SaveCNSIToken(cnsiGUID string, userGUID string, tokenRecord TokenRecord) error
}
