$(document).ready(function () {
  "use strict";

  tabs.init($('#tabs'), $('#tab-content'));

  tabs.add({
    name: 'db',
    text: 'Files',
    onInit: vDb.onInit,
    onActivate: vDb.onActivate,
    onBeforeDeactivate: vDb.onBeforeDeactivate,
    onDeactivate: vDb.onDeactivate,
  });

  tabs.add({
    name: 'teams',
    text: 'Teams',
    onInit: vTeams.onInit,
    onActivate: vTeams.onActivate,
    onBeforeDeactivate: vTeams.onBeforeDeactivate,
    onDeactivate: vTeams.onDeactivate,
  });

  tabs.add({
    name: 'rules',
    text: 'Rules',
    onInit: vRules.onInit,
    onActivate: vRules.onActivate,
    onBeforeDeactivate: vRules.onBeforeDeactivate,
    onDeactivate: vRules.onDeactivate,
  });

  tabs.add({
    name: 'match',
    text: 'Matching',
    onInit: vMatching.onInit,
    onActivate: vMatching.onActivate,
    onBeforeDeactivate: vMatching.onBeforeDeactivate,
    onDeactivate: vMatching.onDeactivate,
  });

  tabs.add({
    name: 'map',
    text: 'Map',
    onInit: vMap.onInit,
    onActivate: vMap.onActivate,
    onBeforeDeactivate: vMap.onBeforeDeactivate,
    onDeactivate: vMap.onDeactivate,
  });

  tabs.add({
    name: 'mails',
    text: 'Mails',
    onInit: vMails.onInit,
    onActivate: vMails.onActivate,
    onBeforeDeactivate: vMails.onBeforeDeactivate,
    onDeactivate: vMails.onDeactivate,
  });

  tabs.addSpacer();

  vFooter.init($('#footer-row'));
  vLoading.init($('#loading'));

  tabs.tryActivate('db');
  persistence.load();
  sig.on('*-modified', delayedOnce.make(() => {
    persistence.save();
  }, 2));
})
