let geo = (function() {
  "use strict";
  let cache = (function() {
    function code(address, callback) {
      let err, res = ['not found', null]
      try {
        let cacheRaw = localStorage.getItem('geo.cache');
        let cache = JSON.parse(cacheRaw);
        if (address in cache) {
          [err, res] = [null, cache[address]];
        }
      } catch (e) {
      }
      callback(err, res);
    }
    function add(address, results) {
      let cache;
      try {
        let cacheRaw = localStorage.getItem('geo.cache');
        cache = JSON.parse(cacheRaw) || {};
      } catch (e) {
        cache = {};
      }
      cache[address] = results;
      localStorage.setItem('geo.cache', JSON.stringify(cache));
    }
    function clear() {
      localStorage.setItem('geo.cache', null);
    }
    return {
      name: 'cache',
      code: code,
      add: add,
      clear: clear,
    }
  })();
  function clearCache() {
    cache.clear();
  }

  let nominatim = (function() {
    function code(address, callback) {
      $.ajax({
         type: 'GET',
         url: 'https://nominatim.openstreetmap.org/search',
         dataType: 'jsonp',
         jsonp: 'json_callback',
         data: {
           format: 'jsonv2',
           q: address,
         },
         success: function(results) {
           let list = [];
           for (let i = 0; i < results.length; ++i) {
             let res = {};
             try {
               res.lat = results[i].lat;
               res.lng = results[i].lon;
               res.streetAddress = results[i].display_name;
               list[list.length] = res;
             } catch (e) {
             }
           }
           callback(null, list);
         },
         error: function(xhr, err) {
           callback(err, null);
         }
      })
    }
    return {
      name: 'openstreetmap',
      code: code
    }
  })();

  function geocodeWithNext(address, callback, providers) {
    if (providers.length < 1) {
      callback('not found', null);
    } else {
      let coder = providers[0];
      let rest = providers.slice(1);
      coder.code(address, (err, results) => {
        if (err === null && results.length > 0) {
          if (coder !== cache) {
            cache.add(address, results);
          }
          console.log(`address resolved by ${coder.name}`);
          callback(null, results);
          return
        } else {
          geocodeWithNext(address, callback, rest);
        }
      });
    }
  }

  function geocode(address, callback) {
    if (address.toLowerCase().indexOf('mannheim') === -1) {
      address = address + ', Mannheim';
    }
    geocodeWithNext(address, callback, [cache, nominatim]);
  }

  function geodecode(lat, lng, callback) {
    callback('not implemented', null);
  }

  return {
    clearCache: clearCache,
    code: geocode,
    decode: geodecode
  }
})();
