let persistence = (function() {
  "use strict";
  const localStoragePrefix = 'local-';
  // factored into separate function in order to not have dependencies at
  // script load time
  let models = function () {
    return [['teams', teamsModel], ['rules', rulesModel], ['match', bestMatching],
            ['mails', mails]];
  }

  function saveLocal() {
    for (let i = 0; i < models().length; ++i) {
      let [name, model] = models()[i];
      let serialized = model.serialize();
      localStorage.setItem(localStoragePrefix+name, serialized);
    }
    sig.emit('all-saved');
  }

  function loadLocal() {
    for (let i = 0; i < models().length; ++i) {
      let [name, model] = models()[i];
      let raw = localStorage.getItem(localStoragePrefix+name);
      if (raw !== undefined && raw !== null) {
        model.deserialize(raw);
      }
    }
    sig.emit('all-loaded');
  }

  function clearLocal() {
    for (let i = 0; i < models().length; ++i) {
      let [name, model] = models()[i];
      localStorage.removeItem(localStoragePrefix+name);
      model.reset();
    }
  }

  return {
    save: saveLocal,
    load: loadLocal,
    clear: clearLocal,
  };
})();
