var Module = {};
var readyPromiseResolve,
    readyPromiseReject;
Module["ready"] = new Promise(function (resolve, reject) {
    readyPromiseResolve = resolve;
    readyPromiseReject = reject
});
Module["FLIST"]=[];
Module["FSM"] = wx.getFileSystemManager();
Module["USER_DATA_PATH"] = wx.env.USER_DATA_PATH+"/";
var out = Module["print"] || console.log.bind(console);
var err = Module["printErr"] || console.warn.bind(console);
var arguments_ = [];
var thisProgram = "./this.program";
var ENVIRONMENT_IS_NODE = true;

var wasmMemory;
var wasmTable = new WebAssembly.Table({
    "initial": 9160,
    "maximum": 9160 + 0,
    "element": "anyfunc"
});
var ABORT = false;
var EXITSTATUS = 0;

function assert(condition, text) {
    if (!condition) {
        abort("Assertion failed: " + text)
    }
}
var UTF8Decoder = typeof TextDecoder !== "undefined" ? new TextDecoder("utf8") : undefined;
function UTF8ArrayToString(heap, idx, maxBytesToRead) {
    var endIdx = idx + maxBytesToRead;
    var endPtr = idx;
    while (heap[endPtr] && !(endPtr >= endIdx))
        ++endPtr;
    if (endPtr - idx > 16 && heap.subarray && UTF8Decoder) {
        return UTF8Decoder.decode(heap.subarray(idx, endPtr))
    } else {
        var str = "";
        while (idx < endPtr) {
            var u0 = heap[idx++];
            if (!(u0 & 128)) {
                str += String.fromCharCode(u0);
                continue
            }
            var u1 = heap[idx++] & 63;
            if ((u0 & 224) == 192) {
                str += String.fromCharCode((u0 & 31) << 6 | u1);
                continue
            }
            var u2 = heap[idx++] & 63;
            if ((u0 & 240) == 224) {
                u0 = (u0 & 15) << 12 | u1 << 6 | u2
            } else {
                u0 = (u0 & 7) << 18 | u1 << 12 | u2 << 6 | heap[idx++] & 63
            }
            if (u0 < 65536) {
                str += String.fromCharCode(u0)
            } else {
                var ch = u0 - 65536;
                str += String.fromCharCode(55296 | ch >> 10, 56320 | ch & 1023)
            }
        }
    }
    return str
}
function UTF8ToString(ptr, maxBytesToRead) {
    return ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead) : ""
}
function stringToUTF8Array(str, heap, outIdx, maxBytesToWrite) {
    if (!(maxBytesToWrite > 0))
        return 0;
    var startIdx = outIdx;
    var endIdx = outIdx + maxBytesToWrite - 1;
    for (var i = 0; i < str.length; ++i) {
        var u = str.charCodeAt(i);
        if (u >= 55296 && u <= 57343) {
            var u1 = str.charCodeAt(++i);
            u = 65536 + ((u & 1023) << 10) | u1 & 1023
        }
        if (u <= 127) {
            if (outIdx >= endIdx)
                break;
            heap[outIdx++] = u
        } else if (u <= 2047) {
            if (outIdx + 1 >= endIdx)
                break;
            heap[outIdx++] = 192 | u >> 6;
            heap[outIdx++] = 128 | u & 63
        } else if (u <= 65535) {
            if (outIdx + 2 >= endIdx)
                break;
            heap[outIdx++] = 224 | u >> 12;
            heap[outIdx++] = 128 | u >> 6 & 63;
            heap[outIdx++] = 128 | u & 63
        } else {
            if (outIdx + 3 >= endIdx)
                break;
            heap[outIdx++] = 240 | u >> 18;
            heap[outIdx++] = 128 | u >> 12 & 63;
            heap[outIdx++] = 128 | u >> 6 & 63;
            heap[outIdx++] = 128 | u & 63
        }
    }
    heap[outIdx] = 0;
    return outIdx - startIdx
}
function stringToUTF8(str, outPtr, maxBytesToWrite) {
    return stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite)
}
function lengthBytesUTF8(str) {
    var len = 0;
    for (var i = 0; i < str.length; ++i) {
        var u = str.charCodeAt(i);
        if (u >= 55296 && u <= 57343)
            u = 65536 + ((u & 1023) << 10) | str.charCodeAt(++i) & 1023;
        if (u <= 127)
            ++len;
        else if (u <= 2047)
            len += 2;
        else if (u <= 65535)
            len += 3;
        else
            len += 4
    }
    return len
}
var UTF16Decoder = typeof TextDecoder !== "undefined" ? new TextDecoder("utf-16le") : undefined;

function UTF16ToString(ptr, maxBytesToRead) {
    var endPtr = ptr;
    var idx = endPtr >> 1;
    var maxIdx = idx + maxBytesToRead / 2;
    while (!(idx >= maxIdx) && HEAPU16[idx])
        ++idx;
    endPtr = idx << 1;
    if (endPtr - ptr > 32 && UTF16Decoder) {
        return UTF16Decoder.decode(HEAPU8.subarray(ptr, endPtr))
    } else {
        var i = 0;
        var str = "";
        while (1) {
            var codeUnit = HEAP16[ptr + i * 2 >> 1];
            if (codeUnit == 0 || i == maxBytesToRead / 2)
                return str;
            ++i;
            str += String.fromCharCode(codeUnit)
        }
    }
}

function stringToUTF16(str, outPtr, maxBytesToWrite) {
    if (maxBytesToWrite === undefined) {
        maxBytesToWrite = 2147483647
    }
    if (maxBytesToWrite < 2)
        return 0;
    maxBytesToWrite -= 2;
    var startPtr = outPtr;
    var numCharsToWrite = maxBytesToWrite < str.length * 2 ? maxBytesToWrite / 2 : str.length;
    for (var i = 0; i < numCharsToWrite; ++i) {
        var codeUnit = str.charCodeAt(i);
        HEAP16[outPtr >> 1] = codeUnit;
        outPtr += 2
    }
    HEAP16[outPtr >> 1] = 0;
    return outPtr - startPtr
}

function lengthBytesUTF16(str) {
    return str.length * 2
}

function UTF32ToString(ptr, maxBytesToRead) {
    var i = 0;
    var str = "";
    while (!(i >= maxBytesToRead / 4)) {
        var utf32 = HEAP32[ptr + i * 4 >> 2];
        if (utf32 == 0)
            break;
        ++i;
        if (utf32 >= 65536) {
            var ch = utf32 - 65536;
            str += String.fromCharCode(55296 | ch >> 10, 56320 | ch & 1023)
        } else {
            str += String.fromCharCode(utf32)
        }
    }
    return str
}

function stringToUTF32(str, outPtr, maxBytesToWrite) {
    if (maxBytesToWrite === undefined) {
        maxBytesToWrite = 2147483647
    }
    if (maxBytesToWrite < 4)
        return 0;
    var startPtr = outPtr;
    var endPtr = startPtr + maxBytesToWrite - 4;
    for (var i = 0; i < str.length; ++i) {
        var codeUnit = str.charCodeAt(i);
        if (codeUnit >= 55296 && codeUnit <= 57343) {
            var trailSurrogate = str.charCodeAt(++i);
            codeUnit = 65536 + ((codeUnit & 1023) << 10) | trailSurrogate & 1023
        }
        HEAP32[outPtr >> 2] = codeUnit;
        outPtr += 4;
        if (outPtr + 4 > endPtr)
            break
    }
    HEAP32[outPtr >> 2] = 0;
    return outPtr - startPtr
}

function lengthBytesUTF32(str) {
    var len = 0;
    for (var i = 0; i < str.length; ++i) {
        var codeUnit = str.charCodeAt(i);
        if (codeUnit >= 55296 && codeUnit <= 57343)
            ++i;
        len += 4
    }
    return len
}

function writeArrayToMemory(array, buffer) {
    HEAP8.set(array, buffer)
}

function writeAsciiToMemory(str, buffer, dontAddNull) {
    for (var i = 0; i < str.length; ++i) {
        HEAP8[buffer++ >> 0] = str.charCodeAt(i)
    }
    if (!dontAddNull)
        HEAP8[buffer >> 0] = 0

}
var WASM_PAGE_SIZE = 65536;

function alignUp(x, multiple) {
    if (x % multiple > 0) {
        x += multiple - x % multiple
    }
    return x
}
var buffer,
    HEAP8,
    HEAPU8,
    HEAP16,
    HEAPU16,
    HEAP32,
    HEAPU32,
    HEAPF32,
    HEAPF64;

function updateGlobalBufferAndViews(buf) {
    buffer = buf;
    Module["HEAP8"] = HEAP8 = new Int8Array(buf);
    Module["HEAP16"] = HEAP16 = new Int16Array(buf);
    Module["HEAP32"] = HEAP32 = new Int32Array(buf);
    Module["HEAPU8"] = HEAPU8 = new Uint8Array(buf);
    Module["HEAPU16"] = HEAPU16 = new Uint16Array(buf);
    Module["HEAPU32"] = HEAPU32 = new Uint32Array(buf);
    Module["HEAPF32"] = HEAPF32 = new Float32Array(buf);
    Module["HEAPF64"] = HEAPF64 = new Float64Array(buf)
}
var STACK_BASE = 6506912,
    DYNAMIC_BASE = 6506912,
    DYNAMICTOP_PTR = 1263872;
var INITIAL_INITIAL_MEMORY = 134217728;
wasmMemory = new WebAssembly.Memory({
    "initial": INITIAL_INITIAL_MEMORY / WASM_PAGE_SIZE,
    "maximum": 1073741824 / WASM_PAGE_SIZE
})
if (wasmMemory) {
    buffer = wasmMemory.buffer
}
INITIAL_INITIAL_MEMORY = buffer.byteLength;
updateGlobalBufferAndViews(buffer);
HEAP32[DYNAMICTOP_PTR >> 2] = DYNAMIC_BASE;

function callRuntimeCallbacks(callbacks) {
    while (callbacks.length > 0) {
        var callback = callbacks.shift();
        if (typeof callback == "function") {
            callback(Module);
            continue
        }
        var func = callback.func;
        if (typeof func === "number") {
            if (callback.arg === undefined) {
                Module["dynCall_v"](func)
            } else {
                Module["dynCall_vi"](func, callback.arg)
            }
        } else {
            func(callback.arg === undefined ? null : callback.arg)
        }
    }
}
var __ATPRERUN__ = [];
var __ATINIT__ = [];
var __ATMAIN__ = [];
var __ATEXIT__ = [];
var __ATPOSTRUN__ = [];
var runtimeInitialized = false;
var runtimeExited = false;

function preRun() {
    if (Module["preRun"]) {
        if (typeof Module["preRun"] == "function")
            Module["preRun"] = [Module["preRun"]];
        while (Module["preRun"].length) {
            addOnPreRun(Module["preRun"].shift())
        }
    }
    callRuntimeCallbacks(__ATPRERUN__)
}

function initRuntime() {
    runtimeInitialized = true;
    if (!Module["noFSInit"] && !FS.init.initialized)
        FS.init();
    callRuntimeCallbacks(__ATINIT__)
}

function preMain() {
    callRuntimeCallbacks(__ATMAIN__)
}

function exitRuntime() {
    runtimeExited = true
}

function postRun() {
    if (Module["postRun"]) {
        if (typeof Module["postRun"] == "function")
            Module["postRun"] = [Module["postRun"]];
        while (Module["postRun"].length) {
            addOnPostRun(Module["postRun"].shift())
        }
    }
    callRuntimeCallbacks(__ATPOSTRUN__)
}

function addOnPreRun(cb) {
    __ATPRERUN__.unshift(cb)
}

function addOnPostRun(cb) {
    __ATPOSTRUN__.unshift(cb)
}
var Math_abs = Math.abs;
var Math_ceil = Math.ceil;
var Math_floor = Math.floor;
var Math_min = Math.min;
var runDependencies = 0;
var runDependencyWatcher = null;
var dependenciesFulfilled = null;

function getUniqueRunDependency(id) {
    return id
}

function addRunDependency(id) {
    runDependencies++;
    if (Module["monitorRunDependencies"]) {
        Module["monitorRunDependencies"](runDependencies)
    }
}

function removeRunDependency(id) {
    runDependencies--;
    if (Module["monitorRunDependencies"]) {
        Module["monitorRunDependencies"](runDependencies)
    }
    if (runDependencies == 0) {
        if (runDependencyWatcher !== null) {
            clearInterval(runDependencyWatcher);
            runDependencyWatcher = null
        }
        if (dependenciesFulfilled) {
            var callback = dependenciesFulfilled;
            dependenciesFulfilled = null;
            callback()
        }
    }
}

function abort(what) {
    if (Module["onAbort"]) {
        Module["onAbort"](what)
    }
    what += "";
    out(what);
    err(what);
    ABORT = true;
    EXITSTATUS = 1;
    what = "abort(" + what + "). Build with -s ASSERTIONS=1 for more info.";
    throw new WebAssembly.RuntimeError(what)
}
function ___cxa_allocate_exception(size) {
    return _malloc(size)
}

function _atexit(func, arg) {
    __ATEXIT__.unshift({
        func: func,
        arg: arg
    })
}

function ___cxa_atexit(a0, a1) {
    return _atexit(a0, a1)
}
var ___exception_infos = {};
var ___exception_last = 0;

function __ZSt18uncaught_exceptionv() {
    return __ZSt18uncaught_exceptionv.uncaught_exceptions > 0
}

function ___cxa_throw(ptr, type, destructor) {
    ___exception_infos[ptr] = {
        ptr: ptr,
        adjusted: [ptr],
        type: type,
        destructor: destructor,
        refcount: 0,
        caught: false,
        rethrown: false
    };
    ___exception_last = ptr;
    if (!("uncaught_exception" in __ZSt18uncaught_exceptionv)) {
        __ZSt18uncaught_exceptionv.uncaught_exceptions = 1
    } else {
        __ZSt18uncaught_exceptionv.uncaught_exceptions++
    }
    throw ptr
}

function setErrNo(value) {
    HEAP32[___errno_location() >> 2] = value;
    return value
}

function ___map_file(pathname, size) {
    setErrNo(63);
    return -1
}

