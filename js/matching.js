/* As far as it stays reasonable, we stay functional
 * in this unit. This means that a matching is considered immutable.
 * Changes to a matching produce another, modified matching with the
 * old one staying unmodified and valid.
 * This does not apply to plumbing, which is mutable for performance reasons.
 * The decision to have a functional interface is a tradeoff:
 * - loose coupling within module (no monolithic objects)
 * - more copying (but who cares, memory and copying are cheap)
 * - programming errors don't corrupt valid objects
 * - all functions can run in parallel (ding ding ding!)
 * Some notes regarding performance:
 * - sparse arrays are slow, randomly accessed arrays should be preallocated
 *   by linearly setting all elements
 * - strings and string comparisons are cheap because every halfway decent
 *   js engine interns them.
 * - objects with the same structure (i.e. fields) are cheap because they
 *   are compiled to classes (at least in v8 -> chrome).
 * - The optimization (max * Math.random() << 0) saves marginally because it
 *   bit shifts instead of rounding down. This optimization is not worth
 *   anything regarding the complexity of the rest of the module.
 * I'm also adopting the spirit of the '_' identifier from functional
 * programming: if a variable is used exclusively in one place, it's named '_'.
 * Fuck underscore.js and their shitty naming choice.
 */


/* Distance measure by the way the crow flies. In kilometers
 */
let calcCrow = function (p1, p2) {
  "use strict";
  function toRad(Value) {
    return Value * Math.PI / 180;
  }
  let [_lat1, lon1] = p1;
  let [_lat2, lon2] = p2;
  var R = 6371; // km
  var dLat = toRad(_lat2-_lat1);
  var dLon = toRad(lon2-lon1);
  var lat1 = toRad(_lat1);
  var lat2 = toRad(_lat2);

  var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  var d = R * c;
  return d;
}

/* Helper class that provides access based on x, y, and z to linear array.
 * Does not augment/copy the original array. The purpose is to make the
 * matching object a plain data object that can be easy serialized/copied.
 */
let cursor3d = function(data, nx, ny, nz) {
  "use strict";
  return function(x, y, z, val) {
    let idx = 0;
    idx += x;
    idx += y * nx;
    idx += z * nx * ny;
    if (val !== undefined) {
      data[idx] = val;
    } else {
      return data[idx]
    }
  }
}

/* Another helper class to not fuck up book keeping. It's life cycle
 * does not extend across functions, so it does not need to be duplicatable
 * for a functional interface
 */
let randomSet = (function() {
  "use strict";
  function del(set, val) {
    if (set[val] === undefined) {
      throw 'element not in set!';
    }
    delete set[val];
  }

  function has(set, val) {
    return set[val] === true;
  }

  function add(set, val) {
    if (set[val] === true) {
      throw 'element already in set!';
    }
    set[val] = true;
  }

  function get(set) {
    return Object.keys(set);
  }

  function pick(set) {
    if (Object.keys(set).length == 0) {
      throw 'trying to pick/pop from empty set';
    }
    let keys = Object.keys(set);
    let val = keys[keys.length * Math.random() << 0];
    return val;
  }

  function pop(set) {
    let val = pick(set);
    del(set, val);
    return val;
  }

  function augment(obj) {
    return {
      has: (val) => { return has(obj, val); },
      get: (val) => { return get(obj); },
      add: (val) => { return add(obj, val); },
      del: (val) => { return del(obj, val); },
      pick: () => { return pick(obj); },
      pop: () => { return pop(obj); },
    }
  }

  function fromArray(arr) {
    if (typeof(arr) !== "object") {
      throw 'expected array as argument';
    }
    let set = {};
    for (let i = 0; i < arr.length; ++i) {
      if (typeof(arr[i]) === "object") {
        throw 'cannot use objects as keys';
      }
      set[arr[i]] = true;
    }
    return augment(set);
  }

  // noninclusive upper bound;
  function fromRange(min, max) {
    let set = {};
    for (let i = 0; i < max; ++i) {
      set[i] = true;
    }
    return augment(set);
  }

  function fromEmpty() {
    return augment({});
  }

  return {
    fromArray: fromArray,
    fromRange: fromRange,
    fromEmpty: fromEmpty,
  }
})();

