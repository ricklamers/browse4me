const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: {
    background: './src/background.js',
    content: './src/content.js',
    popup: './src/popup.js',
    options: './src/options.js'
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'manifest.json', to: 'manifest.json' },
        { from: 'src/popup.html', to: 'popup.html' },
        { from: 'src/options.html', to: 'options.html' },
      ],
    }),
  ],
  performance: {
    maxAssetSize: 1000000, // Size in bytes, 1000000 = 1MB
    maxEntrypointSize: 1000000,
    hints: 'warning' // or 'error' to treat as errors, or false to disable
  },
  optimization: {
    minimize: false // Disable minification
  },
  devtool: 'source-map' // Generate source map
};