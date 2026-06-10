module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    ['@babel/plugin-proposal-decorators', {legacy: true}],
    // Reanimated plugin MUST be last
    'react-native-reanimated/plugin',
  ],
};
