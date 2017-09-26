/* This file contains the entry point and business logic
 * of the web worker.
 * It does NOT automatically execute the main function, this
 * call is inserted into the amalgamate during building.
 */
let workerMain = function() {
  "use strict";
  let config;
  let bestMatch;
  let bestScore;
  let rules;
  let n;
  let tried = 0;

  function bestOf(config, match, rules, n) {
    bestMatch = match;
    bestScore = matching.score(config, rules, match);
    for (let i = 0; i < n; ++i) {
      let attempt = matching.shuffleMatch(config, match, [2, 0.125], [10, 0.2]);
      let score = matching.score(config, rules, attempt);
      if (score.total < bestScore.total) {
        bestMatch = attempt;
        bestScore = score;
      }
      tried += 1;
    }
    postMessage({
      action: 'update',
      score: bestScore,
      match: bestMatch,
      tried: tried,
    })
  }

  self.addEventListener('message', function(e) {
    let msg = e.data;
    if (msg.action === 'start') {
      n = msg.n;
      rules = msg.rules;
      config = msg.config;
      tried = 0;
      let imports = msg.imports;

      let match = msg.match;
      postMessage({
        action: 'started',
      })
      bestOf(config, match, rules, n);
    }
    if (msg.action === 'continue') {
      bestOf(config, bestMatch, rules, n);
    }
    if (msg.action === 'stop') {
      postMessage({
        action: 'stopped',
      })
      close();
    }
  }, false);
};
