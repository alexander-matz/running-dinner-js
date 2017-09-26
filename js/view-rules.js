let vRules = (function() {
  "use strict";

  let view = null;
  let editor = null;
  let bar = null;
  let overlay = null;
  let locked = false;

  function lock() {
    locked = true;
  }
  function unlock() {
    locked = false;
  }

  function updateAll() {
    lock();
    editor.val(rulesModel.get());
    unlock();
    overlayControl.updateErrors();
  }

  let overlayControl = (function () {
    let overlay;
    let editor;
    let errors = {};
    let message;
    let lineHeight = 0;

    function init(_overlay, _editor) {
      overlay = _overlay;
      editor = _editor;
      message =  $('<div>').addClass('message');
    }

    function updateMessage(line) {
      if (errors[line] !== undefined) {
        message.text(errors[line]);
        message.css({
          'display': 'block',
          'left': '1px',
          'top': (line * lineHeight + lineHeight) + 'px',
        });
        overlay.append(message);
      } else {
        message.css('display', 'none');
      }
    }

    function updateErrors() {
      let source = editor.val();
      let teams = teamsModel.getAll();
      let dishes = ['starter', 'main', 'dessert'];
      lineHeight = parseInt(editor.css('line-height'), 10);
      errors = {};

      let [errSyn, cns] = matching.parseConstraints(source);
      for (let i = 0; i < errSyn.length; ++i) {
        errors[errSyn[i][0]-1] = errSyn[i][1];
      }
      let errCn = matching.checkConstraints(teams, dishes, cns);
      for (let i = 0; i < errCn.length; ++i) {
        let cn = cns[errCn[i][0]];
        errors[cn.line-1] = errCn[i][1];
      }

      lineHeight = parseInt(editor.css('line-height'), 10);
      overlay.empty();
      for (let line in errors) {
        let bar = $('<div>').addClass('error');
        bar.css({
          'left': 0,
          'top': (line*lineHeight) + 'px',
        });
        overlay.append(bar);
      }
    }
    return {
      init: init,
      updateErrors: updateErrors,
      updateMessage: updateMessage,
    }
  })();

  function onInit(elem) {
    view = elem;
    let container = $('<div>').attr('id', 'rules-container');
      let editorDiv = $('<div>').attr('id', 'rules-editor');
        overlay = $('<div>').attr('id', 'rules-editor-overlay');
        editor = $('<textarea>').attr('id', 'rules-editor-edit');
      let help = $('<div>').attr('id', 'rules-help').html(defaults.rulesHelp());
    container.append(editorDiv);
      editorDiv.append(overlay);
      editorDiv.append(editor);
    container.append(help);

    editor.on('scroll', (event) => {
      overlay.prop('scrollTop', editor.prop('scrollTop'));
    });

    editor.on('mousemove', delayedOnce.make(function(event) {
      let lineHeight = parseInt(editor.css('line-height'), 10);
      let line = Math.floor(event.offsetY / lineHeight);
      overlayControl.updateMessage(line);
    }, 0.05));

    editor.on('input', delayedOnce.make(function(event) {
      overlayControl.updateErrors();
      if (locked) return;
      rulesModel.set(editor.val());
    }, 0.25));

    sig.on('rules-modified', () => {
      locked = true;
      editor.val(rulesModel.get());
      locked = false;
    });

    overlayControl.init(overlay, editor);

    locked = true;
    editor.val(rulesModel.get());
    locked = false;

    view.append(container);
  }

  function onActivate() {
    updateAll();
  }

  function onDeactivate() {
  }

  return {
    onInit: onInit,
    onActivate: onActivate,
  };
})();
