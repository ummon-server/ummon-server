'use strict';

module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    // Grunt shell: https://github.com/sindresorhus/grunt-shell#documentation
    shell: {
      test: {
        // command: 'npm test',
        command: 'node test/ummon_test.js',
        options: {
            stdout: true,
            stderr: true,
            failOnError : true
        }
      },
    },

    jshint: {
      options: {
        jshintrc: '.jshintrc'
      },
      gruntfile: {
        src: 'Gruntfile.js'
      },
      lib: {
        src: ['lib/**/*.js', 'index.js']
      },
      test: {
        src: ['test/**/*.js']
      },
    },
    watch: {
      gruntfile: {
        files: '<%= jshint.gruntfile.src %>',
        tasks: ['jshint:gruntfile']
      },
      lib: {
        files: '<%= jshint.lib.src %>',
        tasks: ['jshint:lib', 'shell:test']
      },
      test: {
        files: '<%= jshint.test.src %>',
        tasks: ['jshint:test', 'shell:test']
      },
    },
  });

  // These plugins provide necessary tasks.
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-shell');

  // Default task.
  grunt.registerTask('default', ['jshint', 'shell:test']);

};
