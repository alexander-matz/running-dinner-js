let vFooter = (function() {
  "use strict";

  let dom = null;
  let modified = null;
  let numTeams = null;

  function init(elem) {
    dom = elem;
    numTeams = $('<div>').text(`Teams: ${teamsModel.getNumber()}`);
    elem.append(numTeams);
    sig.on('*-modified', onModifiedAny);
    sig.on('all-saved', onSavedAll);
    sig.on('all-loaded', onLoadedAll);
    sig.on('error', onSignalError);
  }

  function onModifiedAny() {
    numTeams.text(`Teams: ${teamsModel.getNumber()}`);
    if (dom === null || modified !== null) {
      return;
    }
    modified = $('<div>').addClass('warning').text('unsaved changes');
    dom.append(modified);
    $(modified).fadeIn(300);
  }

  function onSavedAll() {
    if (dom === null || modified === null) {
      return;
    }
    $(modified).fadeOut(300);
    modified = null;
  }

  function onLoadedAll() {
    numTeams.text(`Teams: ${teamsModel.getNumber()}`);
    if (dom === null || modified === null) {
      return;
    }
    $(modified).fadeOut(300);
    modified = null;
  }

  function onSignalError(msg) {
    let elem = $('<div>').addClass('error').text(msg);
    dom.append(elem);
    setTimeout(() => {
      elem.fadeOut(500);
    }, 5000);
  }

  return {
    init: init,
  };
})();

/*********************************************************************
 ********************************************************************/

let vLoading = (function() {
  "use strict";
  let view = null;
  function init(elem) {
    view = $(elem);
    view.addClass('sk-cube-grid');
    for (let i = 1; i < 10; ++i) {
      let div = $('<div>').addClass('sk-cube').addClass(`sk-cube${i}`);
      view.append(div);
    }
    view.css('display', 'none');
  };
  sig.on('loading-start', () => {
    view.css('display', 'block');
  });
  sig.on('loading-stop', () => {
    view.css('display', 'none');
  });
  return {
    init: init
  }
})();

/*********************************************************************
 ********************************************************************/

