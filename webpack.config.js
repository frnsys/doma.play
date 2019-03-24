var path = require('path');

module.exports = {
  entry: {
    'city': ['@babel/polyfill', './front/city/app'],
    'play': ['@babel/polyfill', './front/play/app']
  },
  output: {
    path: path.resolve(__dirname, 'static/js'),
    filename: '[name].js'
  },
  devtool: 'inline-source-map',
  module: {
    rules: [{
      test: /\.js$/,
      exclude: /node_modules/,
      use: {
        loader: 'babel-loader',
        options: {
          presets: ['@babel/preset-env', '@babel/preset-react']
        }
      }
    }]
  },
  resolve: {
    extensions: ['.js']
  }
};
