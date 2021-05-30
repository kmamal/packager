#!/usr/bin/env bash

set -eEu -o pipefail

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

cd "$DIR"
./bundle/node bundle/project
