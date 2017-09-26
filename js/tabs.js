let tabs = (function() {
  "use strict";
  let cp = null;
  let tp = null;
  let active = '';
  let tabs = {};

  function init(tabpane, contentpane) {
    tp = tabpane;
    cp = contentpane;
  }

  function add(config) {
    let {name, text, init} = config;
    if (name in tabs) {
      throw "tab already registered!";
    }
    let tab = $('<div>').addClass('tab-link');
    tab.text(text);
    tab.click((event) => { tryActivate(name); });
    $(tp).append(tab);

    let view = $('<div>').addClass('tab-view');
    view.attr('view', name);
    view.css('display', 'none');
    $(cp).append(view);
    config.onInit(view);

    tabs[name] = {
      name: name,
      text: text,
      tab: tab,
      view: view,
      onActivate: config.onActivate,
      onBeforeDeactivate: config.onBeforeDeactivate,
      onDeactivate: config.onDeactivate,
    };
  }

  function addSpacer() {
    let spacer = $('<div class="tab-spacer"></div>');
    $(tp).append(spacer);
  }

  function activate(name) {
    if (! name in tabs) {
      throw "trying to activate unknown tab!";
    }

    if (active != '') {
      tabs[active].tab.removeClass('tab-active');
      tabs[active].view.css('display', 'none');
      if (tabs[active].onDeactivate) {
        tabs[active].onDeactivate();
      }
    }

    active = name;
    tabs[name].tab.addClass('tab-active');
    tabs[name].view.css('display', 'block');
    if (tabs[name].onActivate) {
      tabs[name].onActivate();
    }
  }

  function tryActivate(name) {
    if (active == name) {
      return;
    }
    if (active in tabs && tabs[active].onBeforeDeactivate) {
      // asynchronous guard
      tabs[active].onBeforeDeactivate(() => {
        activate(name);
      });
    } else {
      activate(name);
    }
  }

  return {
    init: init,
    add: add,
    addSpacer: addSpacer,
    tryActivate: tryActivate
  };
})();