function createWasm() {
    var info = {
        "env": asmLibraryArg,
        "wasi_snapshot_preview1": asmLibraryArg
    };

    function receiveInstance(instance, module) {
        var exports = instance.exports;
        Module["asm"] = exports;
        removeRunDependency("wasm-instantiate")
    }
    addRunDependency("wasm-instantiate");

    function receiveInstantiatedSource(output) {
        receiveInstance(output)
    }

    function instantiateAsync() {
        var wasmurl = (typeof Module["wasmurl"] == "string" && Module["wasmurl"] != '' ? Module["wasmurl"] : 'http://192.168.2.7:8080/opencv.wasm');
        var wasmfilename = wasmurl.slice(wasmurl.lastIndexOf("/") + 1);
        var USER_DATA_PATH = wx.env.USER_DATA_PATH;
        var wasmdir = USER_DATA_PATH + "/wasm/";
        var flag = true;
        var FSM = wx.getFileSystemManager();
        try {
            FSM.accessSync(wasmdir)
        } catch (error) {
            FSM.mkdirSync(wasmdir);
        }
        if (!Module["useCache"]) {
            try {
                FSM.accessSync(wasmdir);
                FSM.rmdirSync(wasmdir, true);
                FSM.mkdirSync(wasmdir);
            } catch (error) {
                FSM.mkdirSync(wasmdir);
            }
        } else {
            if (Module["wasmtype"] == "zip") {

                try {
                    FSM.accessSync(wasmdir + wasmfilename.slice(0, wasmfilename.lastIndexOf(".zip")) + ".wasm");
                    //console.log("useCache");
                    flag = false;
                    var wasmdata = FSM.readFileSync(wasmdir + wasmfilename.slice(0, wasmfilename.lastIndexOf(".zip")) + ".wasm");
                    new WebAssembly.compile(wasmdata).then(function (wam) {
                        new WebAssembly.instantiate(wam, info).then(receiveInstantiatedSource);
                    });
                } catch (error) {}
            } else {
                try {
                    FSM.accessSync(wasmdir + wasmfilename);
                    //console.log("useCache");
                    flag = false;
                    var wasmdata = FSM.readFileSync(wasmdir + wasmfilename);
                    new WebAssembly.compile(wasmdata).then(function (wam) {
                        new WebAssembly.instantiate(wam, info).then(receiveInstantiatedSource);
                    });
                } catch (error) {}
            }
        }
        if (flag) {
            wx.downloadFile({
                url: wasmurl,
                success(evt) {
                    if (Module["wasmtype"] == "zip") {
                        var wasmzipfilepath = evt.tempFilePath;
                        FSM.unzip({
                            zipFilePath: wasmzipfilepath,
                            targetPath: wasmdir,
                            complete: function (res) {
                                var wasmdata = FSM.readFileSync(wasmdir + wasmfilename.slice(0, wasmfilename.lastIndexOf(".zip")) + ".wasm");
                                new WebAssembly.compile(wasmdata).then(function (wam) {
                                    new WebAssembly.instantiate(wam, info).then(receiveInstantiatedSource);
                                });
                            }
                        })
                    } else {
                        var wasmfilepath = evt.tempFilePath;
                        FSM.saveFileSync(wasmfilepath, wasmdir + wasmfilename);
                        var wasmdata = FSM.readFileSync(wasmdir + wasmfilename);
                        new WebAssembly.compile(wasmdata).then(function (wam) {
                            new WebAssembly.instantiate(wam, info).then(receiveInstantiatedSource);
                        });
                    }
                }
            })

        }
    }
    if (Module["instantiateWasm"]) {
        try {
            var exports = Module["instantiateWasm"](info, receiveInstance);
            return exports
        } catch (e) {
            err("Module.instantiateWasm callback failed with error: " + e);
            return false
        }
    }
    instantiateAsync();
    return {}
}
var tempDouble;
var tempI64;
__ATINIT__.push({
    func: function () {
        ___wasm_call_ctors()
    }
});
var PATH = {
    splitPath: function (filename) {
        var splitPathRe = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
        return splitPathRe.exec(filename).slice(1)
    },
    normalizeArray: function (parts, allowAboveRoot) {
        var up = 0;
        for (var i = parts.length - 1; i >= 0; i--) {
            var last = parts[i];
            if (last === ".") {
                parts.splice(i, 1)
            } else if (last === "..") {
                parts.splice(i, 1);
                up++
            } else if (up) {
                parts.splice(i, 1);
                up--
            }
        }
        if (allowAboveRoot) {
            for (; up; up--) {
                parts.unshift("..")
            }
        }
        return parts
    },
    normalize: function (path) {
        var isAbsolute = path.charAt(0) === "/",
        trailingSlash = path.substr(-1) === "/";
        path = PATH.normalizeArray(path.split("/").filter(function (p) {
                    return !!p
                }), !isAbsolute).join("/");
        if (!path && !isAbsolute) {
            path = "."
        }
        if (path && trailingSlash) {
            path += "/"
        }
        return (isAbsolute ? "/" : "") + path
    },
    dirname: function (path) {
        var result = PATH.splitPath(path),
        root = result[0],
        dir = result[1];
        if (!root && !dir) {
            return "."
        }
        if (dir) {
            dir = dir.substr(0, dir.length - 1)
        }
        return root + dir
    },
    basename: function (path) {
        if (path === "/")
            return "/";
        var lastSlash = path.lastIndexOf("/");
        if (lastSlash === -1)
            return path;
        return path.substr(lastSlash + 1)
    },
    extname: function (path) {
        return PATH.splitPath(path)[3]
    },
    join: function () {
        var paths = Array.prototype.slice.call(arguments, 0);
        return PATH.normalize(paths.join("/"))
    },
    join2: function (l, r) {
        return PATH.normalize(l + "/" + r)
    }
};
var PATH_FS = {
    resolve: function () {
        var resolvedPath = "",
        resolvedAbsolute = false;
        for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
            var path = i >= 0 ? arguments[i] : FS.cwd();
            if (typeof path !== "string") {
                throw new TypeError("Arguments to path.resolve must be strings")
            } else if (!path) {
                return ""
            }
            resolvedPath = path + "/" + resolvedPath;
            resolvedAbsolute = path.charAt(0) === "/"
        }
        resolvedPath = PATH.normalizeArray(resolvedPath.split("/").filter(function (p) {
                    return !!p
                }), !resolvedAbsolute).join("/");
        return (resolvedAbsolute ? "/" : "") + resolvedPath || "."
    },
    relative: function (from, to) {
        from = PATH_FS.resolve(from).substr(1);
        to = PATH_FS.resolve(to).substr(1);
        function trim(arr) {
            var start = 0;
            for (; start < arr.length; start++) {
                if (arr[start] !== "")
                    break
            }
            var end = arr.length - 1;
            for (; end >= 0; end--) {
                if (arr[end] !== "")
                    break
            }
            if (start > end)
                return [];
            return arr.slice(start, end - start + 1)
        }
        var fromParts = trim(from.split("/"));
        var toParts = trim(to.split("/"));
        var length = Math.min(fromParts.length, toParts.length);
        var samePartsLength = length;
        for (var i = 0; i < length; i++) {
            if (fromParts[i] !== toParts[i]) {
                samePartsLength = i;
                break
            }
        }
        var outputParts = [];
        for (var i = samePartsLength; i < fromParts.length; i++) {
            outputParts.push("..")
        }
        outputParts = outputParts.concat(toParts.slice(samePartsLength));
        return outputParts.join("/")
    }
};
var TTY = {
    ttys: [],
    init: function () {},
    shutdown: function () {},
    register: function (dev, ops) {
        TTY.ttys[dev] = {
            input: [],
            output: [],
            ops: ops
        };
        FS.registerDevice(dev, TTY.stream_ops)
    },
    stream_ops: {
        open: function (stream) {
            var tty = TTY.ttys[stream.node.rdev];
            if (!tty) {
                throw new FS.ErrnoError(43)
            }
            stream.tty = tty;
            stream.seekable = false
        },
        close: function (stream) {
            stream.tty.ops.flush(stream.tty)
        },
        flush: function (stream) {
            stream.tty.ops.flush(stream.tty)
        },
        read: function (stream, buffer, offset, length, pos) {
            if (!stream.tty || !stream.tty.ops.get_char) {
                throw new FS.ErrnoError(60)
            }
            var bytesRead = 0;
            for (var i = 0; i < length; i++) {
                var result;
                try {
                    result = stream.tty.ops.get_char(stream.tty)
                } catch (e) {
                    throw new FS.ErrnoError(29)
                }
                if (result === undefined && bytesRead === 0) {
                    throw new FS.ErrnoError(6)
                }
                if (result === null || result === undefined)
                    break;
                bytesRead++;
                buffer[offset + i] = result
            }
            if (bytesRead) {
                stream.node.timestamp = Date.now()
            }
            return bytesRead
        },
        write: function (stream, buffer, offset, length, pos) {
            if (!stream.tty || !stream.tty.ops.put_char) {
                throw new FS.ErrnoError(60)
            }
            try {
                for (var i = 0; i < length; i++) {
                    stream.tty.ops.put_char(stream.tty, buffer[offset + i])
                }
            } catch (e) {
                throw new FS.ErrnoError(29)
            }
            if (length) {
                stream.node.timestamp = Date.now()
            }
            return i
        }
    },
    default_tty_ops: {
        get_char: function (tty) {
            if (!tty.input.length) {
                var result = null;
                if (ENVIRONMENT_IS_NODE) {
                    var BUFSIZE = 256;
                    var buf = Buffer.alloc ? Buffer.alloc(BUFSIZE) : new Buffer(BUFSIZE);
                    var bytesRead = 0;
                    try {
                        bytesRead = nodeFS.readSync(process.stdin.fd, buf, 0, BUFSIZE, null)
                    } catch (e) {
                        if (e.toString().indexOf("EOF") != -1)
                            bytesRead = 0;
                        else
                            throw e
                    }
                    if (bytesRead > 0) {
                        result = buf.slice(0, bytesRead).toString("utf-8")
                    } else {
                        result = null
                    }
                } else if (typeof window != "undefined" && typeof window.prompt == "function") {
                    result = window.prompt("Input: ");
                    if (result !== null) {
                        result += "\n"
                    }
                } else if (typeof readline == "function") {
                    result = readline();
                    if (result !== null) {
                        result += "\n"
                    }
                }
                if (!result) {
                    return null
                }
                tty.input = intArrayFromString(result, true)
            }
            return tty.input.shift()
        },
        put_char: function (tty, val) {
            if (val === null || val === 10) {
                out(UTF8ArrayToString(tty.output, 0));
                tty.output = []
            } else {
                if (val != 0)
                    tty.output.push(val)
            }
        },
        flush: function (tty) {
            if (tty.output && tty.output.length > 0) {
                out(UTF8ArrayToString(tty.output, 0));
                tty.output = []
            }
        }
    },
    default_tty1_ops: {
        put_char: function (tty, val) {
            if (val === null || val === 10) {
                err(UTF8ArrayToString(tty.output, 0));
                tty.output = []
            } else {
                if (val != 0)
                    tty.output.push(val)
            }
        },
        flush: function (tty) {
            if (tty.output && tty.output.length > 0) {
                err(UTF8ArrayToString(tty.output, 0));
                tty.output = []
            }
        }
    }
};
var MEMFS = {
    ops_table: null,
    mount: function (mount) {
        return MEMFS.createNode(null, "/", 16384 | 511, 0)
    },
    createNode: function (parent, name, mode, dev) {
        if (FS.isBlkdev(mode) || FS.isFIFO(mode)) {
            throw new FS.ErrnoError(63)
        }
        if (!MEMFS.ops_table) {
            MEMFS.ops_table = {
                dir: {
                    node: {
                        getattr: MEMFS.node_ops.getattr,
                        setattr: MEMFS.node_ops.setattr,
                        lookup: MEMFS.node_ops.lookup,
                        mknod: MEMFS.node_ops.mknod,
                        rename: MEMFS.node_ops.rename,
                        unlink: MEMFS.node_ops.unlink,
                        rmdir: MEMFS.node_ops.rmdir,
                        readdir: MEMFS.node_ops.readdir,
                        symlink: MEMFS.node_ops.symlink
                    },
                    stream: {
                        llseek: MEMFS.stream_ops.llseek
                    }
                },
                file: {
                    node: {
                        getattr: MEMFS.node_ops.getattr,
                        setattr: MEMFS.node_ops.setattr
                    },
                    stream: {
                        llseek: MEMFS.stream_ops.llseek,
                        read: MEMFS.stream_ops.read,
                        write: MEMFS.stream_ops.write,
                        allocate: MEMFS.stream_ops.allocate,
                        mmap: MEMFS.stream_ops.mmap,
                        msync: MEMFS.stream_ops.msync
                    }
                },
                link: {
                    node: {
                        getattr: MEMFS.node_ops.getattr,
                        setattr: MEMFS.node_ops.setattr,
                        readlink: MEMFS.node_ops.readlink
                    },
                    stream: {}
                },
                chrdev: {
                    node: {
                        getattr: MEMFS.node_ops.getattr,
                        setattr: MEMFS.node_ops.setattr
                    },
                    stream: FS.chrdev_stream_ops
                }
            }
        }
        var node = FS.createNode(parent, name, mode, dev);
        if (FS.isDir(node.mode)) {
            node.node_ops = MEMFS.ops_table.dir.node;
            node.stream_ops = MEMFS.ops_table.dir.stream;
            node.contents = {}
        } else if (FS.isFile(node.mode)) {
            node.node_ops = MEMFS.ops_table.file.node;
            node.stream_ops = MEMFS.ops_table.file.stream;
            node.usedBytes = 0;
            node.contents = null
        } else if (FS.isLink(node.mode)) {
            node.node_ops = MEMFS.ops_table.link.node;
            node.stream_ops = MEMFS.ops_table.link.stream
        } else if (FS.isChrdev(node.mode)) {
            node.node_ops = MEMFS.ops_table.chrdev.node;
            node.stream_ops = MEMFS.ops_table.chrdev.stream
        }
        node.timestamp = Date.now();
        if (parent) {
            parent.contents[name] = node
        }
        return node
    },
    getFileDataAsRegularArray: function (node) {
        if (node.contents && node.contents.subarray) {
            var arr = [];
            for (var i = 0; i < node.usedBytes; ++i)
                arr.push(node.contents[i]);
            return arr
        }
        return node.contents
    },
    getFileDataAsTypedArray: function (node) {
        if (!node.contents)
            return new Uint8Array(0);
        if (node.contents.subarray)
            return node.contents.subarray(0, node.usedBytes);
        return new Uint8Array(node.contents)
    },
    expandFileStorage: function (node, newCapacity) {
        var prevCapacity = node.contents ? node.contents.length : 0;
        if (prevCapacity >= newCapacity)
            return;
        var CAPACITY_DOUBLING_MAX = 1024 * 1024;
        newCapacity = Math.max(newCapacity, prevCapacity * (prevCapacity < CAPACITY_DOUBLING_MAX ? 2 : 1.125) >>> 0);
        if (prevCapacity != 0)
            newCapacity = Math.max(newCapacity, 256);
        var oldContents = node.contents;
        node.contents = new Uint8Array(newCapacity);
        if (node.usedBytes > 0)
            node.contents.set(oldContents.subarray(0, node.usedBytes), 0);
        return
    },
    resizeFileStorage: function (node, newSize) {
        if (node.usedBytes == newSize)
            return;
        if (newSize == 0) {
            node.contents = null;
            node.usedBytes = 0;
            return
        }
        if (!node.contents || node.contents.subarray) {
            var oldContents = node.contents;
            node.contents = new Uint8Array(newSize);
            if (oldContents) {
                node.contents.set(oldContents.subarray(0, Math.min(newSize, node.usedBytes)))
            }
            node.usedBytes = newSize;
            return
        }
        if (!node.contents)
            node.contents = [];
        if (node.contents.length > newSize)
            node.contents.length = newSize;
        else
            while (node.contents.length < newSize)
                node.contents.push(0);
        node.usedBytes = newSize
    },
    node_ops: {
        getattr: function (node) {
            var attr = {};
            attr.dev = FS.isChrdev(node.mode) ? node.id : 1;
            attr.ino = node.id;
            attr.mode = node.mode;
            attr.nlink = 1;
            attr.uid = 0;
            attr.gid = 0;
            attr.rdev = node.rdev;
            if (FS.isDir(node.mode)) {
                attr.size = 4096
            } else if (FS.isFile(node.mode)) {
                attr.size = node.usedBytes
            } else if (FS.isLink(node.mode)) {
                attr.size = node.link.length
            } else {
                attr.size = 0
            }
            attr.atime = new Date(node.timestamp);
            attr.mtime = new Date(node.timestamp);
            attr.ctime = new Date(node.timestamp);
            attr.blksize = 4096;
            attr.blocks = Math.ceil(attr.size / attr.blksize);
            return attr
        },
        setattr: function (node, attr) {
            if (attr.mode !== undefined) {
                node.mode = attr.mode
            }
            if (attr.timestamp !== undefined) {
                node.timestamp = attr.timestamp
            }
            if (attr.size !== undefined) {
                MEMFS.resizeFileStorage(node, attr.size)
            }
        },
        lookup: function (parent, name) {
            throw FS.genericErrors[44]
        },
        mknod: function (parent, name, mode, dev) {
            return MEMFS.createNode(parent, name, mode, dev)
        },
        rename: function (old_node, new_dir, new_name) {
            if (FS.isDir(old_node.mode)) {
                var new_node;
                try {
                    new_node = FS.lookupNode(new_dir, new_name)
                } catch (e) {}
                if (new_node) {
                    for (var i in new_node.contents) {
                        throw new FS.ErrnoError(55)
                    }
                }
            }
            delete old_node.parent.contents[old_node.name];
            old_node.name = new_name;
            new_dir.contents[new_name] = old_node;
            old_node.parent = new_dir
        },
        unlink: function (parent, name) {
            delete parent.contents[name]
        },
        rmdir: function (parent, name) {
            var node = FS.lookupNode(parent, name);
            for (var i in node.contents) {
                throw new FS.ErrnoError(55)
            }
            delete parent.contents[name]
        },
        readdir: function (node) {
            var entries = [".", ".."];
            for (var key in node.contents) {
                if (!node.contents.hasOwnProperty(key)) {
                    continue
                }
                entries.push(key)
            }
            return entries
        },
        symlink: function (parent, newname, oldpath) {
            var node = MEMFS.createNode(parent, newname, 511 | 40960, 0);
            node.link = oldpath;
            return node
        },
        readlink: function (node) {
            if (!FS.isLink(node.mode)) {
                throw new FS.ErrnoError(28)
            }
            return node.link
        }
    },
    stream_ops: {
        read: function (stream, buffer, offset, length, position) {
            var contents = stream.node.contents;
            if (position >= stream.node.usedBytes)
                return 0;
            var size = Math.min(stream.node.usedBytes - position, length);
            if (size > 8 && contents.subarray) {
                buffer.set(contents.subarray(position, position + size), offset)
            } else {
                for (var i = 0; i < size; i++)
                    buffer[offset + i] = contents[position + i]
            }
            return size
        },
        write: function (stream, buffer, offset, length, position, canOwn) {
            if (buffer.buffer === HEAP8.buffer) {
                canOwn = false
            }
            if (!length)
                return 0;
            var node = stream.node;
            node.timestamp = Date.now();
            if (buffer.subarray && (!node.contents || node.contents.subarray)) {
                if (canOwn) {
                    node.contents = buffer.subarray(offset, offset + length);
                    node.usedBytes = length;
                    return length
                } else if (node.usedBytes === 0 && position === 0) {
                    node.contents = buffer.slice(offset, offset + length);
                    node.usedBytes = length;
                    return length
                } else if (position + length <= node.usedBytes) {
                    node.contents.set(buffer.subarray(offset, offset + length), position);
                    return length
                }
            }
            MEMFS.expandFileStorage(node, position + length);
            if (node.contents.subarray && buffer.subarray)
                node.contents.set(buffer.subarray(offset, offset + length), position);
            else {
                for (var i = 0; i < length; i++) {
                    node.contents[position + i] = buffer[offset + i]
                }
            }
            node.usedBytes = Math.max(node.usedBytes, position + length);
            return length
        },
        llseek: function (stream, offset, whence) {
            var position = offset;
            if (whence === 1) {
                position += stream.position
            } else if (whence === 2) {
                if (FS.isFile(stream.node.mode)) {
                    position += stream.node.usedBytes
                }
            }
            if (position < 0) {
                throw new FS.ErrnoError(28)
            }
            return position
        },
        allocate: function (stream, offset, length) {
            MEMFS.expandFileStorage(stream.node, offset + length);
            stream.node.usedBytes = Math.max(stream.node.usedBytes, offset + length)
        },
        mmap: function (stream, buffer, offset, length, position, prot, flags) {
            if (!FS.isFile(stream.node.mode)) {
                throw new FS.ErrnoError(43)
            }
            var ptr;
            var allocated;
            var contents = stream.node.contents;
            if (!(flags & 2) && contents.buffer === buffer.buffer) {
                allocated = false;
                ptr = contents.byteOffset
            } else {
                if (position > 0 || position + length < contents.length) {
                    if (contents.subarray) {
                        contents = contents.subarray(position, position + length)
                    } else {
                        contents = Array.prototype.slice.call(contents, position, position + length)
                    }
                }
                allocated = true;
                var fromHeap = buffer.buffer == HEAP8.buffer;
                ptr = _malloc(length);
                if (!ptr) {
                    throw new FS.ErrnoError(48)
                }
                (fromHeap ? HEAP8 : buffer).set(contents, ptr)
            }
            return {
                ptr: ptr,
                allocated: allocated
            }
        },
        msync: function (stream, buffer, offset, length, mmapFlags) {
            if (!FS.isFile(stream.node.mode)) {
                throw new FS.ErrnoError(43)
            }
            if (mmapFlags & 2) {
                return 0
            }
            var bytesWritten = MEMFS.stream_ops.write(stream, buffer, 0, length, offset, false);
            return 0
        }
    }
};
var FS = {
    root: null,
    mounts: [],
    devices: {},
    streams: [],
    nextInode: 1,
    nameTable: null,
    currentPath: "/",
    initialized: false,
    ignorePermissions: true,
    trackingDelegate: {},
    tracking: {
        openFlags: {
            READ: 1,
            WRITE: 2
        }
    },
    ErrnoError: null,
    genericErrors: {},
    filesystems: null,
    syncFSRequests: 0,
    handleFSError: function (e) {
        if (!(e instanceof FS.ErrnoError))
            throw e + " : " + stackTrace();
        return setErrNo(e.errno)
    },
    lookupPath: function (path, opts) {
        path = PATH_FS.resolve(FS.cwd(), path);
        opts = opts || {};
        if (!path)
            return {
                path: "",
                node: null
            };
        var defaults = {
            follow_mount: true,
            recurse_count: 0
        };
        for (var key in defaults) {
            if (opts[key] === undefined) {
                opts[key] = defaults[key]
            }
        }
        if (opts.recurse_count > 8) {
            throw new FS.ErrnoError(32)
        }
        var parts = PATH.normalizeArray(path.split("/").filter(function (p) {
                    return !!p
                }), false);
        var current = FS.root;
        var current_path = "/";
        for (var i = 0; i < parts.length; i++) {
            var islast = i === parts.length - 1;
            if (islast && opts.parent) {
                break
            }
            current = FS.lookupNode(current, parts[i]);
            current_path = PATH.join2(current_path, parts[i]);
            if (FS.isMountpoint(current)) {
                if (!islast || islast && opts.follow_mount) {
                    current = current.mounted.root
                }
            }
            if (!islast || opts.follow) {
                var count = 0;
                while (FS.isLink(current.mode)) {
                    var link = FS.readlink(current_path);
                    current_path = PATH_FS.resolve(PATH.dirname(current_path), link);
                    var lookup = FS.lookupPath(current_path, {
                            recurse_count: opts.recurse_count
                        });
                    current = lookup.node;
                    if (count++ > 40) {
                        throw new FS.ErrnoError(32)
                    }
                }
            }
        }
        return {
            path: current_path,
            node: current
        }
    },
    getPath: function (node) {
        var path;
        while (true) {
            if (FS.isRoot(node)) {
                var mount = node.mount.mountpoint;
                if (!path)
                    return mount;
                return mount[mount.length - 1] !== "/" ? mount + "/" + path : mount + path
            }
            path = path ? node.name + "/" + path : node.name;
            node = node.parent
        }
    },
    hashName: function (parentid, name) {
        var hash = 0;
        for (var i = 0; i < name.length; i++) {
            hash = (hash << 5) - hash + name.charCodeAt(i) | 0
        }
        return (parentid + hash >>> 0) % FS.nameTable.length
    },
    hashAddNode: function (node) {
        var hash = FS.hashName(node.parent.id, node.name);
        node.name_next = FS.nameTable[hash];
        FS.nameTable[hash] = node
    },
    hashRemoveNode: function (node) {
        var hash = FS.hashName(node.parent.id, node.name);
        if (FS.nameTable[hash] === node) {
            FS.nameTable[hash] = node.name_next
        } else {
            var current = FS.nameTable[hash];
            while (current) {
                if (current.name_next === node) {
                    current.name_next = node.name_next;
                    break
                }
                current = current.name_next
            }
        }
    },
    lookupNode: function (parent, name) {
        var errCode = FS.mayLookup(parent);
        if (errCode) {
            throw new FS.ErrnoError(errCode, parent)
        }
        var hash = FS.hashName(parent.id, name);
        for (var node = FS.nameTable[hash]; node; node = node.name_next) {
            var nodeName = node.name;
            if (node.parent.id === parent.id && nodeName === name) {
                return node
            }
        }
        return FS.lookup(parent, name)
    },
    createNode: function (parent, name, mode, rdev) {
        var node = new FS.FSNode(parent, name, mode, rdev);
        FS.hashAddNode(node);
        return node
    },
    destroyNode: function (node) {
        FS.hashRemoveNode(node)
    },
    isRoot: function (node) {
        return node === node.parent
    },
    isMountpoint: function (node) {
        return !!node.mounted
    },
    isFile: function (mode) {
        return (mode & 61440) === 32768
    },
    isDir: function (mode) {
        return (mode & 61440) === 16384
    },
    isLink: function (mode) {
        return (mode & 61440) === 40960
    },
    isChrdev: function (mode) {
        return (mode & 61440) === 8192
    },
    isBlkdev: function (mode) {
        return (mode & 61440) === 24576
    },
    isFIFO: function (mode) {
        return (mode & 61440) === 4096
    },
    isSocket: function (mode) {
        return (mode & 49152) === 49152
    },
    flagModes: {
        "r": 0,
        "rs": 1052672,
        "r+": 2,
        "w": 577,
        "wx": 705,
        "xw": 705,
        "w+": 578,
        "wx+": 706,
        "xw+": 706,
        "a": 1089,
        "ax": 1217,
        "xa": 1217,
        "a+": 1090,
        "ax+": 1218,
        "xa+": 1218
    },
    modeStringToFlags: function (str) {
        var flags = FS.flagModes[str];
        if (typeof flags === "undefined") {
            throw new Error("Unknown file open mode: " + str)
        }
        return flags
    },
    flagsToPermissionString: function (flag) {
        var perms = ["r", "w", "rw"][flag & 3];
        if (flag & 512) {
            perms += "w"
        }
        return perms
    },
    nodePermissions: function (node, perms) {
        if (FS.ignorePermissions) {
            return 0
        }
        if (perms.indexOf("r") !== -1 && !(node.mode & 292)) {
            return 2
        } else if (perms.indexOf("w") !== -1 && !(node.mode & 146)) {
            return 2
        } else if (perms.indexOf("x") !== -1 && !(node.mode & 73)) {
            return 2
        }
        return 0
    },
    mayLookup: function (dir) {
        var errCode = FS.nodePermissions(dir, "x");
        if (errCode)
            return errCode;
        if (!dir.node_ops.lookup)
            return 2;
        return 0
    },
    mayCreate: function (dir, name) {
        try {
            var node = FS.lookupNode(dir, name);
            return 20
        } catch (e) {}
        return FS.nodePermissions(dir, "wx")
    },
    mayDelete: function (dir, name, isdir) {
        var node;
        try {
            node = FS.lookupNode(dir, name)
        } catch (e) {
            return e.errno
        }
        var errCode = FS.nodePermissions(dir, "wx");
        if (errCode) {
            return errCode
        }
        if (isdir) {
            if (!FS.isDir(node.mode)) {
                return 54
            }
            if (FS.isRoot(node) || FS.getPath(node) === FS.cwd()) {
                return 10
            }
        } else {
            if (FS.isDir(node.mode)) {
                return 31
            }
        }
        return 0
    },
    mayOpen: function (node, flags) {
        if (!node) {
            return 44
        }
        if (FS.isLink(node.mode)) {
            return 32
        } else if (FS.isDir(node.mode)) {
            if (FS.flagsToPermissionString(flags) !== "r" || flags & 512) {
                return 31
            }
        }
        return FS.nodePermissions(node, FS.flagsToPermissionString(flags))
    },
    MAX_OPEN_FDS: 4096,
    nextfd: function (fd_start, fd_end) {
        fd_start = fd_start || 0;
        fd_end = fd_end || FS.MAX_OPEN_FDS;
        for (var fd = fd_start; fd <= fd_end; fd++) {
            if (!FS.streams[fd]) {
                return fd
            }
        }
        throw new FS.ErrnoError(33)
    },
    getStream: function (fd) {
        return FS.streams[fd]
    },
    createStream: function (stream, fd_start, fd_end) {
        if (!FS.FSStream) {
            FS.FSStream = function () {};
            FS.FSStream.prototype = {
                object: {
                    get: function () {
                        return this.node
                    },
                    set: function (val) {
                        this.node = val
                    }
                },
                isRead: {
                    get: function () {
                        return (this.flags & 2097155) !== 1
                    }
                },
                isWrite: {
                    get: function () {
                        return (this.flags & 2097155) !== 0
                    }
                },
                isAppend: {
                    get: function () {
                        return this.flags & 1024
                    }
                }
            }
        }
        var newStream = new FS.FSStream;
        for (var p in stream) {
            newStream[p] = stream[p]
        }
        stream = newStream;
        var fd = FS.nextfd(fd_start, fd_end);
        stream.fd = fd;
        FS.streams[fd] = stream;
        return stream
    },
    closeStream: function (fd) {
        FS.streams[fd] = null
    },
    chrdev_stream_ops: {
        open: function (stream) {
            var device = FS.getDevice(stream.node.rdev);
            stream.stream_ops = device.stream_ops;
            if (stream.stream_ops.open) {
                stream.stream_ops.open(stream)
            }
        },
        llseek: function () {
            throw new FS.ErrnoError(70)
        }
    },
    major: function (dev) {
        return dev >> 8
    },
    minor: function (dev) {
        return dev & 255
    },
    makedev: function (ma, mi) {
        return ma << 8 | mi
    },
    registerDevice: function (dev, ops) {
        FS.devices[dev] = {
            stream_ops: ops
        }
    },
    getDevice: function (dev) {
        return FS.devices[dev]
    },
    getMounts: function (mount) {
        var mounts = [];
        var check = [mount];
        while (check.length) {
            var m = check.pop();
            mounts.push(m);
            check.push.apply(check, m.mounts)
        }
        return mounts
    },
    syncfs: function (populate, callback) {
        if (typeof populate === "function") {
            callback = populate;
            populate = false
        }
        FS.syncFSRequests++;
        if (FS.syncFSRequests > 1) {
            err("warning: " + FS.syncFSRequests + " FS.syncfs operations in flight at once, probably just doing extra work")
        }
        var mounts = FS.getMounts(FS.root.mount);
        var completed = 0;
        function doCallback(errCode) {
            FS.syncFSRequests--;
            return callback(errCode)
        }
        function done(errCode) {
            if (errCode) {
                if (!done.errored) {
                    done.errored = true;
                    return doCallback(errCode)
                }
                return
            }
            if (++completed >= mounts.length) {
                doCallback(null)
            }
        }
        mounts.forEach(function (mount) {
            if (!mount.type.syncfs) {
                return done(null)
            }
            mount.type.syncfs(mount, populate, done)
        })
    },
    mount: function (type, opts, mountpoint) {
        var root = mountpoint === "/";
        var pseudo = !mountpoint;
        var node;
        if (root && FS.root) {
            throw new FS.ErrnoError(10)
        } else if (!root && !pseudo) {
            var lookup = FS.lookupPath(mountpoint, {
                    follow_mount: false
                });
            mountpoint = lookup.path;
            node = lookup.node;
            if (FS.isMountpoint(node)) {
                throw new FS.ErrnoError(10)
            }
            if (!FS.isDir(node.mode)) {
                throw new FS.ErrnoError(54)
            }
        }
        var mount = {
            type: type,
            opts: opts,
            mountpoint: mountpoint,
            mounts: []
        };
        var mountRoot = type.mount(mount);
        mountRoot.mount = mount;
        mount.root = mountRoot;
        if (root) {
            FS.root = mountRoot
        } else if (node) {
            node.mounted = mount;
            if (node.mount) {
                node.mount.mounts.push(mount)
            }
        }
        return mountRoot
    },
    unmount: function (mountpoint) {
        var lookup = FS.lookupPath(mountpoint, {
                follow_mount: false
            });
        if (!FS.isMountpoint(lookup.node)) {
            throw new FS.ErrnoError(28)
        }
        var node = lookup.node;
        var mount = node.mounted;
        var mounts = FS.getMounts(mount);
        Object.keys(FS.nameTable).forEach(function (hash) {
            var current = FS.nameTable[hash];
            while (current) {
                var next = current.name_next;
                if (mounts.indexOf(current.mount) !== -1) {
                    FS.destroyNode(current)
                }
                current = next
            }
        });
        node.mounted = null;
        var idx = node.mount.mounts.indexOf(mount);
        node.mount.mounts.splice(idx, 1)
    },
    lookup: function (parent, name) {
        return parent.node_ops.lookup(parent, name)
    },
    mknod: function (path, mode, dev) {
        var lookup = FS.lookupPath(path, {
                parent: true
            });
        var parent = lookup.node;
        var name = PATH.basename(path);
        if (!name || name === "." || name === "..") {
            throw new FS.ErrnoError(28)
        }
        var errCode = FS.mayCreate(parent, name);
        if (errCode) {
            throw new FS.ErrnoError(errCode)
        }
        if (!parent.node_ops.mknod) {
            throw new FS.ErrnoError(63)
        }
        return parent.node_ops.mknod(parent, name, mode, dev)
    },
    create: function (path, mode) {
        mode = mode !== undefined ? mode : 438;
        mode &= 4095;
        mode |= 32768;
        return FS.mknod(path, mode, 0)
    },
    mkdir: function (path, mode) {
        mode = mode !== undefined ? mode : 511;
        mode &= 511 | 512;
        mode |= 16384;
        return FS.mknod(path, mode, 0)
    },
    mkdirTree: function (path, mode) {
        var dirs = path.split("/");
        var d = "";
        for (var i = 0; i < dirs.length; ++i) {
            if (!dirs[i])
                continue;
            d += "/" + dirs[i];
            try {
                FS.mkdir(d, mode)
            } catch (e) {
                if (e.errno != 20)
                    throw e
            }
        }
    },
    mkdev: function (path, mode, dev) {
        if (typeof dev === "undefined") {
            dev = mode;
            mode = 438
        }
        mode |= 8192;
        return FS.mknod(path, mode, dev)
    },
    symlink: function (oldpath, newpath) {
        if (!PATH_FS.resolve(oldpath)) {
            throw new FS.ErrnoError(44)
        }
        var lookup = FS.lookupPath(newpath, {
                parent: true
            });
        var parent = lookup.node;
        if (!parent) {
            throw new FS.ErrnoError(44)
        }
        var newname = PATH.basename(newpath);
        var errCode = FS.mayCreate(parent, newname);
        if (errCode) {
            throw new FS.ErrnoError(errCode)
        }
        if (!parent.node_ops.symlink) {
            throw new FS.ErrnoError(63)
        }
        return parent.node_ops.symlink(parent, newname, oldpath)
    },
    rename: function (old_path, new_path) {
        var old_dirname = PATH.dirname(old_path);
        var new_dirname = PATH.dirname(new_path);
        var old_name = PATH.basename(old_path);
        var new_name = PATH.basename(new_path);
        var lookup,
        old_dir,
        new_dir;
        try {
            lookup = FS.lookupPath(old_path, {
                    parent: true
                });
            old_dir = lookup.node;
            lookup = FS.lookupPath(new_path, {
                    parent: true
                });
            new_dir = lookup.node
        } catch (e) {
            throw new FS.ErrnoError(10)
        }
        if (!old_dir || !new_dir)
            throw new FS.ErrnoError(44);
        if (old_dir.mount !== new_dir.mount) {
            throw new FS.ErrnoError(75)
        }
        var old_node = FS.lookupNode(old_dir, old_name);
        var relative = PATH_FS.relative(old_path, new_dirname);
        if (relative.charAt(0) !== ".") {
            throw new FS.ErrnoError(28)
        }
        relative = PATH_FS.relative(new_path, old_dirname);
        if (relative.charAt(0) !== ".") {
            throw new FS.ErrnoError(55)
        }
        var new_node;
        try {
            new_node = FS.lookupNode(new_dir, new_name)
        } catch (e) {}
        if (old_node === new_node) {
            return
        }
        var isdir = FS.isDir(old_node.mode);
        var errCode = FS.mayDelete(old_dir, old_name, isdir);
        if (errCode) {
            throw new FS.ErrnoError(errCode)
        }
        errCode = new_node ? FS.mayDelete(new_dir, new_name, isdir) : FS.mayCreate(new_dir, new_name);
        if (errCode) {
            throw new FS.ErrnoError(errCode)
        }
        if (!old_dir.node_ops.rename) {
            throw new FS.ErrnoError(63)
        }
        if (FS.isMountpoint(old_node) || new_node && FS.isMountpoint(new_node)) {
            throw new FS.ErrnoError(10)
        }
        if (new_dir !== old_dir) {
            errCode = FS.nodePermissions(old_dir, "w");
            if (errCode) {
                throw new FS.ErrnoError(errCode)
            }
        }
        try {
            if (FS.trackingDelegate["willMovePath"]) {
                FS.trackingDelegate["willMovePath"](old_path, new_path)
            }
        } catch (e) {
            err("FS.trackingDelegate['willMovePath']('" + old_path + "', '" + new_path + "') threw an exception: " + e.message)
        }
        FS.hashRemoveNode(old_node);
        try {
            old_dir.node_ops.rename(old_node, new_dir, new_name)
        } catch (e) {
            throw e
        }
        finally {
            FS.hashAddNode(old_node)
        }
        try {
            if (FS.trackingDelegate["onMovePath"])
                FS.trackingDelegate["onMovePath"](old_path, new_path)
        } catch (e) {
            err("FS.trackingDelegate['onMovePath']('" + old_path + "', '" + new_path + "') threw an exception: " + e.message)
        }
    },
    rmdir: function (path) {
        var lookup = FS.lookupPath(path, {
                parent: true
            });
        var parent = lookup.node;
        var name = PATH.basename(path);
        var node = FS.lookupNode(parent, name);
        var errCode = FS.mayDelete(parent, name, true);
        if (errCode) {
            throw new FS.ErrnoError(errCode)
        }
        if (!parent.node_ops.rmdir) {
            throw new FS.ErrnoError(63)
        }
        if (FS.isMountpoint(node)) {
            throw new FS.ErrnoError(10)
        }
        try {
            if (FS.trackingDelegate["willDeletePath"]) {
                FS.trackingDelegate["willDeletePath"](path)
            }
        } catch (e) {
            err("FS.trackingDelegate['willDeletePath']('" + path + "') threw an exception: " + e.message)
        }
        parent.node_ops.rmdir(parent, name);
        FS.destroyNode(node);
        try {
            if (FS.trackingDelegate["onDeletePath"])
                FS.trackingDelegate["onDeletePath"](path)
        } catch (e) {
            err("FS.trackingDelegate['onDeletePath']('" + path + "') threw an exception: " + e.message)
        }
    },
    readdir: function (path) {
        var lookup = FS.lookupPath(path, {
                follow: true
            });
        var node = lookup.node;
        if (!node.node_ops.readdir) {
            throw new FS.ErrnoError(54)
        }
        return node.node_ops.readdir(node)
    },
    unlink: function (path) {
        var lookup = FS.lookupPath(path, {
                parent: true
            });
        var parent = lookup.node;
        var name = PATH.basename(path);
        var node = FS.lookupNode(parent, name);
        var errCode = FS.mayDelete(parent, name, false);
        if (errCode) {
            throw new FS.ErrnoError(errCode)
        }
        if (!parent.node_ops.unlink) {
            throw new FS.ErrnoError(63)
        }
        if (FS.isMountpoint(node)) {
            throw new FS.ErrnoError(10)
        }
        try {
            if (FS.trackingDelegate["willDeletePath"]) {
                FS.trackingDelegate["willDeletePath"](path)
            }
        } catch (e) {
            err("FS.trackingDelegate['willDeletePath']('" + path + "') threw an exception: " + e.message)
        }
        parent.node_ops.unlink(parent, name);
        FS.destroyNode(node);
        try {
            if (FS.trackingDelegate["onDeletePath"])
                FS.trackingDelegate["onDeletePath"](path)
        } catch (e) {
            err("FS.trackingDelegate['onDeletePath']('" + path + "') threw an exception: " + e.message)
        }
    },
    readlink: function (path) {
        var lookup = FS.lookupPath(path);
        var link = lookup.node;
        if (!link) {
            throw new FS.ErrnoError(44)
        }
        if (!link.node_ops.readlink) {
            throw new FS.ErrnoError(28)
        }
        return PATH_FS.resolve(FS.getPath(link.parent), link.node_ops.readlink(link))
    },
    stat: function (path, dontFollow) {
        var lookup = FS.lookupPath(path, {
                follow: !dontFollow
            });
        var node = lookup.node;
        if (!node) {
            throw new FS.ErrnoError(44)
        }
        if (!node.node_ops.getattr) {
            throw new FS.ErrnoError(63)
        }
        return node.node_ops.getattr(node)
    },
    lstat: function (path) {
        return FS.stat(path, true)
    },
    chmod: function (path, mode, dontFollow) {
        var node;
        if (typeof path === "string") {
            var lookup = FS.lookupPath(path, {
                    follow: !dontFollow
                });
            node = lookup.node
        } else {
            node = path
        }
        if (!node.node_ops.setattr) {
            throw new FS.ErrnoError(63)
        }
        node.node_ops.setattr(node, {
            mode: mode & 4095 | node.mode & ~4095,
            timestamp: Date.now()
        })
    },
    lchmod: function (path, mode) {
        FS.chmod(path, mode, true)
    },
    fchmod: function (fd, mode) {
        var stream = FS.getStream(fd);
        if (!stream) {
            throw new FS.ErrnoError(8)
        }
        FS.chmod(stream.node, mode)
    },
    chown: function (path, uid, gid, dontFollow) {
        var node;
        if (typeof path === "string") {
            var lookup = FS.lookupPath(path, {
                    follow: !dontFollow
                });
            node = lookup.node
        } else {
            node = path
        }
        if (!node.node_ops.setattr) {
            throw new FS.ErrnoError(63)
        }
        node.node_ops.setattr(node, {
            timestamp: Date.now()
        })
    },
    lchown: function (path, uid, gid) {
        FS.chown(path, uid, gid, true)
    },
    fchown: function (fd, uid, gid) {
        var stream = FS.getStream(fd);
        if (!stream) {
            throw new FS.ErrnoError(8)
        }
        FS.chown(stream.node, uid, gid)
    },
    truncate: function (path, len) {
        if (len < 0) {
            throw new FS.ErrnoError(28)
        }
        var node;
        if (typeof path === "string") {
            var lookup = FS.lookupPath(path, {
                    follow: true
                });
            node = lookup.node
        } else {
            node = path
        }
        if (!node.node_ops.setattr) {
            throw new FS.ErrnoError(63)
        }
        if (FS.isDir(node.mode)) {
            throw new FS.ErrnoError(31)
        }
        if (!FS.isFile(node.mode)) {
            throw new FS.ErrnoError(28)
        }
        var errCode = FS.nodePermissions(node, "w");
        if (errCode) {
            throw new FS.ErrnoError(errCode)
        }
        node.node_ops.setattr(node, {
            size: len,
            timestamp: Date.now()
        })
    },
    ftruncate: function (fd, len) {
        var stream = FS.getStream(fd);
        if (!stream) {
            throw new FS.ErrnoError(8)
        }
        if ((stream.flags & 2097155) === 0) {
            throw new FS.ErrnoError(28)
        }
        FS.truncate(stream.node, len)
    },
    utime: function (path, atime, mtime) {
        var lookup = FS.lookupPath(path, {
                follow: true
            });
        var node = lookup.node;
        node.node_ops.setattr(node, {
            timestamp: Math.max(atime, mtime)
        })
    },
    open: function (path, flags, mode, fd_start, fd_end) {
        if (path === "") {
            throw new FS.ErrnoError(44)
        }
        flags = typeof flags === "string" ? FS.modeStringToFlags(flags) : flags;
        mode = typeof mode === "undefined" ? 438 : mode;
        if (flags & 64) {
            mode = mode & 4095 | 32768
        } else {
            mode = 0
        }
        var node;
        if (typeof path === "object") {
            node = path
        } else {
            path = PATH.normalize(path);
            try {
                var lookup = FS.lookupPath(path, {
                        follow: !(flags & 131072)
                    });
                node = lookup.node
            } catch (e) {}
        }
        var created = false;
        if (flags & 64) {
            if (node) {
                if (flags & 128) {
                    throw new FS.ErrnoError(20)
                }
            } else {
                node = FS.mknod(path, mode, 0);
                created = true
            }
        }
        if (!node) {
            throw new FS.ErrnoError(44)
        }
        if (FS.isChrdev(node.mode)) {
            flags &= ~512
        }
        if (flags & 65536 && !FS.isDir(node.mode)) {
            throw new FS.ErrnoError(54)
        }
        if (!created) {
            var errCode = FS.mayOpen(node, flags);
            if (errCode) {
                throw new FS.ErrnoError(errCode)
            }
        }
        if (flags & 512) {
            FS.truncate(node, 0)
        }
        flags &= ~(128 | 512 | 131072);
        var stream = FS.createStream({
                node: node,
                path: FS.getPath(node),
                flags: flags,
                seekable: true,
                position: 0,
                stream_ops: node.stream_ops,
                ungotten: [],
                error: false
            }, fd_start, fd_end);
        if (stream.stream_ops.open) {
            stream.stream_ops.open(stream)
        }
        if (Module["logReadFiles"] && !(flags & 1)) {
            if (!FS.readFiles)
                FS.readFiles = {};
            if (!(path in FS.readFiles)) {
                FS.readFiles[path] = 1;
                err("FS.trackingDelegate error on read file: " + path)
            }
        }
        try {
            if (FS.trackingDelegate["onOpenFile"]) {
                var trackingFlags = 0;
                if ((flags & 2097155) !== 1) {
                    trackingFlags |= FS.tracking.openFlags.READ
                }
                if ((flags & 2097155) !== 0) {
                    trackingFlags |= FS.tracking.openFlags.WRITE
                }
                FS.trackingDelegate["onOpenFile"](path, trackingFlags)
            }
        } catch (e) {
            err("FS.trackingDelegate['onOpenFile']('" + path + "', flags) threw an exception: " + e.message)
        }
        return stream
    },
    close: function (stream) {
        if (FS.isClosed(stream)) {
            throw new FS.ErrnoError(8)
        }
        if (stream.getdents)
            stream.getdents = null;
        try {
            if (stream.stream_ops.close) {
                stream.stream_ops.close(stream)
            }
        } catch (e) {
            throw e
        }
        finally {
            FS.closeStream(stream.fd)
        }
        stream.fd = null
    },
    isClosed: function (stream) {
        return stream.fd === null
    },
    llseek: function (stream, offset, whence) {
        if (FS.isClosed(stream)) {
            throw new FS.ErrnoError(8)
        }
        if (!stream.seekable || !stream.stream_ops.llseek) {
            throw new FS.ErrnoError(70)
        }
        if (whence != 0 && whence != 1 && whence != 2) {
            throw new FS.ErrnoError(28)
        }
        stream.position = stream.stream_ops.llseek(stream, offset, whence);
        stream.ungotten = [];
        return stream.position
    },
    read: function (stream, buffer, offset, length, position) {
        if (length < 0 || position < 0) {
            throw new FS.ErrnoError(28)
        }
        if (FS.isClosed(stream)) {
            throw new FS.ErrnoError(8)
        }
        if ((stream.flags & 2097155) === 1) {
            throw new FS.ErrnoError(8)
        }
        if (FS.isDir(stream.node.mode)) {
            throw new FS.ErrnoError(31)
        }
        if (!stream.stream_ops.read) {
            throw new FS.ErrnoError(28)
        }
        var seeking = typeof position !== "undefined";
        if (!seeking) {
            position = stream.position
        } else if (!stream.seekable) {
            throw new FS.ErrnoError(70)
        }
        var bytesRead = stream.stream_ops.read(stream, buffer, offset, length, position);
        if (!seeking)
            stream.position += bytesRead;
        return bytesRead
    },
    write: function (stream, buffer, offset, length, position, canOwn) {
        if (length < 0 || position < 0) {
            throw new FS.ErrnoError(28)
        }
        if (FS.isClosed(stream)) {
            throw new FS.ErrnoError(8)
        }
        if ((stream.flags & 2097155) === 0) {
            throw new FS.ErrnoError(8)
        }
        if (FS.isDir(stream.node.mode)) {
            throw new FS.ErrnoError(31)
        }
        if (!stream.stream_ops.write) {
            throw new FS.ErrnoError(28)
        }
        if (stream.seekable && stream.flags & 1024) {
            FS.llseek(stream, 0, 2)
        }
        var seeking = typeof position !== "undefined";
        if (!seeking) {
            position = stream.position
        } else if (!stream.seekable) {
            throw new FS.ErrnoError(70)
        }
        var bytesWritten = stream.stream_ops.write(stream, buffer, offset, length, position, canOwn);
        if (!seeking)
            stream.position += bytesWritten;
        try {
            if (stream.path && FS.trackingDelegate["onWriteToFile"])
                FS.trackingDelegate["onWriteToFile"](stream.path)
        } catch (e) {
            err("FS.trackingDelegate['onWriteToFile']('" + stream.path + "') threw an exception: " + e.message)
        }
        return bytesWritten
    },
    allocate: function (stream, offset, length) {
        if (FS.isClosed(stream)) {
            throw new FS.ErrnoError(8)
        }
        if (offset < 0 || length <= 0) {
            throw new FS.ErrnoError(28)
        }
        if ((stream.flags & 2097155) === 0) {
            throw new FS.ErrnoError(8)
        }
        if (!FS.isFile(stream.node.mode) && !FS.isDir(stream.node.mode)) {
            throw new FS.ErrnoError(43)
        }
        if (!stream.stream_ops.allocate) {
            throw new FS.ErrnoError(138)
        }
        stream.stream_ops.allocate(stream, offset, length)
    },
    mmap: function (stream, buffer, offset, length, position, prot, flags) {
        if ((prot & 2) !== 0 && (flags & 2) === 0 && (stream.flags & 2097155) !== 2) {
            throw new FS.ErrnoError(2)
        }
        if ((stream.flags & 2097155) === 1) {
            throw new FS.ErrnoError(2)
        }
        if (!stream.stream_ops.mmap) {
            throw new FS.ErrnoError(43)
        }
        return stream.stream_ops.mmap(stream, buffer, offset, length, position, prot, flags)
    },
    msync: function (stream, buffer, offset, length, mmapFlags) {
        if (!stream || !stream.stream_ops.msync) {
            return 0
        }
        return stream.stream_ops.msync(stream, buffer, offset, length, mmapFlags)
    },
    munmap: function (stream) {
        return 0
    },
    ioctl: function (stream, cmd, arg) {
        if (!stream.stream_ops.ioctl) {
            throw new FS.ErrnoError(59)
        }
        return stream.stream_ops.ioctl(stream, cmd, arg)
    },
    readFile: function (path, opts) {
        opts = opts || {};
        opts.flags = opts.flags || "r";
        opts.encoding = opts.encoding || "binary";
        if (opts.encoding !== "utf8" && opts.encoding !== "binary") {
            throw new Error('Invalid encoding type "' + opts.encoding + '"')
        }
        var ret;
        var stream = FS.open(path, opts.flags);
        var stat = FS.stat(path);
        var length = stat.size;
        var buf = new Uint8Array(length);
        FS.read(stream, buf, 0, length, 0);
        if (opts.encoding === "utf8") {
            ret = UTF8ArrayToString(buf, 0)
        } else if (opts.encoding === "binary") {
            ret = buf
        }
        FS.close(stream);
        return ret
    },
    writeFile: function (path, data, opts) {
        opts = opts || {};
        opts.flags = opts.flags || "w";
        var stream = FS.open(path, opts.flags, opts.mode);
        if (typeof data === "string") {
            var buf = new Uint8Array(lengthBytesUTF8(data) + 1);
            var actualNumBytes = stringToUTF8Array(data, buf, 0, buf.length);
            FS.write(stream, buf, 0, actualNumBytes, undefined, opts.canOwn)
        } else if (ArrayBuffer.isView(data)) {
            FS.write(stream, data, 0, data.byteLength, undefined, opts.canOwn)
        } else {
            throw new Error("Unsupported data type")
        }
        FS.close(stream)
    },
    cwd: function () {
        return FS.currentPath
    },
    chdir: function (path) {
        var lookup = FS.lookupPath(path, {
                follow: true
            });
        if (lookup.node === null) {
            throw new FS.ErrnoError(44)
        }
        if (!FS.isDir(lookup.node.mode)) {
            throw new FS.ErrnoError(54)
        }
        var errCode = FS.nodePermissions(lookup.node, "x");
        if (errCode) {
            throw new FS.ErrnoError(errCode)
        }
        FS.currentPath = lookup.path
    },
    createDefaultDirectories: function () {
        FS.mkdir("/tmp");
        FS.mkdir("/home");
        FS.mkdir("/home/web_user")
    },
    createDefaultDevices: function () {
        FS.mkdir("/dev");
        FS.registerDevice(FS.makedev(1, 3), {
            read: function () {
                return 0
            },
            write: function (stream, buffer, offset, length, pos) {
                return length
            }
        });
        FS.mkdev("/dev/null", FS.makedev(1, 3));
        TTY.register(FS.makedev(5, 0), TTY.default_tty_ops);
        TTY.register(FS.makedev(6, 0), TTY.default_tty1_ops);
        FS.mkdev("/dev/tty", FS.makedev(5, 0));
        FS.mkdev("/dev/tty1", FS.makedev(6, 0));
        var random_device;
        if (typeof crypto === "object" && typeof crypto["getRandomValues"] === "function") {
            var randomBuffer = new Uint8Array(1);
            random_device = function () {
                crypto.getRandomValues(randomBuffer);
                return randomBuffer[0]
            }
        } else if (ENVIRONMENT_IS_NODE) {
            try {
                var crypto_module = require("crypto");
                random_device = function () {
                    return crypto_module["randomBytes"](1)[0]
                }
            } catch (e) {}
        } else {}
        if (!random_device) {
            random_device = function () {
                abort("random_device")
            }
        }
        FS.createDevice("/dev", "random", random_device);
        FS.createDevice("/dev", "urandom", random_device);
        FS.mkdir("/dev/shm");
        FS.mkdir("/dev/shm/tmp")
    },
    createSpecialDirectories: function () {
        FS.mkdir("/proc");
        FS.mkdir("/proc/self");
        FS.mkdir("/proc/self/fd");
        FS.mount({
            mount: function () {
                var node = FS.createNode("/proc/self", "fd", 16384 | 511, 73);
                node.node_ops = {
                    lookup: function (parent, name) {
                        var fd = +name;
                        var stream = FS.getStream(fd);
                        if (!stream)
                            throw new FS.ErrnoError(8);
                        var ret = {
                            parent: null,
                            mount: {
                                mountpoint: "fake"
                            },
                            node_ops: {
                                readlink: function () {
                                    return stream.path
                                }
                            }
                        };
                        ret.parent = ret;
                        return ret
                    }
                };
                return node
            }
        }, {}, "/proc/self/fd")
    },
    createStandardStreams: function () {
        if (Module["stdin"]) {
            FS.createDevice("/dev", "stdin", Module["stdin"])
        } else {
            FS.symlink("/dev/tty", "/dev/stdin")
        }
        if (Module["stdout"]) {
            FS.createDevice("/dev", "stdout", null, Module["stdout"])
        } else {
            FS.symlink("/dev/tty", "/dev/stdout")
        }
        if (Module["stderr"]) {
            FS.createDevice("/dev", "stderr", null, Module["stderr"])
        } else {
            FS.symlink("/dev/tty1", "/dev/stderr")
        }
        var stdin = FS.open("/dev/stdin", "r");
        var stdout = FS.open("/dev/stdout", "w");
        var stderr = FS.open("/dev/stderr", "w")
    },
    ensureErrnoError: function () {
        if (FS.ErrnoError)
            return;
        FS.ErrnoError = function ErrnoError(errno, node) {
            this.node = node;
            this.setErrno = function (errno) {
                this.errno = errno
            };
            this.setErrno(errno);
            this.message = "FS error"
        };
        FS.ErrnoError.prototype = new Error;
        FS.ErrnoError.prototype.constructor = FS.ErrnoError;
        [44].forEach(function (code) {
            FS.genericErrors[code] = new FS.ErrnoError(code);
            FS.genericErrors[code].stack = "<generic error, no stack>"
        })
    },
    staticInit: function () {
        FS.ensureErrnoError();
        FS.nameTable = new Array(4096);
        FS.mount(MEMFS, {}, "/");
        //FS.createDefaultDirectories();
        FS.createDefaultDevices();
        //FS.createSpecialDirectories();
        FS.filesystems = {
            "MEMFS": MEMFS
        }
    },
    init: function (input, output, error) {
        FS.init.initialized = true;
        FS.ensureErrnoError();
        Module["stdin"] = input || Module["stdin"];
        Module["stdout"] = output || Module["stdout"];
        Module["stderr"] = error || Module["stderr"];
        FS.createStandardStreams()
    },
    quit: function () {
        FS.init.initialized = false;
        var fflush = Module["_fflush"];
        if (fflush)
            fflush(0);
        for (var i = 0; i < FS.streams.length; i++) {
            var stream = FS.streams[i];
            if (!stream) {
                continue
            }
            FS.close(stream)
        }
    },
    getMode: function (canRead, canWrite) {
        var mode = 0;
        if (canRead)
            mode |= 292 | 73;
        if (canWrite)
            mode |= 146;
        return mode
    },
    joinPath: function (parts, forceRelative) {
        var path = PATH.join.apply(null, parts);
        if (forceRelative && path[0] == "/")
            path = path.substr(1);
        return path
    },
    absolutePath: function (relative, base) {
        return PATH_FS.resolve(base, relative)
    },
    standardizePath: function (path) {
        return PATH.normalize(path)
    },
    findObject: function (path, dontResolveLastLink) {
        var ret = FS.analyzePath(path, dontResolveLastLink);
        if (ret.exists) {
            return ret.object
        } else {
            setErrNo(ret.error);
            return null
        }
    },
    analyzePath: function (path, dontResolveLastLink) {
        try {
            var lookup = FS.lookupPath(path, {
                    follow: !dontResolveLastLink
                });
            path = lookup.path
        } catch (e) {}
        var ret = {
            isRoot: false,
            exists: false,
            error: 0,
            name: null,
            path: null,
            object: null,
            parentExists: false,
            parentPath: null,
            parentObject: null
        };
        try {
            var lookup = FS.lookupPath(path, {
                    parent: true
                });
            ret.parentExists = true;
            ret.parentPath = lookup.path;
            ret.parentObject = lookup.node;
            ret.name = PATH.basename(path);
            lookup = FS.lookupPath(path, {
                    follow: !dontResolveLastLink
                });
            ret.exists = true;
            ret.path = lookup.path;
            ret.object = lookup.node;
            ret.name = lookup.node.name;
            ret.isRoot = lookup.path === "/"
        } catch (e) {
            ret.error = e.errno
        }
        return ret
    },
    createFolder: function (parent, name, canRead, canWrite) {
        var path = PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name);
        var mode = FS.getMode(canRead, canWrite);
        return FS.mkdir(path, mode)
    },
    createPath: function (parent, path, canRead, canWrite) {
        parent = typeof parent === "string" ? parent : FS.getPath(parent);
        var parts = path.split("/").reverse();
        while (parts.length) {
            var part = parts.pop();
            if (!part)
                continue;
            var current = PATH.join2(parent, part);
            try {
                FS.mkdir(current)
            } catch (e) {}
            parent = current
        }
        return current
    },
    createFile: function (parent, name, properties, canRead, canWrite) {
        var path = PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name);
        var mode = FS.getMode(canRead, canWrite);
        return FS.create(path, mode)
    },
    createDataFile: function (parent, name, data, canRead, canWrite, canOwn) {
        var path = name ? PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name) : parent;
        var mode = FS.getMode(canRead, canWrite);
        var node = FS.create(path, mode);
        if (data) {
            if (typeof data === "string") {
                var arr = new Array(data.length);
                for (var i = 0, len = data.length; i < len; ++i)
                    arr[i] = data.charCodeAt(i);
                data = arr
            }
            FS.chmod(node, mode | 146);
            var stream = FS.open(node, "w");
            FS.write(stream, data, 0, data.length, 0, canOwn);
            FS.close(stream);
            FS.chmod(node, mode)
        }
        return node
    },
    createDevice: function (parent, name, input, output) {
        var path = PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name);
        var mode = FS.getMode(!!input, !!output);
        if (!FS.createDevice.major)
            FS.createDevice.major = 64;
        var dev = FS.makedev(FS.createDevice.major++, 0);
        FS.registerDevice(dev, {
            open: function (stream) {
                stream.seekable = false
            },
            close: function (stream) {
                if (output && output.buffer && output.buffer.length) {
                    output(10)
                }
            },
            read: function (stream, buffer, offset, length, pos) {
                var bytesRead = 0;
                for (var i = 0; i < length; i++) {
                    var result;
                    try {
                        result = input()
                    } catch (e) {
                        throw new FS.ErrnoError(29)
                    }
                    if (result === undefined && bytesRead === 0) {
                        throw new FS.ErrnoError(6)
                    }
                    if (result === null || result === undefined)
                        break;
                    bytesRead++;
                    buffer[offset + i] = result
                }
                if (bytesRead) {
                    stream.node.timestamp = Date.now()
                }
                return bytesRead
            },
            write: function (stream, buffer, offset, length, pos) {
                for (var i = 0; i < length; i++) {
                    try {
                        output(buffer[offset + i])
                    } catch (e) {
                        throw new FS.ErrnoError(29)
                    }
                }
                if (length) {
                    stream.node.timestamp = Date.now()
                }
                return i
            }
        });
        return FS.mkdev(path, mode, dev)
    },
    createLink: function (parent, name, target, canRead, canWrite) {
        var path = PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name);
        return FS.symlink(target, path)
    },
    forceLoadFile: function (obj) {
        if (obj.isDevice || obj.isFolder || obj.link || obj.contents)
            return true;
        var success = true;
        if (typeof XMLHttpRequest !== "undefined") {
            throw new Error("Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread.")
        } else if (read_) {
            try {
                obj.contents = intArrayFromString(read_(obj.url), true);
                obj.usedBytes = obj.contents.length
            } catch (e) {
                success = false
            }
        } else {
            throw new Error("Cannot load without read() or XMLHttpRequest.")
        }
        if (!success)
            setErrNo(29);
        return success
    },
    createLazyFile: function (parent, name, url, canRead, canWrite) {
        function LazyUint8Array() {
            this.lengthKnown = false;
            this.chunks = []
        }
        LazyUint8Array.prototype.get = function LazyUint8Array_get(idx) {
            if (idx > this.length - 1 || idx < 0) {
                return undefined
            }
            var chunkOffset = idx % this.chunkSize;
            var chunkNum = idx / this.chunkSize | 0;
            return this.getter(chunkNum)[chunkOffset]
        };
        LazyUint8Array.prototype.setDataGetter = function LazyUint8Array_setDataGetter(getter) {
            this.getter = getter
        };
        LazyUint8Array.prototype.cacheLength = function LazyUint8Array_cacheLength() {
            var xhr = new XMLHttpRequest;
            xhr.open("HEAD", url, false);
            xhr.send(null);
            if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304))
                throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
            var datalength = Number(xhr.getResponseHeader("Content-length"));
            var header;
            var hasByteServing = (header = xhr.getResponseHeader("Accept-Ranges")) && header === "bytes";
            var usesGzip = (header = xhr.getResponseHeader("Content-Encoding")) && header === "gzip";
            var chunkSize = 1024 * 1024;
            if (!hasByteServing)
                chunkSize = datalength;
            var doXHR = function (from, to) {
                if (from > to)
                    throw new Error("invalid range (" + from + ", " + to + ") or no bytes requested!");
                if (to > datalength - 1)
                    throw new Error("only " + datalength + " bytes available! programmer error!");
                var xhr = new XMLHttpRequest;
                xhr.open("GET", url, false);
                if (datalength !== chunkSize)
                    xhr.setRequestHeader("Range", "bytes=" + from + "-" + to);
                if (typeof Uint8Array != "undefined")
                    xhr.responseType = "arraybuffer";
                if (xhr.overrideMimeType) {
                    xhr.overrideMimeType("text/plain; charset=x-user-defined")
                }
                xhr.send(null);
                if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304))
                    throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
                if (xhr.response !== undefined) {
                    return new Uint8Array(xhr.response || [])
                } else {
                    return intArrayFromString(xhr.responseText || "", true)
                }
            };
            var lazyArray = this;
            lazyArray.setDataGetter(function (chunkNum) {
                var start = chunkNum * chunkSize;
                var end = (chunkNum + 1) * chunkSize - 1;
                end = Math.min(end, datalength - 1);
                if (typeof lazyArray.chunks[chunkNum] === "undefined") {
                    lazyArray.chunks[chunkNum] = doXHR(start, end)
                }
                if (typeof lazyArray.chunks[chunkNum] === "undefined")
                    throw new Error("doXHR failed!");
                return lazyArray.chunks[chunkNum]
            });
            if (usesGzip || !datalength) {
                chunkSize = datalength = 1;
                datalength = this.getter(0).length;
                chunkSize = datalength;
                out("LazyFiles on gzip forces download of the whole file when length is accessed")
            }
            this._length = datalength;
            this._chunkSize = chunkSize;
            this.lengthKnown = true
        };
        if (typeof XMLHttpRequest !== "undefined") {
            if (!ENVIRONMENT_IS_WORKER)
                throw "Cannot do synchronous binary XHRs outside webworkers in modern browsers. Use --embed-file or --preload-file in emcc";
            var lazyArray = new LazyUint8Array;
            Object.defineProperties(lazyArray, {
                length: {
                    get: function () {
                        if (!this.lengthKnown) {
                            this.cacheLength()
                        }
                        return this._length
                    }
                },
                chunkSize: {
                    get: function () {
                        if (!this.lengthKnown) {
                            this.cacheLength()
                        }
                        return this._chunkSize
                    }
                }
            });
            var properties = {
                isDevice: false,
                contents: lazyArray
            }
        } else {
            var properties = {
                isDevice: false,
                url: url
            }
        }
        var node = FS.createFile(parent, name, properties, canRead, canWrite);
        if (properties.contents) {
            node.contents = properties.contents
        } else if (properties.url) {
            node.contents = null;
            node.url = properties.url
        }
        Object.defineProperties(node, {
            usedBytes: {
                get: function () {
                    return this.contents.length
                }
            }
        });
        var stream_ops = {};
        var keys = Object.keys(node.stream_ops);
        keys.forEach(function (key) {
            var fn = node.stream_ops[key];
            stream_ops[key] = function forceLoadLazyFile() {
                if (!FS.forceLoadFile(node)) {
                    throw new FS.ErrnoError(29)
                }
                return fn.apply(null, arguments)
            }
        });
        stream_ops.read = function stream_ops_read(stream, buffer, offset, length, position) {
            if (!FS.forceLoadFile(node)) {
                throw new FS.ErrnoError(29)
            }
            var contents = stream.node.contents;
            if (position >= contents.length)
                return 0;
            var size = Math.min(contents.length - position, length);
            if (contents.slice) {
                for (var i = 0; i < size; i++) {
                    buffer[offset + i] = contents[position + i]
                }
            } else {
                for (var i = 0; i < size; i++) {
                    buffer[offset + i] = contents.get(position + i)
                }
            }
            return size
        };
        node.stream_ops = stream_ops;
        return node
    },
    createPreloadedFile: function (parent, name, url, canRead, canWrite, onload, onerror, dontCreateFile, canOwn, preFinish) {
        Browser.init();
        var fullname = name ? PATH_FS.resolve(PATH.join2(parent, name)) : parent;
        var dep = getUniqueRunDependency("cp " + fullname);
        function processData(byteArray) {
            function finish(byteArray) {
                if (preFinish)
                    preFinish();
                if (!dontCreateFile) {
                    FS.createDataFile(parent, name, byteArray, canRead, canWrite, canOwn)
                }
                if (onload)
                    onload();
                removeRunDependency(dep)
            }
            var handled = false;
            Module["preloadPlugins"].forEach(function (plugin) {
                if (handled)
                    return;
                if (plugin["canHandle"](fullname)) {
                    plugin["handle"](byteArray, fullname, finish, function () {
                        if (onerror)
                            onerror();
                        removeRunDependency(dep)
                    });
                    handled = true
                }
            });
            if (!handled)
                finish(byteArray)
        }
        addRunDependency(dep);
        if (typeof url == "string") {
            Browser.asyncLoad(url, function (byteArray) {
                processData(byteArray)
            }, onerror)
        } else {
            processData(url)
        }
    },
    indexedDB: function () {
        return window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB
    },
    DB_NAME: function () {
        return "EM_FS_" + window.location.pathname
    },
    DB_VERSION: 20,
    DB_STORE_NAME: "FILE_DATA",
    saveFilesToDB: function (paths, onload, onerror) {
        onload = onload || function () {};
        onerror = onerror || function () {};
        var indexedDB = FS.indexedDB();
        try {
            var openRequest = indexedDB.open(FS.DB_NAME(), FS.DB_VERSION)
        } catch (e) {
            return onerror(e)
        }
        openRequest.onupgradeneeded = function openRequest_onupgradeneeded() {
            out("creating db");
            var db = openRequest.result;
            db.createObjectStore(FS.DB_STORE_NAME)
        };
        openRequest.onsuccess = function openRequest_onsuccess() {
            var db = openRequest.result;
            var transaction = db.transaction([FS.DB_STORE_NAME], "readwrite");
            var files = transaction.objectStore(FS.DB_STORE_NAME);
            var ok = 0,
            fail = 0,
            total = paths.length;
            function finish() {
                if (fail == 0)
                    onload();
                else
                    onerror()
            }
            paths.forEach(function (path) {
                var putRequest = files.put(FS.analyzePath(path).object.contents, path);
                putRequest.onsuccess = function putRequest_onsuccess() {
                    ok++;
                    if (ok + fail == total)
                        finish()
                };
                putRequest.onerror = function putRequest_onerror() {
                    fail++;
                    if (ok + fail == total)
                        finish()
                }
            });
            transaction.onerror = onerror
        };
        openRequest.onerror = onerror
    },
    loadFilesFromDB: function (paths, onload, onerror) {
        onload = onload || function () {};
        onerror = onerror || function () {};
        var indexedDB = FS.indexedDB();
        try {
            var openRequest = indexedDB.open(FS.DB_NAME(), FS.DB_VERSION)
        } catch (e) {
            return onerror(e)
        }
        openRequest.onupgradeneeded = onerror;
        openRequest.onsuccess = function openRequest_onsuccess() {
            var db = openRequest.result;
            try {
                var transaction = db.transaction([FS.DB_STORE_NAME], "readonly")
            } catch (e) {
                onerror(e);
                return
            }
            var files = transaction.objectStore(FS.DB_STORE_NAME);
            var ok = 0,
            fail = 0,
            total = paths.length;
            function finish() {
                if (fail == 0)
                    onload();
                else
                    onerror()
            }
            paths.forEach(function (path) {
                var getRequest = files.get(path);
                getRequest.onsuccess = function getRequest_onsuccess() {
                    if (FS.analyzePath(path).exists) {
                        FS.unlink(path)
                    }
                    FS.createDataFile(PATH.dirname(path), PATH.basename(path), getRequest.result, true, true, true);
                    ok++;
                    if (ok + fail == total)
                        finish()
                };
                getRequest.onerror = function getRequest_onerror() {
                    fail++;
                    if (ok + fail == total)
                        finish()
                }
            });
            transaction.onerror = onerror
        };
        openRequest.onerror = onerror
    }
};
var FSNode = function (parent, name, mode, rdev) {
    if (!parent) {
        parent = this
    }
    this.parent = parent;
    this.mount = parent.mount;
    this.mounted = null;
    this.id = FS.nextInode++;
    this.name = name;
    this.mode = mode;
    this.node_ops = {};
    this.stream_ops = {};
    this.rdev = rdev
};
var readMode = 292 | 73;
var writeMode = 146;
Object.defineProperties(FSNode.prototype, {
    read: {
        get: function () {
            return (this.mode & readMode) === readMode
        },
        set: function (val) {
            val ? this.mode |= readMode : this.mode &= ~readMode
        }
    },
    write: {
        get: function () {
            return (this.mode & writeMode) === writeMode
        },
        set: function (val) {
            val ? this.mode |= writeMode : this.mode &= ~writeMode
        }
    },
    isFolder: {
        get: function () {
            return FS.isDir(this.mode)
        }
    },
    isDevice: {
        get: function () {
            return FS.isChrdev(this.mode)
        }
    }
});
FS.FSNode = FSNode;
FS.staticInit();
Module["FS_createFolder"] = FS.createFolder;
Module["FS_createPath"] = FS.createPath;
Module["FS_createDataFile"] = FS.createDataFile;
Module["FS_createPreloadedFile"] = FS.createPreloadedFile;
Module["FS_createLazyFile"] = FS.createLazyFile;
Module["FS_createLink"] = FS.createLink;
Module["FS_createDevice"] = FS.createDevice;
Module["FS_unlink"] = FS.unlink;
var SYSCALLS = {
    mappings: {},
    DEFAULT_POLLMASK: 5,
    umask: 511,
    calculateAt: function (dirfd, path) {
        if (path[0] !== "/") {
            var dir;
            if (dirfd === -100) {
                dir = FS.cwd()
            } else {
                var dirstream = FS.getStream(dirfd);
                if (!dirstream)
                    throw new FS.ErrnoError(8);
                dir = dirstream.path
            }
            path = PATH.join2(dir, path)
        }
        return path
    },
    doStat: function (func, path, buf) {
        try {
            var stat = func(path)
        } catch (e) {
            if (e && e.node && PATH.normalize(path) !== PATH.normalize(FS.getPath(e.node))) {
                return -54
            }
            throw e
        }
        HEAP32[buf >> 2] = stat.dev;
        HEAP32[buf + 4 >> 2] = 0;
        HEAP32[buf + 8 >> 2] = stat.ino;
        HEAP32[buf + 12 >> 2] = stat.mode;
        HEAP32[buf + 16 >> 2] = stat.nlink;
        HEAP32[buf + 20 >> 2] = stat.uid;
        HEAP32[buf + 24 >> 2] = stat.gid;
        HEAP32[buf + 28 >> 2] = stat.rdev;
        HEAP32[buf + 32 >> 2] = 0;
        tempI64 = [stat.size >>> 0, (tempDouble = stat.size, +Math_abs(tempDouble) >= 1 ? tempDouble > 0 ? (Math_min(+Math_floor(tempDouble / 4294967296), 4294967295) | 0) >>> 0 : ~~+Math_ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0)],
            HEAP32[buf + 40 >> 2] = tempI64[0],
            HEAP32[buf + 44 >> 2] = tempI64[1];
        HEAP32[buf + 48 >> 2] = 4096;
        HEAP32[buf + 52 >> 2] = stat.blocks;
        HEAP32[buf + 56 >> 2] = stat.atime.getTime() / 1e3 | 0;
        HEAP32[buf + 60 >> 2] = 0;
        HEAP32[buf + 64 >> 2] = stat.mtime.getTime() / 1e3 | 0;
        HEAP32[buf + 68 >> 2] = 0;
        HEAP32[buf + 72 >> 2] = stat.ctime.getTime() / 1e3 | 0;
        HEAP32[buf + 76 >> 2] = 0;
        tempI64 = [stat.ino >>> 0, (tempDouble = stat.ino, +Math_abs(tempDouble) >= 1 ? tempDouble > 0 ? (Math_min(+Math_floor(tempDouble / 4294967296), 4294967295) | 0) >>> 0 : ~~+Math_ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0)],
            HEAP32[buf + 80 >> 2] = tempI64[0],
            HEAP32[buf + 84 >> 2] = tempI64[1];
        return 0
    },
    doMsync: function (addr, stream, len, flags, offset) {
        var buffer = HEAPU8.slice(addr, addr + len);
        FS.msync(stream, buffer, offset, len, flags)
    },
    doMkdir: function (path, mode) {
        path = PATH.normalize(path);
        if (path[path.length - 1] === "/")
            path = path.substr(0, path.length - 1);
        FS.mkdir(path, mode, 0);
        return 0
    },
    doMknod: function (path, mode, dev) {
        switch (mode & 61440) {
            case 32768:
            case 8192:
            case 24576:
            case 4096:
            case 49152:
                break;
            default:
                return -28
        }
        FS.mknod(path, mode, dev);
        return 0
    },
    doReadlink: function (path, buf, bufsize) {
        if (bufsize <= 0)
            return -28;
        var ret = FS.readlink(path);
        var len = Math.min(bufsize, lengthBytesUTF8(ret));
        var endChar = HEAP8[buf + len];
        stringToUTF8(ret, buf, bufsize + 1);
        HEAP8[buf + len] = endChar;
        return len
    },
    doAccess: function (path, amode) {
        if (amode & ~7) {
            return -28
        }
        var node;
        var lookup = FS.lookupPath(path, {
            follow: true
        });
        node = lookup.node;
        if (!node) {
            return -44
        }
        var perms = "";
        if (amode & 4)
            perms += "r";
        if (amode & 2)
            perms += "w";
        if (amode & 1)
            perms += "x";
        if (perms && FS.nodePermissions(node, perms)) {
            return -2
        }
        return 0
    },
    doDup: function (path, flags, suggestFD) {
        var suggest = FS.getStream(suggestFD);
        if (suggest)
            FS.close(suggest);
        return FS.open(path, flags, 0, suggestFD, suggestFD).fd
    },
    doReadv: function (stream, iov, iovcnt, offset) {
        var ret = 0;
        for (var i = 0; i < iovcnt; i++) {
            var ptr = HEAP32[iov + i * 8 >> 2];
            var len = HEAP32[iov + (i * 8 + 4) >> 2];
            var curr = FS.read(stream, HEAP8, ptr, len, offset);
            if (curr < 0)
                return -1;
            ret += curr;
            if (curr < len)
                break
        }
        return ret
    },
    doWritev: function (stream, iov, iovcnt, offset) {
        var ret = 0;
        for (var i = 0; i < iovcnt; i++) {
            var ptr = HEAP32[iov + i * 8 >> 2];
            var len = HEAP32[iov + (i * 8 + 4) >> 2];
            var curr = FS.write(stream, HEAP8, ptr, len, offset);
            if (curr < 0)
                return -1;
            ret += curr
        }
        return ret
    },
    varargs: undefined,
    get: function () {
        SYSCALLS.varargs += 4;
        var ret = HEAP32[SYSCALLS.varargs - 4 >> 2];
        return ret
    },
    getStr: function (ptr) {
        var ret = UTF8ToString(ptr);
        return ret
    },
    getStreamFromFD: function (fd) {
        var stream = FS.getStream(fd);
        if (!stream)
            throw new FS.ErrnoError(8);
        return stream
    },
    get64: function (low, high) {
        return low
    }
};

