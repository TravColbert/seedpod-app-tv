const { DataTypes } = require("sequelize");

module.exports = function (app) {
  const Movie = app.locals.db.define(
    "Movie",
    {
      tmdbId: {
        comment: [
          "The TMDB (The Movie Database) unique identifier for the movie",
          "Sourced from the TMDB API 'id' field",
          "In cases where we have the same movie in different places in our filesystem,",
          "this ID may not be unique across records. If the TMDB lookup has not been performed yet, this field may be null.",
        ],
        type: DataTypes.INTEGER,
        allowNull: true,
        validate: {
          isInt: {
            msg: "TMDB ID must be an integer",
          },
          min: {
            args: 1,
            msg: "TMDB ID must be a positive integer",
          },
        },
      },
      title: {
        comment: [
          "The title of the movie",
          "Sourced from the TMDB API 'title' field",
        ],
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: {
            msg: "Title cannot be empty",
          },
          len: {
            args: [1, 100],
            msg: "Title must be between 1 and 100 characters",
          },
        },
      },
      searchTitle: {
        comment: [
          "The title string that is used to search the on-line movie database",
          "Persisted so we can implement systematic searches",
        ],
        type: DataTypes.STRING,
      },
      path: {
        comment: ["The filesystem path where the movie file is located"],
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
          notEmpty: {
            msg: "Path cannot be empty",
          },
        },
      },
      preferred: {
        comment: [
          "In cases where multiple movies exist with the same title",
          "this flag indicates which one should be shown by default",
        ],
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      description: {
        comment: [
          "A brief description or synopsis of the movie",
          "Sourced from the TMDB API 'overview' field",
        ],
        type: DataTypes.TEXT,
        validate: {
          max: {
            args: [1000],
            msg: "Description must be at most 1000 characters",
          },
        },
      },
      favorite: {
        comment: [
          "Indicates whether this movie is marked as a favorite by the user",
        ],
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      needsResync: {
        comment: [
          "Indicates whether this movie's metadata needs to be resynchronized with the TMDB API",
        ],
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      poster: {
        comment: [
          "URL to a poster image for the movie from the TMDB API",
          "The URL is composed of 3 pieces: Those pieces are a base_url, a file_size and a file_path.",
          "Example: https://image.tmdb.org/t/p/w500/abcd1234.jpg",
          "Where https://image.tmdb.org/t/p/ is the base_url, w500 is the file_size and /abcd1234.jpg is the file_path",
          "We'll have to implement a model method that retrieves the base_url and file_size from TMDB's configuration API endpoint",
          "and then combines those with the file_path we store here to produce the full URL",
        ],
        type: DataTypes.STRING,
        validate: {
          isUrl: {
            msg: "Poster must be a valid URL",
          },
        },
      },
      backdrop: {
        comment: [
          "URL to a backdrop image for the movie from the TMDB API",
          "The URL is composed of 3 pieces: Those pieces are a base_url, a file_size and a file_path.",
          "Example: https://image.tmdb.org/t/p/w780/abcd1234.jpg",
          "Where https://image.tmdb.org/t/p/ is the base_url, w780 is the file_size and /abcd1234.jpg is the file_path",
          "We'll have to implement a model method that retrieves the base_url and file_size from TMDB's configuration API endpoint",
          "and then combines those with the file_path we store here to produce the full URL",
        ],
        type: DataTypes.STRING,
        validate: {
          isUrl: {
            msg: "Backdrop must be a valid URL",
          },
        },
      },
    },
    {
      indexes: [
        {
          unique: true,
          fields: ["path"],
        },
        {
          unique: false,
          fields: ["title"],
        },
        {
          unique: false,
          fields: ["tmdbId"],
        },
      ],
    },
  );

  return Movie;
};
