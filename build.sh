#!/usr/bin/env bash

has_param() {
  local term="$1"
  shift
  for arg; do
    if [[ $arg == "$term" ]]; then return 0; fi
  done
  return 1
}

# First argument is filepath (or filename, without extension)
#
# Supported flags:
#  --watch: Rebuild automatically when changes are detected
build() {
  local file_path=$1
  local name_override=$2
  local file=$(basename $file_path)
  if [[ -z $name_override ]]; then
    local file_noext="${file%.*}"
  else
    local file_noext=$name_override
  fi
  local cmd
  cmd="rollup --config rollup.config.ts --environment file_path:$file_path,file:$file_noext --configPlugin @rollup/plugin-typescript"
  if has_param '--watch' "$@"; then cmd+=' --watch'; fi
  $cmd
}

build_and_watch() {
  build "$1" --watch

# ---- entrypoint ----
if has_param '--watch' "$@"; then
  build_and_watch "$@"
else
  build "$@"
fi

}