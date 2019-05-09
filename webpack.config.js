var path = require('path');

module.exports = {
  entry: {
    'city': ['@babel/polyfill', './js/city/app'],
    'play': ['@babel/polyfill', './js/play/app'],
    'design': ['@babel/polyfill', './js/city/design']
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
