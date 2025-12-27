const express = require("express");
const router = express.Router({ mergeParams: true });
const path = require("path");

module.exports = function (app) {
  const currentRouteName = path.basename(__filename, ".js");

  // Require the controller with the same name as the router
  const controller = require(
    path.join("../", app.locals.controllerPath, currentRouteName),
  )(app);

  router
    .route("/library/:id/resync")
    .get(controller.resync, controller.status, controller.render);

  router.route("/library/:id/edit").get(controller.edit, controller.render);

  router
    .route("/library/:id/play")
    .get(controller.play, controller.status, controller.render);

  router.route("/library/sync").get(controller.syncLibrary);

  router
    .route("/library/stop")
    .get(controller.stop, controller.status, controller.render);

  router
    .route("/library/pause")
    .get(controller.pause, controller.status, controller.render);

  router.route("/library/status").get(controller.status, controller.render);

  router
    .route("/library/volume-up")
    .get(controller.volumeUp, controller.status, controller.render);

  router
    .route("/library/volume-down")
    .get(controller.volumeDown, controller.status, controller.render);

  router
    .route("/library/seek-forward")
    .get(controller.seekPlus10Seconds, controller.status, controller.render);

  router
    .route("/library/seek-backward")
    .get(controller.seekMinus10Seconds, controller.status, controller.render);

  router
    .route("/library/:id")
    .get(controller.get, controller.status, controller.render)
    .post(controller.update, controller.status, controller.render);

  router
    .route("/library")
    .get(controller.status, controller.library, controller.render);

  router.route("/").get((_req, res) => res.render("home"));

  return router;
};
