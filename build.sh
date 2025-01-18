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
  local entry_file_path=$1
  local parsed_path
  if [[ $entry_file_path == ./src/* ]]; then
    parsed_path=$entry_file_path
  else
    parsed_path=./src/entry/$entry_file_path.ts
  fi
  local cmd
  cmd="rollup --config rollup.config.ts --environment file_path:$parsed_path --configPlugin @rollup/plugin-typescript"
  if has_param '--watch' "$@"; then cmd+=' --watch'; fi
  $cmd
}

build_and_watch() {
  build "$1" --watch
}