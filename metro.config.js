const { getDefaultConfig } = require("expo/metro-config");

console.log("✅ metro.config.js LOADED"); // để kiểm tra chắc chắn config có chạy

const config = getDefaultConfig(__dirname);

// 1) CHỐT: tắt package.json "exports" (nguyên nhân Metro kéo victory-pie/es)
config.resolver.unstable_enablePackageExports = false;

// 2) Ưu tiên entry native trước, tránh Metro chọn ESM web
config.resolver.resolverMainFields = ["react-native", "main", "browser"];

// 3) (tùy chọn nhưng rất hay giúp) ưu tiên điều kiện require
config.resolver.unstable_conditionNames = ["react-native", "require", "default"];

module.exports = config;
