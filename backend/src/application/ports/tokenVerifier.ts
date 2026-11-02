export interface AuthenticatedActor {
  id: string
  kind: "staff" | "driver"
}

export interface ITokenVerifier {
  /** Null means expired, invalid, or unsupported token claims. */
  verify(token: string): Promise<AuthenticatedActor | null>
}
