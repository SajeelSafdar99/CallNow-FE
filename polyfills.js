// Polyfill for EventEmitter
if (!global.EventEmitter) {
  const EventEmitter = require('events');
  global.EventEmitter = EventEmitter;
}

// Polyfill for expo
if (!global.expo) {
  global.expo = {};
}

if (!global.expo.EventEmitter) {
  global.expo.EventEmitter = global.EventEmitter;
}
