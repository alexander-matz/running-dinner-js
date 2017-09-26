/******************************************************************************
 * Data storage for the team list, constraints and matchups
 *
 * All this data is tabular (more or less, constraints are documents),
 * therefore the interface is row based.
 * Rows can be queried, inserted and updated atomatically.
 * Fields of a row can not be accessed individually without transferring the
 * whole row. Who gives a fuck, though, it's like 250 teams.
 * Also everything is using copies of objects, that reduces errors due to
 * accidental changes to (what was thought as) stale data.
 *
 * Most of the API is only executed on the client side, with the exception
 * of persistence.
 * Client side API is synchronous (because why not, it's easier).
 * Persistence API calls into the node backend and accepts a callback for
 * actions on completion.
 *****************************************************************************/

let rulesModel = (function() {
  "use strict";
  let text = undefined;
  function set(_text) {
    text = _text;
    sig.emit('rules-modified');
  }
  function get() {
    if (text === undefined) {
      reset();
    }
    return text;
  }
  function reset() {
    set(defaults.rules());
  }
  function serialize() {
    return text;
  }
  function deserialize(text) {
    set(text);
  }
  return {
    get: get,
    set: set,
    reset: reset,
    serialize: serialize,
    deserialize: deserialize,
  };
})();

let mapModel = (function() {
  "use strict";
  const bounds = [49.5054, 8.4318, 49.4695, 8.5006];
  function getBounds() {
    return [bounds[0], bounds[1], bounds[2], bounds[3]];
  }
  function geoToLocal(lat, lng, width, height) {
    let x = ((lng-bounds[1]) * width) / (bounds[3] - bounds[1]);
    let y = ((lat-bounds[0]) * height) / (bounds[2] - bounds[0]);
    return [x, y];
  };
  function localToGeo(x, y, width, height) {
      let lat = ((y/height) * (bounds[2] - bounds[0])) + bounds[0];
      let lng = ((x/width) * (bounds[3] - bounds[1])) + bounds[1];
      return [lat, lng];
  };
  function isWithinBounds(lat, lng) {
    return lat > bounds[2] && lat < bounds[0] && lng > bounds[1] && lng < bounds[3];
  }
  return {
    isWithinBounds: isWithinBounds,
    getBounds: getBounds,
    geoToLocal: geoToLocal,
    localToGeo: localToGeo,
  };
})();
