let vTeams = (function() {
  "use strict";

  let view = null;
  let teamTable = null;
  let pendingIdx = 0;
  let pending = [];
  let similar = {};
  let updating = true;

  let columns = null;

  function onChangedColumns(choices) {
    if (choices === undefined) {
      choices = {
        'cook1': true,
        'cook2': true,
        'info': true,
        'comments': false,
        'coords': true,
      }
    }

    columns = [{ title: 'ID', id: 'id', editable: false, width: '60px', class: 'team-id' }];
    if (choices.cook1) {
      columns = columns.concat([
        { title: 'Name 1', id: 'cook1name' },
        { title: 'Last 1', id: 'cook1last' },
        { title: 'Mail 1', id: 'cook1mail' },
      ]);
    }
    if (choices.cook2) {
      columns = columns.concat([
        { title: 'Name 2', id: 'cook2name' },
        { title: 'Last 2', id: 'cook2last' },
        { title: 'Mail 2', id: 'cook2mail' },
      ]);
    }
    if (choices.info) {
      columns = columns.concat([
        { title: 'Address', id: 'address' },
        { title: 'Phone', id: 'phone'},
      ]);
    }
    if (choices.comments) {
      columns.push({ title: 'Comments', id: 'comments'});
    }
    if (choices.coords) {
      columns = columns.concat([
        { title: 'Lat.', id: 'lat', width: '40px'},
        { title: 'Lng.', id: 'lng', width: '40px'},
      ]);
    }
    updateTable();
  }

  function updateTable() {
    if (!updating) return;
    teamTable.egrid({
      columns: columns,
      data: pending.concat(teamsModel.getAll()),
    });
  }

  function onStartEdit() {
    updating = false;
  }

  function onEndEdit() {
    updating = true;
  }

  function onEdited(row) {
    let pendingIdx = row.pending;
    if (row.id !== '') {
      if (row.lat === "" || isNaN(row.lat)) row.lat = undefined;
      if (row.lng === "" || isNaN(row.lng)) row.lng = undefined;
      teamsModel.updateRow(row);
    } else {
      teamsModel.lockModified();
      let [newId, err] = teamsModel.addRow(row);

      if (newId !== false) {
        for (let i = 0; i < pending.length; ++i) {
          if (pending[i].pending == pendingIdx) {
            pending.splice(i, 1);
          }
        }
      } else {
        for (let i = 0; i < pending.length; ++i) {
          if (pending[i].pending == pendingIdx) {
            pending[i] = row;
          }
        }
      }
      teamsModel.unlockModified();
    }
  }

  function onStyleRow(row) {
    let style = {};
    if (row.pending !== '') {
      style.row = 'pending-row';
    }
    let [lat, lng] = [parseFloat(row.lat), parseFloat(row.lng)];
    if (row.pending == '' && !mapModel.isWithinBounds(lat, lng)) {
      style.lat = 'too-far';
      style.lng = 'too-far';
    }
    return style;
  }

  let geoInflight;
  function onGeocodeStart(number) {
    if (geoInflight > 0) {
      return false;
    }
    teamsModel.lockModified();
    sig.emit('loading-start');
    geoInflight = number;
  }

  function onGeocodeTick() {
    geoInflight--;
    if (geoInflight === 0) {
      onGeocodeDone();
    }
  }

  function onGeocodeDone() {
    teamsModel.unlockModified();
    sig.emit('loading-stop');
  }

  function onActivate() {
    teamTable.egrid('refresh');
  }

  function onInit(elem) {
    view = elem;
    let teamContainer = $('<div>').attr('id', 'team-container');
      let controls = $('<div>').attr('id', 'team-controls');
        let buttonAdd = $('<button>').attr('id', 'team-add').text('add team');
        let buttonClear = $('<button>').attr('id', 'team-clear').text('delete all');
        let buttonLocs = $('<button>').attr('id', 'team-locs').text('resolve addresses');
        let buttonColumns = $('<button>').attr('id', 'team-columns').text('columns');
      teamTable = $('<div>').attr('id', 'team-table');
    teamContainer.append(controls);
      controls.append(buttonAdd);
      controls.append(buttonClear);
      controls.append(buttonLocs);
      controls.append(buttonColumns);
    teamContainer.append(teamTable);

    buttonLocs.on('click', (event) => {
      let rows = teamsModel.get();
      const bounds = mapModel.getBounds();
      let nrows = rows.length;

      onGeocodeStart(nrows);
      let delayedUpdate = delayedOnce.make(function () {
        updateTable();
      }, 0.5);

      for (let i = 0; i < nrows; ++i) {
        let row = rows[i];
        geo.code(row.address, function (err, results) {
          onGeocodeTick();
          if (!err) {
            teamsModel.updateRow({id: row.id, lat: results[0].lat, lng: results[0].lng});
            delayedUpdate();
          } else {
          }
        });
      }
    });

    buttonAdd.on('click', (event) => {
      let newRow = {pending: 'pending'+pendingIdx}
      pendingIdx += 1;
      pending[pending.length] = newRow;
      updateTable();
    });

    buttonClear.on('click', (event) => {
      teamsModel.clear();
    });

    buttonColumns.dropdownmulti([
        ['First cook', 'cook1', true],
        ['Second cook', 'cook2', true],
        ['Contact info', 'info', true],
        ['Comments', 'comments', false],
        ['Coordinates', 'coords', true],
      ],
      {
        onStartEdit: onStartEdit,
        onChanged: (choices) => {onChangedColumns(choices);},
        onEndEdit: onEndEdit,
      });

    view.append(teamContainer);
    onChangedColumns();

    teamTable.egrid({
      columns: columns,
      extraFields: ['pending'],
      onStyleRow: onStyleRow,
      onEdited: onEdited,
    });

    sig.on('teams-modified', () => {
      updateTable();
    });
  }
  return {
    onInit: onInit,
    onActivate: onActivate,
  };
})();