function ___sys_fcntl64(fd, cmd, varargs) {
    SYSCALLS.varargs = varargs;
    try {
        var stream = SYSCALLS.getStreamFromFD(fd);
        switch (cmd) {
            case 0: {
                var arg = SYSCALLS.get();
                if (arg < 0) {
                    return -28
                }
                var newStream;
                newStream = FS.open(stream.path, stream.flags, 0, arg);
                return newStream.fd
            }
            case 1:
            case 2:
                return 0;
            case 3:
                return stream.flags;
            case 4: {
                var arg = SYSCALLS.get();
                stream.flags |= arg;
                return 0
            }
            case 12: {
                var arg = SYSCALLS.get();
                var offset = 0;
                HEAP16[arg + offset >> 1] = 2;
                return 0
            }
            case 13:
            case 14:
                return 0;
            case 16:
            case 8:
                return -28;
            case 9:
                setErrNo(28);
                return -1;
            default: {
                return -28
            }
        }
    } catch (e) {
        if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError))
            abort(e);
        return -e.errno
    }
}

function ___sys_ioctl(fd, op, varargs) {
    SYSCALLS.varargs = varargs;
    try {
        var stream = SYSCALLS.getStreamFromFD(fd);
        switch (op) {
            case 21509:
            case 21505: {
                if (!stream.tty)
                    return -59;
                return 0
            }
            case 21510:
            case 21511:
            case 21512:
            case 21506:
            case 21507:
            case 21508: {
                if (!stream.tty)
                    return -59;
                return 0
            }
            case 21519: {
                if (!stream.tty)
                    return -59;
                var argp = SYSCALLS.get();
                HEAP32[argp >> 2] = 0;
                return 0
            }
            case 21520: {
                if (!stream.tty)
                    return -59;
                return -28
            }
            case 21531: {
                var argp = SYSCALLS.get();
                return FS.ioctl(stream, op, argp)
            }
            case 21523: {
                if (!stream.tty)
                    return -59;
                return 0
            }
            case 21524: {
                if (!stream.tty)
                    return -59;
                return 0
            }
            default:
                abort("bad ioctl syscall " + op)
        }
    } catch (e) {
        if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError))
            abort(e);
        return -e.errno
    }
}

