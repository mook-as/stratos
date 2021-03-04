#!/bin/bash

echo "Installing GO ..."
curl -sL -o ~/bin/gimme https://raw.githubusercontent.com/travis-ci/gimme/master/gimme
chmod +x ~/bin/gimme
eval "$(gimme 1.16)"
go version
