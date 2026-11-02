import jwt from "jsonwebtoken"

import type {
  AuthenticatedActor,
  ITokenVerifier,
} from "../../application/ports/tokenVerifier.js"

export class JwtTokenVerifier implements ITokenVerifier {
  constructor(private readonly secret: string) {}

  async verify(token: string): Promise<AuthenticatedActor | null> {
    try {
      const claims = jwt.verify(token, this.secret)
      if (
        typeof claims === "string" ||
        typeof claims.sub !== "string" ||
        !claims.sub ||
        (claims.kind !== "staff" && claims.kind !== "driver")
      )
        return null
      return { id: claims.sub, kind: claims.kind }
    } catch {
      return null
    }
  }
}