function syscallMunmap(addr, len) {
    if ((addr | 0) === -1 || len === 0) {
        return -28
    }
    var info = SYSCALLS.mappings[addr];
    if (!info)
        return 0;
    if (len === info.len) {
        var stream = FS.getStream(info.fd);
        if (info.prot & 2) {
            SYSCALLS.doMsync(addr, stream, len, info.flags, info.offset)
        }
        FS.munmap(stream);
        SYSCALLS.mappings[addr] = null;
        if (info.allocated) {
            _free(info.malloc)
        }
    }
    return 0
}

function ___sys_munmap(addr, len) {
    try {
        return syscallMunmap(addr, len)
    } catch (e) {
        if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError))
            abort(e);
        return -e.errno
    }
}

function ___sys_open(path, flags, varargs) {
    SYSCALLS.varargs = varargs;
    try {
        var pathname = SYSCALLS.getStr(path);
        var mode = SYSCALLS.get();
        var stream = FS.open(pathname, flags, mode);
        return stream.fd;
    } catch (e) {
        console.log(e);
        if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError))
            abort(e);
        return -e.errno
    }
}

function ___sys_read(fd, buf, count) {
    try {
        var stream = SYSCALLS.getStreamFromFD(fd);
        return FS.read(stream, HEAP8, buf, count)
    } catch (e) {
        console.log(e);
        if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError))
            abort(e);
        return -e.errno
    }
}

var tupleRegistrations = {};

function runDestructors(destructors) {
    while (destructors.length) {
        var ptr = destructors.pop();
        var del = destructors.pop();
        del(ptr)
    }
}

function simpleReadValueFromPointer(pointer) {
    return this["fromWireType"](HEAPU32[pointer >> 2])
}
var awaitingDependencies = {};
var registeredTypes = {};
var typeDependencies = {};
var char_0 = 48;
var char_9 = 57;

function makeLegalFunctionName(name) {
    if (undefined === name) {
        return "_unknown"
    }
    name = name.replace(/[^a-zA-Z0-9_]/g, "$");
    var f = name.charCodeAt(0);
    if (f >= char_0 && f <= char_9) {
        return "_" + name
    } else {
        return name
    }
}


function createNamedFunction(name, body) {
    name = makeLegalFunctionName(name);
    var Dyncall = function (body) {
        this[name] = function () {
            "use strict";
            return body.apply(this, arguments);
        }
        return this[name];
    }(body)
    return Dyncall;
}

function extendError(baseErrorType, errorName) {
    var errorClass = createNamedFunction(errorName, function (message) {
        this.name = errorName;
        this.message = message;
        var stack = new Error(message).stack;
        if (stack !== undefined) {
            this.stack = this.toString() + "\n" + stack.replace(/^Error(:[^\n]*)?\n/, "")
        }
    });
    errorClass.prototype = Object.create(baseErrorType.prototype);
    errorClass.prototype.constructor = errorClass;
    errorClass.prototype.toString = function () {
        if (this.message === undefined) {
            return this.name
        } else {
            return this.name + ": " + this.message
        }
    };
    return errorClass
}
var InternalError = undefined;

function throwInternalError(message) {
    throw new InternalError(message)
}

function whenDependentTypesAreResolved(myTypes, dependentTypes, getTypeConverters) {
    myTypes.forEach(function (type) {
        typeDependencies[type] = dependentTypes
    });

    function onComplete(typeConverters) {
        var myTypeConverters = getTypeConverters(typeConverters);
        if (myTypeConverters.length !== myTypes.length) {
            throwInternalError("Mismatched type converter count")
        }
        for (var i = 0; i < myTypes.length; ++i) {
            registerType(myTypes[i], myTypeConverters[i])
        }
    }
    var typeConverters = new Array(dependentTypes.length);
    var unregisteredTypes = [];
    var registered = 0;
    dependentTypes.forEach(function (dt, i) {
        if (registeredTypes.hasOwnProperty(dt)) {
            typeConverters[i] = registeredTypes[dt]
        } else {
            unregisteredTypes.push(dt);
            if (!awaitingDependencies.hasOwnProperty(dt)) {
                awaitingDependencies[dt] = []
            }
            awaitingDependencies[dt].push(function () {
                typeConverters[i] = registeredTypes[dt];
                ++registered;
                if (registered === unregisteredTypes.length) {
                    onComplete(typeConverters)
                }
            })
        }
    });
    if (0 === unregisteredTypes.length) {
        onComplete(typeConverters)
    }
}

function __embind_finalize_value_array(rawTupleType) {
    var reg = tupleRegistrations[rawTupleType];
    delete tupleRegistrations[rawTupleType];
    var elements = reg.elements;
    var elementsLength = elements.length;
    var elementTypes = elements.map(function (elt) {
        return elt.getterReturnType
    }).concat(elements.map(function (elt) {
        return elt.setterArgumentType
    }));
    var rawConstructor = reg.rawConstructor;
    var rawDestructor = reg.rawDestructor;
    whenDependentTypesAreResolved([rawTupleType], elementTypes, function (elementTypes) {
        elements.forEach(function (elt, i) {
            var getterReturnType = elementTypes[i];
            var getter = elt.getter;
            var getterContext = elt.getterContext;
            var setterArgumentType = elementTypes[i + elementsLength];
            var setter = elt.setter;
            var setterContext = elt.setterContext;
            elt.read = function (ptr) {
                return getterReturnType["fromWireType"](getter(getterContext, ptr))
            };
            elt.write = function (ptr, o) {
                var destructors = [];
                setter(setterContext, ptr, setterArgumentType["toWireType"](destructors, o));
                runDestructors(destructors)
            }
        });
        return [{
            name: reg.name,
            "fromWireType": function (ptr) {
                var rv = new Array(elementsLength);
                for (var i = 0; i < elementsLength; ++i) {
                    rv[i] = elements[i].read(ptr)
                }
                rawDestructor(ptr);
                return rv
            },
            "toWireType": function (destructors, o) {
                if (elementsLength !== o.length) {
                    throw new TypeError("Incorrect number of tuple elements for " + reg.name + ": expected=" + elementsLength + ", actual=" + o.length)
                }
                var ptr = rawConstructor();
                for (var i = 0; i < elementsLength; ++i) {
                    elements[i].write(ptr, o[i])
                }
                if (destructors !== null) {
                    destructors.push(rawDestructor, ptr)
                }
                return ptr
            },
            "argPackAdvance": 8,
            "readValueFromPointer": simpleReadValueFromPointer,
            destructorFunction: rawDestructor
        }]
    })
}
var structRegistrations = {};

function __embind_finalize_value_object(structType) {
    var reg = structRegistrations[structType];
    delete structRegistrations[structType];
    var rawConstructor = reg.rawConstructor;
    var rawDestructor = reg.rawDestructor;
    var fieldRecords = reg.fields;
    var fieldTypes = fieldRecords.map(function (field) {
        return field.getterReturnType
    }).concat(fieldRecords.map(function (field) {
        return field.setterArgumentType
    }));
    whenDependentTypesAreResolved([structType], fieldTypes, function (fieldTypes) {
        var fields = {};
        fieldRecords.forEach(function (field, i) {
            var fieldName = field.fieldName;
            var getterReturnType = fieldTypes[i];
            var getter = field.getter;
            var getterContext = field.getterContext;
            var setterArgumentType = fieldTypes[i + fieldRecords.length];
            var setter = field.setter;
            var setterContext = field.setterContext;
            fields[fieldName] = {
                read: function (ptr) {
                    return getterReturnType["fromWireType"](getter(getterContext, ptr))
                },
                write: function (ptr, o) {
                    var destructors = [];
                    setter(setterContext, ptr, setterArgumentType["toWireType"](destructors, o));
                    runDestructors(destructors)
                }
            }
        });
        return [{
            name: reg.name,
            "fromWireType": function (ptr) {
                var rv = {};
                for (var i in fields) {
                    rv[i] = fields[i].read(ptr)
                }
                rawDestructor(ptr);
                return rv
            },
            "toWireType": function (destructors, o) {
                for (var fieldName in fields) {
                    if (!(fieldName in o)) {
                        throw new TypeError("Missing field")
                    }
                }
                var ptr = rawConstructor();
                for (fieldName in fields) {
                    fields[fieldName].write(ptr, o[fieldName])
                }
                if (destructors !== null) {
                    destructors.push(rawDestructor, ptr)
                }
                return ptr
            },
            "argPackAdvance": 8,
            "readValueFromPointer": simpleReadValueFromPointer,
            destructorFunction: rawDestructor
        }]
    })
}

function getShiftFromSize(size) {
    switch (size) {
        case 1:
            return 0;
        case 2:
            return 1;
        case 4:
            return 2;
        case 8:
            return 3;
        default:
            throw new TypeError("Unknown type size: " + size)
    }
}

function embind_init_charCodes() {
    var codes = new Array(256);
    for (var i = 0; i < 256; ++i) {
        codes[i] = String.fromCharCode(i)
    }
    embind_charCodes = codes
}
var embind_charCodes = undefined;

function readLatin1String(ptr) {
    var ret = "";
    var c = ptr;
    while (HEAPU8[c]) {
        ret += embind_charCodes[HEAPU8[c++]]
    }
    return ret
}
var BindingError = undefined;

function throwBindingError(message) {
    throw new BindingError(message)
}

function registerType(rawType, registeredInstance, options) {
    options = options || {};
    if (!("argPackAdvance" in registeredInstance)) {
        //throw new TypeError("registerType registeredInstance requires argPackAdvance")
    }
    var name = registeredInstance.name;
    if (!rawType) {
        throwBindingError('type "' + name + '" must have a positive integer typeid pointer')
    }
    if (registeredTypes.hasOwnProperty(rawType)) {
        if (options.ignoreDuplicateRegistrations) {
            return
        } else {
            return
            //throwBindingError("Cannot register type '" + name + "' twice")
        }
    }
    registeredTypes[rawType] = registeredInstance;
    delete typeDependencies[rawType];
    if (awaitingDependencies.hasOwnProperty(rawType)) {
        var callbacks = awaitingDependencies[rawType];
        delete awaitingDependencies[rawType];
        callbacks.forEach(function (cb) {
            cb()
        })
    }
}

function __embind_register_bool(rawType, name, size, trueValue, falseValue) {
    var shift = getShiftFromSize(size);
    name = readLatin1String(name);
    registerType(rawType, {
        name: name,
        "fromWireType": function (wt) {
            return !!wt
        },
        "toWireType": function (destructors, o) {
            return o ? trueValue : falseValue
        },
        "argPackAdvance": 8,
        "readValueFromPointer": function (pointer) {
            var heap;
            if (size === 1) {
                heap = HEAP8
            } else if (size === 2) {
                heap = HEAP16
            } else if (size === 4) {
                heap = HEAP32
            } else {
                throw new TypeError("Unknown boolean type size: " + name)
            }
            return this["fromWireType"](heap[pointer >> shift])
        },
        destructorFunction: null
    })
}

function ClassHandle_isAliasOf(other) {
    if (!(this instanceof ClassHandle)) {
        return false
    }
    if (!(other instanceof ClassHandle)) {
        return false
    }
    var leftClass = this.$$.ptrType.registeredClass;
    var left = this.$$.ptr;
    var rightClass = other.$$.ptrType.registeredClass;
    var right = other.$$.ptr;
    while (leftClass.baseClass) {
        left = leftClass.upcast(left);
        leftClass = leftClass.baseClass
    }
    while (rightClass.baseClass) {
        right = rightClass.upcast(right);
        rightClass = rightClass.baseClass
    }
    return leftClass === rightClass && left === right
}

function shallowCopyInternalPointer(o) {
    return {
        count: o.count,
        deleteScheduled: o.deleteScheduled,
        preservePointerOnDelete: o.preservePointerOnDelete,
        ptr: o.ptr,
        ptrType: o.ptrType,
        smartPtr: o.smartPtr,
        smartPtrType: o.smartPtrType
    }
}

function throwInstanceAlreadyDeleted(obj) {
    function getInstanceTypeName(handle) {
        return handle.$$.ptrType.registeredClass.name
    }
    throwBindingError(getInstanceTypeName(obj) + " instance already deleted")
}
var finalizationGroup = false;

function detachFinalizer(handle) {}

function runDestructor($$) {
    if ($$.smartPtr) {
        $$.smartPtrType.rawDestructor($$.smartPtr)
    } else {
        $$.ptrType.registeredClass.rawDestructor($$.ptr)
    }
}

function releaseClassHandle($$) {
    $$.count.value -= 1;
    var toDelete = 0 === $$.count.value;
    if (toDelete) {
        runDestructor($$)
    }
}

function attachFinalizer(handle) {
    if ("undefined" === typeof FinalizationGroup) {
        attachFinalizer = function (handle) {
            return handle
        };
        return handle
    }
    finalizationGroup = new FinalizationGroup(function (iter) {
        for (var result = iter.next(); !result.done; result = iter.next()) {
            var $$ = result.value;
            if (!$$.ptr) {
                console.warn("object already deleted: " + $$.ptr)
            } else {
                releaseClassHandle($$)
            }
        }
    });
    attachFinalizer = function (handle) {
        finalizationGroup.register(handle, handle.$$, handle.$$);
        return handle
    };
    detachFinalizer = function (handle) {
        finalizationGroup.unregister(handle.$$)
    };
    return attachFinalizer(handle)
}

function ClassHandle_clone() {
    if (!this.$$.ptr) {
        throwInstanceAlreadyDeleted(this)
    }
    if (this.$$.preservePointerOnDelete) {
        this.$$.count.value += 1;
        return this
    } else {
        var clone = attachFinalizer(Object.create(Object.getPrototypeOf(this), {
            $$: {
                value: shallowCopyInternalPointer(this.$$)
            }
        }));
        clone.$$.count.value += 1;
        clone.$$.deleteScheduled = false;
        return clone
    }
}

function ClassHandle_delete() {
    if (!this.$$.ptr) {
        throwInstanceAlreadyDeleted(this)
    }
    if (this.$$.deleteScheduled && !this.$$.preservePointerOnDelete) {
        throwBindingError("Object already scheduled for deletion")
    }
    detachFinalizer(this);
    releaseClassHandle(this.$$);
    if (!this.$$.preservePointerOnDelete) {
        this.$$.smartPtr = undefined;
        this.$$.ptr = undefined
    }
}

function ClassHandle_isDeleted() {
    return !this.$$.ptr
}
var delayFunction = undefined;
var deletionQueue = [];

function flushPendingDeletes() {
    while (deletionQueue.length) {
        var obj = deletionQueue.pop();
        obj.$$.deleteScheduled = false;
        obj["delete"]()
    }
}

function ClassHandle_deleteLater() {
    if (!this.$$.ptr) {
        throwInstanceAlreadyDeleted(this)
    }
    if (this.$$.deleteScheduled && !this.$$.preservePointerOnDelete) {
        throwBindingError("Object already scheduled for deletion")
    }
    deletionQueue.push(this);
    if (deletionQueue.length === 1 && delayFunction) {
        delayFunction(flushPendingDeletes)
    }
    this.$$.deleteScheduled = true;
    return this
}

function init_ClassHandle() {
    ClassHandle.prototype["isAliasOf"] = ClassHandle_isAliasOf;
    ClassHandle.prototype["clone"] = ClassHandle_clone;
    ClassHandle.prototype["delete"] = ClassHandle_delete;
    ClassHandle.prototype["isDeleted"] = ClassHandle_isDeleted;
    ClassHandle.prototype["deleteLater"] = ClassHandle_deleteLater
}

function ClassHandle() {}
var registeredPointers = {};

function ensureOverloadTable(proto, methodName, humanName) {
    if (undefined === proto[methodName].overloadTable) {
        var prevFunc = proto[methodName];
        proto[methodName] = function () {
            if (!proto[methodName].overloadTable.hasOwnProperty(arguments.length)) {
                throwBindingError("Function '" + humanName + "' called with an invalid number of arguments (" + arguments.length + ") - expects one of (" + proto[methodName].overloadTable + ")!")
            }
            return proto[methodName].overloadTable[arguments.length].apply(this, arguments)
        };
        proto[methodName].overloadTable = [];
        proto[methodName].overloadTable[prevFunc.argCount] = prevFunc
    }
}

function exposePublicSymbol(name, value, numArguments) {
    if (Module.hasOwnProperty(name)) {
        if (undefined === numArguments || undefined !== Module[name].overloadTable && undefined !== Module[name].overloadTable[numArguments]) {
            throwBindingError("Cannot register public name '" + name + "' twice")
        }
        ensureOverloadTable(Module, name, name);
        if (Module.hasOwnProperty(numArguments)) {
            throwBindingError("Cannot register multiple overloads of a function with the same number of arguments (" + numArguments + ")!")
        }
        Module[name].overloadTable[numArguments] = value
    } else {
        Module[name] = value;
        if (undefined !== numArguments) {
            Module[name].numArguments = numArguments
        }
    }
}

function RegisteredClass(name, constructor, instancePrototype, rawDestructor, baseClass, getActualType, upcast, downcast) {
    this.name = name;
    this.constructor = constructor;
    this.instancePrototype = instancePrototype;
    this.rawDestructor = rawDestructor;
    this.baseClass = baseClass;
    this.getActualType = getActualType;
    this.upcast = upcast;
    this.downcast = downcast;
    this.pureVirtualFunctions = []
}

function upcastPointer(ptr, ptrClass, desiredClass) {
    while (ptrClass !== desiredClass) {
        if (!ptrClass.upcast) {
            throwBindingError("Expected null or instance of " + desiredClass.name + ", got an instance of " + ptrClass.name)
        }
        ptr = ptrClass.upcast(ptr);
        ptrClass = ptrClass.baseClass
    }
    return ptr
}



function constNoSmartPtrRawPointerToWireType(destructors, handle) {
    if (handle === null) {
        if (this.isReference) {
            throwBindingError("null is not a valid " + this.name)
        }
        return 0
    }
    if (!handle.$$) {
        throwBindingError('Cannot pass "' + _embind_repr(handle) + '" as a ' + this.name)
    }
    if (!handle.$$.ptr) {
        throwBindingError("Cannot pass deleted object as a pointer of type " + this.name)
    }
    var handleClass = handle.$$.ptrType.registeredClass;
    var ptr = upcastPointer(handle.$$.ptr, handleClass, this.registeredClass);
    return ptr
}

function genericPointerToWireType(destructors, handle) {
    var ptr;
    if (handle === null) {
        if (this.isReference) {
            throwBindingError("null is not a valid " + this.name)
        }
        if (this.isSmartPointer) {
            ptr = this.rawConstructor();
            if (destructors !== null) {
                destructors.push(this.rawDestructor, ptr)
            }
            return ptr
        } else {
            return 0
        }
    }
    if (!handle.$$) {
        throwBindingError('Cannot pass "' + _embind_repr(handle) + '" as a ' + this.name)
    }
    if (!handle.$$.ptr) {
        throwBindingError("Cannot pass deleted object as a pointer of type " + this.name)
    }
    if (!this.isConst && handle.$$.ptrType.isConst) {
        throwBindingError("Cannot convert argument of type " + (handle.$$.smartPtrType ? handle.$$.smartPtrType.name : handle.$$.ptrType.name) + " to parameter type " + this.name)
    }
    var handleClass = handle.$$.ptrType.registeredClass;
    ptr = upcastPointer(handle.$$.ptr, handleClass, this.registeredClass);
    if (this.isSmartPointer) {
        if (undefined === handle.$$.smartPtr) {
            throwBindingError("Passing raw pointer to smart pointer is illegal")
        }
        switch (this.sharingPolicy) {
            case 0:
                if (handle.$$.smartPtrType === this) {
                    ptr = handle.$$.smartPtr
                } else {
                    throwBindingError("Cannot convert argument of type " + (handle.$$.smartPtrType ? handle.$$.smartPtrType.name : handle.$$.ptrType.name) + " to parameter type " + this.name)
                }
                break;
            case 1:
                ptr = handle.$$.smartPtr;
                break;
            case 2:
                if (handle.$$.smartPtrType === this) {
                    ptr = handle.$$.smartPtr
                } else {
                    var clonedHandle = handle["clone"]();
                    ptr = this.rawShare(ptr, __emval_register(function () {
                        clonedHandle["delete"]()
                    }));
                    if (destructors !== null) {
                        destructors.push(this.rawDestructor, ptr)
                    }
                }
                break;
            default:
                throwBindingError("Unsupporting sharing policy")
        }
    }
    return ptr
}

function nonConstNoSmartPtrRawPointerToWireType(destructors, handle) {
    if (handle === null) {
        if (this.isReference) {
            throwBindingError("null is not a valid " + this.name)
        }
        return 0
    }
    if (!handle.$$) {
        throwBindingError('Cannot pass "' + _embind_repr(handle) + '" as a ' + this.name)
    }
    if (!handle.$$.ptr) {
        throwBindingError("Cannot pass deleted object as a pointer of type " + this.name)
    }
    if (handle.$$.ptrType.isConst) {
        throwBindingError("Cannot convert argument of type " + handle.$$.ptrType.name + " to parameter type " + this.name)
    }
    var handleClass = handle.$$.ptrType.registeredClass;
    var ptr = upcastPointer(handle.$$.ptr, handleClass, this.registeredClass);
    return ptr
}

function RegisteredPointer_getPointee(ptr) {
    if (this.rawGetPointee) {
        ptr = this.rawGetPointee(ptr)
    }
    return ptr
}

function RegisteredPointer_destructor(ptr) {
    if (this.rawDestructor) {
        this.rawDestructor(ptr)
    }
}

function RegisteredPointer_deleteObject(handle) {
    if (handle !== null) {
        handle["delete"]()
    }
}

function downcastPointer(ptr, ptrClass, desiredClass) {
    if (ptrClass === desiredClass) {
        return ptr
    }
    if (undefined === desiredClass.baseClass) {
        return null
    }
    var rv = downcastPointer(ptr, ptrClass, desiredClass.baseClass);
    if (rv === null) {
        return null
    }
    return desiredClass.downcast(rv)
}

function getInheritedInstanceCount() {
    return Object.keys(registeredInstances).length
}

function getLiveInheritedInstances() {
    var rv = [];
    for (var k in registeredInstances) {
        if (registeredInstances.hasOwnProperty(k)) {
            rv.push(registeredInstances[k])
        }
    }
    return rv
}

function setDelayFunction(fn) {
    delayFunction = fn;
    if (deletionQueue.length && delayFunction) {
        delayFunction(flushPendingDeletes)
    }
}

function init_embind() {
    Module["getInheritedInstanceCount"] = getInheritedInstanceCount;
    Module["getLiveInheritedInstances"] = getLiveInheritedInstances;
    Module["flushPendingDeletes"] = flushPendingDeletes;
    Module["setDelayFunction"] = setDelayFunction
}
var registeredInstances = {};

function getBasestPointer(class_, ptr) {
    if (ptr === undefined) {
        throwBindingError("ptr should not be undefined")
    }
    while (class_.baseClass) {
        ptr = class_.upcast(ptr);
        class_ = class_.baseClass
    }
    return ptr
}

function getInheritedInstance(class_, ptr) {
    ptr = getBasestPointer(class_, ptr);
    return registeredInstances[ptr]
}

function makeClassHandle(prototype, record) {
    if (!record.ptrType || !record.ptr) {
        throwInternalError("makeClassHandle requires ptr and ptrType")
    }
    var hasSmartPtrType = !!record.smartPtrType;
    var hasSmartPtr = !!record.smartPtr;
    if (hasSmartPtrType !== hasSmartPtr) {
        throwInternalError("Both smartPtrType and smartPtr must be specified")
    }
    record.count = {
        value: 1
    };
    return attachFinalizer(Object.create(prototype, {
        $$: {
            value: record
        }
    }))
}

function RegisteredPointer_fromWireType(ptr) {
    var rawPointer = this.getPointee(ptr);
    if (!rawPointer) {
        this.destructor(ptr);
        return null
    }
    var registeredInstance = getInheritedInstance(this.registeredClass, rawPointer);
    if (undefined !== registeredInstance) {
        if (0 === registeredInstance.$$.count.value) {
            registeredInstance.$$.ptr = rawPointer;
            registeredInstance.$$.smartPtr = ptr;
            return registeredInstance["clone"]()
        } else {
            var rv = registeredInstance["clone"]();
            this.destructor(ptr);
            return rv
        }
    }

    function makeDefaultHandle() {
        if (this.isSmartPointer) {
            return makeClassHandle(this.registeredClass.instancePrototype, {
                ptrType: this.pointeeType,
                ptr: rawPointer,
                smartPtrType: this,
                smartPtr: ptr
            })
        } else {
            return makeClassHandle(this.registeredClass.instancePrototype, {
                ptrType: this,
                ptr: ptr
            })
        }
    }
    var actualType = this.registeredClass.getActualType(rawPointer);
    var registeredPointerRecord = registeredPointers[actualType];
    if (!registeredPointerRecord) {
        return makeDefaultHandle.call(this)
    }
    var toType;
    if (this.isConst) {
        toType = registeredPointerRecord.constPointerType
    } else {
        toType = registeredPointerRecord.pointerType
    }
    var dp = downcastPointer(rawPointer, this.registeredClass, toType.registeredClass);
    if (dp === null) {
        return makeDefaultHandle.call(this)
    }
    if (this.isSmartPointer) {
        return makeClassHandle(toType.registeredClass.instancePrototype, {
            ptrType: toType,
            ptr: dp,
            smartPtrType: this,
            smartPtr: ptr
        })
    } else {
        return makeClassHandle(toType.registeredClass.instancePrototype, {
            ptrType: toType,
            ptr: dp
        })
    }
}


function init_RegisteredPointer() {
    RegisteredPointer.prototype.getPointee = RegisteredPointer_getPointee;
    RegisteredPointer.prototype.destructor = RegisteredPointer_destructor;
    RegisteredPointer.prototype["argPackAdvance"] = 8;
    RegisteredPointer.prototype["readValueFromPointer"] = simpleReadValueFromPointer;
    RegisteredPointer.prototype["deleteObject"] = RegisteredPointer_deleteObject;
    RegisteredPointer.prototype["fromWireType"] = RegisteredPointer_fromWireType
}

