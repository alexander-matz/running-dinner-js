/******************************************************************************
 * Team list
 *
 * Row Format:
 * id, cook1name, cook1last,, mail1, cook2name, cook2last, mail2, address, phone, comments, lat, lng
 * The ID is not to be touched by the user!
 *****************************************************************************/
let teamsModel = (function() {
  "use strict";
  let ids = {};
  let store = [];
  let lockm = false;
  let modified = false;

  function lockModified() {
    lockm = true;
  }
  function unlockModified() {
    lockm = false;
    sig.emit('teams-modified');
  }

  function clear() {
    store = [];
    if (!lockm) sig.emit('teams-modified');
  }

  function makeIndex(row) {
    let attempt = row.cook1name.substring(0, 1).toLowerCase() +
                  row.cook1last.substring(0, 1).toLowerCase() +
                  row.cook2name.substring(0, 1).toLowerCase() +
                  row.cook2last.substring(0, 1).toLowerCase();
    if (!(attempt in store)) {
      return attempt;
    } else {
      let i = 1;
      while ((attempt+i) in store) {
        i += 1;
      }
      return (attempt+i);
    }
  }

  function hasRequired(row, fields) {
    for (let i = 0; i < fields.length; ++i) {
      if (!(fields[i] in row) || row[fields[i]] == '')
        return false;
    }
    return true;
  }

  function addRow(row) {
    if (!hasRequired(row, ['cook1name', 'cook1last', 'cook2name', 'cook2last'])) {
      return [false, "required field is missing"]
    }
    let id = makeIndex(row);
    let newRow = {
      id: id,
      cook1name: row.cook1name,
      cook1last: row.cook1last,
      cook1mail: row.cook1mail,
      cook2name: row.cook2name,
      cook2last: row.cook2last,
      cook2mail: row.cook2mail,
      address: row.address,
      phone: row.phone,
      comments: row.comments || null,
      lat: (isNaN(row.lat) ? null : parseFloat(row.lat)),
      lng: (isNaN(row.lng) ? null : parseFloat(row.lng)),
    };
    ids[id] = true;
    store.push(newRow);
    store.sort(function (a, b) {
      if (a.id < b.id) {
        return -1;
      } else {
        return 1;
      }
    });

    if (!lockm) sig.emit('teams-modified');

    return [id, null];
  }

  function updateRow(row) {
    if (!('id' in row)) {
      return [false, "id is missing"];
    }
    for (let i = 0; i < store.length; ++i) {
      if (store[i].id === row.id) {
        if ('cook1name' in row) store[i].cook1name = row.cook1name;
        if ('cook1last' in row) store[i].cook1last = row.cook1last;
        if ('cook1mail' in row) store[i].cook1mail = row.cook1mail;
        if ('cook2name' in row) store[i].cook2name = row.cook2name;
        if ('cook2last' in row) store[i].cook2last = row.cook2last;
        if ('cook2mail' in row) store[i].cook2mail = row.cook2mail;
        if ('address' in row) store[i].address = row.address;
        if ('phone' in row) store[i].phone = row.phone;
        if ('comments' in row) store[i].comments = row.comments;
        if ('lat' in row && !isNaN(row.lat)) store[i].lat = parseFloat(row.lat);
        if ('lng' in row && !isNaN(row.lng)) store[i].lng = parseFloat(row.lng);
        if (!lockm) sig.emit('teams-modified');
        break;
      }
    }
  }

  function removeRow(rowOrId) {
    let id
    if (type[rowOrId] === 'object') {
      id = rowOrId[0];
    } else {
      id = rowOrId;
    }
    if (!(id in ids)) {
      return false;
    }
    if (!lockm) sig.emit('teams-modified');
    return false;
  }

  function getOne(id) {
    for (let i = 0; i < store.length; ++i) {
      if (store[i].id === id) {
        return $.extend({}, store[i]);
      }
    }
    return null;
  }

  function get(fn) {
    if (fn === undefined) fn = () => {return true;};
    let result = [];
    for (let i = 0; i < store.length; ++i) {
      if (fn(store[i])) {
        result.push($.extend({}, store[i]));
      }
    }
    return result;
  }

  function getAll() {
    return get(() => {return true;});
  }

  function getNumber() {
    return store.length;
  }

  function reset() {
    store = [];
    ids = ids;
  }

  function serialize() {
    return JSON.stringify(store);
  }

  function deserialize(data) {
  let newStore = JSON.parse(data);
    let newIds = {};
    for (let i = 0; i < newStore.length; ++i) {
      newIds[newStore[i].id] = true;
    }
    store = newStore;
    ids = newIds;
    if (!lockm) sig.emit('teams-modified')
  }

  return {
    clear: clear,
    makeId: makeIndex,
    addRow: addRow,
    updateRow: updateRow,
    getOne: getOne,
    get: get,
    getAll: getAll,
    getNumber: getNumber,
    reset: reset,
    serialize: serialize,
    deserialize: deserialize,
    lockModified: lockModified,
    unlockModified: unlockModified,
  };

})();
