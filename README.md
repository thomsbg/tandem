Tandem Realtime Coauthoring Engine
===

This repository is also both a Rails gem and a Node.js module.


How to Use
---

### Client

```javascript
var tandem = new Tandem.Client('https://node.stypi.com');
var file = tandem.open(fileId);
file.on('file-update', function(delta) {
    // ...
});
file.update(delta);
```

### Server

```javascript
var Tandem = require('tandem')

var server = require('http').Server();
new Tandem.Server(server);
```

Installation
---


### Rails Bundler

Popular javascript libraries are offically included as dependencies. Less popular libraries will be concatenated with source as part of the build process. To install, just add to Gemfile:

    gem 'tandem-rails', :git => 'git@github.com:stypi/tandem.git', :branch => 'v0.3.2'
    
### NPM

Add to package.json

    "dependencies"  : {
        "tandem": "git+ssh://git@github.com:stypi/tandem.git#v0.3.2"
    }
    
### Other

Copy and use the appropriate file in the build folder.


Project Organization
---

### Top level files/directories

The tandem source code is in the **src** folder. Tests are in the **tests** folder.

All other files/directories are just supporting npm/bundler, build, or documentation files.

    build - js client build target, symbolic link to vendor/assets/javascripts/tandem
    demo - demos
    lib - bundler
    src - source code
    tests - tests written for Mocha on node.js
    vendor/assets/javascripts/tandem - js build target
    grunt.js - js build tool
    index.js - npm
    package.json - npm
    tandem.gemspec - bundler
    

### Version numbers

Until we write a script, version numbers will have to be updated in the following files:

- lib/tandem/version.rb
- grunt.js
- package.json
- all package.json's in demo folder


### Tests

We use the mocha testing framework. To run:

    make test