function RegisteredPointer(name, registeredClass, isReference, isConst, isSmartPointer, pointeeType, sharingPolicy, rawGetPointee, rawConstructor, rawShare, rawDestructor) {
    this.name = name;
    this.registeredClass = registeredClass;
    this.isReference = isReference;
    this.isConst = isConst;
    this.isSmartPointer = isSmartPointer;
    this.pointeeType = pointeeType;
    this.sharingPolicy = sharingPolicy;
    this.rawGetPointee = rawGetPointee;
    this.rawConstructor = rawConstructor;
    this.rawShare = rawShare;
    this.rawDestructor = rawDestructor;
    if (!isSmartPointer && registeredClass.baseClass === undefined) {
        if (isConst) {
            this["toWireType"] = constNoSmartPtrRawPointerToWireType;
            this.destructorFunction = null
        } else {
            this["toWireType"] = nonConstNoSmartPtrRawPointerToWireType;
            this.destructorFunction = null
        }
    } else {
        this["toWireType"] = genericPointerToWireType
    }
}

function replacePublicSymbol(name, value, numArguments) {
    if (!Module.hasOwnProperty(name)) {
        throwInternalError("Replacing nonexistant public symbol")
    }
    if (undefined !== Module[name].overloadTable && undefined !== numArguments) {
        Module[name].overloadTable[numArguments] = value
    } else {
        Module[name] = value;
        Module[name].argCount = numArguments
    }
}

function embind__requireFunction(signature, rawFunction) {
    signature = readLatin1String(signature);

    function makeDynCaller(dynCall) {
        switch (signature.length) {
            case 1:
                var DynCaller = function (dynCall, rawFunction) {
                    this["dynCall_" + signature + "_" + rawFunction] = function (a1) {
                        return dynCall(rawFunction, a1);
                    };
                    return this["dynCall_" + signature + "_" + rawFunction];
                }(dynCall, rawFunction);
                break;
            case 2:
                var DynCaller = function (dynCall, rawFunction) {
                    this["dynCall_" + signature + "_" + rawFunction] = function (a1, a2) {
                        return dynCall(rawFunction, a1, a2);
                    };
                    return this["dynCall_" + signature + "_" + rawFunction];
                }(dynCall, rawFunction);
                break;
            case 3:
                var DynCaller = function (dynCall, rawFunction) {
                    this["dynCall_" + signature + "_" + rawFunction] = function (a1, a2, a3) {
                        return dynCall(rawFunction, a1, a2, a3);
                    };
                    return this["dynCall_" + signature + "_" + rawFunction];
                }(dynCall, rawFunction);
                break;
            case 4:
                var DynCaller = function (dynCall, rawFunction) {
                    this["dynCall_" + signature + "_" + rawFunction] = function (a1, a2, a3, a4) {
                        return dynCall(rawFunction, a1, a2, a3, a4);
                    };
                    return this["dynCall_" + signature + "_" + rawFunction];
                }(dynCall, rawFunction);
                break;
            case 5:
                var DynCaller = function (dynCall, rawFunction) {
                    this["dynCall_" + signature + "_" + rawFunction] = function (a1, a2, a3, a4, a5) {
                        return dynCall(rawFunction, a1, a2, a3, a4, a5);
                    };
                    return this["dynCall_" + signature + "_" + rawFunction];
                }(dynCall, rawFunction);
                break;
            case 6:
                var DynCaller = function (dynCall, rawFunction) {
                    this["dynCall_" + signature + "_" + rawFunction] = function (a1, a2, a3, a4, a5, a6) {
                        return dynCall(rawFunction, a1, a2, a3, a4, a5, a6);
                    };
                    return this["dynCall_" + signature + "_" + rawFunction];
                }(dynCall, rawFunction);
                break;
            case 7:
                var DynCaller = function (dynCall, rawFunction) {
                    this["dynCall_" + signature + "_" + rawFunction] = function (a1, a2, a3, a4, a5, a6, a7) {
                        return dynCall(rawFunction, a1, a2, a3, a4, a5, a6, a7);
                    };
                    return this["dynCall_" + signature + "_" + rawFunction];
                }(dynCall, rawFunction);
                break;
            case 8:
                var DynCaller = function (dynCall, rawFunction) {
                    this["dynCall_" + signature + "_" + rawFunction] = function (a1, a2, a3, a4, a5, a6, a7, a8) {
                        return dynCall(rawFunction, a1, a2, a3, a4, a5, a6, a7, a8);
                    };
                    return this["dynCall_" + signature + "_" + rawFunction];
                }(dynCall, rawFunction);
                break;
            case 9:
                var DynCaller = function (dynCall, rawFunction) {
                    this["dynCall_" + signature + "_" + rawFunction] = function (a1, a2, a3, a4, a5, a6, a7, a8, a9) {
                        return dynCall(rawFunction, a1, a2, a3, a4, a5, a6, a7, a8, a9);
                    };
                    return this["dynCall_" + signature + "_" + rawFunction];
                }(dynCall, rawFunction);
                break;
            case 10:
                var DynCaller = function (dynCall, rawFunction) {
                    this["dynCall_" + signature + "_" + rawFunction] = function (a1, a2, a3, a4, a5, a6, a7, a8, a9, a10) {
                        return dynCall(rawFunction, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10);
                    };
                    return this["dynCall_" + signature + "_" + rawFunction];
                }(dynCall, rawFunction);
                break;
            case 11:
                var DynCaller = function (dynCall, rawFunction) {
                    this["dynCall_" + signature + "_" + rawFunction] = function (a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11) {
                        return dynCall(rawFunction, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11);
                    };
                    return this["dynCall_" + signature + "_" + rawFunction];
                }(dynCall, rawFunction);
                break;
            case 12:
                var DynCaller = function (dynCall, rawFunction) {
                    this["dynCall_" + signature + "_" + rawFunction] = function (a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12) {
                        return dynCall(rawFunction, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12);
                    };
                    return this["dynCall_" + signature + "_" + rawFunction];
                }(dynCall, rawFunction);
                break;
            case 13:
                var DynCaller = function (dynCall, rawFunction) {
                    this["dynCall_" + signature + "_" + rawFunction] = function (a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13) {
                        return dynCall(rawFunction, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13);
                    };
                    return this["dynCall_" + signature + "_" + rawFunction];
                }(dynCall, rawFunction);
                break;
            case 14:
                var DynCaller = function (dynCall, rawFunction) {
                    this["dynCall_" + signature + "_" + rawFunction] = function (a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14) {
                        return dynCall(rawFunction, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14);
                    };
                    return this["dynCall_" + signature + "_" + rawFunction];
                }(dynCall, rawFunction);
                break;
        }
        return DynCaller;
    }
    var dc = Module["dynCall_" + signature];
    var fp = makeDynCaller(dc);
    if (typeof fp !== "function") {
        throwBindingError("unknown function pointer with signature " + signature + ": " + rawFunction)
    }
    return fp
}
var UnboundTypeError = undefined;

function getTypeName(type) {
    var ptr = ___getTypeName(type);
    var rv = readLatin1String(ptr);
    _free(ptr);
    return rv
}

function throwUnboundTypeError(message, types) {
    var unboundTypes = [];
    var seen = {};

    function visit(type) {
        if (seen[type]) {
            return
        }
        if (registeredTypes[type]) {
            return
        }
        if (typeDependencies[type]) {
            typeDependencies[type].forEach(visit);
            return
        }
        unboundTypes.push(type);
        seen[type] = true
    }
    types.forEach(visit);
    throw new UnboundTypeError(message + ": " + unboundTypes.map(getTypeName).join([", "]))
}

function __embind_register_class(rawType, rawPointerType, rawConstPointerType, baseClassRawType, getActualTypeSignature, getActualType, upcastSignature, upcast, downcastSignature, downcast, name, destructorSignature, rawDestructor) {
    name = readLatin1String(name);
    getActualType = embind__requireFunction(getActualTypeSignature, getActualType);
    if (upcast) {
        upcast = embind__requireFunction(upcastSignature, upcast)
    }
    if (downcast) {
        downcast = embind__requireFunction(downcastSignature, downcast)
    }
    rawDestructor = embind__requireFunction(destructorSignature, rawDestructor);
    var legalFunctionName = makeLegalFunctionName(name);
    exposePublicSymbol(legalFunctionName, function () {
        throwUnboundTypeError("Cannot construct " + name + " due to unbound types", [baseClassRawType])
    });
    whenDependentTypesAreResolved([rawType, rawPointerType, rawConstPointerType], baseClassRawType ? [baseClassRawType] : [], function (base) {
        base = base[0];
        var baseClass;
        var basePrototype;
        if (baseClassRawType) {
            baseClass = base.registeredClass;
            basePrototype = baseClass.instancePrototype
        } else {
            basePrototype = ClassHandle.prototype
        }
        var constructor = createNamedFunction(legalFunctionName, function () {
            if (Object.getPrototypeOf(this) !== instancePrototype) {
                throw new BindingError("Use 'new' to construct " + name)
            }
            if (undefined === registeredClass.constructor_body) {
                throw new BindingError(name + " has no accessible constructor")
            }
            var body = registeredClass.constructor_body[arguments.length];
            if (undefined === body) {
                throw new BindingError("Tried to invoke ctor of " + name + " with invalid number of parameters (" + arguments.length + ") - expected (" + Object.keys(registeredClass.constructor_body).toString() + ") parameters instead!")
            }
            return body.apply(this, arguments)
        });
        var instancePrototype = Object.create(basePrototype, {
            constructor: {
                value: constructor
            }
        });
        constructor.prototype = instancePrototype;
        var registeredClass = new RegisteredClass(name, constructor, instancePrototype, rawDestructor, baseClass, getActualType, upcast, downcast);
        var referenceConverter = new RegisteredPointer(name, registeredClass, true, false, false);
        var pointerConverter = new RegisteredPointer(name + "*", registeredClass, false, false, false);
        var constPointerConverter = new RegisteredPointer(name + " const*", registeredClass, false, true, false);
        registeredPointers[rawType] = {
            pointerType: pointerConverter,
            constPointerType: constPointerConverter
        };
        replacePublicSymbol(legalFunctionName, constructor);
        return [referenceConverter, pointerConverter, constPointerConverter]
    })
}


function craftInvokerFunction(humanName, argTypes, classType, cppInvokerFunc, cppTargetFunc) {
    var argCount = argTypes.length;
    if (argCount < 2) {
        throwBindingError("argTypes array size mismatch! Must at least get return value and 'this' types!")
    }
    var args2 = [throwBindingError, cppInvokerFunc, cppTargetFunc, runDestructors, argTypes[0], argTypes[1]];
    for (var i = 0; i < argCount - 2; ++i) {
        args2.push(argTypes[i + 2])
    }
    var anonymous = function (throwBindingError, invoker, fn, runDestructors, retType, classParam, argType0, argType1, argType2, argType3, argType4, argType5, argType6, argType7, argType8, argType9) {
        var parentargs = Array.from(arguments);
        return this[makeLegalFunctionName(humanName)] = function (arg0, arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8, arg9) {
            var args = Array.from(arguments);
            var argWired = [];
            argWired.push(fn);
            var needsDestructorStack = false;
            for (var i = 6; i < parentargs.length; ++i) {
                if (parentargs[i] !== null && parentargs[i].destructorFunction === undefined) {
                    needsDestructorStack = true;
                    break
                }
            }
            if (needsDestructorStack) {
                var destructors = [];
            }
            if (classParam != null) {
                if (needsDestructorStack) {
                    var thisWired = classParam.toWireType(destructors, this);
                } else {
                    var thisWired = classParam.toWireType(null, this);
                }
                argWired.push(thisWired);
            }
            for (var i = 6, k = argWired.length; i < parentargs.length; i++) {
                if (parentargs[i] == null || typeof parentargs[i] != "object") {} else {
                    if (needsDestructorStack) {
                        argWired[k] = parentargs[i].toWireType(destructors, args[i - 6]);
                    } else {
                        argWired[k] = parentargs[i].toWireType(null, args[i - 6]);
                    }
                    k++;
                }
            }
            var rv = invoker(...argWired);
            if (needsDestructorStack) {
                runDestructors(destructors);
            } else {
                if (classParam != null) {
                    if (thisWired.destructorFunction !== null) {
                        //this["thisWired_dtor"](thisWired);
                    }
                }
                for (var i = 2; i < argWired.length; ++i) {
                    if (argWired[i].destructorFunction !== null) {
                        //this["arg"+(i-2)+"Wired_dtor"](argWired[i]);
                    }
                }
            }
            var ret = retType.fromWireType(rv);
            return ret;
        }
    }


    var invokerFunction = anonymous.apply(null, args2);
    return invokerFunction
}

function heap32VectorToArray(count, firstElement) {
    var array = [];
    for (var i = 0; i < count; i++) {
        array.push(HEAP32[(firstElement >> 2) + i])
    }
    return array
}

function __embind_register_class_class_function(rawClassType, methodName, argCount, rawArgTypesAddr, invokerSignature, rawInvoker, fn) {
    var rawArgTypes = heap32VectorToArray(argCount, rawArgTypesAddr);
    methodName = readLatin1String(methodName);
    rawInvoker = embind__requireFunction(invokerSignature, rawInvoker);
    whenDependentTypesAreResolved([], [rawClassType], function (classType) {
        classType = classType[0];
        var humanName = classType.name + "." + methodName;

        function unboundTypesHandler() {
            throwUnboundTypeError("Cannot call " + humanName + " due to unbound types", rawArgTypes)
        }
        var proto = classType.registeredClass.constructor;
        if (undefined === proto[methodName]) {
            unboundTypesHandler.argCount = argCount - 1;
            proto[methodName] = unboundTypesHandler
        } else {
            ensureOverloadTable(proto, methodName, humanName);
            proto[methodName].overloadTable[argCount - 1] = unboundTypesHandler
        }
        whenDependentTypesAreResolved([], rawArgTypes, function (argTypes) {
            var invokerArgsArray = [argTypes[0], null].concat(argTypes.slice(1));
            var func = craftInvokerFunction(humanName, invokerArgsArray, null, rawInvoker, fn);
            if (undefined === proto[methodName].overloadTable) {
                func.argCount = argCount - 1;
                proto[methodName] = func
            } else {
                proto[methodName].overloadTable[argCount - 1] = func
            }
            return []
        });
        return []
    })
}

function __embind_register_class_constructor(rawClassType, argCount, rawArgTypesAddr, invokerSignature, invoker, rawConstructor) {
    assert(argCount > 0);
    var rawArgTypes = heap32VectorToArray(argCount, rawArgTypesAddr);
    invoker = embind__requireFunction(invokerSignature, invoker);
    var args = [rawConstructor];
    var destructors = [];
    whenDependentTypesAreResolved([], [rawClassType], function (classType) {
        classType = classType[0];
        var humanName = "constructor " + classType.name;
        if (undefined === classType.registeredClass.constructor_body) {
            classType.registeredClass.constructor_body = []
        }
        if (undefined !== classType.registeredClass.constructor_body[argCount - 1]) {
            throw new BindingError("Cannot register multiple constructors with identical number of parameters (" + (argCount - 1) + ") for class '" + classType.name + "'! Overload resolution is currently only performed using the parameter count, not actual type info!")
        }
        classType.registeredClass.constructor_body[argCount - 1] = function unboundTypeHandler() {
            throwUnboundTypeError("Cannot construct " + classType.name + " due to unbound types", rawArgTypes)
        };
        whenDependentTypesAreResolved([], rawArgTypes, function (argTypes) {
            classType.registeredClass.constructor_body[argCount - 1] = function constructor_body() {
                if (arguments.length !== argCount - 1) {
                    throwBindingError(humanName + " called with " + arguments.length + " arguments, expected " + (argCount - 1))
                }
                destructors.length = 0;
                args.length = argCount;
                for (var i = 1; i < argCount; ++i) {
                    args[i] = argTypes[i]["toWireType"](destructors, arguments[i - 1])
                }
                var ptr = invoker.apply(null, args);
                runDestructors(destructors);
                return argTypes[0]["fromWireType"](ptr)
            };
            return []
        });
        return []
    })
}

function __embind_register_class_function(rawClassType, methodName, argCount, rawArgTypesAddr, invokerSignature, rawInvoker, context, isPureVirtual) {
    var rawArgTypes = heap32VectorToArray(argCount, rawArgTypesAddr);
    methodName = readLatin1String(methodName);
    rawInvoker = embind__requireFunction(invokerSignature, rawInvoker);
    whenDependentTypesAreResolved([], [rawClassType], function (classType) {
        classType = classType[0];
        var humanName = classType.name + "." + methodName;
        if (isPureVirtual) {
            classType.registeredClass.pureVirtualFunctions.push(methodName)
        }

        function unboundTypesHandler() {
            throwUnboundTypeError("Cannot call " + humanName + " due to unbound types", rawArgTypes)
        }
        var proto = classType.registeredClass.instancePrototype;
        var method = proto[methodName];
        if (undefined === method || undefined === method.overloadTable && method.className !== classType.name && method.argCount === argCount - 2) {
            unboundTypesHandler.argCount = argCount - 2;
            unboundTypesHandler.className = classType.name;
            proto[methodName] = unboundTypesHandler
        } else {
            ensureOverloadTable(proto, methodName, humanName);
            proto[methodName].overloadTable[argCount - 2] = unboundTypesHandler
        }
        whenDependentTypesAreResolved([], rawArgTypes, function (argTypes) {
            var memberFunction = craftInvokerFunction(humanName, argTypes, classType, rawInvoker, context);
            if (undefined === proto[methodName].overloadTable) {
                memberFunction.argCount = argCount - 2;
                proto[methodName] = memberFunction
            } else {
                proto[methodName].overloadTable[argCount - 2] = memberFunction
            }
            return []
        });
        return []
    })
}

function validateThis(this_, classType, humanName) {
    if (!(this_ instanceof Object)) {
        throwBindingError(humanName + ' with invalid "this": ' + this_)
    }
    if (!(this_ instanceof classType.registeredClass.constructor)) {
        throwBindingError(humanName + ' incompatible with "this" of type ' + this_.constructor.name)
    }
    if (!this_.$$.ptr) {
        throwBindingError("cannot call emscripten binding method " + humanName + " on deleted object")
    }
    return upcastPointer(this_.$$.ptr, this_.$$.ptrType.registeredClass, classType.registeredClass)
}

function __embind_register_class_property(classType, fieldName, getterReturnType, getterSignature, getter, getterContext, setterArgumentType, setterSignature, setter, setterContext) {
    fieldName = readLatin1String(fieldName);
    getter = embind__requireFunction(getterSignature, getter);
    whenDependentTypesAreResolved([], [classType], function (classType) {
        classType = classType[0];
        var humanName = classType.name + "." + fieldName;
        var desc = {
            get: function () {
                throwUnboundTypeError("Cannot access " + humanName + " due to unbound types", [getterReturnType, setterArgumentType])
            },
            enumerable: true,
            configurable: true
        };
        if (setter) {
            desc.set = function () {
                throwUnboundTypeError("Cannot access " + humanName + " due to unbound types", [getterReturnType, setterArgumentType])
            }
        } else {
            desc.set = function (v) {
                throwBindingError(humanName + " is a read-only property")
            }
        }
        Object.defineProperty(classType.registeredClass.instancePrototype, fieldName, desc);
        whenDependentTypesAreResolved([], setter ? [getterReturnType, setterArgumentType] : [getterReturnType], function (types) {
            var getterReturnType = types[0];
            var desc = {
                get: function () {
                    var ptr = validateThis(this, classType, humanName + " getter");
                    return getterReturnType["fromWireType"](getter(getterContext, ptr))
                },
                enumerable: true
            };
            if (setter) {
                setter = embind__requireFunction(setterSignature, setter);
                var setterArgumentType = types[1];
                desc.set = function (v) {
                    var ptr = validateThis(this, classType, humanName + " setter");
                    var destructors = [];
                    setter(setterContext, ptr, setterArgumentType["toWireType"](destructors, v));
                    runDestructors(destructors)
                }
            }
            Object.defineProperty(classType.registeredClass.instancePrototype, fieldName, desc);
            return []
        });
        return []
    })
}

function __embind_register_constant(name, type, value) {
    name = readLatin1String(name);
    whenDependentTypesAreResolved([], [type], function (type) {
        type = type[0];
        Module[name] = type["fromWireType"](value);
        return []
    })
}


var emval_free_list = [];
var emval_handle_array = [{}, {
    value: undefined
}, {
    value: null
}, {
    value: true
}, {
    value: false
}];

function __emval_decref(handle) {
    if (handle > 4 && 0 === --emval_handle_array[handle].refcount) {
        emval_handle_array[handle] = undefined;
        emval_free_list.push(handle)
    }
}

function count_emval_handles() {
    var count = 0;
    for (var i = 5; i < emval_handle_array.length; ++i) {
        if (emval_handle_array[i] !== undefined) {
            ++count
        }
    }
    return count
}

function get_first_emval() {
    for (var i = 5; i < emval_handle_array.length; ++i) {
        if (emval_handle_array[i] !== undefined) {
            return emval_handle_array[i]
        }
    }
    return null
}

function init_emval() {
    Module["count_emval_handles"] = count_emval_handles;
    Module["get_first_emval"] = get_first_emval
}

function __emval_register(value) {
    switch (value) {
        case undefined: {
            return 1
        }
        case null: {
            return 2
        }
        case true: {
            return 3
        }
        case false: {
            return 4
        }
        default: {
            var handle = emval_free_list.length ? emval_free_list.pop() : emval_handle_array.length;
            emval_handle_array[handle] = {
                refcount: 1,
                value: value
            };
            return handle
        }
    }
}

function __embind_register_emval(rawType, name) {
    name = readLatin1String(name);
    registerType(rawType, {
        name: name,
        "fromWireType": function (handle) {
            var rv = emval_handle_array[handle].value;
            __emval_decref(handle);
            return rv
        },
        "toWireType": function (destructors, value) {
            return __emval_register(value)
        },
        "argPackAdvance": 8,
        "readValueFromPointer": simpleReadValueFromPointer,
        destructorFunction: null
    })
}

function _embind_repr(v) {
    if (v === null) {
        return "null"
    }
    var t = typeof v;
    if (t === "object" || t === "array" || t === "function") {
        return v.toString()
    } else {
        return "" + v
    }
}

function floatReadValueFromPointer(name, shift) {
    switch (shift) {
        case 2:
            return function (pointer) {
                return this["fromWireType"](HEAPF32[pointer >> 2])
            };
        case 3:
            return function (pointer) {
                return this["fromWireType"](HEAPF64[pointer >> 3])
            };
        default:
            throw new TypeError("Unknown float type: " + name)
    }
}

function __embind_register_float(rawType, name, size) {
    var shift = getShiftFromSize(size);
    name = readLatin1String(name);
    registerType(rawType, {
        name: name,
        "fromWireType": function (value) {
            return value
        },
        "toWireType": function (destructors, value) {
            if (typeof value !== "number" && typeof value !== "boolean") {
                throw new TypeError('Cannot convert "' + _embind_repr(value) + '" to ' + this.name)
            }
            return value
        },
        "argPackAdvance": 8,
        "readValueFromPointer": floatReadValueFromPointer(name, shift),
        destructorFunction: null
    })
}

function __embind_register_function(name, argCount, rawArgTypesAddr, signature, rawInvoker, fn) {
    var argTypes = heap32VectorToArray(argCount, rawArgTypesAddr);
    name = readLatin1String(name);
    rawInvoker = embind__requireFunction(signature, rawInvoker);
    exposePublicSymbol(name, function () {
        throwUnboundTypeError("Cannot call " + name + " due to unbound types", argTypes)
    }, argCount - 1);
    whenDependentTypesAreResolved([], argTypes, function (argTypes) {
        var invokerArgsArray = [argTypes[0], null].concat(argTypes.slice(1));
        replacePublicSymbol(name, craftInvokerFunction(name, invokerArgsArray, null, rawInvoker, fn), argCount - 1);
        return []
    })
}

function integerReadValueFromPointer(name, shift, signed) {
    switch (shift) {
        case 0:
            return signed ? function readS8FromPointer(pointer) {
                    return HEAP8[pointer]
                } :
                function readU8FromPointer(pointer) {
                    return HEAPU8[pointer]
                };
        case 1:
            return signed ? function readS16FromPointer(pointer) {
                    return HEAP16[pointer >> 1]
                } :
                function readU16FromPointer(pointer) {
                    return HEAPU16[pointer >> 1]
                };
        case 2:
            return signed ? function readS32FromPointer(pointer) {
                    return HEAP32[pointer >> 2]
                } :
                function readU32FromPointer(pointer) {
                    return HEAPU32[pointer >> 2]
                };
        default:
            throw new TypeError("Unknown integer type: " + name)
    }
}

function __embind_register_integer(primitiveType, name, size, minRange, maxRange) {
    name = readLatin1String(name);
    if (maxRange === -1) {
        maxRange = 4294967295
    }
    var shift = getShiftFromSize(size);
    var fromWireType = function (value) {
        return value
    };
    if (minRange === 0) {
        var bitshift = 32 - 8 * size;
        fromWireType = function (value) {
            return value << bitshift >>> bitshift
        }
    }
    var isUnsignedType = name.indexOf("unsigned") != -1;
    registerType(primitiveType, {
        name: name,
        "fromWireType": fromWireType,
        "toWireType": function (destructors, value) {
            if (typeof value !== "number" && typeof value !== "boolean") {
                throw new TypeError('Cannot convert "' + _embind_repr(value) + '" to ' + this.name)
            }
            if (value < minRange || value > maxRange) {
                throw new TypeError('Passing a number "' + _embind_repr(value) + '" from JS side to C/C++ side to an argument of type "' + name + '", which is outside the valid range [' + minRange + ", " + maxRange + "]!")
            }
            return isUnsignedType ? value >>> 0 : value | 0
        },
        "argPackAdvance": 8,
        "readValueFromPointer": integerReadValueFromPointer(name, shift, minRange !== 0),
        destructorFunction: null
    })
}

function __embind_register_memory_view(rawType, dataTypeIndex, name) {
    var typeMapping = [Int8Array, Uint8Array, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array, Float64Array];
    var TA = typeMapping[dataTypeIndex];

    function decodeMemoryView(handle) {
        handle = handle >> 2;
        var heap = HEAPU32;
        var size = heap[handle];
        var data = heap[handle + 1];
        return new TA(buffer, data, size)
    }
    name = readLatin1String(name);
    registerType(rawType, {
        name: name,
        "fromWireType": decodeMemoryView,
        "argPackAdvance": 8,
        "readValueFromPointer": decodeMemoryView
    }, {
        ignoreDuplicateRegistrations: true
    })
}

function __embind_register_smart_ptr(rawType, rawPointeeType, name, sharingPolicy, getPointeeSignature, rawGetPointee, constructorSignature, rawConstructor, shareSignature, rawShare, destructorSignature, rawDestructor) {
    name = readLatin1String(name);
    rawGetPointee = embind__requireFunction(getPointeeSignature, rawGetPointee);
    rawConstructor = embind__requireFunction(constructorSignature, rawConstructor);
    rawShare = embind__requireFunction(shareSignature, rawShare);
    rawDestructor = embind__requireFunction(destructorSignature, rawDestructor);
    whenDependentTypesAreResolved([rawType], [rawPointeeType], function (pointeeType) {
        pointeeType = pointeeType[0];
        var registeredPointer = new RegisteredPointer(name, pointeeType.registeredClass, false, false, true, pointeeType, sharingPolicy, rawGetPointee, rawConstructor, rawShare, rawDestructor);
        return [registeredPointer]
    })
}

function __embind_register_std_string(rawType, name) {
    name = readLatin1String(name);
    var stdStringIsUTF8 = name === "std::string";
    registerType(rawType, {
        name: name,
        "fromWireType": function (value) {
            var length = HEAPU32[value >> 2];
            var str;
            if (stdStringIsUTF8) {
                var decodeStartPtr = value + 4;
                for (var i = 0; i <= length; ++i) {
                    var currentBytePtr = value + 4 + i;
                    if (HEAPU8[currentBytePtr] == 0 || i == length) {
                        var maxRead = currentBytePtr - decodeStartPtr;
                        var stringSegment = UTF8ToString(decodeStartPtr, maxRead);
                        if (str === undefined) {
                            str = stringSegment
                        } else {
                            str += String.fromCharCode(0);
                            str += stringSegment
                        }
                        decodeStartPtr = currentBytePtr + 1
                    }
                }
            } else {
                var a = new Array(length);
                for (var i = 0; i < length; ++i) {
                    a[i] = String.fromCharCode(HEAPU8[value + 4 + i])
                }
                str = a.join("")
            }
            _free(value);
            return str
        },
        "toWireType": function (destructors, value) {
            if (value instanceof ArrayBuffer) {
                value = new Uint8Array(value)
            }
            var getLength;
            var valueIsOfTypeString = typeof value === "string";
            if (!(valueIsOfTypeString || value instanceof Uint8Array || value instanceof Uint8ClampedArray || value instanceof Int8Array)) {
                throwBindingError("Cannot pass non-string to std::string")
            }
            if (stdStringIsUTF8 && valueIsOfTypeString) {
                getLength = function () {
                    return lengthBytesUTF8(value)
                }
            } else {
                getLength = function () {
                    return value.length
                }
            }
            var length = getLength();
            var ptr = _malloc(4 + length + 1);
            HEAPU32[ptr >> 2] = length;
            if (stdStringIsUTF8 && valueIsOfTypeString) {
                stringToUTF8(value, ptr + 4, length + 1)
            } else {
                if (valueIsOfTypeString) {
                    for (var i = 0; i < length; ++i) {
                        var charCode = value.charCodeAt(i);
                        if (charCode > 255) {
                            _free(ptr);
                            throwBindingError("String has UTF-16 code units that do not fit in 8 bits")
                        }
                        HEAPU8[ptr + 4 + i] = charCode
                    }
                } else {
                    for (var i = 0; i < length; ++i) {
                        HEAPU8[ptr + 4 + i] = value[i]
                    }
                }
            }
            if (destructors !== null) {
                destructors.push(_free, ptr)
            }
            return ptr
        },
        "argPackAdvance": 8,
        "readValueFromPointer": simpleReadValueFromPointer,
        destructorFunction: function (ptr) {
            _free(ptr)
        }
    })
}

