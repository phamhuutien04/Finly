const expo = require("eslint-config-expo/flat");

module.exports = [
  ...expo,
  {
    settings: {
      // BỎ QUA victory-native khi check unresolved import
      "import/ignore": ["victory-native"],

      "import/resolver": {
        typescript: {
          project: "./tsconfig.json",
        },
        node: true,
      },
    },
  },
];
