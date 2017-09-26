(function($) {
  "use strict";
  function delayedOnce(fn, timeout) {
    let timeoutHandler = null;
    let args = [];
    function wrappedFn() {
      fn.apply(null, args);
      timeoutHandler = null;
    }
    return function () {
      if (timeoutHandler !== null) {
        clearTimeout(timeoutHandler);
      }
      args = arguments;
      timeoutHandler = setTimeout(wrappedFn, timeout*1000);
    }
  }

  let resize = delayedOnce((table) => {
    updateSize(table);
  }, 0.250);

  function click(table, body, event) {
    let data = $(table).data('egrid');
    let target = $(event.target);
    let type = target.attr('data-type');
  }

  function dblClick(table, body, event) {
    let data = $(table).data('egrid');
    let target = $(event.target);
    let type = target.attr('data-type');
    if (type == 'cell') {
      let row = parseInt(target.parent().attr('data-row'));
      let col = parseInt(target.attr('data-col'));
      if (data.editing === false && data.columns[col].editable !== false) {
        editStartRow(table, row);
        editStartCol(table, col);
      }
    }
  }

  //****************************************************
  function editOnKeyDown(table, event) {
    let data = table.data('egrid');
    let {input} = data;
    if (data.editing === false) {
      return;
    }
    if (event.key === 'Enter') {
      editSubmitCol(table);
      editSubmitRow(table);
      editEnd(table);
    }
    if (event.key === 'Escape') {
      editEnd(table);
    }
    if (event.key === 'Tab') {
      event.preventDefault();
      let {row, col}  = data.editing;
      if ((!event.shiftKey) && col < (data.columns.length - 1)) {
        editSubmitCol(table);
        editStartCol(table, col + 1);
      }
      if ((event.shiftKey) && col > 0 && (data.columns[col-1].editable)) {
        editSubmitCol(table);
        editStartCol(table, col - 1);
      }
    }
    if (event.key === 'ArrowUp' && event.altKey === true) {
      let {row, col}  = data.editing;
      if (row > 0) {
        editSubmitCol(table);
        editSubmitRow(table);
        data.editing = false;
        editStartRow(table, row-1);
        editStartCol(table, col);
      }
    }
    if (event.key === 'ArrowDown' && event.altKey === true) {
      let {row, col}  = data.editing;
      if (row < (data.rows.length-1)) {
        editSubmitCol(table);
        editSubmitRow(table);
        data.editing = false;
        editStartRow(table, row+1);
        editStartCol(table, col);
      }
    }
  }

  // is called before keydown, which is problematic if a tab is the reason
  // for the lost focus. So we delay edit abortion a bit to check if
  // we just moved the edit
  function editOnFocusOut(table, event) {
    let data = table.data('egrid');
    let {col, row} = data.editing;
    if (data.editing === false) {
      return;
    }
    setTimeout(() => {
      let data = table.data('egrid');
      let newCol = data.editing.col;
      let newRow = data.editing.row;
      if (newCol == col && newRow == row) {
        editEnd(table);
      }
    }, 1);
  }

  function editStartRow(table, row) {
    let data = table.data('egrid');
    if (data.editing !== false) {
      throw 'trying to edit multiple rows';
    }
    let oldRow = $.extend({}, data.rows[row]);
    let newRow = $.extend({}, data.rows[row]);
    data.editing = {row: row, oldData: oldRow, newData: newRow};
    table.data('egrid', data);

    let {input} = data;
    input.on('keydown', (event) => {editOnKeyDown(table, event);});
    input.on('focusout', (event) => {editOnFocusOut(table, event);})

    if (data.onStartEdit !== undefined) {
      data.onStartEdit(oldRow);
    }
  }

  function editSubmitRow(table) {
    let data = table.data('egrid');
    let {row, newData} = data.editing;
    data.rows[row] = newData;
    table.data('egrid', data);
    updateRows(table);

    let {input} = data;
    input.off('keydown');
    input.off('focusout');
    input.remove();
    if (data.onEdited !== undefined) {
      data.onEdited(newData);
    }
  }

  function editStartCol(table, col) {
    let data = table.data('egrid');
    let {ids, input, scrollBox, body, columns} = data;
    let {row, newData} = data.editing;

    // init and move input
    let cell = $(body[0].children[row].children[col]);
    let [left, top] = [cell[0].offsetLeft, cell[0].offsetTop];
    let {width, height} = cell[0].getBoundingClientRect();
    input.css({
      'position': 'absolute',
      'left': left + 'px',
      'top': top + 'px',
      'width': width + 'px',
      'height': height + 'px'
    });
    scrollBox.append(input);

    input.val(newData[ids[col]]);
    input.focus();
    input.select();

    data.editing.col = col;
    table.data('egrid', data);
  }

  function editSubmitCol(table) {
    let data = table.data('egrid');
    let {ids, input, body, columns} = data;
    let {row, col, newData} = data.editing;
    newData[ids[col]] = input.val();
    let cell = $(body[0].children[row].children[col]);
    cell.text(newData[ids[col]]);
    table.data('egrid', data)
  }

  function editEnd(table) {
    let data = table.data('egrid');
    let {input} = data;
    data.editing = false;
    input.remove();
    table.data('egrid', data);
    updateRows(table);
    if (data.onEndEdit !== undefined) {
      data.onEndEdit();
    }
    window.getSelection().removeAllRanges();
  }

  //****************************************************
  function updateSize(elem) {
    let data = elem.data('egrid');
    let {columns, head, body} = data;
    let width = body[0].clientWidth;

    let availableWidth = width;
    let widths = [];
    for (let i = 0; i < columns.length; ++i) {
      widths[i] = (availableWidth / columns.length) + 'px';
    }

    // head
    let headCells = head.children();
    for (let i = 0; i < headCells.length; ++i) {
      let cell = $(headCells[i]);
      cell.css('width', widths[i]);
    }

    // body
    let rows = body.children();
    for (let i = 0; i < rows.length; ++i) {
      let cells = $(rows[i]).children();
      for (let j = 0; j < cells.length; ++j) {
        let cell = $(cells[j]);
        cell.css('width', widths[j]);
      }
    }
  }

  //****************************************************
  function copyRows(rows, ids) {
    let result = [];
    for (let i = 0; i < rows.length; ++i) {
      let row = {};
      for (let j in ids) {
        let id = ids[j];
        let val = rows[i][id];
        if (val !== null && val !== undefined) {
          row[id] = val;
        } else {
          row[id] = '';
        }
      }
      result[i] = row;
    }
    return result;
  }

  function updateData(elem, rows) {
    let data = elem.data('egrid');
    let {columns, extraFields} = data;
    let ids = [];
    for (let i = 0; i < columns.length; ++i) {
      ids[i] = columns[i].id;
    }
    // additional invisible fields
    for (let i = 0; i < extraFields.length; ++i) {
      ids[columns.length+i] = extraFields[i];
    }
    data.rows = copyRows(rows, ids);
    elem.data('egrid', data);
    updateRows(elem);
  };

  function joinClasses() {
    let className;
    for (let i = 0; i < arguments.length; ++i) {
      if (arguments[i] === undefined || arguments[i] === null && arguments[i] === '') {
        continue;
      }
      if (className === undefined) {
        className = arguments[i];
      } else {
        className += ' ' + arguments[i];
      }
    }
    return className;
  }

  function updateRows(elem) {
    let {onStyleRow, columns, rows, body} = elem.data('egrid');

    let rowNumberChanged = false;

    // adjust number of rows
    while (body.children().length > rows.length) {
      body.children().first().remove();
      rowNumberChanged = true;
    }
    while (body.children().length < rows.length) {
      let rowElem = $('<div>');
      rowElem.attr('data-type', 'row');
      for (let i = 0; i < columns.length; ++i) {
        let cellElem = $('<div>');
        cellElem.attr('data-type', 'cell');
        rowElem.append(cellElem);
      }
      body.append(rowElem);
      rowNumberChanged = true;
    }

    // update row text, ids etc.
    let rowElems = body[0].children;
    for (let i = 0; i < rows.length; ++i) {
      let row = rows[i];
      let rowElem = rowElems[i];
      let styles = {};

      // get user styling
      if (onStyleRow) {
        styles = onStyleRow(row) || {};
      }

      rowElem.setAttribute('data-row', i);
      rowElem.className = joinClasses('egrid-body-row', styles['row']);

      for (let j = 0; j < columns.length; ++j) {
        let cellElem = rowElem.children[j];

        let id = columns[j].id;
        let val = rows[i][id];
        //cellElem.innerHTML = String(val);
        cellElem.innerHTML = val;
        cellElem.setAttribute('data-col', j);

        // set styling
        cellElem.className = joinClasses('egrid-body-cell', columns[j].class, styles[id]);

      }
    }

    updateSize(elem);
  }

  //****************************************************
  function updateColumns(elem, _columns) {
    let data = elem.data('egrid');
    if (data === undefined) {
      throw "can't set columns on uninitialized egrid";
    }

    let columns = [];
    let ids = [];
    for (let i = 0; i < _columns.length; ++i) {
      if (_columns[i].id === undefined) {
        throw "tried to add column without id";
      }
      ids[i] = _columns[i].id;
      columns[i] = $.extend({
        editable: true
      }, _columns[i])
    }

    data.ids = ids;
    data.columns = columns;
    elem.data('egrid', data);

    let {head, body} = data;

    head.empty();
    for (let i = 0; i < columns.length; ++i) {
      let cell = $('<div>').addClass('egrid-head-cell');
      if ('class' in columns[i]) {
        cell.addClass(columns[i].class);
      }
      cell.text(columns[i].title);
      head.append(cell);
    }

    body.empty();
  };

  //****************************************************
  function setupBasics(elem) {
    let head = $('<div>').addClass('egrid-head');
    let scrollBox = $('<div>').addClass('egrid-scrollbox');
    let body = $('<div>').addClass('egrid-body');
    let input = $('<input>').addClass('egrid-input');

    elem.empty();
    elem.resize(() => { resize(elem); });

    elem.addClass('egrid');
    scrollBox.append(body);
    elem.append(head).append(scrollBox);
    body.on('dblclick', (event) => {dblClick(elem, body, event); });
    body.on('click', (event) => {click(elem, body, event); });
    elem.data('egrid', {
      editing: false,
      rows: [],
      input: input,
      head: head,
      scrollBox: scrollBox,
      body: body,
    });
  }

  function extendSome(names, target, source) {
    for (let i = 0; i < names.length; ++i) {
      let name = names[i];
      if (source[name] !== undefined) {
        target[name] = source[name];
      }
    }
  }

  function commands(table, command, args) {
    let data = table.data('egrid');
    if (command == 'refresh') {
      updateRows(table);
    } else {
      throw `unknown command ${command}`;
    }
  }

  function config(elem, opts) {
      if (opts.columns === undefined && opts.data === undefined) {
        throw "cannot configure egrid without neither columns or data";
      }
      if (elem.data('egrid') === undefined) {
        setupBasics(elem);
      }

      let data = elem.data('egrid');
      extendSome(['onStartEditing', 'onEndEditing', 'onEdited',
        'onStyleRow','extraFields'],
        data, opts);
      if (data.extraFields === undefined) {
        data.extraFields = [];
      }
      elem.data('egrid', data);

      if ('columns' in opts) {
        updateColumns(elem, opts.columns);
      }
      if ('data' in opts) {
        updateData(elem, opts.data);
      }
  }

  $.fn.egrid = function(opts) {
    let args = arguments;
    return this.each(() => {
      let elem = $(this);

      if (typeof(opts) === 'string') {
        commands(elem, args[0], [...args].slice(1));
      } else {
        config(elem, opts);
      }
    });
  };
})(jQuery);