function __embind_register_std_wstring(rawType, charSize, name) {
    name = readLatin1String(name);
    var decodeString,
        encodeString,
        getHeap,
        lengthBytesUTF,
        shift;
    if (charSize === 2) {
        decodeString = UTF16ToString;
        encodeString = stringToUTF16;
        lengthBytesUTF = lengthBytesUTF16;
        getHeap = function () {
            return HEAPU16
        };
        shift = 1
    } else if (charSize === 4) {
        decodeString = UTF32ToString;
        encodeString = stringToUTF32;
        lengthBytesUTF = lengthBytesUTF32;
        getHeap = function () {
            return HEAPU32
        };
        shift = 2
    }
    registerType(rawType, {
        name: name,
        "fromWireType": function (value) {
            var length = HEAPU32[value >> 2];
            var HEAP = getHeap();
            var str;
            var decodeStartPtr = value + 4;
            for (var i = 0; i <= length; ++i) {
                var currentBytePtr = value + 4 + i * charSize;
                if (HEAP[currentBytePtr >> shift] == 0 || i == length) {
                    var maxReadBytes = currentBytePtr - decodeStartPtr;
                    var stringSegment = decodeString(decodeStartPtr, maxReadBytes);
                    if (str === undefined) {
                        str = stringSegment
                    } else {
                        str += String.fromCharCode(0);
                        str += stringSegment
                    }
                    decodeStartPtr = currentBytePtr + charSize
                }
            }
            _free(value);
            return str
        },
        "toWireType": function (destructors, value) {
            if (!(typeof value === "string")) {
                throwBindingError("Cannot pass non-string to C++ string type " + name)
            }
            var length = lengthBytesUTF(value);
            var ptr = _malloc(4 + length + charSize);
            HEAPU32[ptr >> 2] = length >> shift;
            encodeString(value, ptr + 4, length + charSize);
            if (destructors !== null) {
                destructors.push(_free, ptr)
            }
            return ptr
        },
        "argPackAdvance": 8,
        "readValueFromPointer": simpleReadValueFromPointer,
        destructorFunction: function (ptr) {
            _free(ptr)
        }
    })
}

function __embind_register_value_array(rawType, name, constructorSignature, rawConstructor, destructorSignature, rawDestructor) {
    tupleRegistrations[rawType] = {
        name: readLatin1String(name),
        rawConstructor: embind__requireFunction(constructorSignature, rawConstructor),
        rawDestructor: embind__requireFunction(destructorSignature, rawDestructor),
        elements: []
    }
}

function __embind_register_value_array_element(rawTupleType, getterReturnType, getterSignature, getter, getterContext, setterArgumentType, setterSignature, setter, setterContext) {
    tupleRegistrations[rawTupleType].elements.push({
        getterReturnType: getterReturnType,
        getter: embind__requireFunction(getterSignature, getter),
        getterContext: getterContext,
        setterArgumentType: setterArgumentType,
        setter: embind__requireFunction(setterSignature, setter),
        setterContext: setterContext
    })
}

function __embind_register_value_object(rawType, name, constructorSignature, rawConstructor, destructorSignature, rawDestructor) {
    structRegistrations[rawType] = {
        name: readLatin1String(name),
        rawConstructor: embind__requireFunction(constructorSignature, rawConstructor),
        rawDestructor: embind__requireFunction(destructorSignature, rawDestructor),
        fields: []
    }
}

function __embind_register_value_object_field(structType, fieldName, getterReturnType, getterSignature, getter, getterContext, setterArgumentType, setterSignature, setter, setterContext) {
    structRegistrations[structType].fields.push({
        fieldName: readLatin1String(fieldName),
        getterReturnType: getterReturnType,
        getter: embind__requireFunction(getterSignature, getter),
        getterContext: getterContext,
        setterArgumentType: setterArgumentType,
        setter: embind__requireFunction(setterSignature, setter),
        setterContext: setterContext
    })
}

function __embind_register_void(rawType, name) {
    name = readLatin1String(name);
    registerType(rawType, {
        isVoid: true,
        name: name,
        "argPackAdvance": 0,
        "fromWireType": function () {
            return undefined
        },
        "toWireType": function (destructors, o) {
            return undefined
        }
    })
}

function requireHandle(handle) {
    if (!handle) {
        throwBindingError("Cannot use deleted val. handle = " + handle)
    }
    return emval_handle_array[handle].value
}

function requireRegisteredType(rawType, humanName) {
    var impl = registeredTypes[rawType];
    if (undefined === impl) {
        throwBindingError(humanName + " has unknown type " + getTypeName(rawType))
    }
    return impl
}

function __emval_as(handle, returnType, destructorsRef) {
    handle = requireHandle(handle);
    returnType = requireRegisteredType(returnType, "emval::as");
    var destructors = [];
    var rd = __emval_register(destructors);
    HEAP32[destructorsRef >> 2] = rd;
    return returnType["toWireType"](destructors, handle)
}
var emval_symbols = {};

function getStringOrSymbol(address) {
    var symbol = emval_symbols[address];
    if (symbol === undefined) {
        return readLatin1String(address)
    } else {
        return symbol
    }
}
var emval_methodCallers = [];

function __emval_call_void_method(caller, handle, methodName, args) {
    caller = emval_methodCallers[caller];
    handle = requireHandle(handle);
    methodName = getStringOrSymbol(methodName);
    caller(handle, methodName, null, args)
}

function __emval_addMethodCaller(caller) {
    var id = emval_methodCallers.length;
    emval_methodCallers.push(caller);
    return id
}

function __emval_lookupTypes(argCount, argTypes) {
    var a = new Array(argCount);
    for (var i = 0; i < argCount; ++i) {
        a[i] = requireRegisteredType(HEAP32[(argTypes >> 2) + i], "parameter " + i)
    }
    return a
}

function __emval_get_method_caller(argCount, argTypes) {
    var types = __emval_lookupTypes(argCount, argTypes);
    var retType = types[0];
    var signatureName = retType.name + "_$" + types.slice(1).map(function (t) {
        return t.name
    }).join("_") + "$";
    var params = ["retType"];
    var args = [retType];
    var argsList = "";
    for (var i = 0; i < argCount - 1; ++i) {
        argsList += (i !== 0 ? ", " : "") + "arg" + i;
        params.push("argType" + i);
        args.push(types[1 + i])
    }
    var functionName = makeLegalFunctionName("methodCaller_" + signatureName);
    var functionBody = "return function " + functionName + "(handle, name, destructors, args) {\n";
    var offset = 0;
    for (var i = 0; i < argCount - 1; ++i) {
        functionBody += "    var arg" + i + " = argType" + i + ".readValueFromPointer(args" + (offset ? "+" + offset : "") + ");\n";
        offset += types[i + 1]["argPackAdvance"]
    }
    functionBody += "    var rv = handle[name](" + argsList + ");\n";
    for (var i = 0; i < argCount - 1; ++i) {
        if (types[i + 1]["deleteObject"]) {
            functionBody += "    argType" + i + ".deleteObject(arg" + i + ");\n"
        }
    }
    if (!retType.isVoid) {
        functionBody += "    return retType.toWireType(destructors, rv);\n"
    }
    functionBody += "};\n";
    params.push(functionBody);
    console.log(functionBody);
    //TODO....
    var anonymous = function (retType, argType0, argType1, argType2, argType3, argType4, argType5, argType6, argType7, argType8, argType9) {
        var parentargs = Array.from(arguments);
        return this[makeLegalFunctionName("methodCaller_" + signatureName)] = function (handle, name, destructors, args) {
            var args = Array.from(arguments);
            var argsList = [];
            for (var i = 0; i < argCount - 1; ++i) {
                argsList.push("arg" + i);
                params.push("argType" + i);
                args.push(types[1 + i])
            }
            var rv = handle[name](...argsList);

            for (var i = 0; i < argCount - 1; ++i) {
                if (types[i + 1]["deleteObject"]) {
                    this["argType" + i].deleteObject(...["arg" + i]);
                }
            }

            return retType.toWireType(destructors, rv);
        }
    }


    var invokerFunction = anonymous.apply(null, args);
    return __emval_addMethodCaller(invokerFunction)
}

function __emval_get_property(handle, key) {
    handle = requireHandle(handle);
    key = requireHandle(key);
    return __emval_register(handle[key])
}

function __emval_incref(handle) {
    if (handle > 4) {
        emval_handle_array[handle].refcount += 1
    }
}

function __emval_new_array() {
    return __emval_register([])
}

function __emval_new_cstring(v) {
    return __emval_register(getStringOrSymbol(v))
}

function __emval_run_destructors(handle) {
    var destructors = emval_handle_array[handle].value;
    runDestructors(destructors);
    __emval_decref(handle)
}

function __emval_set_property(handle, key, value) {
    handle = requireHandle(handle);
    key = requireHandle(key);
    value = requireHandle(value);
    handle[key] = value
}

function __emval_take_value(type, argv) {
    type = requireRegisteredType(type, "_emval_take_value");
    var v = type["readValueFromPointer"](argv);
    return __emval_register(v)
}

function _abort() {
    abort()
}

function _emscripten_get_sbrk_ptr() {
    return 1244912
}

function _emscripten_memcpy_big(dest, src, num) {
    HEAPU8.copyWithin(dest, src, src + num)
}

function _emscripten_get_heap_size() {
    return HEAPU8.length
}

function emscripten_realloc_buffer(size) {
    try {
        wasmMemory.grow(size - buffer.byteLength + 65535 >>> 16);
        updateGlobalBufferAndViews(wasmMemory.buffer);
        return 1
    } catch (e) {}
}

function _emscripten_resize_heap(requestedSize) {
    requestedSize = requestedSize >>> 0;
    var oldSize = _emscripten_get_heap_size();
    var PAGE_MULTIPLE = 65536;
    var maxHeapSize = 1073741824;
    if (requestedSize > maxHeapSize) {
        return false
    }
    var minHeapSize = 16777216;
    for (var cutDown = 1; cutDown <= 4; cutDown *= 2) {
        var overGrownHeapSize = oldSize * (1 + .2 / cutDown);
        overGrownHeapSize = Math.min(overGrownHeapSize, requestedSize + 100663296);
        var newSize = Math.min(maxHeapSize, alignUp(Math.max(minHeapSize, requestedSize, overGrownHeapSize), PAGE_MULTIPLE));
        var replacement = emscripten_realloc_buffer(newSize);
        if (replacement) {
            return true
        }
    }
    return false
}
var ENV = {};

function __getExecutableName() {
    return thisProgram || "./this.program"
}

function getEnvStrings() {
    if (!getEnvStrings.strings) {
        var env = {
            "USER": "web_user",
            "LOGNAME": "web_user",
            "PATH": "/",
            "PWD": "/",
            "HOME": "/home/web_user",
            "LANG": (typeof navigator === "object" && navigator.languages && navigator.languages[0] || "C").replace("-", "_") + ".UTF-8",
            "_": __getExecutableName()
        };
        for (var x in ENV) {
            env[x] = ENV[x]
        }
        var strings = [];
        for (var x in env) {
            strings.push(x + "=" + env[x])
        }
        getEnvStrings.strings = strings
    }
    return getEnvStrings.strings
}

function _environ_get(__environ, environ_buf) {
    var bufSize = 0;
    getEnvStrings().forEach(function (string, i) {
        var ptr = environ_buf + bufSize;
        HEAP32[__environ + i * 4 >> 2] = ptr;
        writeAsciiToMemory(string, ptr);
        bufSize += string.length + 1
    });
    return 0
}

function _environ_sizes_get(penviron_count, penviron_buf_size) {
    var strings = getEnvStrings();
    HEAP32[penviron_count >> 2] = strings.length;
    var bufSize = 0;
    strings.forEach(function (string) {
        bufSize += string.length + 1
    });
    HEAP32[penviron_buf_size >> 2] = bufSize;
    return 0
}

function _fd_close(fd) {
    try {
        var stream = SYSCALLS.getStreamFromFD(fd);
        FS.close(stream);
        return 0
    } catch (e) {
        if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError))
            abort(e);
        return e.errno
    }
}

function _fd_read(fd, iov, iovcnt, pnum) {
    try {
        var stream = SYSCALLS.getStreamFromFD(fd);
        var num = SYSCALLS.doReadv(stream, iov, iovcnt);
        HEAP32[pnum >> 2] = num;
        return 0
    } catch (e) {
        console.log(e);
        if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError))
            abort(e);
        return e.errno
    }
}

function _fd_seek(fd, offset_low, offset_high, whence, newOffset) {
    try {
        var stream = SYSCALLS.getStreamFromFD(fd);
        var HIGH_OFFSET = 4294967296;
        var offset = offset_high * HIGH_OFFSET + (offset_low >>> 0);
        var DOUBLE_LIMIT = 9007199254740992;
        if (offset <= -DOUBLE_LIMIT || offset >= DOUBLE_LIMIT) {
            return -61
        }
        FS.llseek(stream, offset, whence);
        tempI64 = [0 >>> 0, (tempDouble = stream.position, +Math_abs(tempDouble) >= 1 ? tempDouble > stream.position ? (Math_min(+Math_floor(tempDouble / 4294967296), 4294967295) | 0) >>> 0 : ~~+Math_ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0)],
            HEAP32[newOffset >> 2] = tempI64[0],
            HEAP32[newOffset + 4 >> 2] = tempI64[1];
        if (stream.getdents && offset === 0 && whence === 0)
            stream.getdents = null;
        return 0
    } catch (e) {
        if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError))
            abort(e);
        return e.errno
    }
}

function _fd_write(fd, iov, iovcnt, pnum) {
    try {
        var stream = SYSCALLS.getStreamFromFD(fd);
        var num = SYSCALLS.doWritev(stream, iov, iovcnt);
        HEAP32[pnum >> 2] = num;
        return 0
    } catch (e) {
        if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError))
            abort(e);
        return e.errno
    }
}

function _gettimeofday(ptr) {
    var now = Date.now();
    HEAP32[ptr >> 2] = now / 1e3 | 0;
    HEAP32[ptr + 4 >> 2] = now % 1e3 * 1e3 | 0;
    return 0
}

function _pthread_mutexattr_destroy() {}

function _pthread_mutexattr_init() {}

function _pthread_mutexattr_settype() {}

function _setTempRet0($i) {
    setTempRet0($i | 0)
}

function _strftime_l(s, maxsize, format, tm) {
    return _strftime(s, maxsize, format, tm)
}

