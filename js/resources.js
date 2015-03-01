function Callback(source, args, scope, timeout) {
    this.oScope = scope == null ? window : scope;
    if (typeof source === 'string') {
        this.sName = source;
    } else if (typeof source === 'function') {
        this.sName = source.name;
        this.fCallback = source;
    } else {
        throw new TypeError("Callback is not have a function or function name!");
    }
    this.modeStrictly = false; // строго ждать загрузки всех ресурсов, перед запуском функции
    this.resources = [];
    this.nLoadResourceTimeout = 5000;
    this.nLoadResourceInterval = 50;
    this.aArgs = args;
    this.sType = 'callback';
    this.nTimeout = timeout == null ? 5000 : timeout;
    this.nInterval = 50;
    this.execute = function () {
        if (this.fCallback == null && typeof this.sName === 'string') {
            this.fCallback = this.oScope[this.sName];
        }
        if (typeof this.fCallback === 'function') {
            this.aArgs != null ? this.fCallback.apply(this.oScope, this.aArgs) : this.fCallback.call(this.oScope);
        } else {
            throw new TypeError("callback cannot execute function!");
        }
    };
    this.executeOnAvailable = function () {
        var callback = this;
        startChecker(callback.nInterval, callback.nTimeout,
            function () {
                if (typeof callback.oScope === "string") {
                    if (window[callback.oScope] != undefined) {
                        callback.oScope = window[callback.oScope];
                    } else {
                        return false;
                    }
                }
                if (typeof callback.oScope[callback.sName] === 'function') {
                    callback.execute();
                    return true;
                }
            },
            function () {
                throw new Error("Function name not found in " + callback.oScope.toString() + " scope");
            });
    };
    // in development
    this.checkResources = function () {
        var callback = this;
        var head = document.getElementsByTagName('head')[0];
        var resource = callback.resources.pop();
        if (resource == null) {
            return;
        }
        if (resource.tagName === 'SCRIPT') {
            if (callback.resources.length == 0) { //Stub
                callback.executeOnAvailable();
            } else {
                callback.checkResources();
            }
        } else if (resource.tagName === 'LINK') {
            var sheet, cssRules;
            // get the correct properties to check for depending on the browser
            if ('sheet' in resource) {
                sheet = 'sheet';
                cssRules = 'cssRules';
            } else {
                sheet = 'styleSheet';
                cssRules = 'rules';
            }
            startChecker(callback.nLoadResourceInterval, callback.nLoadResourceTimeout,
                function () {                                                  // start checking whether the style sheet has successfully loaded
                    if (resource[sheet]) { //&& resource[sheet][cssRules] && resource[sheet][cssRules].length) {
                        if (callback.resources.length == 0) { // SUCCESS! our style sheet has loaded
                            callback.executeOnAvailable();
                        } else {
                            callback.checkResources();
                        }
                        return true;
                    }
                },                                                               // how often to check if the stylesheet is loaded
                function () {                                                    // start counting down till fail
                    head.removeChild(resource);                                  // since the style sheet didn't load, remove the link node from the DOM
                    if (callback.resources.length == 0) {
                        callback.executeOnAvailable();
                    } else {
                        callback.checkResources();
                    }
                    throw new Error("Cannot load " + resource.href);
                });
        } else {
            throw new TypeError("Invalid resource url");
        }
    };
    return this;
}

if (typeof String.prototype.endsWith !== 'function') {
    String.prototype.endsWith = function (suffix) {
        return this.indexOf(suffix, this.length - suffix.length) !== -1;
    };
}

function createResource(url) {
    var resource;
    if (typeof url === 'string') {
        if (url.endsWith(".js")) {
            resource = document.createElement('script');
            resource.type = 'text/javascript';
            resource.src = url;
        } else if (url.endsWith(".css")) {
            resource = document.createElement('link');
            resource.type = 'text/css';
            resource.href = url;
            resource.rel = 'stylesheet';
        } else {
            throw new TypeError("Invalid resource url");
        }
    } else {
        throw new TypeError("Resource url is not string : " + typeof url);
    }
    return resource;
}

function loadResource(url) {
    var head = document.getElementsByTagName('head')[0];
    head.appendChild(createResource(url));
}

function loadResources(urls, index) {
    if (typeof urls === 'string') {
        loadResource(urls);
        return;
    }
    index = index == undefined ? 0 : index;
    if (index >= urls.length - 1) {
        return;
    }
    var head = document.getElementsByTagName('head')[0];
    head.appendChild(createResource(urls[index]));
    loadResources(urls, index + 1);
}

function loadResourceWithCallback(url, callback) {
    var head = document.getElementsByTagName('head')[0];
    var resource = createResource(url);
    if (callback.modeStrictly) {
        callback.resources.push(resource);
    }
    // Then bind the event to the callback function.
    // There are several events for cross browser compatibility.
    resource.onload = resource.onerror = function () {
        if (!this.executed) { // выполнится только один раз
            this.executed = true;
            fireCallback(callback);
        }
    };

    resource.onreadystatechange = function () {
        var self = this;
        if (this.readyState == "complete" || this.readyState == "loaded") {
            setTimeout(function () {
                self.onload()
            }, 0);// сохранить "this" для onload
        }
    };
    // Fire the loading
    head.appendChild(resource);
}

function loadResourcesWithCallback(urls, callback, index) {
    if (typeof urls === 'string') {
        loadResourceWithCallback(urls, callback);
        return;
    }
    index = index == undefined ? 0 : index;
    if (index >= urls.length) {
        return;
    }
    // Adding the script tag to the head as suggested before
    var head = document.getElementsByTagName('head')[0];
    var resource = createResource(urls[index]);
    if (callback.modeStrictly) {
        callback.resources.push(resource);
    }
    // Then bind the event to the callback function.
    // There are several events for cross browser compatibility.
    resource.onload = resource.onerror = function () {
        if (!this.executed) { // выполнится только один раз
            this.executed = true;
            if (index != urls.length - 1) {
                loadResourcesWithCallback(urls, callback, index + 1);
            } else {
                fireCallback(callback);
            }
        }
    };

    resource.onreadystatechange = function () {
        var self = this;
        if (this.readyState == "complete" || this.readyState == "loaded") {
            setTimeout(function () {
                self.onload()
            }, 0);// сохранить "this" для onload
        }
    };
    // Fire the loading
    head.appendChild(resource);
}

function fireCallback(callback) {
    var cb;
    if (typeof callback === 'object' && callback.sType == 'callback') {
        cb = callback;
    } else {
        cb = new Callback(callback);
    }
    if (callback.modeStrictly) {
        cb.checkResources();
    } else {
        cb.executeOnAvailable();
    }
}

function startChecker(interval, timeout, onTry, onFail) {
    var intervalId = setInterval(function () {
        if (onTry()) {
            clearInterval(intervalId);                               // clear the counters
            clearTimeout(timeoutId);
        }
    }, interval);
    var timeoutId = setTimeout(function () {
        clearInterval(intervalId);
        clearTimeout(timeoutId);
        onFail()
    }, timeout);
}
