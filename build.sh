#!/bin/bash

# vim: ts=2 sts=2 sw=2 et ai

set -e
cleanup() {
  [ -d tmp ] && rm -rf tmp
}
trap cleanup EXIT

verify_command () {
  if ! hash $1; then
    echo "command $1 not found"
    exit 1
  fi
}

indent () {
  indent="  "
  if [[ -n "$1" ]]; then
    indent="$1"
  fi
  indent="${indent//\//\\\/}"
  sed -e "s/^/$indent/g"
}

escape_file () {
  file="$1"
  file="${file//./_}"
  file="${file// /_}"
  file="${file//:/_}"
  file="${file//\//_}"
  echo "$file"
}

bundle_js () {
  name=""
  files=()
  prologue=""
  epilogue=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --prologue)
        prologue="$2"
        shift
        ;;
      --epilogue)
        epilogue="$2"
        shift
        ;;
      -o|--out)
        name="$2"
        shift
        ;;
      --*|-*)
        echo "unknown option: $1"
        return 1
        ;;
      *)
        files+=("$1")
        ;;
    esac
    shift
  done
  if [[ -z "$name" ]]; then
    echo "no out file specified"
  fi
  tmp="./tmp/$(escape_file $name)"

  if [[ ${#files[@]} -lt 1 ]]; then
    echo "error: no files specified"
    return 1
  fi

  echo "bundling"
  for infile in ${files[@]}; do
    fname=$(basename $infile)
    cat $infile >> "$tmp.amal"
  done
  echo "transpiling"
  babel --presets es2015 "$tmp.amal" > "$tmp.es5"
  echo "minimizing"
  echo "$prologue" > "$name"
  uglifyjs "$tmp.es5" -c >> "$name" 2>> log.err
  echo "$epilogue" >> "$name"
}

render_template() {
  eval "cat <<EOF
$(<$1)
EOF
" 2> /dev/null
}

# set up & check tooling
[ -d node_modules ] && PATH="${PWD}/node_modules/.bin:$PATH"
verify_command babel
verify_command uglifyjs
verify_command stylus

[ -d dist ] && rm -rf dist
mkdir dist

mkdir tmp

echo "copying static files"
cp index_dist.html dist/index.html
cp img/Logo.png dist/logo.png
cp LICENSE dist/LICENSE
cp ATTRIBUTIONS dist/ATTRIBUTIONS
cp README.md dist/README.md

echo "copying dependencies"
mkdir dist/lib
cp lib/* dist/lib

echo "compiling style sheet"
stylus < style/app.styl > dist/app.css

echo "preparing license file"
cp LICENSE tmp/license
echo '*****************************************************************' >> tmp/license
sed -i -e 's!^!// !g' tmp/license
license=$(cat tmp/license)

echo "creating app.min.js"
bundle_js js/*.js \
  -o dist/app.min.js \
  --prologue "$license" | indent

echo "creating worker.min.js"
bundle_js js/matching.js js/worker-main.js \
  -o dist/worker.min.js \
  --prologue "$license" \
  --epilogue $'\nworkerMain()\n' | indent
echo "embedding worker.min.js into html"
WORKERCODE=$(cat dist/worker.min.js)
render_template dist/index.html > dist/index2.html
mv dist/index2.html dist/index.html