/* Actual matching logic.
 * The interface is designed around these rules:
 * - the space a matching exists in is defined by its configuration, which
 *   consists of information about the available teams, the constraints etc.
 * - matchings are immutable
 * - before any matching can be improved on, an initial one according to
 *   a specific configuration has to be created
 * - a 'matching' is considered opaque to the outside, use 'asList'
 *   for a more sane representation.
 * - a matching is not modified, any changes produce a new matching and the
 *   original matching is not touched.
 */
let matching = (function() {
  "use strict";
  /* create a configuration object from the given parameters
   * - long lived object, can be reused across multiple matchings
   * - ties a teamlist to constraints, changes in either require rebuild
   * this function can fail, therefor it has an [error, value] return type
   */
  function makeConfig(_teams, _dishes) {
    let nteams = _teams.length;
    let ndishes = _dishes.length;
    let ngroups = nteams / ndishes;

    // sanity check
    if (nteams % ndishes != 0) {
      return [`number of teams (${nteams}) not divisable by number of dishes (${ndishes})!`, null];
    }

    // make local copy of teams so nobody fucks around with the original object
    let teams = [];
    for (let i = 0; i < nteams; ++i) {
      teams.push({id: _teams[i].id, lat: _teams[i].lat, lng: _teams[i].lng});
    }

    let dishes = _dishes.slice();

    return [null, {
      nteams: nteams,
      ndishes: ndishes,
      ngroups: ngroups,
      teams: teams,
      dishes: dishes,
    }]
  }

  /* Calculates initial valid matching from a config object.
   * This is the starting point for any valid matching.
   * Although this matching is valid (short of groups meeting multiple times),
   * it does suck big time because it is purely random.
   */
  function initialMatch(config) {
    let {nteams, ndishes, ngroups, assignments} = config;
    // keep track of who didn't cooked yet
    let availCooks = randomSet.fromRange(0, nteams);

    let match = {
      nx: ndishes,
      ny: ngroups,
      nz: ndishes,
      data: [],
    }
    let [nx, ny, nz] = [ndishes, ngroups, ndishes];
    let arr = match.data;
    for (let i = 0; i < nx*ny*nz; ++i) {
      arr[i] = -1;
    }

    let val = cursor3d(arr, nx, ny, nz);

    // for each dish, first select cooks, then guests
    for (let i = 0; i < ndishes; ++i) {
      // list of available Guests
      let availGuests = randomSet.fromRange(0, nteams);

      // for each group select a cook
      for (let j = 0; j < ngroups; ++j) {
        // pick and remove cook
        let cook = parseInt(availCooks.pop()); // let's avoid type weirdness
        // remove cook from available guests
        availGuests.del(cook);
        // assign cook
        val(i, j, 0, cook);
      }

      for (let j = 0; j < ngroups; ++j) {
        // ndishes - 1 guests
        for (let k = 1; k < ndishes; ++k) {
          // pick and remove guest
          let guest = parseInt(availGuests.pop()); // let's avoid type weirdness
          val(i, j, k, guest);
        }
      }
    }
    return match;
  }

  /* Takes an existing valid matches and returns a copy with a statistic number
   * of switches applied. The resulting match is still valid.
   * It might be better or worse than the original (pure random).
   * The following two switch operations exist:
   * teamSwitch: take two teams and switch every of their occurences,
   *   this allows a team to change the meal they're cooking
   * seatSwitch: withing a dish, take two random teams and switch places.
   *   A guest is switched with another guest and a cook is switched with
   *   another cook. Switching cook and guest would result in an invalid match.
   * While seatSwitching is cheap, it restricts each team to its initial role
   * for each dish (cook/guest) which locks a match into local optima.
   * teamSwitching is supposed to fix this.
   * Rule of thumb: do teamSwitches sparingly and sweatSwitches more liberally.
   * The probabilities are based on dice rolls with [2, 0.1] meaning two dice
   * rolls, each with a probability of 10%.
   */
  function shuffleMatch(config, match, tsProb, ssProb) {
    // make copy and keep the same name, we don't want to mix up names
    match = {
      nx: match.nx,
      ny: match.ny,
      nz: match.nz,
      data: match.data.slice(),
    }
    let val = cursor3d(match.data, match.nx, match.ny, match.nz);

    let {nteams, ndishes, ngroups} = config;

    // check for usage errors, use exception because it's faulty logic
    if (isNaN(tsProb[0]) || isNaN(tsProb[1]) || isNaN(ssProb[0]) || isNaN(ssProb[1])) {
      throw 'bad probabilities';
    }

    let [rolls, chance] = tsProb;
    for (let _ = 0; _ < rolls; ++_) {
      // don't do anything if dice roll is unsuccessful
      if (Math.random() > chance) continue;
      // select teams
      let team1 = nteams * Math.random() << 0;
      let team2 = nteams * Math.random() << 0;
      while (team2 === team1) {
        team2 = nteams * Math.random() << 0;
      }
      /* switch teams. we want to stay within O(nteams * ndishes) complexity,
       * so we traverse everything once and keep track of occurences, then
       * switch the teams based on our lists. Cannot modify list right here
       * due to usual swapping issue (a = b; b = a -> b == b);
       */
      let team1List = [];
      let team2List = [];
      for (let dish = 0; dish < ndishes; ++dish) {
        for (let group = 0; group < ngroups; ++group) {
          for (let seat = 0; seat < ndishes; ++seat) {
            if (val(dish, group, seat) === team1) {
              team1List[team1List.length] = [dish, group, seat];
            }
            if (val(dish, group, seat) === team2) {
              team2List[team2List.length] = [dish, group, seat];
            }
          }
        }
      }
      // sanity check for programming errors
      if (team1List.length != ndishes || team2List.length != ndishes) {
        throw 'WHOOPS! Team occurences not right';
      }
      // switch teams
      for (let i = 0; i < ndishes; ++i) {
        let [dish, group, seat] = team1List[i];
        val(dish, group, seat, team2);
      }
      for (let i = 0; i < ndishes; ++i) {
        let [dish, group, seat] = team2List[i];
        val(dish, group, seat, team1);
      }
    }

    [rolls, chance] = ssProb;
    for (let _ = 0; _ < rolls; ++_) {
      let dishes = config.dishes;
      // don't do anything if dice roll is unsuccessful
      if (Math.random() > chance) continue;
      // select dish within which to switch
      let dish = ndishes * Math.random() << 0;
      // select seat to switch
      let seat = ndishes * Math.random() << 0;
      // select groups which to switch seats
      let group1 = ngroups * Math.random() << 0;
      let group2 = ngroups * Math.random() << 0;
      while (group2 == group1) {
        group2 = ngroups * Math.random() << 0;
      }
      // get current assignments
      let team1 = val(dish, group1, seat);
      let team2 = val(dish, group2, seat);
      // do the switch
      val(dish, group1, seat, team2);
      val(dish, group2, seat, team1);
    }

    return match;
  }


  /* returns a matching in its 'long format', which contains redundant
   * information but is easier digestable for scoring algorithms and humans.
   * The long format is a list of rows, one for each team, with each row being:
   * [ <dish they're cooking>, ..<their location for each dish> ]
   * Everything is stored numerically and tied to the supplied configuration.
   */
  function asLong(config, match) {
    let {nteams, ndishes, ngroups} = config;
    let val = cursor3d(match.data, match.nx, match.ny, match.nz);
    let long = [];
    for (let team = 0; team < nteams; ++team) {
      long[team] = [-1, -1, -1, -1];
    }
    for (let dish = 0; dish < ndishes; ++dish) {
      for (let group = 0; group < ngroups; ++group) {
        let cooking = val(dish, group, 0);
        // set cooks
        long[cooking][0] = dish;
        // in this group, find out who is in every seat and update set
        // the location to the cooking party
        for (let seat = 0; seat < ndishes; ++seat) {
          let team = val(dish, group, seat);
          long[team][dish+1] = cooking;
        }
      }
    }
    return long;
  }

  /* Returns the match in a long format, but instead of numeric arrays,
   * each row is an object with fully resolved team id, dish they're cooking
   * as well as their destinations.
   */
  function asList(config, match) {
    let {teams, dishes} = config;
    let long = asLong(config, match);
    let result = [];
    for (let i = 0; i < long.length; ++i) {
      let row = {};
      row.teamId = teams[i].id;
      row.cooking = dishes[long[i][0]];
      for (let j = 0; j < dishes.length; ++j) {
        if (long[i][j+1] !== -1) {
          row[dishes[j]] = teams[long[i][j+1]].id;
        }
      }
      result[result.length] = row;
    }
    return result;
  }

  /* Returns the full match, containing the cooks and guests for each
   * dish for all teams
   */
  function asFull(config, match) {
    let {teams, dishes, ndishes, ngroups, nteams} = config;
    let val = cursor3d(match.data, match.nx, match.ny, match.nz);
    let long = asLong(config, match);
    let result = [];

    for (let i = 0; i < nteams; ++i) {
      result[i] = {
        teamId: teams[i].id,
        cooking: dishes[long[i][0]],
      };
      for (let j = 0; j < ndishes; ++j) {
        result[i][dishes[j]] = [];
      }
    }
    for (let dish = 0; dish < ndishes; ++dish) {
      for (let group = 0; group < ngroups; ++group) {
        let guests = [];
        for (let seatA = 0; seatA < ndishes; ++seatA) {
          let dishName = dishes[dish];
          let team = val(dish, group, seatA);
          for (let seatB = 0; seatB < ndishes; ++seatB) {
            let other = val(dish, group, seatB);
            result[team][dishName].push(teams[other].id);
          }
        }
      }
    }
    return result;
  }

  /****************************************************************
   * constraint input
   */

  /* helper function to match text according to some pattern
   * what: [expected] -> expected can be either '*' which matches everything
   * or a specific literal string that has to be matched exactly
   */
  function matchPattern(text, what) {
    let tokens = text.match(/\S+/g);
    if (tokens === null) return null;
    if (tokens.length !== what.length) return null;
    let values = [];
    for (let i = 0; i < what.length; ++i) {
      if (what[i] === '*') {
        values[values.length] = tokens[i];
      } else if (what[i] !== tokens[i]) {
        return null;
      }
    }
    return values;
  }

  /* Parses Constraints into digestable internal format.
   * Does not check for validity, use checkConstraints for that.
   * returns [errors, constraints], with error being [line, what]
   */
  function parseConstraints(text) {
    let lines = text.split('\n');
    let errors = [];
    let cns = [];
    for (let i = 0; i < lines.length; ++i) {
      let line = lines[i].trim();
      if (line === '') continue;
      let match;
      match = matchPattern(line, ['teams', 'meet', 'once']); if (match) {
        cns[cns.length] = { type: 'onlyOnce', line: i+1};
        continue;
      }
      match = matchPattern(line, ['ways', 'short']); if (match) {
        cns[cns.length] = { type: 'shortWays', line: i+1 };
        continue;
      }
      match = matchPattern(line, ['ways', 'similar']); if (match) {
        cns[cns.length] = { type: 'sameWays', line: i+1 };
        continue;
      }
      match = matchPattern(line, ['*', 'cooks', '*']); if (match) {
        cns[cns.length] = { type: 'dish', teamId: match[0], dish: match[1], pos: true, line: i+1};
        continue;
      }
      match = matchPattern(line, ['*', 'not', 'cooks', '*']); if (match) {
        cns[cns.length] = { type: 'dish', teamId: match[0], dish: match[1], pos: false, line: i+1};
        continue;
      }
      match = matchPattern(line, ['*', 'meets', '*']); if (match) {
        cns[cns.length] = { type: 'pair', teamId1: match[0], teamId2: match[1], pos: true, line: i+1};
        continue;
      }
      match = matchPattern(line, ['*', 'not', 'meets', '*']); if (match) {
        cns[cns.length] = { type: 'pair', teamId1: match[0], teamId2: match[1], pos: false, line: i+1};
        continue;
      }
      errors[errors.length] = [i+1, `unknown rule`];
    }
    return [errors, cns];
  }

  /* check if the supplied constraint actually make sense, e.g.
   * the specified teams and dishes exist.
   * returns errorMessage or null
   *   error: [constraintIndex, what]
   */
  function checkConstraints(teams, dishes, cns) {
    let errors = [];
    for (let i = 0; i < cns.length; ++i) {
      let cn = cns[i];
      if (cn.type === 'dish') {
        let found = false;
        for (let j = 0; j < teams.length; ++j) {
          if (teams[j].id === cn.teamId) {
            found = true;
            break;
          }
        }
        if (!found) {
          errors[errors.length] = [i, `did not find team ${cn.teamId}`];
        }
        found = false;
        for (let j = 0; j < dishes.length; ++j) {
          if (dishes[j] === cn.dish) {
            found = true;
            break;
          }
        }
        if (!found) {
          errors[errors.length] = [i, `dish ${cn.dish} does not exist`];
        }
      }
      if (cn.type === 'pair') {
        if (cn.teamId1 === cn.teamId2) {
          errors[errors.length] = [i, `used the same team twice`];
        }
        let found1 = false;
        let found2 = false;
        for (let j = 0; j < teams.length; ++j) {
          if (teams[j].id === cn.teamId1) {
            found1 = true;
          }
          if (teams[j].id === cn.teamId2) {
            found2 = true;
          }
          if (found1 && found2) {
            break;
          }
        }
        if (!found1) {
          errors[errors.length] = [i, `did not find team ${cn.teamId1}`];
        }
        if (!found2) {
          errors[errors.length] = [i, `did not find team ${cn.teamId2}`];
        }
      }
    }
    return errors;
  }

  let scoreFns = {};
  /* calculates the score for this match and returns:
   * {
   *   total: <total score>,
   *   partials: [[<partial score>, <status>, <message>]],
   * }
   */
  function score(config, cns, match) {
    let total = 0;
    let partials = [];

    let long = asLong(config, match);
    for (let i = 0; i < cns.length; ++i) {
      let cn = cns[i];
      if (scoreFns[cn.type] === undefined) {
        throw 'WHOOPS! Unknown constraint';
      }
      let score = scoreFns[cn.type](config, cn, match, long);
      total += score[0];
      partials[partials.length] = score;
    }
    return {
      total: total,
      partials: partials,
    };
  }

  /****************************************************************
   * scoring functions
   */

  /* Returns a huge penalty for teams that meet twice.
   * This is the most complex scoring function as it essentially has
   * to check each team against each other team.
   */
  scoreFns.onlyOnce = function(config, cn, match, long) {
    let {ndishes, ngroups, nteams} = config;
    let val = cursor3d(match.data, match.nx, match.ny, match.nz);
    let weight = cn.weight || (1e4);
    let visited = {};
    let multiple = 0;
    for (let dish = 0; dish < ndishes; ++dish) {
      for (let group = 0; group < ngroups; ++group) {
        // get list of all teams participating
        // and check for having met more than twice
        let guests = [];
        for (let seatA = 0; seatA < ndishes; ++seatA) {
          let team = val(dish, group, seatA);
          guests[guests.length] = team;
          for (let seatB = 0; seatB < ndishes; ++seatB) {
            if (seatA == seatB) continue;
            let other = val(dish, group, seatB);
            if (visited[other] == undefined) visited[other] = {};
            if (visited[other][team] !== undefined) {
              multiple += 1;
            }
          }
        }
        // update visited list, needs to be separate step
        for (let seatA = 0; seatA < ndishes; ++seatA) {
          let team = val(dish, group, seatA);
          for (let seatB = 0; seatB < ndishes; ++seatB) {
            if (seatA == seatB) continue;
            let other = val(dish, group, seatB);
            visited[other][team] = true;
          }
        }
      }
    }
    if (multiple === 0) {
      return [0, 'ok', 'no teams meet more than once'];
    } else {
      return [multiple * weight, 'bad', 'teams have met multiple times'];
    }
  }

  /* Computes the distance each team has to travel, sums them up and
   * multiplies it by the resulting weight.
   * This is then returned as the penalty.
   */
  scoreFns.shortWays = function (config, cn, match, long) {
    let {teams, ndishes, nteams, ngroups} = config;
    let weight = cn.weight || 2;
    let score = 0;
    for (let i = 0; i < long.length; ++i) {
      for (let j = 1; j < ndishes; ++j) {
        let start = teams[long[i][j]];
        let end = teams[long[i][j+1]];
        score += calcCrow([start.lat, start.lng], [end.lat, end.lng]);
      }
    }
    return [score, 'ok', 'based on total distance traveled']
  }

  /* Computes the average of all distances the teams have to travel.
   * It then returns the sum of deviations of each team, multiplied
   * by a weight, as the penalty.
   * This can ensure that teams roughly have the same distances to trave.
   * The usefulness of this penalty is questionable.
   */
  scoreFns.sameWays = function (config, cn, match, long) {
    let {ndishes, nteams, ngroups} = config;
    let weight = cn.weight || 2;
    let distances = [];
    let sum = 0;

    for (let i = 0; i < long.length; ++i) {
      for (let j = 1; j < ndishes; ++j) {
        let start = teams[long[i][j]];
        let end = teams[long[i][j+1]];
        let dist = calcCrow([start.lat, start.lng], [end.lat, end.lng]);
        sum += dist;
        distances[distances.length] = dist;
      }
    }
    let mean = sum / distances.length;
    let dev = distances.reduce((a,b)=>{return a+b;})/distances.length;
    let score = dev * weight;
    return [score, 'ok', 'based on "unfairness" of distances']
  }

  /* Dishes out a medium penalty for teams that wish to either cook
   * or not cook a specific dish and don't have their wish granted.
   * Not a huge fan of the lookup in the teams list that has to be
   * performed, but I don't think it has a noticable impact on performance.
   */
  scoreFns.dish = function (config, cn, match, long) {
    let {dishes, teams, ndishes, nteams, ngroups} = config;
    let weight = cn.weight || 100;
    let {dish: dishName, teamId, pos: positive} = cn;
    let dish = dishes.indexOf(dishName);
    let team = -1;
    for (let i = 0; i < teams.length; ++i) {
      if (teams[i].id === teamId) {
        team = i;
        break;
      }
    }
    let hasDish = long[team][0] === dish;
    let ok = (hasDish && positive) || (!hasDish && !positive);
    return (ok ? [0, 'ok', ''] : [weight, 'bad', `team ${teamId} has unwanted dish`]);
  }

  /* Dishes out a medium penalty for teams that wish to either cook
   * or not cook a specific dish and don't have their wish granted.
   * Not a huge fan of the lookup in the teams list that has to be
   * performed, but I don't think it has a noticable impact on performance.
   */
  scoreFns.pair = function (config, cn, match, long) {
    return ([5, 'bad', `not implemented`]);
  }

  return {
    makeConfig: makeConfig,
    initialMatch: initialMatch,
    shuffleMatch: shuffleMatch,
    parseConstraints: parseConstraints,
    checkConstraints: checkConstraints,
    asList: asList,
    asLong: asLong,
    asFull: asFull,
    score: score
  };
})();