function _sysconf(name) {
    switch (name) {
        case 30:
            return 16384;
        case 85:
            var maxHeapSize = 1073741824;
            return maxHeapSize / 16384;
        case 132:
        case 133:
        case 12:
        case 137:
        case 138:
        case 15:
        case 235:
        case 16:
        case 17:
        case 18:
        case 19:
        case 20:
        case 149:
        case 13:
        case 10:
        case 236:
        case 153:
        case 9:
        case 21:
        case 22:
        case 159:
        case 154:
        case 14:
        case 77:
        case 78:
        case 139:
        case 80:
        case 81:
        case 82:
        case 68:
        case 67:
        case 164:
        case 11:
        case 29:
        case 47:
        case 48:
        case 95:
        case 52:
        case 51:
        case 46:
        case 79:
            return 200809;
        case 27:
        case 246:
        case 127:
        case 128:
        case 23:
        case 24:
        case 160:
        case 161:
        case 181:
        case 182:
        case 242:
        case 183:
        case 184:
        case 243:
        case 244:
        case 245:
        case 165:
        case 178:
        case 179:
        case 49:
        case 50:
        case 168:
        case 169:
        case 175:
        case 170:
        case 171:
        case 172:
        case 97:
        case 76:
        case 32:
        case 173:
        case 35:
            return -1;
        case 176:
        case 177:
        case 7:
        case 155:
        case 8:
        case 157:
        case 125:
        case 126:
        case 92:
        case 93:
        case 129:
        case 130:
        case 131:
        case 94:
        case 91:
            return 1;
        case 74:
        case 60:
        case 69:
        case 70:
        case 4:
            return 1024;
        case 31:
        case 42:
        case 72:
            return 32;
        case 87:
        case 26:
        case 33:
            return 2147483647;
        case 34:
        case 1:
            return 47839;
        case 38:
        case 36:
            return 99;
        case 43:
        case 37:
            return 2048;
        case 0:
            return 2097152;
        case 3:
            return 65536;
        case 28:
            return 32768;
        case 44:
            return 32767;
        case 75:
            return 16384;
        case 39:
            return 1e3;
        case 89:
            return 700;
        case 71:
            return 256;
        case 40:
            return 255;
        case 2:
            return 100;
        case 180:
            return 64;
        case 25:
            return 20;
        case 5:
            return 16;
        case 6:
            return 6;
        case 73:
            return 4;
        case 84: {
            if (typeof navigator === "object")
                return navigator["hardwareConcurrency"] || 1;
            return 1
        }
    }
    setErrNo(28);
    return -1
}
InternalError = Module["InternalError"] = extendError(Error, "InternalError");
embind_init_charCodes();
BindingError = Module["BindingError"] = extendError(Error, "BindingError");
init_ClassHandle();
init_RegisteredPointer();
init_embind();
UnboundTypeError = Module["UnboundTypeError"] = extendError(Error, "UnboundTypeError");
init_emval();
var asmLibraryArg = {
    "__cxa_allocate_exception": ___cxa_allocate_exception,
    "__cxa_atexit": ___cxa_atexit,
    "__cxa_throw": ___cxa_throw,
    "__map_file": ___map_file,
    "__sys_fcntl64": ___sys_fcntl64,
    "__sys_ioctl": ___sys_ioctl,
    "__sys_munmap": ___sys_munmap,
    "__sys_open": ___sys_open,
    "__sys_read": ___sys_read,
    "_embind_finalize_value_array": __embind_finalize_value_array,
    "_embind_finalize_value_object": __embind_finalize_value_object,
    "_embind_register_bool": __embind_register_bool,
    "_embind_register_class": __embind_register_class,
    "_embind_register_class_class_function": __embind_register_class_class_function,
    "_embind_register_class_constructor": __embind_register_class_constructor,
    "_embind_register_class_function": __embind_register_class_function,
    "_embind_register_class_property": __embind_register_class_property,
    "_embind_register_constant": __embind_register_constant,
    "_embind_register_emval": __embind_register_emval,
    "_embind_register_float": __embind_register_float,
    "_embind_register_function": __embind_register_function,
    "_embind_register_integer": __embind_register_integer,
    "_embind_register_memory_view": __embind_register_memory_view,
    "_embind_register_smart_ptr": __embind_register_smart_ptr,
    "_embind_register_std_string": __embind_register_std_string,
    "_embind_register_std_wstring": __embind_register_std_wstring,
    "_embind_register_value_array": __embind_register_value_array,
    "_embind_register_value_array_element": __embind_register_value_array_element,
    "_embind_register_value_object": __embind_register_value_object,
    "_embind_register_value_object_field": __embind_register_value_object_field,
    "_embind_register_void": __embind_register_void,
    "_emval_as": __emval_as,
    "_emval_call_void_method": __emval_call_void_method,
    "_emval_decref": __emval_decref,
    "_emval_get_method_caller": __emval_get_method_caller,
    "_emval_get_property": __emval_get_property,
    "_emval_incref": __emval_incref,
    "_emval_new_array": __emval_new_array,
    "_emval_new_cstring": __emval_new_cstring,
    "_emval_run_destructors": __emval_run_destructors,
    "_emval_set_property": __emval_set_property,
    "_emval_take_value": __emval_take_value,
    "abort": _abort,
    "emscripten_get_sbrk_ptr": _emscripten_get_sbrk_ptr,
    "emscripten_memcpy_big": _emscripten_memcpy_big,
    "emscripten_resize_heap": _emscripten_resize_heap,
    "environ_get": _environ_get,
    "environ_sizes_get": _environ_sizes_get,
    "fd_close": _fd_close,
    "fd_read": _fd_read,
    "fd_seek": _fd_seek,
    "fd_write": _fd_write,
    "gettimeofday": _gettimeofday,
    "memory": wasmMemory,
    "pthread_mutexattr_destroy": _pthread_mutexattr_destroy,
    "pthread_mutexattr_init": _pthread_mutexattr_init,
    "pthread_mutexattr_settype": _pthread_mutexattr_settype,
    "setTempRet0": _setTempRet0,
    "strftime_l": _strftime_l,
    "sysconf": _sysconf,
    "table": wasmTable
};
var asm = {};
Module["asm"] = asm;
var ___wasm_call_ctors = Module["___wasm_call_ctors"] = function () {
    return (___wasm_call_ctors = Module["___wasm_call_ctors"] = Module["asm"]["__wasm_call_ctors"]).apply(null, arguments)
};
var _malloc = Module["_malloc"] = function () {
    return (_malloc = Module["_malloc"] = Module["asm"]["malloc"]).apply(null, arguments)
};
var _free = Module["_free"] = function () {
    return (_free = Module["_free"] = Module["asm"]["free"]).apply(null, arguments)
};
var ___errno_location = Module["___errno_location"] = function () {
    return (___errno_location = Module["___errno_location"] = Module["asm"]["__errno_location"]).apply(null, arguments)
};
var ___getTypeName = Module["___getTypeName"] = function () {
    return (___getTypeName = Module["___getTypeName"] = Module["asm"]["__getTypeName"]).apply(null, arguments)
};
var ___embind_register_native_and_builtin_types = Module["___embind_register_native_and_builtin_types"] = function () {
    return (___embind_register_native_and_builtin_types = Module["___embind_register_native_and_builtin_types"] = Module["asm"]["__embind_register_native_and_builtin_types"]).apply(null, arguments)
};
var _setThrew = Module["_setThrew"] = function () {
    return (_setThrew = Module["_setThrew"] = Module["asm"]["setThrew"]).apply(null, arguments)
};
var ___cxa_demangle = Module["___cxa_demangle"] = function () {
    return (___cxa_demangle = Module["___cxa_demangle"] = Module["asm"]["__cxa_demangle"]).apply(null, arguments)
};
var _emscripten_main_thread_process_queued_calls = Module["_emscripten_main_thread_process_queued_calls"] = function () {
    return (_emscripten_main_thread_process_queued_calls = Module["_emscripten_main_thread_process_queued_calls"] = Module["asm"]["emscripten_main_thread_process_queued_calls"]).apply(null, arguments)
};
var stackSave = Module["stackSave"] = function () {
    return (stackSave = Module["stackSave"] = Module["asm"]["stackSave"]).apply(null, arguments)
};
var stackAlloc = Module["stackAlloc"] = function () {
    return (stackAlloc = Module["stackAlloc"] = Module["asm"]["stackAlloc"]).apply(null, arguments)
};
var stackRestore = Module["stackRestore"] = function () {
    return (stackRestore = Module["stackRestore"] = Module["asm"]["stackRestore"]).apply(null, arguments)
};
var __growWasmMemory = Module["__growWasmMemory"] = function () {
    return (__growWasmMemory = Module["__growWasmMemory"] = Module["asm"]["__growWasmMemory"]).apply(null, arguments)
};
var dynCall_ii = Module["dynCall_ii"] = function () {
    return (dynCall_ii = Module["dynCall_ii"] = Module["asm"]["dynCall_ii"]).apply(null, arguments)
};
var dynCall_vi = Module["dynCall_vi"] = function () {
    return (dynCall_vi = Module["dynCall_vi"] = Module["asm"]["dynCall_vi"]).apply(null, arguments)
};
var dynCall_i = Module["dynCall_i"] = function () {
    return (dynCall_i = Module["dynCall_i"] = Module["asm"]["dynCall_i"]).apply(null, arguments)
};
var dynCall_iii = Module["dynCall_iii"] = function () {
    return (dynCall_iii = Module["dynCall_iii"] = Module["asm"]["dynCall_iii"]).apply(null, arguments)
};
var dynCall_iiii = Module["dynCall_iiii"] = function () {
    return (dynCall_iiii = Module["dynCall_iiii"] = Module["asm"]["dynCall_iiii"]).apply(null, arguments)
};
var dynCall_iiiii = Module["dynCall_iiiii"] = function () {
    return (dynCall_iiiii = Module["dynCall_iiiii"] = Module["asm"]["dynCall_iiiii"]).apply(null, arguments)
};
var dynCall_iiiiii = Module["dynCall_iiiiii"] = function () {
    return (dynCall_iiiiii = Module["dynCall_iiiiii"] = Module["asm"]["dynCall_iiiiii"]).apply(null, arguments)
};
var dynCall_iiiiiii = Module["dynCall_iiiiiii"] = function () {
    return (dynCall_iiiiiii = Module["dynCall_iiiiiii"] = Module["asm"]["dynCall_iiiiiii"]).apply(null, arguments)
};
var dynCall_viii = Module["dynCall_viii"] = function () {
    return (dynCall_viii = Module["dynCall_viii"] = Module["asm"]["dynCall_viii"]).apply(null, arguments)
};
var dynCall_viiii = Module["dynCall_viiii"] = function () {
    return (dynCall_viiii = Module["dynCall_viiii"] = Module["asm"]["dynCall_viiii"]).apply(null, arguments)
};
var dynCall_vii = Module["dynCall_vii"] = function () {
    return (dynCall_vii = Module["dynCall_vii"] = Module["asm"]["dynCall_vii"]).apply(null, arguments)
};
var dynCall_viiidd = Module["dynCall_viiidd"] = function () {
    return (dynCall_viiidd = Module["dynCall_viiidd"] = Module["asm"]["dynCall_viiidd"]).apply(null, arguments)
};
var dynCall_viiiidd = Module["dynCall_viiiidd"] = function () {
    return (dynCall_viiiidd = Module["dynCall_viiiidd"] = Module["asm"]["dynCall_viiiidd"]).apply(null, arguments)
};
var dynCall_viiid = Module["dynCall_viiid"] = function () {
    return (dynCall_viiid = Module["dynCall_viiid"] = Module["asm"]["dynCall_viiid"]).apply(null, arguments)
};
var dynCall_viiiid = Module["dynCall_viiiid"] = function () {
    return (dynCall_viiiid = Module["dynCall_viiiid"] = Module["asm"]["dynCall_viiiid"]).apply(null, arguments)
};
var dynCall_viiiii = Module["dynCall_viiiii"] = function () {
    return (dynCall_viiiii = Module["dynCall_viiiii"] = Module["asm"]["dynCall_viiiii"]).apply(null, arguments)
};
var dynCall_dii = Module["dynCall_dii"] = function () {
    return (dynCall_dii = Module["dynCall_dii"] = Module["asm"]["dynCall_dii"]).apply(null, arguments)
};
var dynCall_diii = Module["dynCall_diii"] = function () {
    return (dynCall_diii = Module["dynCall_diii"] = Module["asm"]["dynCall_diii"]).apply(null, arguments)
};
var dynCall_iiiid = Module["dynCall_iiiid"] = function () {
    return (dynCall_iiiid = Module["dynCall_iiiid"] = Module["asm"]["dynCall_iiiid"]).apply(null, arguments)
};
var dynCall_fiii = Module["dynCall_fiii"] = function () {
    return (dynCall_fiii = Module["dynCall_fiii"] = Module["asm"]["dynCall_fiii"]).apply(null, arguments)
};
var dynCall_fiiii = Module["dynCall_fiiii"] = function () {
    return (dynCall_fiiii = Module["dynCall_fiiii"] = Module["asm"]["dynCall_fiiii"]).apply(null, arguments)
};
var dynCall_fiiiii = Module["dynCall_fiiiii"] = function () {
    return (dynCall_fiiiii = Module["dynCall_fiiiii"] = Module["asm"]["dynCall_fiiiii"]).apply(null, arguments)
};
var dynCall_diiiii = Module["dynCall_diiiii"] = function () {
    return (dynCall_diiiii = Module["dynCall_diiiii"] = Module["asm"]["dynCall_diiiii"]).apply(null, arguments)
};
var dynCall_diiii = Module["dynCall_diiii"] = function () {
    return (dynCall_diiii = Module["dynCall_diiii"] = Module["asm"]["dynCall_diiii"]).apply(null, arguments)
};
var dynCall_viid = Module["dynCall_viid"] = function () {
    return (dynCall_viid = Module["dynCall_viid"] = Module["asm"]["dynCall_viid"]).apply(null, arguments)
};
var dynCall_fii = Module["dynCall_fii"] = function () {
    return (dynCall_fii = Module["dynCall_fii"] = Module["asm"]["dynCall_fii"]).apply(null, arguments)
};
var dynCall_viif = Module["dynCall_viif"] = function () {
    return (dynCall_viif = Module["dynCall_viif"] = Module["asm"]["dynCall_viif"]).apply(null, arguments)
};
var dynCall_iiiiiiiiii = Module["dynCall_iiiiiiiiii"] = function () {
    return (dynCall_iiiiiiiiii = Module["dynCall_iiiiiiiiii"] = Module["asm"]["dynCall_iiiiiiiiii"]).apply(null, arguments)
};
var dynCall_iiiiiiiii = Module["dynCall_iiiiiiiii"] = function () {
    return (dynCall_iiiiiiiii = Module["dynCall_iiiiiiiii"] = Module["asm"]["dynCall_iiiiiiiii"]).apply(null, arguments)
};
var dynCall_iiiiiiii = Module["dynCall_iiiiiiii"] = function () {
    return (dynCall_iiiiiiii = Module["dynCall_iiiiiiii"] = Module["asm"]["dynCall_iiiiiiii"]).apply(null, arguments)
};
var dynCall_viiif = Module["dynCall_viiif"] = function () {
    return (dynCall_viiif = Module["dynCall_viiif"] = Module["asm"]["dynCall_viiif"]).apply(null, arguments)
};
var dynCall_iiiif = Module["dynCall_iiiif"] = function () {
    return (dynCall_iiiif = Module["dynCall_iiiif"] = Module["asm"]["dynCall_iiiif"]).apply(null, arguments)
};
var dynCall_viiiddii = Module["dynCall_viiiddii"] = function () {
    return (dynCall_viiiddii = Module["dynCall_viiiddii"] = Module["asm"]["dynCall_viiiddii"]).apply(null, arguments)
};
var dynCall_viiddii = Module["dynCall_viiddii"] = function () {
    return (dynCall_viiddii = Module["dynCall_viiddii"] = Module["asm"]["dynCall_viiddii"]).apply(null, arguments)
};
var dynCall_viiiddi = Module["dynCall_viiiddi"] = function () {
    return (dynCall_viiiddi = Module["dynCall_viiiddi"] = Module["asm"]["dynCall_viiiddi"]).apply(null, arguments)
};
var dynCall_viiddi = Module["dynCall_viiddi"] = function () {
    return (dynCall_viiddi = Module["dynCall_viiddi"] = Module["asm"]["dynCall_viiddi"]).apply(null, arguments)
};
var dynCall_viidd = Module["dynCall_viidd"] = function () {
    return (dynCall_viidd = Module["dynCall_viidd"] = Module["asm"]["dynCall_viidd"]).apply(null, arguments)
};
var dynCall_viiiiddi = Module["dynCall_viiiiddi"] = function () {
    return (dynCall_viiiiddi = Module["dynCall_viiiiddi"] = Module["asm"]["dynCall_viiiiddi"]).apply(null, arguments)
};
var dynCall_viiiiddddii = Module["dynCall_viiiiddddii"] = function () {
    return (dynCall_viiiiddddii = Module["dynCall_viiiiddddii"] = Module["asm"]["dynCall_viiiiddddii"]).apply(null, arguments)
};
var dynCall_viiiddddii = Module["dynCall_viiiddddii"] = function () {
    return (dynCall_viiiddddii = Module["dynCall_viiiddddii"] = Module["asm"]["dynCall_viiiddddii"]).apply(null, arguments)
};
var dynCall_viiiiddddi = Module["dynCall_viiiiddddi"] = function () {
    return (dynCall_viiiiddddi = Module["dynCall_viiiiddddi"] = Module["asm"]["dynCall_viiiiddddi"]).apply(null, arguments)
};
var dynCall_viiiddddi = Module["dynCall_viiiddddi"] = function () {
    return (dynCall_viiiddddi = Module["dynCall_viiiddddi"] = Module["asm"]["dynCall_viiiddddi"]).apply(null, arguments)
};
var dynCall_viiiidddd = Module["dynCall_viiiidddd"] = function () {
    return (dynCall_viiiidddd = Module["dynCall_viiiidddd"] = Module["asm"]["dynCall_viiiidddd"]).apply(null, arguments)
};
var dynCall_viiidddd = Module["dynCall_viiidddd"] = function () {
    return (dynCall_viiidddd = Module["dynCall_viiidddd"] = Module["asm"]["dynCall_viiidddd"]).apply(null, arguments)
};
var dynCall_viiiiddd = Module["dynCall_viiiiddd"] = function () {
    return (dynCall_viiiiddd = Module["dynCall_viiiiddd"] = Module["asm"]["dynCall_viiiiddd"]).apply(null, arguments)
};
var dynCall_viiiddd = Module["dynCall_viiiddd"] = function () {
    return (dynCall_viiiddd = Module["dynCall_viiiddd"] = Module["asm"]["dynCall_viiiddd"]).apply(null, arguments)
};
var dynCall_viiiddidddd = Module["dynCall_viiiddidddd"] = function () {
    return (dynCall_viiiddidddd = Module["dynCall_viiiddidddd"] = Module["asm"]["dynCall_viiiddidddd"]).apply(null, arguments)
};
var dynCall_viiddidddd = Module["dynCall_viiddidddd"] = function () {
    return (dynCall_viiddidddd = Module["dynCall_viiddidddd"] = Module["asm"]["dynCall_viiddidddd"]).apply(null, arguments)
};
var dynCall_viiiddiddd = Module["dynCall_viiiddiddd"] = function () {
    return (dynCall_viiiddiddd = Module["dynCall_viiiddiddd"] = Module["asm"]["dynCall_viiiddiddd"]).apply(null, arguments)
};
var dynCall_viiddiddd = Module["dynCall_viiddiddd"] = function () {
    return (dynCall_viiddiddd = Module["dynCall_viiddiddd"] = Module["asm"]["dynCall_viiddiddd"]).apply(null, arguments)
};
var dynCall_viiiddidd = Module["dynCall_viiiddidd"] = function () {
    return (dynCall_viiiddidd = Module["dynCall_viiiddidd"] = Module["asm"]["dynCall_viiiddidd"]).apply(null, arguments)
};
var dynCall_viiddidd = Module["dynCall_viiddidd"] = function () {
    return (dynCall_viiddidd = Module["dynCall_viiddidd"] = Module["asm"]["dynCall_viiddidd"]).apply(null, arguments)
};
var dynCall_viiiddid = Module["dynCall_viiiddid"] = function () {
    return (dynCall_viiiddid = Module["dynCall_viiiddid"] = Module["asm"]["dynCall_viiiddid"]).apply(null, arguments)
};
var dynCall_viiddid = Module["dynCall_viiddid"] = function () {
    return (dynCall_viiddid = Module["dynCall_viiddid"] = Module["asm"]["dynCall_viiddid"]).apply(null, arguments)
};
var dynCall_viiiiiddi = Module["dynCall_viiiiiddi"] = function () {
    return (dynCall_viiiiiddi = Module["dynCall_viiiiiddi"] = Module["asm"]["dynCall_viiiiiddi"]).apply(null, arguments)
};
var dynCall_viiiiidd = Module["dynCall_viiiiidd"] = function () {
    return (dynCall_viiiiidd = Module["dynCall_viiiiidd"] = Module["asm"]["dynCall_viiiiidd"]).apply(null, arguments)
};
var dynCall_viiiiid = Module["dynCall_viiiiid"] = function () {
    return (dynCall_viiiiid = Module["dynCall_viiiiid"] = Module["asm"]["dynCall_viiiiid"]).apply(null, arguments)
};
var dynCall_viiiiiiddi = Module["dynCall_viiiiiiddi"] = function () {
    return (dynCall_viiiiiiddi = Module["dynCall_viiiiiiddi"] = Module["asm"]["dynCall_viiiiiiddi"]).apply(null, arguments)
};
var dynCall_viiiiiidd = Module["dynCall_viiiiiidd"] = function () {
    return (dynCall_viiiiiidd = Module["dynCall_viiiiiidd"] = Module["asm"]["dynCall_viiiiiidd"]).apply(null, arguments)
};
var dynCall_viiiiiid = Module["dynCall_viiiiiid"] = function () {
    return (dynCall_viiiiiid = Module["dynCall_viiiiiid"] = Module["asm"]["dynCall_viiiiiid"]).apply(null, arguments)
};
var dynCall_viiiiii = Module["dynCall_viiiiii"] = function () {
    return (dynCall_viiiiii = Module["dynCall_viiiiii"] = Module["asm"]["dynCall_viiiiii"]).apply(null, arguments)
};
var dynCall_viiiiiiiddi = Module["dynCall_viiiiiiiddi"] = function () {
    return (dynCall_viiiiiiiddi = Module["dynCall_viiiiiiiddi"] = Module["asm"]["dynCall_viiiiiiiddi"]).apply(null, arguments)
};
var dynCall_viiiiiiidd = Module["dynCall_viiiiiiidd"] = function () {
    return (dynCall_viiiiiiidd = Module["dynCall_viiiiiiidd"] = Module["asm"]["dynCall_viiiiiiidd"]).apply(null, arguments)
};
var dynCall_viiiiiiid = Module["dynCall_viiiiiiid"] = function () {
    return (dynCall_viiiiiiid = Module["dynCall_viiiiiiid"] = Module["asm"]["dynCall_viiiiiiid"]).apply(null, arguments)
};
var dynCall_viiiiiii = Module["dynCall_viiiiiii"] = function () {
    return (dynCall_viiiiiii = Module["dynCall_viiiiiii"] = Module["asm"]["dynCall_viiiiiii"]).apply(null, arguments)
};
var dynCall_viiidiiid = Module["dynCall_viiidiiid"] = function () {
    return (dynCall_viiidiiid = Module["dynCall_viiidiiid"] = Module["asm"]["dynCall_viiidiiid"]).apply(null, arguments)
};
var dynCall_viidiiid = Module["dynCall_viidiiid"] = function () {
    return (dynCall_viidiiid = Module["dynCall_viidiiid"] = Module["asm"]["dynCall_viidiiid"]).apply(null, arguments)
};
var dynCall_viididdii = Module["dynCall_viididdii"] = function () {
    return (dynCall_viididdii = Module["dynCall_viididdii"] = Module["asm"]["dynCall_viididdii"]).apply(null, arguments)
};
var dynCall_vididdii = Module["dynCall_vididdii"] = function () {
    return (dynCall_vididdii = Module["dynCall_vididdii"] = Module["asm"]["dynCall_vididdii"]).apply(null, arguments)
};
var dynCall_viididdi = Module["dynCall_viididdi"] = function () {
    return (dynCall_viididdi = Module["dynCall_viididdi"] = Module["asm"]["dynCall_viididdi"]).apply(null, arguments)
};
var dynCall_vididdi = Module["dynCall_vididdi"] = function () {
    return (dynCall_vididdi = Module["dynCall_vididdi"] = Module["asm"]["dynCall_vididdi"]).apply(null, arguments)
};
var dynCall_viiidi = Module["dynCall_viiidi"] = function () {
    return (dynCall_viiidi = Module["dynCall_viiidi"] = Module["asm"]["dynCall_viiidi"]).apply(null, arguments)
};
var dynCall_viidi = Module["dynCall_viidi"] = function () {
    return (dynCall_viidi = Module["dynCall_viidi"] = Module["asm"]["dynCall_viidi"]).apply(null, arguments)
};
var dynCall_viiiiiiii = Module["dynCall_viiiiiiii"] = function () {
    return (dynCall_viiiiiiii = Module["dynCall_viiiiiiii"] = Module["asm"]["dynCall_viiiiiiii"]).apply(null, arguments)
};
var dynCall_viiiidiiiidi = Module["dynCall_viiiidiiiidi"] = function () {
    return (dynCall_viiiidiiiidi = Module["dynCall_viiiidiiiidi"] = Module["asm"]["dynCall_viiiidiiiidi"]).apply(null, arguments)
};
var dynCall_viiidiiiidi = Module["dynCall_viiidiiiidi"] = function () {
    return (dynCall_viiidiiiidi = Module["dynCall_viiidiiiidi"] = Module["asm"]["dynCall_viiidiiiidi"]).apply(null, arguments)
};
var dynCall_viiiiiiiiiiid = Module["dynCall_viiiiiiiiiiid"] = function () {
    return (dynCall_viiiiiiiiiiid = Module["dynCall_viiiiiiiiiiid"] = Module["asm"]["dynCall_viiiiiiiiiiid"]).apply(null, arguments)
};
var dynCall_viiiiiiiiiid = Module["dynCall_viiiiiiiiiid"] = function () {
    return (dynCall_viiiiiiiiiid = Module["dynCall_viiiiiiiiiid"] = Module["asm"]["dynCall_viiiiiiiiiid"]).apply(null, arguments)
};
var dynCall_viiiiiiiiiii = Module["dynCall_viiiiiiiiiii"] = function () {
    return (dynCall_viiiiiiiiiii = Module["dynCall_viiiiiiiiiii"] = Module["asm"]["dynCall_viiiiiiiiiii"]).apply(null, arguments)
};
var dynCall_viiiiiiiiii = Module["dynCall_viiiiiiiiii"] = function () {
    return (dynCall_viiiiiiiiii = Module["dynCall_viiiiiiiiii"] = Module["asm"]["dynCall_viiiiiiiiii"]).apply(null, arguments)
};
var dynCall_viiiiiiiii = Module["dynCall_viiiiiiiii"] = function () {
    return (dynCall_viiiiiiiii = Module["dynCall_viiiiiiiii"] = Module["asm"]["dynCall_viiiiiiiii"]).apply(null, arguments)
};
var dynCall_diiiiiiiiiiiii = Module["dynCall_diiiiiiiiiiiii"] = function () {
    return (dynCall_diiiiiiiiiiiii = Module["dynCall_diiiiiiiiiiiii"] = Module["asm"]["dynCall_diiiiiiiiiiiii"]).apply(null, arguments)
};
var dynCall_diiiiiiiiiiii = Module["dynCall_diiiiiiiiiiii"] = function () {
    return (dynCall_diiiiiiiiiiii = Module["dynCall_diiiiiiiiiiii"] = Module["asm"]["dynCall_diiiiiiiiiiii"]).apply(null, arguments)
};
var dynCall_diiiiiiiiiii = Module["dynCall_diiiiiiiiiii"] = function () {
    return (dynCall_diiiiiiiiiii = Module["dynCall_diiiiiiiiiii"] = Module["asm"]["dynCall_diiiiiiiiiii"]).apply(null, arguments)
};
var dynCall_diiiiiiiiii = Module["dynCall_diiiiiiiiii"] = function () {
    return (dynCall_diiiiiiiiii = Module["dynCall_diiiiiiiiii"] = Module["asm"]["dynCall_diiiiiiiiii"]).apply(null, arguments)
};
var dynCall_di = Module["dynCall_di"] = function () {
    return (dynCall_di = Module["dynCall_di"] = Module["asm"]["dynCall_di"]).apply(null, arguments)
};
var dynCall_viiiiidi = Module["dynCall_viiiiidi"] = function () {
    return (dynCall_viiiiidi = Module["dynCall_viiiiidi"] = Module["asm"]["dynCall_viiiiidi"]).apply(null, arguments)
};
var dynCall_viiiidi = Module["dynCall_viiiidi"] = function () {
    return (dynCall_viiiidi = Module["dynCall_viiiidi"] = Module["asm"]["dynCall_viiiidi"]).apply(null, arguments)
};
var dynCall_vidiii = Module["dynCall_vidiii"] = function () {
    return (dynCall_vidiii = Module["dynCall_vidiii"] = Module["asm"]["dynCall_vidiii"]).apply(null, arguments)
};
var dynCall_vdiii = Module["dynCall_vdiii"] = function () {
    return (dynCall_vdiii = Module["dynCall_vdiii"] = Module["asm"]["dynCall_vdiii"]).apply(null, arguments)
};
var dynCall_vidii = Module["dynCall_vidii"] = function () {
    return (dynCall_vidii = Module["dynCall_vidii"] = Module["asm"]["dynCall_vidii"]).apply(null, arguments)
};
var dynCall_vdii = Module["dynCall_vdii"] = function () {
    return (dynCall_vdii = Module["dynCall_vdii"] = Module["asm"]["dynCall_vdii"]).apply(null, arguments)
};
var dynCall_viiiiiifi = Module["dynCall_viiiiiifi"] = function () {
    return (dynCall_viiiiiifi = Module["dynCall_viiiiiifi"] = Module["asm"]["dynCall_viiiiiifi"]).apply(null, arguments)
};
var dynCall_viiiiifi = Module["dynCall_viiiiifi"] = function () {
    return (dynCall_viiiiifi = Module["dynCall_viiiiifi"] = Module["asm"]["dynCall_viiiiifi"]).apply(null, arguments)
};
var dynCall_viiiiiif = Module["dynCall_viiiiiif"] = function () {
    return (dynCall_viiiiiif = Module["dynCall_viiiiiif"] = Module["asm"]["dynCall_viiiiiif"]).apply(null, arguments)
};
var dynCall_viiiiif = Module["dynCall_viiiiif"] = function () {
    return (dynCall_viiiiif = Module["dynCall_viiiiif"] = Module["asm"]["dynCall_viiiiif"]).apply(null, arguments)
};
var dynCall_viiiidddiiii = Module["dynCall_viiiidddiiii"] = function () {
    return (dynCall_viiiidddiiii = Module["dynCall_viiiidddiiii"] = Module["asm"]["dynCall_viiiidddiiii"]).apply(null, arguments)
};
var dynCall_viiidddiiii = Module["dynCall_viiidddiiii"] = function () {
    return (dynCall_viiidddiiii = Module["dynCall_viiidddiiii"] = Module["asm"]["dynCall_viiidddiiii"]).apply(null, arguments)
};
var dynCall_viiiidddiii = Module["dynCall_viiiidddiii"] = function () {
    return (dynCall_viiiidddiii = Module["dynCall_viiiidddiii"] = Module["asm"]["dynCall_viiiidddiii"]).apply(null, arguments)
};
var dynCall_viiidddiii = Module["dynCall_viiidddiii"] = function () {
    return (dynCall_viiidddiii = Module["dynCall_viiidddiii"] = Module["asm"]["dynCall_viiidddiii"]).apply(null, arguments)
};
var dynCall_viiiidddii = Module["dynCall_viiiidddii"] = function () {
    return (dynCall_viiiidddii = Module["dynCall_viiiidddii"] = Module["asm"]["dynCall_viiiidddii"]).apply(null, arguments)
};
var dynCall_viiidddii = Module["dynCall_viiidddii"] = function () {
    return (dynCall_viiidddii = Module["dynCall_viiidddii"] = Module["asm"]["dynCall_viiidddii"]).apply(null, arguments)
};
var dynCall_viiiidddi = Module["dynCall_viiiidddi"] = function () {
    return (dynCall_viiiidddi = Module["dynCall_viiiidddi"] = Module["asm"]["dynCall_viiiidddi"]).apply(null, arguments)
};
var dynCall_viiidddi = Module["dynCall_viiidddi"] = function () {
    return (dynCall_viiidddi = Module["dynCall_viiidddi"] = Module["asm"]["dynCall_viiidddi"]).apply(null, arguments)
};
var dynCall_iiiiiididi = Module["dynCall_iiiiiididi"] = function () {
    return (dynCall_iiiiiididi = Module["dynCall_iiiiiididi"] = Module["asm"]["dynCall_iiiiiididi"]).apply(null, arguments)
};
var dynCall_viiiiididi = Module["dynCall_viiiiididi"] = function () {
    return (dynCall_viiiiididi = Module["dynCall_viiiiididi"] = Module["asm"]["dynCall_viiiiididi"]).apply(null, arguments)
};
var dynCall_iiiiiidid = Module["dynCall_iiiiiidid"] = function () {
    return (dynCall_iiiiiidid = Module["dynCall_iiiiiidid"] = Module["asm"]["dynCall_iiiiiidid"]).apply(null, arguments)
};
var dynCall_viiiiidid = Module["dynCall_viiiiidid"] = function () {
    return (dynCall_viiiiidid = Module["dynCall_viiiiidid"] = Module["asm"]["dynCall_viiiiidid"]).apply(null, arguments)
};
var dynCall_iiiiiidi = Module["dynCall_iiiiiidi"] = function () {
    return (dynCall_iiiiiidi = Module["dynCall_iiiiiidi"] = Module["asm"]["dynCall_iiiiiidi"]).apply(null, arguments)
};
var dynCall_iiiiiid = Module["dynCall_iiiiiid"] = function () {
    return (dynCall_iiiiiid = Module["dynCall_iiiiiid"] = Module["asm"]["dynCall_iiiiiid"]).apply(null, arguments)
};
var dynCall_viiiiiidi = Module["dynCall_viiiiiidi"] = function () {
    return (dynCall_viiiiiidi = Module["dynCall_viiiiiidi"] = Module["asm"]["dynCall_viiiiiidi"]).apply(null, arguments)
};
var dynCall_iiiiidiid = Module["dynCall_iiiiidiid"] = function () {
    return (dynCall_iiiiidiid = Module["dynCall_iiiiidiid"] = Module["asm"]["dynCall_iiiiidiid"]).apply(null, arguments)
};
var dynCall_viiiidiid = Module["dynCall_viiiidiid"] = function () {
    return (dynCall_viiiidiid = Module["dynCall_viiiidiid"] = Module["asm"]["dynCall_viiiidiid"]).apply(null, arguments)
};
var dynCall_iiiiidii = Module["dynCall_iiiiidii"] = function () {
    return (dynCall_iiiiidii = Module["dynCall_iiiiidii"] = Module["asm"]["dynCall_iiiiidii"]).apply(null, arguments)
};
var dynCall_viiiidii = Module["dynCall_viiiidii"] = function () {
    return (dynCall_viiiidii = Module["dynCall_viiiidii"] = Module["asm"]["dynCall_viiiidii"]).apply(null, arguments)
};
var dynCall_iiiiidi = Module["dynCall_iiiiidi"] = function () {
    return (dynCall_iiiiidi = Module["dynCall_iiiiidi"] = Module["asm"]["dynCall_iiiiidi"]).apply(null, arguments)
};
var dynCall_iiiiid = Module["dynCall_iiiiid"] = function () {
    return (dynCall_iiiiid = Module["dynCall_iiiiid"] = Module["asm"]["dynCall_iiiiid"]).apply(null, arguments)
};
var dynCall_diiiiiiii = Module["dynCall_diiiiiiii"] = function () {
    return (dynCall_diiiiiiii = Module["dynCall_diiiiiiii"] = Module["asm"]["dynCall_diiiiiiii"]).apply(null, arguments)
};
var dynCall_diiiiiii = Module["dynCall_diiiiiii"] = function () {
    return (dynCall_diiiiiii = Module["dynCall_diiiiiii"] = Module["asm"]["dynCall_diiiiiii"]).apply(null, arguments)
};
var dynCall_viiididii = Module["dynCall_viiididii"] = function () {
    return (dynCall_viiididii = Module["dynCall_viiididii"] = Module["asm"]["dynCall_viiididii"]).apply(null, arguments)
};
var dynCall_viididii = Module["dynCall_viididii"] = function () {
    return (dynCall_viididii = Module["dynCall_viididii"] = Module["asm"]["dynCall_viididii"]).apply(null, arguments)
};
var dynCall_viiididi = Module["dynCall_viiididi"] = function () {
    return (dynCall_viiididi = Module["dynCall_viiididi"] = Module["asm"]["dynCall_viiididi"]).apply(null, arguments)
};
var dynCall_viididi = Module["dynCall_viididi"] = function () {
    return (dynCall_viididi = Module["dynCall_viididi"] = Module["asm"]["dynCall_viididi"]).apply(null, arguments)
};
var dynCall_iiidd = Module["dynCall_iiidd"] = function () {
    return (dynCall_iiidd = Module["dynCall_iiidd"] = Module["asm"]["dynCall_iiidd"]).apply(null, arguments)
};
var dynCall_viiiiddiiid = Module["dynCall_viiiiddiiid"] = function () {
    return (dynCall_viiiiddiiid = Module["dynCall_viiiiddiiid"] = Module["asm"]["dynCall_viiiiddiiid"]).apply(null, arguments)
};
var dynCall_viiiddiiid = Module["dynCall_viiiddiiid"] = function () {
    return (dynCall_viiiddiiid = Module["dynCall_viiiddiiid"] = Module["asm"]["dynCall_viiiddiiid"]).apply(null, arguments)
};
var dynCall_viiiiddiii = Module["dynCall_viiiiddiii"] = function () {
    return (dynCall_viiiiddiii = Module["dynCall_viiiiddiii"] = Module["asm"]["dynCall_viiiiddiii"]).apply(null, arguments)
};
var dynCall_viiiddiii = Module["dynCall_viiiddiii"] = function () {
    return (dynCall_viiiddiii = Module["dynCall_viiiddiii"] = Module["asm"]["dynCall_viiiddiii"]).apply(null, arguments)
};
var dynCall_viiiiddii = Module["dynCall_viiiiddii"] = function () {
    return (dynCall_viiiiddii = Module["dynCall_viiiiddii"] = Module["asm"]["dynCall_viiiiddii"]).apply(null, arguments)
};
var dynCall_viiiiddiiiid = Module["dynCall_viiiiddiiiid"] = function () {
    return (dynCall_viiiiddiiiid = Module["dynCall_viiiiddiiiid"] = Module["asm"]["dynCall_viiiiddiiiid"]).apply(null, arguments)
};
var dynCall_viiiddiiiid = Module["dynCall_viiiddiiiid"] = function () {
    return (dynCall_viiiddiiiid = Module["dynCall_viiiddiiiid"] = Module["asm"]["dynCall_viiiddiiiid"]).apply(null, arguments)
};
var dynCall_viiiiddiiii = Module["dynCall_viiiiddiiii"] = function () {
    return (dynCall_viiiiddiiii = Module["dynCall_viiiiddiiii"] = Module["asm"]["dynCall_viiiiddiiii"]).apply(null, arguments)
};
var dynCall_viiiddiiii = Module["dynCall_viiiddiiii"] = function () {
    return (dynCall_viiiddiiii = Module["dynCall_viiiddiiii"] = Module["asm"]["dynCall_viiiddiiii"]).apply(null, arguments)
};
var dynCall_diiiiii = Module["dynCall_diiiiii"] = function () {
    return (dynCall_diiiiii = Module["dynCall_diiiiii"] = Module["asm"]["dynCall_diiiiii"]).apply(null, arguments)
};
var dynCall_diiiid = Module["dynCall_diiiid"] = function () {
    return (dynCall_diiiid = Module["dynCall_diiiid"] = Module["asm"]["dynCall_diiiid"]).apply(null, arguments)
};
var dynCall_diiid = Module["dynCall_diiid"] = function () {
    return (dynCall_diiid = Module["dynCall_diiid"] = Module["asm"]["dynCall_diiid"]).apply(null, arguments)
};
var dynCall_viiddiii = Module["dynCall_viiddiii"] = function () {
    return (dynCall_viiddiii = Module["dynCall_viiddiii"] = Module["asm"]["dynCall_viiddiii"]).apply(null, arguments)
};
var dynCall_vidi = Module["dynCall_vidi"] = function () {
    return (dynCall_vidi = Module["dynCall_vidi"] = Module["asm"]["dynCall_vidi"]).apply(null, arguments)
};
var dynCall_viiiiidiiii = Module["dynCall_viiiiidiiii"] = function () {
    return (dynCall_viiiiidiiii = Module["dynCall_viiiiidiiii"] = Module["asm"]["dynCall_viiiiidiiii"]).apply(null, arguments)
};
var dynCall_viiiidiiii = Module["dynCall_viiiidiiii"] = function () {
    return (dynCall_viiiidiiii = Module["dynCall_viiiidiiii"] = Module["asm"]["dynCall_viiiidiiii"]).apply(null, arguments)
};
var dynCall_viiiiidiii = Module["dynCall_viiiiidiii"] = function () {
    return (dynCall_viiiiidiii = Module["dynCall_viiiiidiii"] = Module["asm"]["dynCall_viiiiidiii"]).apply(null, arguments)
};
var dynCall_viiiidiii = Module["dynCall_viiiidiii"] = function () {
    return (dynCall_viiiidiii = Module["dynCall_viiiidiii"] = Module["asm"]["dynCall_viiiidiii"]).apply(null, arguments)
};
var dynCall_viiiiidii = Module["dynCall_viiiiidii"] = function () {
    return (dynCall_viiiiidii = Module["dynCall_viiiiidii"] = Module["asm"]["dynCall_viiiiidii"]).apply(null, arguments)
};
var dynCall_viiiiiiidi = Module["dynCall_viiiiiiidi"] = function () {
    return (dynCall_viiiiiiidi = Module["dynCall_viiiiiiidi"] = Module["asm"]["dynCall_viiiiiiidi"]).apply(null, arguments)
};
var dynCall_diiiddi = Module["dynCall_diiiddi"] = function () {
    return (dynCall_diiiddi = Module["dynCall_diiiddi"] = Module["asm"]["dynCall_diiiddi"]).apply(null, arguments)
};
var dynCall_diiddi = Module["dynCall_diiddi"] = function () {
    return (dynCall_diiddi = Module["dynCall_diiddi"] = Module["asm"]["dynCall_diiddi"]).apply(null, arguments)
};
var dynCall_iiidiiiii = Module["dynCall_iiidiiiii"] = function () {
    return (dynCall_iiidiiiii = Module["dynCall_iiidiiiii"] = Module["asm"]["dynCall_iiidiiiii"]).apply(null, arguments)
};
var dynCall_viidiiiii = Module["dynCall_viidiiiii"] = function () {
    return (dynCall_viidiiiii = Module["dynCall_viidiiiii"] = Module["asm"]["dynCall_viidiiiii"]).apply(null, arguments)
};
var dynCall_iiidiiii = Module["dynCall_iiidiiii"] = function () {
    return (dynCall_iiidiiii = Module["dynCall_iiidiiii"] = Module["asm"]["dynCall_iiidiiii"]).apply(null, arguments)
};
var dynCall_viidiiii = Module["dynCall_viidiiii"] = function () {
    return (dynCall_viidiiii = Module["dynCall_viidiiii"] = Module["asm"]["dynCall_viidiiii"]).apply(null, arguments)
};
var dynCall_iiidiii = Module["dynCall_iiidiii"] = function () {
    return (dynCall_iiidiii = Module["dynCall_iiidiii"] = Module["asm"]["dynCall_iiidiii"]).apply(null, arguments)
};
var dynCall_viidiii = Module["dynCall_viidiii"] = function () {
    return (dynCall_viidiii = Module["dynCall_viidiii"] = Module["asm"]["dynCall_viidiii"]).apply(null, arguments)
};
var dynCall_iiidii = Module["dynCall_iiidii"] = function () {
    return (dynCall_iiidii = Module["dynCall_iiidii"] = Module["asm"]["dynCall_iiidii"]).apply(null, arguments)
};
var dynCall_viidii = Module["dynCall_viidii"] = function () {
    return (dynCall_viidii = Module["dynCall_viidii"] = Module["asm"]["dynCall_viidii"]).apply(null, arguments)
};
var dynCall_iiidi = Module["dynCall_iiidi"] = function () {
    return (dynCall_iiidi = Module["dynCall_iiidi"] = Module["asm"]["dynCall_iiidi"]).apply(null, arguments)
};
var dynCall_iiid = Module["dynCall_iiid"] = function () {
    return (dynCall_iiid = Module["dynCall_iiid"] = Module["asm"]["dynCall_iiid"]).apply(null, arguments)
};
var dynCall_vif = Module["dynCall_vif"] = function () {
    return (dynCall_vif = Module["dynCall_vif"] = Module["asm"]["dynCall_vif"]).apply(null, arguments)
};
var dynCall_iifff = Module["dynCall_iifff"] = function () {
    return (dynCall_iifff = Module["dynCall_iifff"] = Module["asm"]["dynCall_iifff"]).apply(null, arguments)
};
var dynCall_vifff = Module["dynCall_vifff"] = function () {
    return (dynCall_vifff = Module["dynCall_vifff"] = Module["asm"]["dynCall_vifff"]).apply(null, arguments)
};
var dynCall_iiff = Module["dynCall_iiff"] = function () {
    return (dynCall_iiff = Module["dynCall_iiff"] = Module["asm"]["dynCall_iiff"]).apply(null, arguments)
};
var dynCall_viff = Module["dynCall_viff"] = function () {
    return (dynCall_viff = Module["dynCall_viff"] = Module["asm"]["dynCall_viff"]).apply(null, arguments)
};
var dynCall_iif = Module["dynCall_iif"] = function () {
    return (dynCall_iif = Module["dynCall_iif"] = Module["asm"]["dynCall_iif"]).apply(null, arguments)
};
var dynCall_iiif = Module["dynCall_iiif"] = function () {
    return (dynCall_iiif = Module["dynCall_iiif"] = Module["asm"]["dynCall_iiif"]).apply(null, arguments)
};
var dynCall_iiiiiiiididiii = Module["dynCall_iiiiiiiididiii"] = function () {
    return (dynCall_iiiiiiiididiii = Module["dynCall_iiiiiiiididiii"] = Module["asm"]["dynCall_iiiiiiiididiii"]).apply(null, arguments)
};
var dynCall_iiiiiiiiiiiii = Module["dynCall_iiiiiiiiiiiii"] = function () {
    return (dynCall_iiiiiiiiiiiii = Module["dynCall_iiiiiiiiiiiii"] = Module["asm"]["dynCall_iiiiiiiiiiiii"]).apply(null, arguments)
};
var dynCall_viiiidiiddi = Module["dynCall_viiiidiiddi"] = function () {
    return (dynCall_viiiidiiddi = Module["dynCall_viiiidiiddi"] = Module["asm"]["dynCall_viiiidiiddi"]).apply(null, arguments)
};
var dynCall_viiiiidiiddi = Module["dynCall_viiiiidiiddi"] = function () {
    return (dynCall_viiiiidiiddi = Module["dynCall_viiiiidiiddi"] = Module["asm"]["dynCall_viiiiidiiddi"]).apply(null, arguments)
};
var dynCall_viiiidiidd = Module["dynCall_viiiidiidd"] = function () {
    return (dynCall_viiiidiidd = Module["dynCall_viiiidiidd"] = Module["asm"]["dynCall_viiiidiidd"]).apply(null, arguments)
};
var dynCall_viiiiidiidd = Module["dynCall_viiiiidiidd"] = function () {
    return (dynCall_viiiiidiidd = Module["dynCall_viiiiidiidd"] = Module["asm"]["dynCall_viiiiidiidd"]).apply(null, arguments)
};
var dynCall_viiiiidiid = Module["dynCall_viiiiidiid"] = function () {
    return (dynCall_viiiiidiid = Module["dynCall_viiiiidiid"] = Module["asm"]["dynCall_viiiiidiid"]).apply(null, arguments)
};
var dynCall_iiiifiii = Module["dynCall_iiiifiii"] = function () {
    return (dynCall_iiiifiii = Module["dynCall_iiiifiii"] = Module["asm"]["dynCall_iiiifiii"]).apply(null, arguments)
};
var dynCall_viiifiii = Module["dynCall_viiifiii"] = function () {
    return (dynCall_viiifiii = Module["dynCall_viiifiii"] = Module["asm"]["dynCall_viiifiii"]).apply(null, arguments)
};
var dynCall_iiiifii = Module["dynCall_iiiifii"] = function () {
    return (dynCall_iiiifii = Module["dynCall_iiiifii"] = Module["asm"]["dynCall_iiiifii"]).apply(null, arguments)
};
var dynCall_viiifii = Module["dynCall_viiifii"] = function () {
    return (dynCall_viiifii = Module["dynCall_viiifii"] = Module["asm"]["dynCall_viiifii"]).apply(null, arguments)
};
var dynCall_iiiifi = Module["dynCall_iiiifi"] = function () {
    return (dynCall_iiiifi = Module["dynCall_iiiifi"] = Module["asm"]["dynCall_iiiifi"]).apply(null, arguments)
};
var dynCall_viiifi = Module["dynCall_viiifi"] = function () {
    return (dynCall_viiifi = Module["dynCall_viiifi"] = Module["asm"]["dynCall_viiifi"]).apply(null, arguments)
};
var dynCall_vid = Module["dynCall_vid"] = function () {
    return (dynCall_vid = Module["dynCall_vid"] = Module["asm"]["dynCall_vid"]).apply(null, arguments)
};
var dynCall_iidi = Module["dynCall_iidi"] = function () {
    return (dynCall_iidi = Module["dynCall_iidi"] = Module["asm"]["dynCall_iidi"]).apply(null, arguments)
};
var dynCall_iid = Module["dynCall_iid"] = function () {
    return (dynCall_iid = Module["dynCall_iid"] = Module["asm"]["dynCall_iid"]).apply(null, arguments)
};
var dynCall_iiiiifiii = Module["dynCall_iiiiifiii"] = function () {
    return (dynCall_iiiiifiii = Module["dynCall_iiiiifiii"] = Module["asm"]["dynCall_iiiiifiii"]).apply(null, arguments)
};
var dynCall_viiiifiii = Module["dynCall_viiiifiii"] = function () {
    return (dynCall_viiiifiii = Module["dynCall_viiiifiii"] = Module["asm"]["dynCall_viiiifiii"]).apply(null, arguments)
};
var dynCall_iiiiifii = Module["dynCall_iiiiifii"] = function () {
    return (dynCall_iiiiifii = Module["dynCall_iiiiifii"] = Module["asm"]["dynCall_iiiiifii"]).apply(null, arguments)
};
var dynCall_viiiifii = Module["dynCall_viiiifii"] = function () {
    return (dynCall_viiiifii = Module["dynCall_viiiifii"] = Module["asm"]["dynCall_viiiifii"]).apply(null, arguments)
};
var dynCall_iiiiifi = Module["dynCall_iiiiifi"] = function () {
    return (dynCall_iiiiifi = Module["dynCall_iiiiifi"] = Module["asm"]["dynCall_iiiiifi"]).apply(null, arguments)
};
var dynCall_viiiifi = Module["dynCall_viiiifi"] = function () {
    return (dynCall_viiiifi = Module["dynCall_viiiifi"] = Module["asm"]["dynCall_viiiifi"]).apply(null, arguments)
};
var dynCall_iiiiif = Module["dynCall_iiiiif"] = function () {
    return (dynCall_iiiiif = Module["dynCall_iiiiif"] = Module["asm"]["dynCall_iiiiif"]).apply(null, arguments)
};
var dynCall_viiiif = Module["dynCall_viiiif"] = function () {
    return (dynCall_viiiif = Module["dynCall_viiiif"] = Module["asm"]["dynCall_viiiif"]).apply(null, arguments)
};
var dynCall_iiifi = Module["dynCall_iiifi"] = function () {
    return (dynCall_iiifi = Module["dynCall_iiifi"] = Module["asm"]["dynCall_iiifi"]).apply(null, arguments)
};
var dynCall_viifi = Module["dynCall_viifi"] = function () {
    return (dynCall_viifi = Module["dynCall_viifi"] = Module["asm"]["dynCall_viifi"]).apply(null, arguments)
};
var dynCall_iiiddiid = Module["dynCall_iiiddiid"] = function () {
    return (dynCall_iiiddiid = Module["dynCall_iiiddiid"] = Module["asm"]["dynCall_iiiddiid"]).apply(null, arguments)
};
var dynCall_viiddiid = Module["dynCall_viiddiid"] = function () {
    return (dynCall_viiddiid = Module["dynCall_viiddiid"] = Module["asm"]["dynCall_viiddiid"]).apply(null, arguments)
};
var dynCall_iiiddii = Module["dynCall_iiiddii"] = function () {
    return (dynCall_iiiddii = Module["dynCall_iiiddii"] = Module["asm"]["dynCall_iiiddii"]).apply(null, arguments)
};
var dynCall_iiiddi = Module["dynCall_iiiddi"] = function () {
    return (dynCall_iiiddi = Module["dynCall_iiiddi"] = Module["asm"]["dynCall_iiiddi"]).apply(null, arguments)
};
var dynCall_iiiddiiid = Module["dynCall_iiiddiiid"] = function () {
    return (dynCall_iiiddiiid = Module["dynCall_iiiddiiid"] = Module["asm"]["dynCall_iiiddiiid"]).apply(null, arguments)
};
var dynCall_viiddiiid = Module["dynCall_viiddiiid"] = function () {
    return (dynCall_viiddiiid = Module["dynCall_viiddiiid"] = Module["asm"]["dynCall_viiddiiid"]).apply(null, arguments)
};
var dynCall_viiiiifii = Module["dynCall_viiiiifii"] = function () {
    return (dynCall_viiiiifii = Module["dynCall_viiiiifii"] = Module["asm"]["dynCall_viiiiifii"]).apply(null, arguments)
};
var dynCall_iiiiiddiddi = Module["dynCall_iiiiiddiddi"] = function () {
    return (dynCall_iiiiiddiddi = Module["dynCall_iiiiiddiddi"] = Module["asm"]["dynCall_iiiiiddiddi"]).apply(null, arguments)
};
var dynCall_viiiiddiddi = Module["dynCall_viiiiddiddi"] = function () {
    return (dynCall_viiiiddiddi = Module["dynCall_viiiiddiddi"] = Module["asm"]["dynCall_viiiiddiddi"]).apply(null, arguments)
};
var dynCall_iiiiiddidd = Module["dynCall_iiiiiddidd"] = function () {
    return (dynCall_iiiiiddidd = Module["dynCall_iiiiiddidd"] = Module["asm"]["dynCall_iiiiiddidd"]).apply(null, arguments)
};
var dynCall_viiiiddidd = Module["dynCall_viiiiddidd"] = function () {
    return (dynCall_viiiiddidd = Module["dynCall_viiiiddidd"] = Module["asm"]["dynCall_viiiiddidd"]).apply(null, arguments)
};
var dynCall_iiiiiddid = Module["dynCall_iiiiiddid"] = function () {
    return (dynCall_iiiiiddid = Module["dynCall_iiiiiddid"] = Module["asm"]["dynCall_iiiiiddid"]).apply(null, arguments)
};
var dynCall_viiiiddid = Module["dynCall_viiiiddid"] = function () {
    return (dynCall_viiiiddid = Module["dynCall_viiiiddid"] = Module["asm"]["dynCall_viiiiddid"]).apply(null, arguments)
};
var dynCall_iiiiiddi = Module["dynCall_iiiiiddi"] = function () {
    return (dynCall_iiiiiddi = Module["dynCall_iiiiiddi"] = Module["asm"]["dynCall_iiiiiddi"]).apply(null, arguments)
};
var dynCall_iiiiidd = Module["dynCall_iiiiidd"] = function () {
    return (dynCall_iiiiidd = Module["dynCall_iiiiidd"] = Module["asm"]["dynCall_iiiiidd"]).apply(null, arguments)
};
var dynCall_viiiiidiiiii = Module["dynCall_viiiiidiiiii"] = function () {
    return (dynCall_viiiiidiiiii = Module["dynCall_viiiiidiiiii"] = Module["asm"]["dynCall_viiiiidiiiii"]).apply(null, arguments)
};
var dynCall_viiiiiidiiiii = Module["dynCall_viiiiiidiiiii"] = function () {
    return (dynCall_viiiiiidiiiii = Module["dynCall_viiiiiidiiiii"] = Module["asm"]["dynCall_viiiiiidiiiii"]).apply(null, arguments)
};
var dynCall_viiiiiidiiii = Module["dynCall_viiiiiidiiii"] = function () {
    return (dynCall_viiiiiidiiii = Module["dynCall_viiiiiidiiii"] = Module["asm"]["dynCall_viiiiiidiiii"]).apply(null, arguments)
};
var dynCall_viiiiiidiii = Module["dynCall_viiiiiidiii"] = function () {
    return (dynCall_viiiiiidiii = Module["dynCall_viiiiiidiii"] = Module["asm"]["dynCall_viiiiiidiii"]).apply(null, arguments)
};
var dynCall_viiiiiidii = Module["dynCall_viiiiiidii"] = function () {
    return (dynCall_viiiiiidii = Module["dynCall_viiiiiidii"] = Module["asm"]["dynCall_viiiiiidii"]).apply(null, arguments)
};
var dynCall_viiidiiii = Module["dynCall_viiidiiii"] = function () {
    return (dynCall_viiidiiii = Module["dynCall_viiidiiii"] = Module["asm"]["dynCall_viiidiiii"]).apply(null, arguments)
};
var dynCall_viiidiii = Module["dynCall_viiidiii"] = function () {
    return (dynCall_viiidiii = Module["dynCall_viiidiii"] = Module["asm"]["dynCall_viiidiii"]).apply(null, arguments)
};
var dynCall_viiidii = Module["dynCall_viiidii"] = function () {
    return (dynCall_viiidii = Module["dynCall_viiidii"] = Module["asm"]["dynCall_viiidii"]).apply(null, arguments)
};
var dynCall_iiffff = Module["dynCall_iiffff"] = function () {
    return (dynCall_iiffff = Module["dynCall_iiffff"] = Module["asm"]["dynCall_iiffff"]).apply(null, arguments)
};
var dynCall_viffff = Module["dynCall_viffff"] = function () {
    return (dynCall_viffff = Module["dynCall_viffff"] = Module["asm"]["dynCall_viffff"]).apply(null, arguments)
};
var dynCall_iiifiiiiiii = Module["dynCall_iiifiiiiiii"] = function () {
    return (dynCall_iiifiiiiiii = Module["dynCall_iiifiiiiiii"] = Module["asm"]["dynCall_iiifiiiiiii"]).apply(null, arguments)
};
var dynCall_viifiiiiiii = Module["dynCall_viifiiiiiii"] = function () {
    return (dynCall_viifiiiiiii = Module["dynCall_viifiiiiiii"] = Module["asm"]["dynCall_viifiiiiiii"]).apply(null, arguments)
};
var dynCall_iiifiiiiii = Module["dynCall_iiifiiiiii"] = function () {
    return (dynCall_iiifiiiiii = Module["dynCall_iiifiiiiii"] = Module["asm"]["dynCall_iiifiiiiii"]).apply(null, arguments)
};
var dynCall_viifiiiiii = Module["dynCall_viifiiiiii"] = function () {
    return (dynCall_viifiiiiii = Module["dynCall_viifiiiiii"] = Module["asm"]["dynCall_viifiiiiii"]).apply(null, arguments)
};
var dynCall_iiifiiiii = Module["dynCall_iiifiiiii"] = function () {
    return (dynCall_iiifiiiii = Module["dynCall_iiifiiiii"] = Module["asm"]["dynCall_iiifiiiii"]).apply(null, arguments)
};
var dynCall_viifiiiii = Module["dynCall_viifiiiii"] = function () {
    return (dynCall_viifiiiii = Module["dynCall_viifiiiii"] = Module["asm"]["dynCall_viifiiiii"]).apply(null, arguments)
};
var dynCall_iiifiiii = Module["dynCall_iiifiiii"] = function () {
    return (dynCall_iiifiiii = Module["dynCall_iiifiiii"] = Module["asm"]["dynCall_iiifiiii"]).apply(null, arguments)
};
var dynCall_viifiiii = Module["dynCall_viifiiii"] = function () {
    return (dynCall_viifiiii = Module["dynCall_viifiiii"] = Module["asm"]["dynCall_viifiiii"]).apply(null, arguments)
};
var dynCall_iiifiii = Module["dynCall_iiifiii"] = function () {
    return (dynCall_iiifiii = Module["dynCall_iiifiii"] = Module["asm"]["dynCall_iiifiii"]).apply(null, arguments)
};
var dynCall_viifiii = Module["dynCall_viifiii"] = function () {
    return (dynCall_viifiii = Module["dynCall_viifiii"] = Module["asm"]["dynCall_viifiii"]).apply(null, arguments)
};
var dynCall_iiifii = Module["dynCall_iiifii"] = function () {
    return (dynCall_iiifii = Module["dynCall_iiifii"] = Module["asm"]["dynCall_iiifii"]).apply(null, arguments)
};
var dynCall_viifii = Module["dynCall_viifii"] = function () {
    return (dynCall_viifii = Module["dynCall_viifii"] = Module["asm"]["dynCall_viifii"]).apply(null, arguments)
};
var dynCall_iiiiffi = Module["dynCall_iiiiffi"] = function () {
    return (dynCall_iiiiffi = Module["dynCall_iiiiffi"] = Module["asm"]["dynCall_iiiiffi"]).apply(null, arguments)
};
var dynCall_viiiffi = Module["dynCall_viiiffi"] = function () {
    return (dynCall_viiiffi = Module["dynCall_viiiffi"] = Module["asm"]["dynCall_viiiffi"]).apply(null, arguments)
};
var dynCall_iiiiff = Module["dynCall_iiiiff"] = function () {
    return (dynCall_iiiiff = Module["dynCall_iiiiff"] = Module["asm"]["dynCall_iiiiff"]).apply(null, arguments)
};
var dynCall_viiiff = Module["dynCall_viiiff"] = function () {
    return (dynCall_viiiff = Module["dynCall_viiiff"] = Module["asm"]["dynCall_viiiff"]).apply(null, arguments)
};
var dynCall_iiiiiiffi = Module["dynCall_iiiiiiffi"] = function () {
    return (dynCall_iiiiiiffi = Module["dynCall_iiiiiiffi"] = Module["asm"]["dynCall_iiiiiiffi"]).apply(null, arguments)
};
var dynCall_viiiiiffi = Module["dynCall_viiiiiffi"] = function () {
    return (dynCall_viiiiiffi = Module["dynCall_viiiiiffi"] = Module["asm"]["dynCall_viiiiiffi"]).apply(null, arguments)
};
var dynCall_iiiiiiff = Module["dynCall_iiiiiiff"] = function () {
    return (dynCall_iiiiiiff = Module["dynCall_iiiiiiff"] = Module["asm"]["dynCall_iiiiiiff"]).apply(null, arguments)
};
var dynCall_viiiiiff = Module["dynCall_viiiiiff"] = function () {
    return (dynCall_viiiiiff = Module["dynCall_viiiiiff"] = Module["asm"]["dynCall_viiiiiff"]).apply(null, arguments)
};
var dynCall_ji = Module["dynCall_ji"] = function () {
    return (dynCall_ji = Module["dynCall_ji"] = Module["asm"]["dynCall_ji"]).apply(null, arguments)
};
var dynCall_viijii = Module["dynCall_viijii"] = function () {
    return (dynCall_viijii = Module["dynCall_viijii"] = Module["asm"]["dynCall_viijii"]).apply(null, arguments)
};
var dynCall_viiiiiiiiiiddi = Module["dynCall_viiiiiiiiiiddi"] = function () {
    return (dynCall_viiiiiiiiiiddi = Module["dynCall_viiiiiiiiiiddi"] = Module["asm"]["dynCall_viiiiiiiiiiddi"]).apply(null, arguments)
};
var dynCall_v = Module["dynCall_v"] = function () {
    return (dynCall_v = Module["dynCall_v"] = Module["asm"]["dynCall_v"]).apply(null, arguments)
};
var dynCall_viiiiiiiiidd = Module["dynCall_viiiiiiiiidd"] = function () {
    return (dynCall_viiiiiiiiidd = Module["dynCall_viiiiiiiiidd"] = Module["asm"]["dynCall_viiiiiiiiidd"]).apply(null, arguments)
};
var dynCall_fi = Module["dynCall_fi"] = function () {
    return (dynCall_fi = Module["dynCall_fi"] = Module["asm"]["dynCall_fi"]).apply(null, arguments)
};
var dynCall_jiii = Module["dynCall_jiii"] = function () {
    return (dynCall_jiii = Module["dynCall_jiii"] = Module["asm"]["dynCall_jiii"]).apply(null, arguments)
};
var dynCall_vifi = Module["dynCall_vifi"] = function () {
    return (dynCall_vifi = Module["dynCall_vifi"] = Module["asm"]["dynCall_vifi"]).apply(null, arguments)
};
var dynCall_vij = Module["dynCall_vij"] = function () {
    return (dynCall_vij = Module["dynCall_vij"] = Module["asm"]["dynCall_vij"]).apply(null, arguments)
};
var dynCall_iiiiiifiididiii = Module["dynCall_iiiiiifiididiii"] = function () {
    return (dynCall_iiiiiifiididiii = Module["dynCall_iiiiiifiididiii"] = Module["asm"]["dynCall_iiiiiifiididiii"]).apply(null, arguments)
};
var dynCall_viiidiiddi = Module["dynCall_viiidiiddi"] = function () {
    return (dynCall_viiidiiddi = Module["dynCall_viiidiiddi"] = Module["asm"]["dynCall_viiidiiddi"]).apply(null, arguments)
};
var dynCall_viiij = Module["dynCall_viiij"] = function () {
    return (dynCall_viiij = Module["dynCall_viiij"] = Module["asm"]["dynCall_viiij"]).apply(null, arguments)
};
var dynCall_jiiii = Module["dynCall_jiiii"] = function () {
    return (dynCall_jiiii = Module["dynCall_jiiii"] = Module["asm"]["dynCall_jiiii"]).apply(null, arguments)
};
var dynCall_viiiij = Module["dynCall_viiiij"] = function () {
    return (dynCall_viiiij = Module["dynCall_viiiij"] = Module["asm"]["dynCall_viiiij"]).apply(null, arguments)
};
var dynCall_jii = Module["dynCall_jii"] = function () {
    return (dynCall_jii = Module["dynCall_jii"] = Module["asm"]["dynCall_jii"]).apply(null, arguments)
};
var dynCall_viji = Module["dynCall_viji"] = function () {
    return (dynCall_viji = Module["dynCall_viji"] = Module["asm"]["dynCall_viji"]).apply(null, arguments)
};
var dynCall_jiji = Module["dynCall_jiji"] = function () {
    return (dynCall_jiji = Module["dynCall_jiji"] = Module["asm"]["dynCall_jiji"]).apply(null, arguments)
};
var dynCall_iidiiii = Module["dynCall_iidiiii"] = function () {
    return (dynCall_iidiiii = Module["dynCall_iidiiii"] = Module["asm"]["dynCall_iidiiii"]).apply(null, arguments)
};
var dynCall_iiiiij = Module["dynCall_iiiiij"] = function () {
    return (dynCall_iiiiij = Module["dynCall_iiiiij"] = Module["asm"]["dynCall_iiiiij"]).apply(null, arguments)
};
var dynCall_iiiiijj = Module["dynCall_iiiiijj"] = function () {
    return (dynCall_iiiiijj = Module["dynCall_iiiiijj"] = Module["asm"]["dynCall_iiiiijj"]).apply(null, arguments)
};
var dynCall_iiiiiijj = Module["dynCall_iiiiiijj"] = function () {
    return (dynCall_iiiiiijj = Module["dynCall_iiiiiijj"] = Module["asm"]["dynCall_iiiiiijj"]).apply(null, arguments)
};

