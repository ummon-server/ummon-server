# ummon [![Build Status](https://secure.travis-ci.org/punkave/ummon.png?branch=master)](http://travis-ci.org/punkave/ummon)

Documentation to come soon. Heavy development in process.

## Glossary

* **Task** The core unit. Tasks are information about work that needs to be executed: The command, its working directory, when it should run, etc
* **Collection** A collection is a grouping of tasks. By default there is one but you can arbitrarily group tasks in collections to simplify logging and structure
* **Queue** The staging area of tasks that have been triggered to run. Tasks will be run FIFO
* **Worker** The worker is what runs that commands and handles communicating back to ummon about their status

## License
Copyright (c) 2013 P'unk Avenue
Licensed under the MIT license.
