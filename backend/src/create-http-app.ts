import type { Express } from "express"

import express from "express"

import type { Container } from "./infrastructure/container.js"

export function createHttpApp(container: Container): Express {
  const app = express()

  // This is an example of the new wiring in the better architecture, with Express just as a particular HTTP
  // technology choice,
  // and controller classes that are independent of a particular HTTP framework.
  // Keep this off until the backend is verified in an E2E test.
  // TO-DO: Add authentication middleware to the route below, and uncomment it when ready.
  // app.post("/rides/:id/accept", authenticationMiddleware, container.ridesControllerInstance.acceptRide)
  return app
}
