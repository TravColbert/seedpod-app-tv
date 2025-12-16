const express = require("express")
const router = express.Router({ mergeParams: true })
const path = require("path")

module.exports = function (app) {
  const currentRouteName = path.basename(__filename, '.js')

  // Require the controller with the same name as the router
  const controller = require(path.join('../', app.locals.controllerPath, currentRouteName))(app)

  router.route("/library/:id/stop")
    .get(controller.stop)

  router.route("/library/:id/play")
    .get(controller.play)

  router.route("/library/:id/status")
    .get(controller.status)

  router.route("/library/:id/volume-up")
    .get(controller.volumeUp)

  router.route("/library/:id/volume-down")
    .get(controller.volumeDown)

  router.route("/library")
    .get(controller.library)

  router.route("/")
    .get((_req, res) => res.render("library"))

  return router
}