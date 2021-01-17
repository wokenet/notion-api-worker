const path = require('path')

const mode = process.env.NODE_ENV || 'production'

module.exports = {
  entry: './index.ts',
  output: {
    filename: `worker.js`,
    path: path.join(__dirname, 'dist'),
  },
  target: 'webworker',
  mode,
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        loader: 'ts-loader',
        options: {
          transpileOnly: true,
        },
      },
    ],
  },
}
