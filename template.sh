#!/bin/bash

if [ -z "$1" ]; then
  echo "Please provide a directory name."
  exit 1
fi

DIR_NAME="$1"

mkdir "$DIR_NAME"

cd "$DIR_NAME" || exit

mkdir src
touch LICENSE README.md .gitignore

echo "# $DIR_NAME" > README.md
echo "This is the $DIR_NAME project." >> README.md

echo "MIT License" > LICENSE
echo "Copyright (c) $(date +%Y) Your Name" >> LICENSE
echo "Permission is hereby granted, free of charge, to any person obtaining a copy" >> LICENSE
echo "of this software and associated documentation files (the 'Software'), to deal" >> LICENSE
echo "in the Software without restriction, including without limitation the rights" >> LICENSE
echo "to use, copy, modify, merge, publish, distribute, sublicense, and/or sell" >> LICENSE
echo "copies of the Software, and to permit persons to whom the Software is" >> LICENSE
echo "furnished to do so, subject to the following conditions:" >> LICENSE
echo "node_modules/" > .gitignore
echo ".env" >> .gitignore
echo "dist/" >> .gitignore

echo "Directory and common files created successfully!"