let vDb = (function() {
  "use strict";
  let view = null;

  let withContents = function (file, fn) {
    let reader = new FileReader();
    reader.onload = (function(theFile) {
      return function (e) {
        return fn(e.target.result);
      }
    })(file);
    reader.readAsText(file, 'utf8');
  }

  let downloadFile = function (filename, contents) {
    let href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(contents);
    let link = document.createElement('a');
    link.href = href;
    link.download = filename;
    link.click();
  }

  let showFile = function(contents) {
    let href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(contents);
    window.open(href, '_blank');
  }

  function onSaveBtn() {
    db.save();
  }

  function onTeamImport(file) {
    withContents(file, (contents) => {
      let [err, rows] = csv.fromString(contents, {
        quote: '"',
        separator: ',',
        requiredFields: [
          'cook1name', 'cook1last', 'cook1mail',
          'cook2name', 'cook2last', 'cook2mail',
          'address', 'phone'],
        hasHeader: true,
      });
      if (err) {
        sig.emit('error', err);
        return;
      }
      teamsModel.lockModified();
      teamsModel.clear();
      for (let i = 0; i < rows.length; ++i) {
        teamsModel.addRow(rows[i]);
      }
      teamsModel.unlockModified();
    })
  }

  function onTeamExport() {
    let teams = teamsModel.getAll();
    let [err, str] = csv.toString(teams, {
      fields: [
        'cook1name', 'cook1last', 'cook1mail',
        'cook2name', 'cook2last', 'cook2mail',
        'address', 'phone', 'comments', 'lat', 'lng',
      ],
      separator: ',',
      quote: '"',
      hasHeader: true,
    });
    if (err) {
      console.error(err);
      return;
    }
    downloadFile('teams.csv', str);
  }

  function onConstraintImport(file) {
    withContents(file, (contents) => {
      rulesModel.deserialize(contents);
    });
  }

  function onConstraintExport() {
    downloadFile('rules.txt', rulesModel.get());
  }

  function onMatchingImport(file) {
    withContents(file, (contents) => {
      bestMatching.deserialize(contents);
    });
  }

  function onMatchingExportCustom() {
    downloadFile('matching.json', bestMatching.serialize());
  }

  function onMatchingExportCsv() {
    let teamList = teamsModel.getAll();
    let teams = {};
    for (let i = 0; i < teamList.length; ++i) {
      teams[teamList[i].id] = teamList[i];
    }
    let {config, match} = bestMatching.get();
    let list = matching.asList(config, match);
    let fields = ['teamNames', 'teamCooks',
                  'starterCookNames','starterCookAddress','starterCookPhone',
                  'mainCookNames','mainCookAddress','mainCookPhone',
                  'dessertCookNames', 'dessertCookAddress', 'dessertCookPhone'];
    let rows = [];
    for (let i = 0; i < list.length; ++i) {
      let row = {};
      let team = teamList[i];
      row.teamNames = `${team.cook1name} ${team.cook1last}, ${team.cook2name} ${team.cook2last}`;
      row.teamCooks = list[i].cooking;
      let starter = teams[list[i].starter];
      row.starterCookNames = `${starter.cook1name} ${starter.cook1last}, ${starter.cook2name} ${starter.cook2last}`;
      row.starterCookAddress = `${starter.address}`;
      row.starterCookPhone = `${starter.phone}`;
      let main = teams[list[i].main];
      row.mainCookNames = `${main.cook1name} ${main.cook1last}, ${main.cook2name} ${main.cook2last}`;
      row.mainCookAddress = `${main.address}`;
      row.mainCookPhone = `${main.phone}`;
      let dessert = teams[list[i].dessert];
      row.dessertCookNames = `${dessert.cook1name} ${dessert.cook1last}, ${dessert.cook2name} ${dessert.cook2last}`;
      row.dessertCookAddress = `${dessert.address}`;
      row.dessertCookPhone = `${dessert.phone}`;
      rows.push(row);
    }
    let options = {
      fields: fields,
      hasHeader: true,
      quote: '"',
      separator: ',',
    }
    let [err, raw] = csv.toString(rows, options);
    if (err) {
      sig.emit('error', err);
      return;
    }
    downloadFile('matching.csv', raw);
  }

  function onMailImport(file) {
    withContents(file, (contents) => {
      mails.deserialize(contents);
    });
  }

  function onMailExport() {
    downloadFile('mails.json', mails.serialize());
  }

  function onInit(elem) {
    view = elem;
    let dom = $.parseHTML(`
    <div id="db-container">
      <div class="db-section">Teams</div>
      <div id="db-team-drop" class="db-drop">drop to import (csv)</div>
      <button id="db-team-export">download (csv)</button>

      <div class="db-section">Rules</div>
      <div id="db-constraint-drop" class="db-drop">drop to import (text file)</div>
      <button id="db-constraint-export">download (text file)</button>

      <div class="db-section">Matching</div>
      <div id="db-matching-drop" class="db-drop">drop to import (custom)</div>
      <button id="db-matching-export-custom">download (custom)</button>
      <button id="db-matching-export-csv">download (csv)</button>

      <div class="db-section">Mails</div>
      <div id="db-mail-drop" class="db-drop">drop to import (custom)</div>
      <button id="db-mail-export">download (custom)</button>

      <div class="db-section">Other</div>
      <button id='db-clear-cache'>clear everything</button>
    </div>
    `);

    $(dom).find('#db-team-drop').droppable(onTeamImport);
    $(dom).find('#db-team-export').on('click', onTeamExport);

    $(dom).find('#db-constraint-drop').droppable(onConstraintImport);
    $(dom).find('#db-constraint-export').on('click', onConstraintExport);

    $(dom).find('#db-matching-drop').droppable(onMatchingImport);
    $(dom).find('#db-matching-export-custom').on('click', onMatchingExportCustom);
    $(dom).find('#db-matching-export-csv').on('click', onMatchingExportCsv);

    $(dom).find('#db-mail-drop').droppable(onMailImport);
    $(dom).find('#db-mail-export').on('click', onMailExport);

    $(dom).find('#db-clear-cache').on('click', () => {
      localStorage.clear();
      location.reload();
    });

    view.append(dom);
  };

  return {
    onInit: onInit,
  };
})();
