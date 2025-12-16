"use strict"

module.exports = function (app, appInstance) {
  return {
    libraryPaths: [
      "path/to/you/media/library1",
    ],
    mediaExtensions: [".mp4", ".mkv", ".avi", ".mp3", ".flac"],
    vlcUrl: "http://localhost:8081/requests/status.xml?command=",
    vlcPassword: "your_vlc_password_here"
  }
}
