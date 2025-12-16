// use the promises-based fs module
const fs = require("fs").promises
const path = require("path")


module.exports = function (app) {
  const getLibrary = async function () {
    // get a list of files from the filesystem by reading from the libraryPaths
    const fullPath = path.join(app.locals.libraryPaths[0])
    const dir = await fs.opendir(fullPath)
    const files = []
    for await (const dirent of dir) {
      if (dirent.isFile()) {
        const ext = path.extname(dirent.name).toLowerCase()
        if (app.locals.mediaExtensions.includes(ext)) {
          files.push({
            name: dirent.name,
            isFile: dirent.isFile(),
            isDirectory: dirent.isDirectory(),
            path: dirent.parentPath
          })
        }
      }
    }
    // Sort files by name
    files.sort((a, b) => a.name.localeCompare(b.name))
    return files
  }

  const getFile = function (filename) {
    // get the full path for the provided file
    return path.join(app.locals.libraryPaths[0], filename)
  }

  return {
    library: async function (req, res) {
      const cacheKey = "cacheTest"
      const result = await app.locals.cache(cacheKey, getLibrary)
      console.log("Rendering library with data:", result)
      return res.render("library", { data: result })
    },
    play: async function (req, res) {
      const id = req.params.id
      console.log(`Playing media item: ${id}`)
      const response = await fetch(`${app.locals.vlcUrl}?command=in_play&input=file:///${getFile(id)}`, {
        method: 'GET',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`:${app.locals.vlcPassword}`).toString('base64')
        }
      })
      console.log("VLC response:", await response.text())
      res.json({ status: "playing", id: id })
    },
    pause: async function (req, res) {
      const id = req.params.id
      console.log(`Pausing media item: ${id}`)
      const response = await fetch(`${app.locals.vlcUrl}?command=pl_pause`, {
        method: 'GET',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`:${app.locals.vlcPassword}`).toString('base64')
        }
      })
      console.log("VLC response:", await response.text())
      res.json({ status: "paused", id: id })
    },
    status: async function (req, res) {
      console.log("Fetching VLC status")
      const response = await fetch(`${app.locals.vlcUrl}`, {
        method: 'GET',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`:${app.locals.vlcPassword}`).toString('base64')
        }
      })
      const text = await response.text()
      console.log("VLC status response:", text)
      res.type('application/xml')
      res.send(text)
    },
    stop: async function (req, res) {
      const id = req.params.id
      console.log(`Stopping media item: ${id}`)
      const response = await fetch(`${app.locals.vlcUrl}?command=pl_stop`, {
        method: 'GET',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`:${app.locals.vlcPassword}`).toString('base64')
        }
      })
      console.log("VLC response:", await response.text())
      res.json({ status: "stopped", id: id })
    },
    volumeUp: async function (req, res) {
      console.log("Increasing VLC volume")
      const response = await fetch(`${app.locals.vlcUrl}?command=volume&val=%2B10`, {
        method: 'GET',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`:${app.locals.vlcPassword}`).toString('base64')
        }
      })
      console.log("VLC response:", await response.text())
      res.json({ status: "volume increased" })
    },
    volumeDown: async function (req, res) {
      console.log("Decreasing VLC volume")
      const response = await fetch(`${app.locals.vlcUrl}?command=volume&val=%2D10`, {
        method: 'GET',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`:${app.locals.vlcPassword}`).toString('base64')
        }
      })
      console.log("VLC response:", await response.text())
      res.json({ status: "volume decreased" })
    },
    seekPlus10Seconds: async function (req, res) {
      console.log("Seeking forward 10 seconds in VLC")
      const response = await fetch(`${app.locals.vlcUrl}?command=seek&val=%2B10`, {
        method: 'GET',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`:${app.locals.vlcPassword}`).toString('base64')
        }
      })
      console.log("VLC response:", await response.text())
      res.json({ status: "seeked forward 10 seconds" })
    },
    seekMinus10Seconds: async function (req, res) {
      console.log("Seeking backward 10 seconds in VLC")
      const response = await fetch(`${app.locals.vlcUrl}?command=seek&val=%2D10`, {
        method: 'GET',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`:${app.locals.vlcPassword}`).toString('base64')
        }
      })
      console.log("VLC response:", await response.text())
      res.json({ status: "seeked backward 10 seconds" })
    }
  }
}
