// use the promises-based fs module
const fs = require("fs").promises
const path = require("path")


module.exports = function (app) {
  const getLibrary = async function () {
    // get a list of files from the filesystem by reading from th elibraryPaths
    const fullPath = path.join(__dirname, app.locals.libraryPaths[0])
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
      const response = await fetch(`${app.locals.vlcUrl}in_play&input=file:///${id}`)
      console.log("VLC response:", await response.text())
      res.json({ status: "playing", id: id })
    },
    stop: async function (req, res) {
      const id = req.params.id
      console.log(`Stopping media item: ${id}`)
      const response = await fetch(`${app.locals.vlcUrl}pl_stop`)
      console.log("VLC response:", await response.text())
      res.json({ status: "stopped", id: id })
    }
  }
}