export class AuthenticationError extends Error {
    public readonly statusCode: number;
    public readonly name = "AuthenticationError";
  
    constructor(
      message: string = "Authentication failed",
      statusCode: number = 401
    ) {
      super(message);
      this.statusCode = statusCode;
  
      // Fix prototype chain (important for instanceof checks)
      Object.setPrototypeOf(this, AuthenticationError.prototype);
    }
  }
  