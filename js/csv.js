let csv = (function() {
  "use strict";
  // returns [token, newpos] OR [false, oldpos]
  function parseQuoted(line, _pos, quoteChar) {
    let pos = _pos;
    if (pos >= line.length || line[pos] !== quoteChar) {
      return [false, pos];
    }
    pos += 1;
    let start = pos;
    while (pos < line.length && line[pos] != quoteChar) {
      pos += 1;
    }
    let end = pos;
    if (line[pos] !== quoteChar) {
      return [false, _pos];
    }
    pos += 1;
    return [line.substring(start, end), pos];
  }

  // returns function(line) that returns [null, tokens] OR [err, null]
  function newParser(options) {
    if (options.separator === undefined) {
      // using exception here because a missing separator here would be a bug,
      // not misuse of the library
      throw 'no separator specified';
    }
    let sep = options.separator;
    let quote = options.quote;
    if (quote !== undefined) { // quoted parser
      return function(line) {
        let tokens = [];
        let pos = 0;
        while (pos < line.length) {
          let [token, newpos] = parseQuoted(line, pos, quote);
          if (token === false) {
            return [`missing/wrong field at pos ${pos}`, null]
          };
          pos = newpos;
          if (pos < line.length) {
            if (line[pos] !== '\n' && line[pos] !== '\r' && line[pos] !== sep) {
              return [`expected separator at pos ${pos}`];
            }
            pos += 1;
          }
          tokens[tokens.length] = token;
        }
        return [null, tokens];
      }
    } else { // unquoted parser
      return function(line) {
        let tokens = [];
        let pos = 0;
        while (pos < line.length) {
          let start = pos;
          while (pos < line.length && line[pos] !== sep) {
            pos += 1;
          }
          let end = pos;
          tokens[tokens.length] = line.substring(start, end);
          if (pos < line.length) {
            pos += 1;
          }
        }
        return [null, tokens];
      }
    }
  }

  function isSkipLine(line) {
    if (line.trim() === '') return true;
    return false;
  }

  // returns [err, rows], with rows being objects following 'fieldname: value'
  function fromString(raw, options) {
    if (!options.hasHeader && options.fields === undefined) {
      return ['no field specification supplied', null];
    }
    if (options.hasHeader && options.fields !== undefined) {
      return ['cannot have header and field specification supplied', null];
    }
    let lineno = 0;
    let lines = raw.split('\n');
    let fields;
    let parse;
    let separator = options.separator;
    if (options.quote !== undefined) {
      parse = newParser({
        quote: options.quote,
        separator
      })
    } else {
      parse = newParser({separator: separator});
    }

    if (separator === undefined) {
      return ['no separator specified', null];
    }

    while (isSkipLine(lines[lineno])) lineno++;

    if (options.hasHeader) {
      if (lineno >= lines.length) {
        return [`line ${lineno}: expected header, got end of input`, null];
      }
      let [err, tokens] = parse(lines[lineno]);
      if (err) {
        return [`line ${lineno}: ${err}`, null];
      }
      lineno += 1;
      fields = tokens;
    } else {
      fields = options.fields;
    }

    if (options.requiredFields) {
      let lookup = {};
      for (let i = 0; i < fields.length; ++i) {
        lookup[fields[i]] = true;
      }
      let req = options.requiredFields;
      for (let i = 0; i < req.length; ++i) {
        if (lookup[req[i]] === undefined) {
          return [`missing required field: ${req[i]}`, null];
        }
      }
    }

    let rows = [];

    while (lineno < lines.length) {
      if (isSkipLine(lines[lineno])) {
        lineno += 1;
        continue;
      }
      let [err, tokens] = parse(lines[lineno]);
      if (err) {
        return [`line ${lineno}: ${err}`, null];
      }
      if (tokens.length !== fields.length) {
        console.log(tokens);
        return [`line ${lineno}: wrong number of fields`]
      }
      let row = {};
      for (let i = 0; i < fields.length; ++i) {
        row[fields[i]] = tokens[i];
      }
      rows[rows.length] = row;
      lineno += 1;
    }

    return [null, rows];
  }

  // expects [{objects}], {options}
  // returns [err, string]
  function toString(rows, options) {
    let fields = options.fields;
    let sep = options.separator;
    let quote = options.quote;
    if (fields === undefined) {
      return ['no fields specified', null];
    }
    if (sep === undefined) {
      return ['no separator specified', null];
    }
    let writer;
    if (quote !== undefined) {
      writer = (field) => {
        field = `${field}`.replace(quote, '\\'+quote);
        return '"' + field + '"';
      };
    } else {
      writer = (field) => { return field; };
    }
    let result = [];
    if (options.hasHeader) {
      let rowStrings = [];
      for (let f = 0; f < fields.length; ++f) {
        rowStrings[rowStrings.length] = writer(fields[f]);
      }
      result[result.length] = rowStrings.join(sep);
    }
    for (let i = 0; i < rows.length; ++i) {
      let row = rows[i];
      let rowStrings = [];
      for (let f = 0; f < fields.length; ++f) {
        if (row[fields[f]] === undefined) {
          return [`missing field ${fields[f]} in row ${i}`, null];
        }
        if (row[fields[f]] === null) {
          row[fields[f]] = '';
        }
        rowStrings[rowStrings.length] = writer(row[fields[f]]);
      }
      result[result.length] = rowStrings.join(sep);
    }
    return [null, result.join('\n')];
  }

  return {
    fromString: fromString,
    toString: toString
  }
})();
