let mails = (function() {
  "use strict";
  let mails = {};

  function setMail(type, mail) {
    if (defaults.dishes().indexOf(type) === -1) throw `WHOOPS! invalid mail ${type}`;
    mails[type] = mail;
    sig.emit('mails-modified');
  }

  function getMail(type) {
    if (defaults.dishes().indexOf(type) === -1) throw `WHOOPS! invalid mail ${type}`;
    return mails[type] || "";
  }

  function reset() {
    mails = {};
  }

  function serialize() {
    return JSON.stringify(mails);
  }

  function deserialize(raw) {
    mails = JSON.parse(raw) || {};
    sig.emit('mails-modified');
  }

  return {
    getTypes: defaults.dishes,
    serialize: serialize,
    deserialize: deserialize,
    reset: reset,
    setMail: setMail,
    getMail: getMail,
  }
})();

let vMails = (function() {
  "use strict";
  let view = null;

  let userEdit = null;
  let passEdit = null;
  let mailSelect = null;
  let mailEditor = null;
  let selected = null;
  let locked = false;

  function updateOptions() {
    mailSelect.empty();
    let dishes = defaults.dishes();
    for (let i = 0; i < dishes.length; ++i) {
      mailSelect.append($('<option>').text(dishes[i]));
    }
    mailSelect.append($('<option>').text('HELP'));
  }

  let downloadFile = function (filename, contents) {
    let href = 'data:text/plain;utf-8,' + encodeURI(contents);
    let link = document.createElement('a');
    link.href = href;
    link.download = filename;
    link.click();
  }

  /* 'renders' a text, as in, replaces ${variablename} with the value
   * of that variable if found in env.
   * returns [err, newText];
   */
  function render(text, env) {
    let re = /\$\(([^)\n]*)\)/;
    while (true) {
      let match = text.match(re);
      if (!match) break;
      let varName = match[1];
      if (env[varName] === undefined) {
        return [`unknown variable ${varName}`, null];
      }
      text = text.replace(match[0], ''+env[varName]);
    }
    return [null, text];
  }

  function onSelectMail(event) {
    let value = $(event.target).val();
    selected = value;
    editorUpdate();
  }

  function editorUpdate() {
    locked = true;
    setTimeout(() => {locked = false}, 1000);
    if (selected === null) {
      mailEditor.val();
    } else if (selected === 'HELP') {
      mailEditor.val(defaults.mailsHelp());
      mailEditor.prop('disabled', true);
    } else {
      mailEditor.val(mails.getMail(selected));
      mailEditor.prop('disabled', false);
    }
  }

  function insertFields(target, obj, map, prefix) {
    prefix = prefix || '';
    for (let key in map) {
      target[prefix + map[key]] = obj[key];
    }
  }

  function onInit(elem) {
    view = elem;
    let container = $('<div>').attr('id', 'mail-container');
      let ctrlPanel = $('<div>').attr('id', 'mail-ctrl');
        mailSelect = $('<select>').attr('id', 'mail-select');

        let spacer = $('<div>').addClass('spacer');

        /*
        let userLabel = $('<span>').text('user').addClass('label');
        userEdit = $('<input>').attr('id', 'mail-user');
        let passLabel = $('<span>').text('pass').addClass('label');
        passEdit = $('<input>').attr('id', 'mail-pass').attr('type', 'password');
        */
        let subjectLabel = $('<span>').text('subject').addClass('label');
        let subjectEdit = $('<input>').attr('id', 'mail-subject');
        let download = $('<button>').text('Download (txt)');
        let downloadJson = $('<button>').text('Download (json)');

        //let send = $('<button>').text('Send Mails');
      mailEditor = $('<textarea>').attr('id', 'mail-editor');

    container.append(ctrlPanel);
      ctrlPanel.append(mailSelect);
      ctrlPanel.append(spacer);
      //ctrlPanel.append(userLabel);
      //ctrlPanel.append(userEdit);
      //ctrlPanel.append(passLabel);
      //ctrlPanel.append(passEdit);
      ctrlPanel.append(subjectLabel);
      ctrlPanel.append(subjectEdit);
      ctrlPanel.append(download);
      ctrlPanel.append(downloadJson);
      //ctrlPanel.append(send);
    container.append(mailEditor);

    mailSelect.on('change', onSelectMail);

    updateOptions(mails.getTypes());
    mailEditor.on('input', delayedOnce.make((event) => {
      if (locked || selected === null || selected === 'HELP') return;
      locked = true;
      mails.setMail(selected, mailEditor.val());
      locked = false;
    }, 0.25));

    download.on('click', () => {
      let {config, match} = bestMatching.get();
      if (config === null) {
        sig.emit('error', 'no matching');
        return;
      }
      let teamsList = teamsModel.getAll();
      let teams = {};
      for (let i = 0; i < teamsList.length; ++i) {
        teams[teamsList[i].id] = teamsList[i];
      }
      let fullMatching = matching.asFull(config, match);

      let mailBuf = [];
      let dishes = defaults.dishes();
      // render mails for dishes after each other
      for (let dish = 0; dish < dishes.length; ++dish) {
        let mailTemplate = mails.getMail(dishes[dish]);
        for (let i = 0; i < fullMatching.length; ++i) {
          let team = teamsList[i];
          if (fullMatching[i].cooking === dishes[dish]) {
            // prepare variables
            let env = {};
            insertFields(env, team, {
              'cook1name': 'recipientFirst1',
              'cook1last': 'recipientLast1',
              'cook2name': 'recipientFirst2',
              'cook2last': 'recipientLast2',
            })
            for (let dish2 = 0; dish2 < dishes.length; ++dish2) {
              let dishName = dishes[dish2];
              let cooks = teams[fullMatching[i][dishName][0]];
              insertFields(env, cooks, {
                'cook1name': 'CookFirst1',
                'cook1last': 'CookLast1',
                'cook2name': 'CookFirst2',
                'cook2last': 'CookLast2',
                'address': 'CookAddress',
                'phone': 'CookPhone',
                'comments': 'CookComments',
              }, dishName);
              let guest1 = teams[fullMatching[i][dishName][1]];
              insertFields(env, guest1, {
                'cook1name': 'Guest1First1',
                'cook1last': 'Guest1Last1',
                'cook2name': 'Guest1First2',
                'cook2last': 'Guest1Last2',
                'phone': 'Guest1Phone',
                'comments': 'Guest1Comments',
              }, dishName);
              let guest2 = teams[fullMatching[i][dishName][2]];
              insertFields(env, guest2, {
                'cook1name': 'Guest2First1',
                'cook1last': 'Guest2Last1',
                'cook2name': 'Guest2First2',
                'cook2last': 'Guest2Last2',
                'phone': 'Guest2Phone',
                'comments': 'Guest2Comments',
              }, dishName);
            }
            // render text
            let [err, mail] = render(mailTemplate, env);
            if (err) {
              sig.emit('error', err);
              return;
            }
            mailBuf.push(`${team.cook1mail}, ${team.cook2mail}`);
            mailBuf.push('*******************************************************');
            mailBuf.push(mail);
            mailBuf.push('*******************************************************');
            mailBuf.push('*******************************************************');
            mailBuf.push('');
          }
        }
      }
      downloadFile('mails-matched.txt', mailBuf.join('\n'));
    });

    downloadJson.on('click', () => {
      let {config, match} = bestMatching.get();
      if (config === null) {
        sig.emit('error', 'no matching');
        return;
      }
      let teamsList = teamsModel.getAll();
      let teams = {};
      for (let i = 0; i < teamsList.length; ++i) {
        teams[teamsList[i].id] = teamsList[i];
      }
      let fullMatching = matching.asFull(config, match);

      let mailObj = {mails: []};
      let dishes = defaults.dishes();
      // render mails for dishes after each other
      for (let dish = 0; dish < dishes.length; ++dish) {
        let mailTemplate = mails.getMail(dishes[dish]);
        for (let i = 0; i < fullMatching.length; ++i) {
          let team = teamsList[i];
          if (fullMatching[i].cooking === dishes[dish]) {
            // prepare variables
            let env = {};
            insertFields(env, team, {
              'cook1name': 'recipientFirst1',
              'cook1last': 'recipientLast1',
              'cook2name': 'recipientFirst2',
              'cook2last': 'recipientLast2',
            })
            for (let dish2 = 0; dish2 < dishes.length; ++dish2) {
              let dishName = dishes[dish2];
              let cooks = teams[fullMatching[i][dishName][0]];
              insertFields(env, cooks, {
                'cook1name': 'CookFirst1',
                'cook1last': 'CookLast1',
                'cook2name': 'CookFirst2',
                'cook2last': 'CookLast2',
                'address': 'CookAddress',
                'phone': 'CookPhone',
                'comments': 'CookComments',
              }, dishName);
              let guest1 = teams[fullMatching[i][dishName][1]];
              insertFields(env, guest1, {
                'cook1name': 'Guest1First1',
                'cook1last': 'Guest1Last1',
                'cook2name': 'Guest1First2',
                'cook2last': 'Guest1Last2',
                'phone': 'Guest1Phone',
                'comments': 'Guest1Comments',
              }, dishName);
              let guest2 = teams[fullMatching[i][dishName][2]];
              insertFields(env, guest2, {
                'cook1name': 'Guest2First1',
                'cook1last': 'Guest2Last1',
                'cook2name': 'Guest2First2',
                'cook2last': 'Guest2Last2',
                'phone': 'Guest2Phone',
                'comments': 'Guest2Comments',
              }, dishName);
            }
            // render text
            let [err, message] = render(mailTemplate, env);
            if (err) {
              sig.emit('error', err);
              return;
            }
            let newMail = {};
            newMail.recipients = [team.cook1mail, team.cook2mail];
            newMail.subject = subjectEdit.value || "Running Dinner";
            newMail.message = message;
            mailObj.mails.push(newMail);
          }
        }
      }
      downloadFile('mails-matched.json', JSON.stringify(mailObj));
    });

    sig.on('mails-modified', () => {
      editorUpdate();
    });

    selected = 'starter';

    view.append(container);
  }
  function onActivate(elem) {

  }
  function onDeactivate(elem) {

  }
  return {
    onInit: onInit,
  };
})();
