let utf8 = (function() {
  "use strict";
  function encode(s) {
  return unescape(encodeURIComponent(s));
}

  function decode(s) {
    return decodeURIComponent(escape(s));
  }
return {
  encode: encode,
  decode: decode,
}
})();

/* State machine implementation.
 * Transitions have the following form:
 * { from: [stateName], symbol: object, to: stateName, action: fn(data)};
 */
let stateMachine = function(initial, transitions) {
  "use strict";
  let states = {};
  for (let i = 0; i < transitions.length; ++i) {
    let {from, to, symbol, action} = transitions[i];
    for (let j = 0; j < from.length; ++j) {
      if (states[from[j]] === undefined) states[from[j]] = {};
      if (states[from[j]][symbol] !== undefined) {
        throw `already added transition for [${from[j]}] < ${symbol}`;
      }
      states[from[j]][symbol] = {to: to, action: action};
    }
  }
  let state = initial;
  return function(symbol, data) {
    if (symbol === undefined && data === undefined) {
      return state;
    }
    if (states[state] === undefined) {
      throw `in invalid state ${state}`;
    }
    if (states[state][symbol] === undefined) {
      throw `invalid input: [${state}] < ${symbol}`;
    }
    states[state][symbol].action(data);
    state = states[state][symbol].to;
  }
}

let shittySnowflake = (function() {
  "use strict";
  let seq = 0;

  function now() {
    let d = new Date();
    return d.getTime();
  }

  return function() {
    seq += 1;
    if (seq = 10000) {
      seq = 0;
    }
    return (seq + now()).toString(16);
  };
})();

let delayedOnce = (function() {
  "use strict";
  function make(fn, timeout) {
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
  return {
    make: make,
  }
})();

let tooltip = (function() {
  "use strict";
  function add(element, text, classes) {
    let tip = $(`<div style="display: none; position: relative;">${text}</div>`);
    function windowMouseMove(event) {
      tip.css('left', (event.clientX + 20) + 'px');
      tip.css('top', (event.clientY) + 'px');
    }
    if (classes === undefined) classes = [];
    for (let i = 0; i < classes.length; ++i) {
      tip.addClass(classes[i]);
    }
    $(element).on('mouseenter', (event) => {
      tip.css('display', 'block');
      $(window).on('mousemove', windowMouseMove);
      windowMouseMove(event);
    });
    $(element).on('mouseleave', (event) => {
      tip.css('display', 'none');
      $(window).off('mousemove', windowMouseMove);
    });
    $('body').append(tip);
  }
  return {
    add: add
  };
})();

let sig = (function() {
  "use strict";
  let signals = {}
  function on(name, handler) {
    if (!(name in signals)) {
      signals[name] = []
    }
    signals[name].push(handler);
    return signals[name].length;
  }

  function off(name, handler) {
    if (!(name in signals)) {
      return;
    }
    if (handler === undefined) {
      signals[name] = [];
    } else {
      let idx = signals[name].indexOf(handler);
      if (idx > -1) {
        signals[name].splice(idx, 1);
      }
    }
  }

  function sigmatch(pat, sig) {
    let prevIndex = -1;
    let array = pat.split('*');
    let result = true;
    for(let i = 0; i < array.length && result; i++){ // For each search section
        let index = sig.indexOf(array[i]); // Find the location of the current search section
        if(index == -1 || index < prevIndex){ // If the section isn't found, or it's placed before the previous section...
            return false;
        }
    }
    return result;
  }

  function auxemit(handlers, args) {
    let n = 0;
    for (let i = 0; i < handlers.length; ++i) {
      handlers[i].apply(null, args);
      n += 1;
    }
    return n;
  }

  function emit() {
    if (arguments.length < 1) {
      throw "not enough arguments to 'emit'";
    }
    let name = arguments[0];
    let args = []
    for (let i = 1; i < arguments.length; ++i) {
      args.push(arguments[i]);
    }
    let n = 0;

    for (let sig in signals) {
      if (sigmatch(sig, name)) {
        n += auxemit(signals[sig], args);
      }
    }

    return n;
  }

  return {
    on: on,
    off: off,
    emit: emit,
  };
})();