Module["asm"] = asm;
var calledRun;
dependenciesFulfilled = function runCaller() {
    if (!calledRun)
        run();
    if (!calledRun)
        dependenciesFulfilled = runCaller
};

function run(args) {
    args = args || arguments_;
    if (runDependencies > 0) {
        return
    }
    preRun();
    if (runDependencies > 0)
        return;

    function doRun() {
        if (calledRun)
            return;
        calledRun = true;
        Module["calledRun"] = true;
        if (ABORT)
            return;
        initRuntime();
        preMain();
        readyPromiseResolve(Module);
        if (Module["onRuntimeInitialized"])
            Module["onRuntimeInitialized"]();
        postRun()
        
    }
    if (Module["setStatus"]) {
        Module["setStatus"]("Running...");
        setTimeout(function () {
            setTimeout(function () {
                Module["setStatus"]("")
            }, 1);
            doRun()
        }, 1)
    } else {
        doRun()
    }
}
Module["run"] = run;
if (Module["preInit"]) {
    if (typeof Module["preInit"] == "function")
        Module["preInit"] = [Module["preInit"]];
    while (Module["preInit"].length > 0) {
        Module["preInit"].pop()()
    }
}
noExitRuntime = true;


Module["imread"] = function (imageSource, callback) {

    var cv = Module;
    var canvas=Module["canvas"];
    var ctx =Module["canvascontext"];
    var img = canvas.createImage();
    img.src = imageSource;
    img.onload = function () {
        ctx.drawImage(img, 0, 0, img.width, img.height)
        var imgData = ctx.getImageData(0, 0, canvas.width, canvas.width);
        callback(cv.matFromImageData(imgData));

    }
    img.onerror=function(evt){
        console.log(evt);
    }
};
Module["imshowed"]=false;
Module["imshow"] = function (mat) {
    if(Module["imshowed"]){
        return false;
    }
    var cv = Module;
    cv.imshowed=true;
    var canvas = Module["canvas"];
    var ctx = Module["canvascontext"];
    var img = mat;
    var img = new cv.Mat;
    var depth = mat.type() % 8;
    var scale = depth <= cv.CV_8S ? 1 : depth <= cv.CV_32S ? 1 / 256 : 255;
    var shift = depth === cv.CV_8S || depth === cv.CV_16S ? 128 : 0;
    mat.convertTo(img, cv.CV_8U, scale, shift);
    switch (img.type()) {
        case cv.CV_8UC1:
            cv.cvtColor(img, img, cv.COLOR_GRAY2RGBA);
            break;
        case cv.CV_8UC3:
            cv.cvtColor(img, img, cv.COLOR_RGB2RGBA);
            break;
        case cv.CV_8UC4:
            break;
        default:
            throw new Error("Bad number of channels (Source image must have 1, 3 or 4 channels)");
            return
    }
    var imgData = canvas.createImageData(new Uint8ClampedArray(img.data),img.cols,img.rows);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.putImageData(imgData, 0, 0);
    cv.imshowed=false;
};

function Range(start, end) {
    this.start = typeof start === "undefined" ? 0 : start;
    this.end = typeof end === "undefined" ? 0 : end
}
Module["Range"] = Range;

function Point(x, y) {
    this.x = typeof x === "undefined" ? 0 : x;
    this.y = typeof y === "undefined" ? 0 : y
}
Module["Point"] = Point;

function Size(width, height) {
    this.width = typeof width === "undefined" ? 0 : width;
    this.height = typeof height === "undefined" ? 0 : height
}
Module["Size"] = Size;

function Rect() {
    switch (arguments.length) {
        case 0: {
            this.x = 0;
            this.y = 0;
            this.width = 0;
            this.height = 0;
            break
        }
        case 1: {
            var rect = arguments[0];
            this.x = rect.x;
            this.y = rect.y;
            this.width = rect.width;
            this.height = rect.height;
            break
        }
        case 2: {
            var point = arguments[0];
            var size = arguments[1];
            this.x = point.x;
            this.y = point.y;
            this.width = size.width;
            this.height = size.height;
            break
        }
        case 4: {
            this.x = arguments[0];
            this.y = arguments[1];
            this.width = arguments[2];
            this.height = arguments[3];
            break
        }
        default: {
            throw new Error("Invalid arguments")
        }
    }
}
Module["Rect"] = Rect;

function RotatedRect() {
    switch (arguments.length) {
        case 0: {
            this.center = {
                x: 0,
                y: 0
            };
            this.size = {
                width: 0,
                height: 0
            };
            this.angle = 0;
            break
        }
        case 3: {
            this.center = arguments[0];
            this.size = arguments[1];
            this.angle = arguments[2];
            break
        }
        default: {
            throw new Error("Invalid arguments")
        }
    }
}
RotatedRect.points = function (obj) {
    return Module.rotatedRectPoints(obj)
};
RotatedRect.boundingRect = function (obj) {
    return Module.rotatedRectBoundingRect(obj)
};
RotatedRect.boundingRect2f = function (obj) {
    return Module.rotatedRectBoundingRect2f(obj)
};
Module["RotatedRect"] = RotatedRect;

function Scalar(v0, v1, v2, v3) {
    this.push(typeof v0 === "undefined" ? 0 : v0);
    this.push(typeof v1 === "undefined" ? 0 : v1);
    this.push(typeof v2 === "undefined" ? 0 : v2);
    this.push(typeof v3 === "undefined" ? 0 : v3)
}
Scalar.prototype = new Array;
Scalar.all = function (v) {
    return new Scalar(v, v, v, v)
};
Module["Scalar"] = Scalar;

function MinMaxLoc() {
    switch (arguments.length) {
        case 0: {
            this.minVal = 0;
            this.maxVal = 0;
            this.minLoc = new Point;
            this.maxLoc = new Point;
            break
        }
        case 4: {
            this.minVal = arguments[0];
            this.maxVal = arguments[1];
            this.minLoc = arguments[2];
            this.maxLoc = arguments[3];
            break
        }
        default: {
            throw new Error("Invalid arguments")
        }
    }
}
Module["MinMaxLoc"] = MinMaxLoc;

function Circle() {
    switch (arguments.length) {
        case 0: {
            this.center = new Point;
            this.radius = 0;
            break
        }
        case 2: {
            this.center = arguments[0];
            this.radius = arguments[1];
            break
        }
        default: {
            throw new Error("Invalid arguments")
        }
    }
}
Module["Circle"] = Circle;

function TermCriteria() {
    switch (arguments.length) {
        case 0: {
            this.type = 0;
            this.maxCount = 0;
            this.epsilon = 0;
            break
        }
        case 3: {
            this.type = arguments[0];
            this.maxCount = arguments[1];
            this.epsilon = arguments[2];
            break
        }
        default: {
            throw new Error("Invalid arguments")
        }
    }
}
Module["TermCriteria"] = TermCriteria;
Module["matFromArray"] = function (rows, cols, type, array) {
    var cv = Module;
    var mat = new cv.Mat(rows, cols, type);
    switch (type) {
        case cv.CV_8U:
        case cv.CV_8UC1:
        case cv.CV_8UC2:
        case cv.CV_8UC3:
        case cv.CV_8UC4: {
            mat.data.set(array);
            break
        }
        case cv.CV_8S:
        case cv.CV_8SC1:
        case cv.CV_8SC2:
        case cv.CV_8SC3:
        case cv.CV_8SC4: {
            mat.data8S.set(array);
            break
        }
        case cv.CV_16U:
        case cv.CV_16UC1:
        case cv.CV_16UC2:
        case cv.CV_16UC3:
        case cv.CV_16UC4: {
            mat.data16U.set(array);
            break
        }
        case cv.CV_16S:
        case cv.CV_16SC1:
        case cv.CV_16SC2:
        case cv.CV_16SC3:
        case cv.CV_16SC4: {
            mat.data16S.set(array);
            break
        }
        case cv.CV_32S:
        case cv.CV_32SC1:
        case cv.CV_32SC2:
        case cv.CV_32SC3:
        case cv.CV_32SC4: {
            mat.data32S.set(array);
            break
        }
        case cv.CV_32F:
        case cv.CV_32FC1:
        case cv.CV_32FC2:
        case cv.CV_32FC3:
        case cv.CV_32FC4: {
            mat.data32F.set(array);
            break
        }
        case cv.CV_64F:
        case cv.CV_64FC1:
        case cv.CV_64FC2:
        case cv.CV_64FC3:
        case cv.CV_64FC4: {
            mat.data64F.set(array);
            break
        }
        default: {
            throw new Error("Type is unsupported")
        }
    }
    return mat
};
Module["matFromImageData"] = function (imageData) {
    var cv = Module;
    var mat = new cv.Mat(imageData.height, imageData.width, cv.CV_8UC4);
    mat.data.set(imageData.data);
    return mat
};
Module["inited"] = false;

function init(args) {
    if (typeof args != "object") {
        if (typeof Module["args"] != "object") {
            console.error("args must be object.");
            return false;
        } else {
            args = Module["args"]
        }
    }
    Module["FS"] = FS;
    Module["wasmurl"] = args.url;
    Module["wasmtype"] = args.type ? args.type : "wasm";
    Module["useCache"] = args.useCache ? args.useCache : false;
    if (typeof Module["asm"]["dynCall_iiiiiijj"] != "function") {
        if (!Module["inited"]) {
            wx.createSelectorQuery().select('#OffscreenCanvas').node(function (res) {
                Module["canvas"] = res.node;
                var dpr=wx.getSystemInfoSync().pixelRatio;
                Module["canvas"].width=res.node._width*dpr;
                Module["canvas"].height=res.node._height*dpr;
                Module["canvascontext"]=Module["canvas"].getContext("2d");
                Module["canvascontext"].scale(dpr,dpr);
            }).exec()
            asm = createWasm();
            run();
            Module["inited"] = true;
            Module["args"] = args;
        }
        setTimeout(init, 1);
    } else {
        if (typeof args.success == "function") {
            args.success(Module);
        }
    }
}
module.exports = {
    Module: Module,
    init: init
};