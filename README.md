# ummon-server [![NPM version](https://badge.fury.io/js/ummon-server.png)](http://badge.fury.io/js/ummon-server) [![Build Status](https://secure.travis-ci.org/punkave/ummon-server.png?branch=master)](http://travis-ci.org/punkave/ummon-server) [![Dependency Status](https://gemnasium.com/punkave/ummon-server.png)](https://gemnasium.com/punkave/ummon-server)

Ummon is a Node.js application for managing and monitoring tasks on a server. Think of it as a lightweight hybrid of Jenkins & Resque.

### Goals of this project

Many large web applications have long-running tasks that are a smattering of cron, supervisor jobs, and tasks triggered by the application itself. Ummon's goal is to unify these tasks under one smart application to provide the following benefits:

* To ensure proper saturation of system resources by intelligently queuing and running tasks
* To provide a single place where tasks are configured and logs are monitored
* To expose many interfaces for the managing and monitoring of tasks (CLI, REST API, JSON log files)
* To set up intelligent task dependencies (e.g., run taskB only after taskA successfully completes)

### Practical Use Cases

* Any command run by cron is a good candidate, including the creation of backups, remote API consumption, and log processing.
  * Why not use cron? With Ummon, logs are easily to query and tasks are queued to avoid stampeding the server.
* Jobs run by Jenkins or another CI server could also be migrated to Ummon.
  * Why? Simpler setup and configuration. Less opinionated deploy management.

### Limitations?

Unlike [resque](https://github.com/resque/resque) or [node-worker-farm](https://github.com/rvagg/node-worker-farm), commands are all run via the shell to allow for scripts in many languages.

### Glossary

* **Task:** Tasks are information about work that needs to be executed: The command, its working directory, when it should run, etc.
  * When it's time for a task to run, it is *triggered*. A task can be triggered manually by the user, by a cron timer, or by the successful or unsuccessful completion of another task.
* **Collection:** A collection is a group of tasks. Collections allow for the setting of defaults for tasks (ie: every task in this collection run from this `cwd`) and the enabling or disabling of many tasks at once.
* **Run:** Every time a task is triggered, it is called a *Run*. Every run has a unique id to provide easy tracking. A run also includes all of the configuration options for a task as well as metadata such as when it was added to the queue, started, and completed.
* **Queue:** The FIFO staging area for runs.
* **Worker:** Workers run commands and communicate the status of those commands with the master process. Technically, a worker is a thin wrapper around `child_process.spawn`.

# Installation and Setup

### Prerequisites

Ummon has one dependency: [node.js](http://nodejs.org/), version 0.10 or above.

### Installation

If you want to play around with Ummon to see what's possible:

1. `sudo npm install -g ummon-server bunyan`
2. Run `ummon-server` and read the output.

To set up ummon-server on Linux:

1. `sudo npm install -g ummon-server bunyan`
2. Configure your init script and install it in your init dir. Check the example directory for a Red Hat 6 example init script.
3. Modify or create `config.json`. If you're using the example init script, the file should be placed in `/etc/ummon/`.
4. Once your init script is in place, you can start ummon with `/etc/init.d/ummon start`.

### Configuration

* `name`: The name of your ummon instance. Defaults to `ummon.server`.
* `port`: The port Ummon will run and listen on. Defaults to `8888`.
* `tasksPath`: Location of task configuration files. Consider `/var/lib/ummon/`. Defaults to  `./config/tasks/`.
* `autoSave`: Whether to automatically save tasks to disk when changed. Defaults to `true`.
* `defaultCollection`: Name of the default collection for tasks. Defaults to  `ummon`.
* `createWorkerPollInterval`: Interval at which Ummon checks if it can run a new worker. Defaults to  `1000`.
* `minimalSaveInterval`: Minimal amount of time before Ummon auto saves again. Defaults to `1000`.
* `maxQueueSize`: The maximum number of runs in the queue before ummon will error. Defaults to `500`.
* `log`:
  * `path`: Path to Ummon's log file. Consider `/var/log/ummon/server.log`. Defaults to `./log/server.log`.
  * `level`: Level at which to log to file. Defaults to `debug`.
  * `period`: Amount of time to keep in a single log file before rotation. Defaults to `1w`.
  * `count`: The total number of `periods` to keep. If the period is 1 week and the count is 4, it will keep a months worth of logs. Defaults to `4`.
* `credentials`: The username and password for API connections.
* `globalTaskDefaults`: Settings to add to every task. Like `ENV` variables or a default `cwd`. Defaults to {}.
* `pause`: Wheter Ummon is paused or not. A paused Ummon will not create any new workers. Defaults to false.
* `workerToCpuRatio`: The ratio of system CPUs to maximum workers. If a server has 4 cpus and a ratio of 1.25, Ummon will run no more than 5 simultaneous workers. Defaults to 1.25.

## License
Copyright (c) 2013 P'unk Avenue
Licensed under the MIT license.
