const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const sharedDir = path.resolve(__dirname, '../packages/shared')

const config = getDefaultConfig(__dirname)

// Allow Metro to resolve modules outside the app root (shared package)
config.watchFolders = [...(config.watchFolders || []), sharedDir]
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  '@importflow/shared': sharedDir,
}

module.exports = config
