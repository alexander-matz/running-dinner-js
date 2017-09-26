let bestMatching = (function() {
  "use strict";

  let config = null;
  let match = null;
  let score = null;
  function set(_config, _match, _score) {
    config = _config;
    match = _match;
    score = _score;
    sig.emit('bestMatching-modified');
  }
  function get() {
    return {
      config: config,
      match: match,
      score: score,
    }
  }
  function reset() {
    config = null;
    match = null;
    score = null;
  }
  function serialize() {
    return JSON.stringify({config: config, match: match, score: score});
  }
  function deserialize(raw) {
    let parsed = JSON.parse(raw);
    let {config: _config, match: _match, score: _score} = parsed;
    config = _config;
    match = _match;
    score = _score;
    sig.emit('bestMatching-modified');
  }
  return {
    reset: reset,
    serialize: serialize,
    deserialize: deserialize,
    set: set,
    get: get,
  }
})();

let vMatching = (function() {

  let labelState = null;
  let labelScore = null;
  let table = null;

  let config = null;
  let match = null;
  let rules = null;
  let score = null;
  let showAddress = false;
  let outdated = false;

  let buttonImprove;

  let view = null;

  function listToString(list) {
    function pad(value, length) {
      return (value.length < length) ? pad(value+" ", length):value;
    }
    let bits = [];
    for (let i = 0; i < list.length; ++i) {
      let row = [];
      row.push(list[i].teamId);
      row.push(pad(list[i].cooking, 7));
      row.push(list[i].starter);
      row.push(list[i].main);
      row.push(list[i].dessert);
      bits.push(row.join(','))
    }
    return bits.join('\n');
  }

  function newMatching() {
    let teams = teamsModel.getAll();
    let dishes = defaults.dishes();
    if (teams.length === 0) {
      sig.emit('error', 'no teams');
      updateUI();
      return;
    }
    let [err, tryConfig] = matching.makeConfig(teams, dishes);
    if (err) {
      sig.emit('error', err);
      updateUI();
      return;
    }
    let source = rulesModel.get();
    let tryRules;
    [err, tryRules] = matching.parseConstraints(source);
    if (err.length > 0) {
      sig.emit('error', 'errors in rules');
      updateUI();
      return;
    }
    let errors = matching.checkConstraints(teams, dishes, tryRules);
    if (errors.length > 0) {
      sig.emit('error', 'errors in rules');
      updateUI();
      return;
    }
    config = tryConfig;
    rules = tryRules;
    match = matching.initialMatch(config, rules);
    score = matching.score(config, rules, match);
    bestMatching.set(config, match, score);
  }

  function updateUI() {
    updateButtons();
    updateData();
    updateLabels();
  }

  function updateButtons() {
    let bState = workerControl();
    if (bState === 'idle' && match !== null) {
      buttonImprove.text('improve');
      buttonImprove.prop('disabled', false);
    } else if (bState === 'idle' && match === null) {
      buttonImprove.text('...');
      buttonImprove.prop('disabled', true);
    } else if (bState === 'starting') {
      buttonImprove.text('...');
      buttonImprove.prop('disabled', true);
    } else if (bState === 'active') {
      buttonImprove.text('stop');
      buttonImprove.prop('disabled', false);
    } else if (bState === 'stopping') {
      buttonImprove.text('...');
      buttonImprove.prop('disabled', true);
    }
  }

  function updateLabels() {
    if (score !== null) {
      labelScore.text(`cost: ${score.total.toFixed(2)}`);
    } else {
      labelScore.text(`cost: N/A`);
    }
    if (score !== null && score.total > 1000) {
      labelScore.addClass('outdated');
    } else {
      labelScore.removeClass('outdated');
    }
    let stateText;
    if (config === null) {
      labelState.text('state: empty');
      labelState.removeClass('outdated');
    } else {
      if (outdated) {
        labelState.text('state: outdated');
        labelState.addClass('outdated');
      } else {
        labelState.text('state: good');
        labelState.removeClass('outdated');
      }
    }
  }

  function updateData() {
    let {config, match} = bestMatching.get();
    let dishes = defaults.dishes();
    if (config !== null && match !== null) {

      if (showAddress) {
        let long = matching.asLong(config, match);
        let teams = teamsModel.getAll();
        let list = [];
        for (let i = 0; i < long.length; ++i) {
          let row = {};
          row.teamId = teams[i].id;
          row.cooking = dishes[long[i][0]];
          let starter = long[i][1];
          row.starter = `${teams[starter].id}, ${teams[starter].address}`
          let main = long[i][2];
          row.main = `${teams[main].id}, ${teams[main].address}`
          let dessert = long[i][3];
          row.dessert = `${teams[dessert].id}, ${teams[dessert].address}`
          list[list.length] = row;
        }
        table.egrid({data: list});
      } else {
        let list = matching.asList(config, match);
        table.egrid({data: list});
      }
    } else {
      table.egrid({data: []});
    }
    if (score !== undefined && score !== null) {
      labelScore.text(`score: ${score.total.toFixed(2)}`);
    } else {
      labelScore.text(`score: N/A`);
    }
  }

  let workerControl = (function() {
    let state = 'idle';
    let worker = null;
    let combinations = 0;

    function workerOnMessage(event) {
      let msg = event.data;
      if (msg.action === 'started') {
        fsm('started');
        updateUI();
      }
      if (msg.action === 'update') {
        fsm('update', msg);
        updateUI();
      }
      if (msg.action === 'stopped') {
        fsm('stopped');
        updateUI();
      }
    };

    function workerOnError(event) {
      console.error(event);
    }

    function dirname(path) {
      return path.match(/.*\//);
    }

    let fsm = stateMachine('idle', [
      {
        from: ['idle'], symbol: 'start', to: 'starting', action: () => {
          let source = document.getElementById('workercode').innerHTML;
          let blob = new Blob([source], {type: "text/javascript"});
          let url = URL.createObjectURL(blob);
          worker = new Worker(url);
          let {config, match} = bestMatching.get();
          worker.onmessage = workerOnMessage;
          worker.onerror = workerOnError;
          worker.postMessage({
            action: 'start',
            config: config,
            match: match,
            rules: rules,
            n: 200,
          })
          sig.emit('loading-started');
        }
      },
      {
        from: ['starting'], symbol: 'started', to: 'active', action: () => {
        }
      },
      {
        from: ['active'], symbol: 'update', to: 'active', action: (data) => {
          combinations = data.tried;
          if (data.score.total < score.total) {
            score = data.score;
            match = data.match;
            bestMatching.set(config, match, score);
          }
          worker.postMessage({
            action: 'continue',
          })
        }
      },
      {
        from: ['active'], symbol: 'stop', to: 'stopping', action: () => {
          worker.postMessage({
            action: 'stop',
          });
        }
      },
      {
        from: ['stopping'], symbol: 'update', to: 'stopping', action: () => {
          // safe guard, race conditions sometimes lead to delayed update
          // messages when the state machine already is in stopping mode,
          // we just ignore that last update
        }
      },
      {
        from: ['stopping'], symbol: 'stopped', to: 'idle', action: () => {
          sig.emit('loading-stopped');
          console.log(`tried ${combinations} combinations`);
        }
      }
    ]);

    return fsm;
  })();


  function onInit(elem) {
    view = elem;
    let container = $('<div>').attr('id', 'match-container');
    let controls = $('<div>').attr('id', 'match-controls');
    let buttonStart = $('<button>').attr('id', 'match-start').text('start matching');
    buttonImprove = $('<button>').text('improve').prop('disabled', true);
    let buttonSwitchTable = $('<button>').text('show addresses');
    let labels = $('<div>').attr('id', 'match-labels');
    labelState = $('<div>').attr('id', 'match-state').text('state: empty');
    labelScore = $('<div>').attr('id', 'match-score').text('cost: N/A');

    table = $('<div>').attr('id', 'match-table');
    table.egrid({ columns: [
        { title: 'Team', id: 'teamId', editable: false},
        { title: 'Cooking', id: 'cooking', editable: false},
        { title: 'Starter', id: 'starter', editable: false},
        { title: 'Main', id: 'main', editable: false},
        { title: 'Dessert', id: 'dessert', editable: false},
    ]});

    container.append(controls);
      controls.append(buttonStart);
      controls.append(buttonImprove);
      controls.append(buttonSwitchTable);
    container.append(labels);
      labels.append(labelState);
      labels.append(labelScore);
    container.append(table);
    //buttonStart.css('width', '100px');
    buttonImprove.css('width', '80px');
    buttonSwitchTable.css('width', '130px');

    buttonStart.on('click', (event) => {
      newMatching();
    });

    buttonImprove.on('click', (event) => {
      let state = workerControl();
      if (state === 'idle') {
        workerControl('start');
      }
      if (state === 'active') {
        workerControl('stop');
      }
      updateButtons();
    });

    buttonSwitchTable.on('click', (event) => {
      if (showAddress) {
        showAddress=false;
        buttonSwitchTable.text('show addresses');
      } else {
        showAddress=true;
        buttonSwitchTable.text('hide addresses');
      }
      updateData();
    });

    sig.on('teams-modified', () => {
      outdated = true;
      updateUI();
    });

    sig.on('rules-modified', () => {
      outdated = true;
      updateUI();
    });

    sig.on('bestMatching-modified', () => {
      let best = bestMatching.get();
      config = best.config;
      match = best.match;
      score = best.score;
      outdated = false;
      updateUI();
    });

    view.append(container);
    updateUI();
  }

  function onActivate() {
  }

  return {
    onInit: onInit,
    onActivate: onActivate,
  };
})();
