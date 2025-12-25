const fs = require("fs").promises;
const path = require("path");

module.exports = function (app) {
  const model = app.locals.models["movies"];

  const vlcAuthHeader = {
    method: "GET",
    headers: {
      Authorization:
        "Basic " + Buffer.from(`:${app.locals.vlcPassword}`).toString("base64"),
    },
  };

  /**
   * Base URL for TMDB API
   */
  const tmdbUrl = "https://api.themoviedb.org/3";

  /**
   * TMDB API authentication header
   */
  const tmdbAuthHeader = {
    accept: "application/json",
    Authorization: `Bearer ${app.locals.tmdbAccessToken}`,
  };

  const tmdbPreferredLanguage = "en-US";

  const getLibraryByFsPath = async function (libraryPath, term = null) {
    const files = [];

    // If the directory does not exist, return an empty array
    try {
      await fs.access(libraryPath);
    } catch (err) {
      console.warn(`Library path does not exist: ${libraryPath}`);
      return [];
    }

    const dir = await fs.opendir(libraryPath);

    for await (const dirent of dir) {
      if (dirent.isFile() && dirent.parentPath && dirent.name) {
        const ext = path.extname(dirent.name).toLowerCase();

        // Make sure it is one of the approved file extensions
        if (app.locals.mediaExtensions.includes(ext)) {
          files.push({
            name: dirent.name,
            isFile: dirent.isFile(),
            isDirectory: dirent.isDirectory(),
            path: dirent.parentPath,
          });
        }
      } else if (dirent.isDirectory()) {
        // Recursively read subdirectories
        const subdirectoryPath = path.join(libraryPath, dirent.name);
        const subdirectoryFiles = await getLibraryByFsPath(
          subdirectoryPath,
          term,
        );
        files.push(...subdirectoryFiles);
      }
    }

    return files;
  };

  /**
   * Collect a list of files based on the 'libraryPaths' value in the config
   * List is filtered by a search term if provided.
   *
   * @param {*} term
   * @returns
   */
  const getLibrary = async function (term = null) {
    let files = [];

    // get a list of files from the filesystem by reading from the libraryPaths
    for await (const libraryPath of app.locals.libraryPaths) {
      files = files.concat(await getLibraryByFsPath(libraryPath));
    }

    // Filter for search terms
    if (term && term !== "") {
      files = files.filter((file) => {
        return file.name.toLowerCase().includes(term.toLowerCase());
      });
    }

    // Sort files by name
    files.sort((a, b) => a.name.localeCompare(b.name));

    return files;
  };

  /**
   * One-way sync from filesystem to database
   * @param {*} files
   */
  const syncFsToDb = async function (files) {
    for await (const file of files) {
      const filePath = path.join(file.path, file.name);
      console.log(filePath);
      const [entry, created] = await createStubEntry(filePath);
      if (created) {
        console.log(`Created new database entry for file: ${filePath}`);
      }
    }
  };

  /**
   * Creates DB entry for the provided file path if it does not already exist
   *
   * Sets title the filename, for starters.
   *
   * Sets needsResync to true so that a later process can fill in metadata from TMDB
   * @param {*} filePath
   * @returns
   */
  const createStubEntry = async function (filePath) {
    return await model.findOrCreate({
      where: {
        path: filePath,
      },
      defaults: {
        title: path.basename(filePath, path.extname(filePath)),
        needsResync: true,
      },
    });
  };

  /**
   * Iterates over all records needing attention and initiates a fetch against
   * the on-line movie database (TMDB).
   *
   * If 'needsResync' property is TRUE
   */
  const syncDbToTmdb = async function () {
    console.log("Syncing database entries to TMDB metadata...");
    // Find all records where needsResync is true
    const recordsToSync = await model.findAll({
      where: {
        needsResync: true,
      },
    });

    for await (const record of recordsToSync) {
      // Fetch metadata from TMDB and update the record
      await fetchMetadataFromTmdb(record);
    }
  };

  /**
   * Gets metadata from TMDB by a query based on the record's title.
   * The record's title is based on either the filename or previously fetched
   * 'title' metadata.
   *
   * @param {*} record
   * @returns
   */
  const fetchMetadataFromTmdb = async function (record) {
    // Placeholder function to fetch metadata from TMDB
    // Use TMDB API to get metadata based on the title or other criteria
    // Update the record with fetched metadata
    let searchTitle = santizeTmdbString(record.title);

    // Have we already tried to use this search term? If so let's mutate it
    if (record.searchTitle === searchTitle) {
      searchTitle = mutateTmbString(searchTitle);
    }

    console.log(
      `Fetch metadata for record ID ${record.id}: "${record.title}" (${searchTitle})...`,
    );
    // Example: Fetch by search
    const searchUrl = `${tmdbUrl}/search/movie?query=${encodeURIComponent(searchTitle)}&include_adult=false&language=${tmdbPreferredLanguage}`;
    const response = await fetch(searchUrl, { headers: tmdbAuthHeader });
    const data = await response.json();

    // There's a lot of crazy stuff out there in the TMDB data.
    // Let's sort by popularity to try to get the most relevant result first
    data.results.sort((a, b) => b.popularity - a.popularity);

    console.dir(data, { depth: null });
    // Need to decide how to handle multiple results, for now just take the first one

    try {
      if (data.results && data.results.length > 0) {
        const movieData = data.results[0];
        record.tmdbId = movieData.id;
        // Truncate title to 100 chars
        record.title = movieData.title.substring(0, 100);
        // Truncate desciption to 1000 characters
        record.description = movieData.overview
          ? movieData.overview.substring(0, 1000)
          : null;
        record.needsResync = false;
        record.poster =
          app.locals.tmdbConfiguration.base_url +
          app.locals.tmdbConfiguration.poster_sizes[0] +
          movieData.poster_path;
        record.backdrop =
          app.locals.tmdbConfiguration.base_url +
          app.locals.tmdbConfiguration.backdrop_sizes[0] +
          movieData.backdrop_path;
        // Add more fields as needed
        console.log(
          `Updating record ID ${record.id} with TMDB ID ${movieData.id}`,
        );
        return await record.save();
      } else {
        console.log(`No TMDB results found for title "${record.title}"`);
        // Save the failed search term to the record so we don't use it again
        record.searchTitle = searchTitle;
        // This should already be true but...
        record.needsResync = true;
        return await record.save();
      }
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  /**
   * Removes confusing characters from the search string sent to TMDB
   * All non-alphanumeric characters are removed except spaces and hyphens
   * @param {*} str
   * @returns
   */
  const santizeTmdbString = function (str) {
    // trim whitespace
    str = str.toLowerCase();
    // There are other strings that throw off the search too, like "1080p", "720p", etc.
    str = str.replace(
      /\b(1080p|720p|480p|x264|x265|h264|h265|bluray|brrip|webrip|web-dl|hdrip|dvdrip|ppvrip|iflix|www|dvdscr|cam)\b/gi,
      "",
    );
    str = str.replace(/\b(xvid|mp3|mp3-xvid|ac3-evo|ac3)\b/gi, "");
    // Replace non-alphanumeric characters (except spaces and hyphens) with spaces
    str = str.replace(/[^a-zA-Z0-9&\-]/g, " ");
    // Collapse multiple spaces into one
    str = str.replace(/\s+/g, " ");

    return str.trim();
  };

  /**
   * Further mutate the search string to hopefully, eventually get a hit from
   * the on-line movie database
   */
  const mutateTmbString = function (title) {
    // There are often a bunch of extra words tacked on the end of movies
    // that have been ripped. Maybe we progressively take those off.
    return title.split(" ").slice(0, -1).join(" ");
  };

  /**
   * Takes list of retrieved files in the library and hydrates their
   * entries with the metadata in the database.
   *
   * THIS IS INTENDED FOR RENDERING TO CLIENT
   *
   * This really doesn't hydrate entries. It just uses the file paths as the lookup key
   *
   * @param {*} keepId
   * @param {*} mergeId
   */
  const hydrateLibraryEntries = async function (files) {
    const hydratedEntries = [];

    for await (const file of files) {
      const filePath = path.join(file.path, file.name);
      const entry = await model.findOne({
        where: {
          path: filePath,
        },
      });
      hydratedEntries.push({
        id: entry.id,
        name: file.name,
        path: entry.path,
        title: entry.title,
        description: entry.description,
        favorite: entry.favorite,
        poster: entry.poster,
        backdrop: entry.backdrop,
      });
    }
    return hydratedEntries;
  };

  const getFile = function (filename) {
    // get the full path for the provided file
    return path.join(app.locals.libraryPaths[0], filename);
  };

  /**
   *
   * @param xmlString     string
   * @param regex         regex
   * @param notFoundValue *
   * @param captureGroup  int
   * @returns {*|null}
   */
  const parseXML = function (
    xmlString,
    regex,
    notFoundValue = null,
    captureGroup = 1,
  ) {
    if (!regex || !xmlString) return notFoundValue;
    const found = regex.exec(xmlString);
    if (found && found.length > 1) return found[captureGroup];
    return notFoundValue;
  };

  const calculateVolume = function (volume) {
    // Volume is an integer from 0 - 250???
    return `${Math.round((volume / 255) * 100)}%`;
  };

  const calculatePosition = function (position) {
    return `${Math.round(position * 100)}%`;
  };

  const calculateTime = function (seconds) {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec}`;
  };

  return {
    /**
     * Sync the media library filesystem to the database/cache
     *
     */
    syncLibrary: async function (req, res, next) {
      app.locals.debug && console.debug("Syncing library...");
      getLibrary()
        .then((library) => syncFsToDb(library))
        .then(() => syncDbToTmdb())
        .then(() => {
          app.locals.debug && console.debug("Library sync complete.");
        })
        .catch((error) => {
          console.error("Error during library sync:", error);
        });

      res.send("Library sync started.");
    },
    /**
     * Fetch the media library for display
     * @param {*} req
     * @param {*} res
     * @param {*} next
     */
    library: async function (req, res, next) {
      app.locals.debug && console.debug("Fetching library...");
      const searchTerm = req.query.search || null;
      // getLibrary(searchTerm)
      //   .then(library => hydrateLibraryEntries(library))
      //   .then(hydratedLibrary => {
      //     res.locals.render.library = hydratedLibrary
      //     next()
      //   })
      //   .catch(error => {
      //     console.error("Error fetching library:", error)
      //     next(error)
      //   })

      // Althernative with caching
      //
      res.locals.render.library = await app.locals.cache(
        `library${searchTerm}`,
        async () => {
          return await hydrateLibraryEntries(await getLibrary(searchTerm));
        },
      );
      // console.dir(res.locals.render.library, { depth: null })
      next();
    },
    /**
     * PLAYS/STARTS the VLC player with the provided media
     * @param {*} req
     * @param {*} res
     * @param {*} next
     */
    play: async function (req, res, next) {
      const id = req.params.id;
      model.findByPk(id).then(async (movie) => {
        if (!movie) {
          console.error("No movie found for id " + id);
        }
        console.log(`Playing media item: ${id}: "${movie.path}"`);
        const response = await fetch(
          `${app.locals.vlcUrl}?command=in_play&input=${encodeURIComponent(movie.path)}`,
          vlcAuthHeader,
        );
        console.log("VLC response:", await response.text());
      });
      next();
    },
    /**
     * PAUSES the VLC player
     * @param {*} req
     * @param {*} res
     * @param {*} next
     */
    pause: async function (req, res, next) {
      const id = req.params.id;
      console.log(`Pausing media item: ${id}`);
      const response = await fetch(
        `${app.locals.vlcUrl}?command=pl_pause`,
        vlcAuthHeader,
      );
      console.log("VLC response:", await response.text());
      next();
    },
    /**
     * Gets the status of the VLC player itself.
     * No library information is included here.
     * @param {*} req
     * @param {*} res
     * @param {*} next
     */
    status: async function (req, res, next) {
      console.log("Fetching VLC status");
      let xmlText;
      const status = {
        state: "disconnected",
      };

      try {
        const response = await fetch(`${app.locals.vlcUrl}`, vlcAuthHeader);
        xmlText = await response.text();
      } catch (error) {
        console.log(error);
        res.locals.render.error = error;
      }

      // app.locals.debug && console.debug("VLC status response:", xmlText);

      // Let's pick out some important stuff using regex
      status.volume = calculateVolume(
        parseXML(xmlText, /<volume>(\d*)<\/volume>/),
      );
      status.fullscreen = parseXML(
        xmlText,
        /<fullscreen>([^<>]*)<\/fullscreen>/,
      );
      status.position = calculatePosition(
        parseXML(xmlText, /<position>([\d\.]*)<\/position>/),
      );
      status.time = calculateTime(parseXML(xmlText, /<time>(\d*)<\/time>/));
      status.state = parseXML(
        xmlText,
        /<state>([^<>]*)<\/state>/,
        "disconnected",
      );
      status.length = calculateTime(
        parseXML(xmlText, /<length>(\d*)<\/length>/),
      );
      status.name = parseXML(xmlText, /<info name='filename'>([^<>]*)<\/info>/);

      app.locals.debug && console.debug("VLC parsed response:", status);
      res.locals.render.status = status;

      next();
    },
    /**
     * STOPs the VLC player
     * @param {*} req
     * @param {*} res
     * @param {*} next
     */
    stop: async function (req, res, next) {
      const id = req.params.id;
      console.log(`Stopping media item: ${id}`);
      const response = await fetch(
        `${app.locals.vlcUrl}?command=pl_stop`,
        vlcAuthHeader,
      );
      console.log("VLC response:", await response.text());
      next();
    },
    /**
     * Increases the VLC player volume
     * @param {*} req
     * @param {*} res
     * @param {*} next
     */
    volumeUp: async function (req, res, next) {
      console.log("Increasing VLC volume");
      const response = await fetch(
        `${app.locals.vlcUrl}?command=volume&val=%2B10`,
        vlcAuthHeader,
      );
      console.log("VLC response:", await response.text());
      next();
    },
    /**
     * Decreases the VLC player volume
     * @param {*} req
     * @param {*} res
     * @param {*} next
     */
    volumeDown: async function (req, res, next) {
      console.log("Decreasing VLC volume");
      const response = await fetch(
        `${app.locals.vlcUrl}?command=volume&val=%2D10`,
        vlcAuthHeader,
      );
      console.log("VLC response:", await response.text());
      next();
    },
    /**
     * Seeks forward 10 seconds in the VLC player
     * @param {*} req
     * @param {*} res
     * @param {*} next
     */
    seekPlus10Seconds: async function (req, res, next) {
      console.log("Seeking forward 10 seconds in VLC");
      const response = await fetch(
        `${app.locals.vlcUrl}?command=seek&val=%2B10`,
        vlcAuthHeader,
      );
      console.log("VLC response:", await response.text());
      next();
    },
    /**
     * Seeks backward 10 seconds in the VLC player
     * @param {*} req
     * @param {*} res
     * @param {*} next
     */
    seekMinus10Seconds: async function (req, res, next) {
      console.log("Seeking backward 10 seconds in VLC");
      const response = await fetch(
        `${app.locals.vlcUrl}?command=seek&val=%2D10`,
        vlcAuthHeader,
      );
      console.log("VLC response:", await response.text());
      next();
    },
    render: async function (req, res) {
      console.log("Rendering output");
      app.locals.debug && console.debug("Rendering:", res.locals.render);
      res.render("content", res.locals.render);
    },
  };
};
