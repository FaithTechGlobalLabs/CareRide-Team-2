import { Router } from "express"

import type { RidesController } from "../controllers/ridesController.js"

export function createRideRoutes(ridesController: RidesController): Router {
  const router = Router()
  router.post("/v2/rides/:id/accept", async (req, res) => {
    const response = await ridesController.acceptRide({
      authorization: req.header("authorization"),
      params: req.params,
      body: req.body,
    })
    res.status(response.status).json(response.body)
  })
  return router
}
