# ummon-server [![NPM version](https://badge.fury.io/js/ummon-server.png)](http://badge.fury.io/js/ummon-server) [![Build Status](https://secure.travis-ci.org/punkave/ummon-server.png?branch=master)](http://travis-ci.org/punkave/ummon-server) [![Dependency Status](https://gemnasium.com/punkave/ummon-server.png)](https://gemnasium.com/punkave/ummon-server)

Ummon is node.js application for managing, queuing, running and monitoring external tasks. Think of it as a lightweight hybrid of Jenkins & Resque

### Goals of this project

Many large web applications have long running tasks that are a smattering of cron, supervisor jobs and tasks triggered by the applicaiton itself. Ummon goal is to unify all of these tasks under one smart application to provide the following benefits:

* To ensuring proper saturation of system resources by intelligently queuing and running tasks
* To provide a single place where tasks are configured and logs are monitored
* To expose many interfaces by which to manage and monitor all of your tasks (CLI, REST api, JSON log files)
* To setup intelligent task dependancies (ie: run taskB only after taskA successfully completes)

### Practical Use Cases

* Any command put into cron. Backup, Regular API consumption, Log processing
  * Why not use cron? Logs are easily queriable and all tasks are queued so there is no risk of stampeding the server
* Any task you would run through Jenkins
  * Why? Simplier setup and configuration. Less opinionated.

### Limitations?

Unlike [resque](https://github.com/resque/resque) or [node-worker-farm](https://github.com/rvagg/node-worker-farm), you can only run terminal commands.

### Glossary

* **Task:** The core unit. Tasks are information about work that needs to be executed: The command, its working directory, when it should run, etc.
  * When it's time for a task to run, it is *triggered*. A task can be triggered manually by the user, by a cron timer or by the successful or unsuccessful completion of another task
* **Collection:** A collection is a arbitrary grouping of tasks. Collections provide the ability to set defaults for tasks (ie: every task in this collection run from this `cwd`) and for enabling/disabling many tasks at once.
* **Queue:** The staging area of tasks that have been triggered. Tasks will be run FIFO
* **Run:** Every time a task is triggered, it is called a *Run*. Every run has a unique id to provide easy tracking. A run also includes all of the configuration options for a task as well as meta data such as when it was added to the queue, started and completed
* **Worker:** The worker is what runs commands and handles communicating back to ummon about their status. Technically, a worker as a thin wrapper around `child_process.spawn`

# Installation and Setup

### Prerequisites

Ummon has one dependency: [node.js](http://nodejs.org/) version 0.10 or above

### Installation

If you want to play around with ummon to see whats possible

1. `sudo npm install -g ummon-server bunyan`
2. Run `ummon-server` and read the output

To setup ummon-server on a linux server, complete the following:

1. `sudo npm install -g ummon-server bunyan`
2. Configure your init script and install it in your init dir. Check the example dir for a Red Hat 6 example init script
3. Modify or create `config.json`. If you're using the example init script, the file should be placed in `/etc/ummon/`
4. Once your init script is in place, you can start ummon with `/etc/init.d/ummon start`

### Configuration

* `name`: The name of your ummon instance. Defaults to `ummon.server`*
* `port`: The port ummon will run and listen on. Defaults to `8888`
* `tasksPath`: Location of task configuration files. Consider `/var/lib/ummon/`. Defaults to  `./config/tasks/`,
* `autoSave`: `true/false` Whether to automatically save tasks to disk when changed. Defaults to `true`,
* `defaultCollection`: Name of the default collection for tasks. Defaults to  `ummon`,
* `createWorkerPollInterval`: Interval at which ummon checks if it can run a new worker. Defaults to  `1000`,
* `minimalSaveInterval`: Minimal amount of time before ummon auto saves again. Defaults to `1000`,
* `log`:
  * `path`: Path to ummons log file. Consider `/var/log/ummon/server.log`. Defaults to `./log/server.log`,
  * `level`: Level at which to log to file. Defaults to `debug`,
  * `period`: Amount of time to keep in a single log file before rotation. Defaults to `1w`,
  * `count`: The total number of `periods` to keep. If period is 1 week and count is 4, it will keep a months worth of logs. Defaults to `4`
* `credentials`: The username and password to allow api connections from
* `globalTaskDefaults`: Settings to add to every task. Like `ENV` variables or a default `cwd`. Defaults to  {}
* `pause`: Wheter ummon is paused or not. A paused ummon will not create any new workers. Defaults to  false,
* `workerToCpuRatio`: The ratio of system CPUs to maximum workers. If server has 4 cpus and a ration of 1.25 ummon will run no more than 5 simultaneous workers. Defaults to  1.25,

## License
Copyright (c) 2013 P'unk Avenue
Licensed under the MIT license.
