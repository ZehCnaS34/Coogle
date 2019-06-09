const path = require("path");

module.exports = {
  mode: "development",
  entry: "./web/app.js",
  output: {
    path: path.resolve(__dirname, "static"),
    filename: "bundle.js"
  },
  module: {
    rules: [
      {
        test: /\.m?js$/,
        exclude: /(node_modules)/,
        use: {
          loader: "babel-loader",
          query: {
            babelrc: true
          }
        }
      }
    ]
  }
};
