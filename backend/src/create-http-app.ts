import type { Express } from "express"

import cors from "cors"
import express from "express"

import type { Container } from "./infrastructure/container.js"

import { createRideRoutes } from "./presentation/routes/rideRoutes.js"

export function createHttpApp(container: Container): Express {
  const app = express()

  // Mount the parallel implementation; index.ts still registers the original API.
  app.use(cors())
  app.use(express.json())
  app.use(express.urlencoded({ extended: true }))
  app.use(createRideRoutes(container.ridesControllerInstance))
  return app
}
