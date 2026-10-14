import 'react-native-url-polyfill/auto';
import { getRandomValues } from 'expo-crypto';

class CryptoPolyfill {
  getRandomValues = getRandomValues;
}

// @ts-ignore
if (!global.crypto) {
  // @ts-ignore
  global.crypto = new CryptoPolyfill();
}