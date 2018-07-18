// The Module object: Our interface to the outside world. We import
// and export values on it. There are various ways Module can be used:
// 1. Not defined. We create it here
// 2. A function parameter, function(Module) { ..generated code.. }
// 3. pre-run appended it, var Module = {}; ..generated code..
// 4. External script tag defines var Module.
// We need to check if Module already exists (e.g. case 3 above).
// Substitution will be replaced with actual code on later stage of the build,
// this way Closure Compiler will not mangle it (e.g. case 4. above).
// Note that if you want to run closure, and also to use Module
// after the generated code, you will need to define   var Module = {};
// before the code. Then that object will be used in the code, and you
// can continue to use Module afterwards as well.
// if (!Module)` is crucial for Closure Compiler here as it will otherwise replace every `Module` occurrence with a string
var Module;
if (!Module) Module = typeof Module !== 'undefined' ? Module : {};

// --pre-jses are emitted after the Module integration code, so that they can
// refer to Module (if they choose; they can also define Module)
// {{PRE_JSES}}

// Sometimes an existing Module object exists with properties
// meant to overwrite the default module functionality. Here
// we collect those properties and reapply _after_ we configure
// the current environment's defaults to avoid having to be so
// defensive during initialization.
var moduleOverrides = {};
var key;
for (key in Module) {
  if (Module.hasOwnProperty(key)) {
    moduleOverrides[key] = Module[key];
  }
}

Module['arguments'] = [];
Module['thisProgram'] = './this.program';
Module['quit'] = function(status, toThrow) {
  throw toThrow;
};
Module['preRun'] = [];
Module['postRun'] = [];

// The environment setup code below is customized to use Module.
// *** Environment setup code ***

var ENVIRONMENT_IS_WEB = false;
var ENVIRONMENT_IS_WORKER = false;
var ENVIRONMENT_IS_NODE = false;
var ENVIRONMENT_IS_SHELL = false;
ENVIRONMENT_IS_WEB = typeof window === 'object';
ENVIRONMENT_IS_WORKER = typeof importScripts === 'function';
ENVIRONMENT_IS_NODE = typeof process === 'object' && typeof require === 'function' && !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_WORKER;
ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;

if (Module['ENVIRONMENT']) {
  throw new Error('Module.ENVIRONMENT has been deprecated. To force the environment, use the ENVIRONMENT compile-time option (for example, -s ENVIRONMENT=web or -s ENVIRONMENT=node)');
}

// Three configurations we can be running in:
// 1) We could be the application main() thread running in the main JS UI thread. (ENVIRONMENT_IS_WORKER == false and ENVIRONMENT_IS_PTHREAD == false)
// 2) We could be the application main() thread proxied to worker. (with Emscripten -s PROXY_TO_WORKER=1) (ENVIRONMENT_IS_WORKER == true, ENVIRONMENT_IS_PTHREAD == false)
// 3) We could be an application pthread running in a worker. (ENVIRONMENT_IS_WORKER == true and ENVIRONMENT_IS_PTHREAD == true)

if (ENVIRONMENT_IS_NODE) {


  // Expose functionality in the same simple way that the shells work
  // Note that we pollute the global namespace here, otherwise we break in node
  var nodeFS;
  var nodePath;

  Module['read'] = function shell_read(filename, binary) {
    var ret;
    ret = tryParseAsDataURI(filename);
    if (!ret) {
      if (!nodeFS) nodeFS = require('fs');
      if (!nodePath) nodePath = require('path');
      filename = nodePath['normalize'](filename);
      ret = nodeFS['readFileSync'](filename);
    }
    return binary ? ret : ret.toString();
  };

  Module['readBinary'] = function readBinary(filename) {
    var ret = Module['read'](filename, true);
    if (!ret.buffer) {
      ret = new Uint8Array(ret);
    }
    assert(ret.buffer);
    return ret;
  };

  if (process['argv'].length > 1) {
    Module['thisProgram'] = process['argv'][1].replace(/\\/g, '/');
  }

  Module['arguments'] = process['argv'].slice(2);

  if (typeof module !== 'undefined') {
    module['exports'] = Module;
  }

  process['on']('uncaughtException', function(ex) {
    // suppress ExitStatus exceptions from showing an error
    if (!(ex instanceof ExitStatus)) {
      throw ex;
    }
  });
  // Currently node will swallow unhandled rejections, but this behavior is
  // deprecated, and in the future it will exit with error status.
  process['on']('unhandledRejection', function(reason, p) {
    err('node.js exiting due to unhandled promise rejection');
    process['exit'](1);
  });

  Module['quit'] = function(status) {
    process['exit'](status);
  };

  Module['inspect'] = function () { return '[Emscripten Module object]'; };
} else
if (ENVIRONMENT_IS_SHELL) {


  if (typeof read != 'undefined') {
    Module['read'] = function shell_read(f) {
      var data = tryParseAsDataURI(f);
      if (data) {
        return intArrayToString(data);
      }
      return read(f);
    };
  }

  Module['readBinary'] = function readBinary(f) {
    var data;
    data = tryParseAsDataURI(f);
    if (data) {
      return data;
    }
    if (typeof readbuffer === 'function') {
      return new Uint8Array(readbuffer(f));
    }
    data = read(f, 'binary');
    assert(typeof data === 'object');
    return data;
  };

  if (typeof scriptArgs != 'undefined') {
    Module['arguments'] = scriptArgs;
  } else if (typeof arguments != 'undefined') {
    Module['arguments'] = arguments;
  }

  if (typeof quit === 'function') {
    Module['quit'] = function(status) {
      quit(status);
    }
  }
} else
if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {


  Module['read'] = function shell_read(url) {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, false);
      xhr.send(null);
      return xhr.responseText;
    } catch (err) {
      var data = tryParseAsDataURI(url);
      if (data) {
        return intArrayToString(data);
      }
      throw err;
    }
  };

  if (ENVIRONMENT_IS_WORKER) {
    Module['readBinary'] = function readBinary(url) {
      try {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, false);
        xhr.responseType = 'arraybuffer';
        xhr.send(null);
        return new Uint8Array(xhr.response);
      } catch (err) {
        var data = tryParseAsDataURI(url);
        if (data) {
          return data;
        }
        throw err;
      }
    };
  }

  Module['readAsync'] = function readAsync(url, onload, onerror) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    xhr.onload = function xhr_onload() {
      if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) { // file URLs can return 0
        onload(xhr.response);
        return;
      }
      var data = tryParseAsDataURI(url);
      if (data) {
        onload(data.buffer);
        return;
      }
      onerror();
    };
    xhr.onerror = onerror;
    xhr.send(null);
  };

  Module['setWindowTitle'] = function(title) { document.title = title };
} else
{
  throw new Error('environment detection error');
}

// Set up the out() and err() hooks, which are how we can print to stdout or
// stderr, respectively.
// If the user provided Module.print or printErr, use that. Otherwise,
// console.log is checked first, as 'print' on the web will open a print dialogue
// printErr is preferable to console.warn (works better in shells)
// bind(console) is necessary to fix IE/Edge closed dev tools panel behavior.
var out = Module['print'] || (typeof console !== 'undefined' ? console.log.bind(console) : (typeof print !== 'undefined' ? print : null));
var err = Module['printErr'] || (typeof printErr !== 'undefined' ? printErr : ((typeof console !== 'undefined' && console.warn.bind(console)) || out));

// *** Environment setup code ***

// Merge back in the overrides
for (key in moduleOverrides) {
  if (moduleOverrides.hasOwnProperty(key)) {
    Module[key] = moduleOverrides[key];
  }
}
// Free the object hierarchy contained in the overrides, this lets the GC
// reclaim data used e.g. in memoryInitializerRequest, which is a large typed array.
moduleOverrides = undefined;



// {{PREAMBLE_ADDITIONS}}

var STACK_ALIGN = 16;

// stack management, and other functionality that is provided by the compiled code,
// should not be used before it is ready
stackSave = stackRestore = stackAlloc = setTempRet0 = getTempRet0 = function() {
  abort('cannot use the stack before compiled code is ready to run, and has provided stack access');
};

function staticAlloc(size) {
  assert(!staticSealed);
  var ret = STATICTOP;
  STATICTOP = (STATICTOP + size + 15) & -16;
  assert(STATICTOP < TOTAL_MEMORY, 'not enough memory for static allocation - increase TOTAL_MEMORY');
  return ret;
}

function dynamicAlloc(size) {
  assert(DYNAMICTOP_PTR);
  var ret = HEAP32[DYNAMICTOP_PTR>>2];
  var end = (ret + size + 15) & -16;
  HEAP32[DYNAMICTOP_PTR>>2] = end;
  if (end >= TOTAL_MEMORY) {
    var success = enlargeMemory();
    if (!success) {
      HEAP32[DYNAMICTOP_PTR>>2] = ret;
      return 0;
    }
  }
  return ret;
}

function alignMemory(size, factor) {
  if (!factor) factor = STACK_ALIGN; // stack alignment (16-byte) by default
  var ret = size = Math.ceil(size / factor) * factor;
  return ret;
}

function getNativeTypeSize(type) {
  switch (type) {
    case 'i1': case 'i8': return 1;
    case 'i16': return 2;
    case 'i32': return 4;
    case 'i64': return 8;
    case 'float': return 4;
    case 'double': return 8;
    default: {
      if (type[type.length-1] === '*') {
        return 4; // A pointer
      } else if (type[0] === 'i') {
        var bits = parseInt(type.substr(1));
        assert(bits % 8 === 0);
        return bits / 8;
      } else {
        return 0;
      }
    }
  }
}

function warnOnce(text) {
  if (!warnOnce.shown) warnOnce.shown = {};
  if (!warnOnce.shown[text]) {
    warnOnce.shown[text] = 1;
    err(text);
  }
}

var asm2wasmImports = { // special asm2wasm imports
    "f64-rem": function(x, y) {
        return x % y;
    },
    "debugger": function() {
        debugger;
    }
};



var jsCallStartIndex = 1;
var functionPointers = new Array(0);

// 'sig' parameter is only used on LLVM wasm backend
function addFunction(func, sig) {
  if (typeof sig === 'undefined') {
    err('warning: addFunction(): You should provide a wasm function signature string as a second argument. This is not necessary for asm.js and asm2wasm, but is required for the LLVM wasm backend, so it is recommended for full portability.');
  }
  var base = 0;
  for (var i = base; i < base + 0; i++) {
    if (!functionPointers[i]) {
      functionPointers[i] = func;
      return jsCallStartIndex + i;
    }
  }
  throw 'Finished up all reserved function pointers. Use a higher value for RESERVED_FUNCTION_POINTERS.';
}

function removeFunction(index) {
  functionPointers[index-jsCallStartIndex] = null;
}

var funcWrappers = {};

function getFuncWrapper(func, sig) {
  if (!func) return; // on null pointer, return undefined
  assert(sig);
  if (!funcWrappers[sig]) {
    funcWrappers[sig] = {};
  }
  var sigCache = funcWrappers[sig];
  if (!sigCache[func]) {
    // optimize away arguments usage in common cases
    if (sig.length === 1) {
      sigCache[func] = function dynCall_wrapper() {
        return dynCall(sig, func);
      };
    } else if (sig.length === 2) {
      sigCache[func] = function dynCall_wrapper(arg) {
        return dynCall(sig, func, [arg]);
      };
    } else {
      // general case
      sigCache[func] = function dynCall_wrapper() {
        return dynCall(sig, func, Array.prototype.slice.call(arguments));
      };
    }
  }
  return sigCache[func];
}


function makeBigInt(low, high, unsigned) {
  return unsigned ? ((+((low>>>0)))+((+((high>>>0)))*4294967296.0)) : ((+((low>>>0)))+((+((high|0)))*4294967296.0));
}

function dynCall(sig, ptr, args) {
  if (args && args.length) {
    assert(args.length == sig.length-1);
    assert(('dynCall_' + sig) in Module, 'bad function pointer type - no table for sig \'' + sig + '\'');
    return Module['dynCall_' + sig].apply(null, [ptr].concat(args));
  } else {
    assert(sig.length == 1);
    assert(('dynCall_' + sig) in Module, 'bad function pointer type - no table for sig \'' + sig + '\'');
    return Module['dynCall_' + sig].call(null, ptr);
  }
}


function getCompilerSetting(name) {
  throw 'You must build with -s RETAIN_COMPILER_SETTINGS=1 for getCompilerSetting or emscripten_get_compiler_setting to work';
}

var Runtime = {
  // FIXME backwards compatibility layer for ports. Support some Runtime.*
  //       for now, fix it there, then remove it from here. That way we
  //       can minimize any period of breakage.
  dynCall: dynCall, // for SDL2 port
  // helpful errors
  getTempRet0: function() { abort('getTempRet0() is now a top-level function, after removing the Runtime object. Remove "Runtime."') },
  staticAlloc: function() { abort('staticAlloc() is now a top-level function, after removing the Runtime object. Remove "Runtime."') },
  stackAlloc: function() { abort('stackAlloc() is now a top-level function, after removing the Runtime object. Remove "Runtime."') },
};

// The address globals begin at. Very low in memory, for code size and optimization opportunities.
// Above 0 is static memory, starting with globals.
// Then the stack.
// Then 'dynamic' memory for sbrk.
var GLOBAL_BASE = 8;


// === Preamble library stuff ===

// Documentation for the public APIs defined in this file must be updated in:
//    site/source/docs/api_reference/preamble.js.rst
// A prebuilt local version of the documentation is available at:
//    site/build/text/docs/api_reference/preamble.js.txt
// You can also build docs locally as HTML or other formats in site/
// An online HTML version (which may be of a different version of Emscripten)
//    is up at http://kripken.github.io/emscripten-site/docs/api_reference/preamble.js.html



//========================================
// Runtime essentials
//========================================

var ABORT = 0; // whether we are quitting the application. no code should run after this. set in exit() and abort()
var EXITSTATUS = 0;

/** @type {function(*, string=)} */
function assert(condition, text) {
  if (!condition) {
    abort('Assertion failed: ' + text);
  }
}

var globalScope = this;

// Returns the C function with a specified identifier (for C++, you need to do manual name mangling)
function getCFunc(ident) {
  var func = Module['_' + ident]; // closure exported function
  assert(func, 'Cannot call unknown function ' + ident + ', make sure it is exported');
  return func;
}

var JSfuncs = {
  // Helpers for cwrap -- it can't refer to Runtime directly because it might
  // be renamed by closure, instead it calls JSfuncs['stackSave'].body to find
  // out what the minified function name is.
  'stackSave': function() {
    stackSave()
  },
  'stackRestore': function() {
    stackRestore()
  },
  // type conversion from js to c
  'arrayToC' : function(arr) {
    var ret = stackAlloc(arr.length);
    writeArrayToMemory(arr, ret);
    return ret;
  },
  'stringToC' : function(str) {
    var ret = 0;
    if (str !== null && str !== undefined && str !== 0) { // null string
      // at most 4 bytes per UTF-8 code point, +1 for the trailing '\0'
      var len = (str.length << 2) + 1;
      ret = stackAlloc(len);
      stringToUTF8(str, ret, len);
    }
    return ret;
  }
};

// For fast lookup of conversion functions
var toC = {
  'string': JSfuncs['stringToC'], 'array': JSfuncs['arrayToC']
};


// C calling interface.
function ccall(ident, returnType, argTypes, args, opts) {
  function convertReturnValue(ret) {
    if (returnType === 'string') return Pointer_stringify(ret);
    if (returnType === 'boolean') return Boolean(ret);
    return ret;
  }

  var func = getCFunc(ident);
  var cArgs = [];
  var stack = 0;
  assert(returnType !== 'array', 'Return type should not be "array".');
  if (args) {
    for (var i = 0; i < args.length; i++) {
      var converter = toC[argTypes[i]];
      if (converter) {
        if (stack === 0) stack = stackSave();
        cArgs[i] = converter(args[i]);
      } else {
        cArgs[i] = args[i];
      }
    }
  }
  var ret = func.apply(null, cArgs);
  ret = convertReturnValue(ret);
  if (stack !== 0) stackRestore(stack);
  return ret;
}

function cwrap(ident, returnType, argTypes, opts) {
  return function() {
    return ccall(ident, returnType, argTypes, arguments, opts);
  }
}

/** @type {function(number, number, string, boolean=)} */
function setValue(ptr, value, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': HEAP8[((ptr)>>0)]=value; break;
      case 'i8': HEAP8[((ptr)>>0)]=value; break;
      case 'i16': HEAP16[((ptr)>>1)]=value; break;
      case 'i32': HEAP32[((ptr)>>2)]=value; break;
      case 'i64': (tempI64 = [value>>>0,(tempDouble=value,(+(Math_abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? ((Math_min((+(Math_floor((tempDouble)/4294967296.0))), 4294967295.0))|0)>>>0 : (~~((+(Math_ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)],HEAP32[((ptr)>>2)]=tempI64[0],HEAP32[(((ptr)+(4))>>2)]=tempI64[1]); break;
      case 'float': HEAPF32[((ptr)>>2)]=value; break;
      case 'double': HEAPF64[((ptr)>>3)]=value; break;
      default: abort('invalid type for setValue: ' + type);
    }
}

/** @type {function(number, string, boolean=)} */
function getValue(ptr, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': return HEAP8[((ptr)>>0)];
      case 'i8': return HEAP8[((ptr)>>0)];
      case 'i16': return HEAP16[((ptr)>>1)];
      case 'i32': return HEAP32[((ptr)>>2)];
      case 'i64': return HEAP32[((ptr)>>2)];
      case 'float': return HEAPF32[((ptr)>>2)];
      case 'double': return HEAPF64[((ptr)>>3)];
      default: abort('invalid type for getValue: ' + type);
    }
  return null;
}

var ALLOC_NORMAL = 0; // Tries to use _malloc()
var ALLOC_STACK = 1; // Lives for the duration of the current function call
var ALLOC_STATIC = 2; // Cannot be freed
var ALLOC_DYNAMIC = 3; // Cannot be freed except through sbrk
var ALLOC_NONE = 4; // Do not allocate

// allocate(): This is for internal use. You can use it yourself as well, but the interface
//             is a little tricky (see docs right below). The reason is that it is optimized
//             for multiple syntaxes to save space in generated code. So you should
//             normally not use allocate(), and instead allocate memory using _malloc(),
//             initialize it with setValue(), and so forth.
// @slab: An array of data, or a number. If a number, then the size of the block to allocate,
//        in *bytes* (note that this is sometimes confusing: the next parameter does not
//        affect this!)
// @types: Either an array of types, one for each byte (or 0 if no type at that position),
//         or a single type which is used for the entire block. This only matters if there
//         is initial data - if @slab is a number, then this does not matter at all and is
//         ignored.
// @allocator: How to allocate memory, see ALLOC_*
/** @type {function((TypedArray|Array<number>|number), string, number, number=)} */
function allocate(slab, types, allocator, ptr) {
  var zeroinit, size;
  if (typeof slab === 'number') {
    zeroinit = true;
    size = slab;
  } else {
    zeroinit = false;
    size = slab.length;
  }

  var singleType = typeof types === 'string' ? types : null;

  var ret;
  if (allocator == ALLOC_NONE) {
    ret = ptr;
  } else {
    ret = [typeof _malloc === 'function' ? _malloc : staticAlloc, stackAlloc, staticAlloc, dynamicAlloc][allocator === undefined ? ALLOC_STATIC : allocator](Math.max(size, singleType ? 1 : types.length));
  }

  if (zeroinit) {
    var stop;
    ptr = ret;
    assert((ret & 3) == 0);
    stop = ret + (size & ~3);
    for (; ptr < stop; ptr += 4) {
      HEAP32[((ptr)>>2)]=0;
    }
    stop = ret + size;
    while (ptr < stop) {
      HEAP8[((ptr++)>>0)]=0;
    }
    return ret;
  }

  if (singleType === 'i8') {
    if (slab.subarray || slab.slice) {
      HEAPU8.set(/** @type {!Uint8Array} */ (slab), ret);
    } else {
      HEAPU8.set(new Uint8Array(slab), ret);
    }
    return ret;
  }

  var i = 0, type, typeSize, previousType;
  while (i < size) {
    var curr = slab[i];

    type = singleType || types[i];
    if (type === 0) {
      i++;
      continue;
    }
    assert(type, 'Must know what type to store in allocate!');

    if (type == 'i64') type = 'i32'; // special case: we have one i32 here, and one i32 later

    setValue(ret+i, curr, type);

    // no need to look up size unless type changes, so cache it
    if (previousType !== type) {
      typeSize = getNativeTypeSize(type);
      previousType = type;
    }
    i += typeSize;
  }

  return ret;
}

// Allocate memory during any stage of startup - static memory early on, dynamic memory later, malloc when ready
function getMemory(size) {
  if (!staticSealed) return staticAlloc(size);
  if (!runtimeInitialized) return dynamicAlloc(size);
  return _malloc(size);
}

/** @type {function(number, number=)} */
function Pointer_stringify(ptr, length) {
  if (length === 0 || !ptr) return '';
  // Find the length, and check for UTF while doing so
  var hasUtf = 0;
  var t;
  var i = 0;
  while (1) {
    assert(ptr + i < TOTAL_MEMORY);
    t = HEAPU8[(((ptr)+(i))>>0)];
    hasUtf |= t;
    if (t == 0 && !length) break;
    i++;
    if (length && i == length) break;
  }
  if (!length) length = i;

  var ret = '';

  if (hasUtf < 128) {
    var MAX_CHUNK = 1024; // split up into chunks, because .apply on a huge string can overflow the stack
    var curr;
    while (length > 0) {
      curr = String.fromCharCode.apply(String, HEAPU8.subarray(ptr, ptr + Math.min(length, MAX_CHUNK)));
      ret = ret ? ret + curr : curr;
      ptr += MAX_CHUNK;
      length -= MAX_CHUNK;
    }
    return ret;
  }
  return UTF8ToString(ptr);
}

// Given a pointer 'ptr' to a null-terminated ASCII-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function AsciiToString(ptr) {
  var str = '';
  while (1) {
    var ch = HEAP8[((ptr++)>>0)];
    if (!ch) return str;
    str += String.fromCharCode(ch);
  }
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in ASCII form. The copy will require at most str.length+1 bytes of space in the HEAP.

function stringToAscii(str, outPtr) {
  return writeAsciiToMemory(str, outPtr, false);
}

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the given array that contains uint8 values, returns
// a copy of that string as a Javascript String object.

var UTF8Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf8') : undefined;
function UTF8ArrayToString(u8Array, idx) {
  var endPtr = idx;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on null terminator by itself.
  // Also, use the length info to avoid running tiny strings through TextDecoder, since .subarray() allocates garbage.
  while (u8Array[endPtr]) ++endPtr;

  if (endPtr - idx > 16 && u8Array.subarray && UTF8Decoder) {
    return UTF8Decoder.decode(u8Array.subarray(idx, endPtr));
  } else {
    var u0, u1, u2, u3, u4, u5;

    var str = '';
    while (1) {
      // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
      u0 = u8Array[idx++];
      if (!u0) return str;
      if (!(u0 & 0x80)) { str += String.fromCharCode(u0); continue; }
      u1 = u8Array[idx++] & 63;
      if ((u0 & 0xE0) == 0xC0) { str += String.fromCharCode(((u0 & 31) << 6) | u1); continue; }
      u2 = u8Array[idx++] & 63;
      if ((u0 & 0xF0) == 0xE0) {
        u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
      } else {
        u3 = u8Array[idx++] & 63;
        if ((u0 & 0xF8) == 0xF0) {
          u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | u3;
        } else {
          u4 = u8Array[idx++] & 63;
          if ((u0 & 0xFC) == 0xF8) {
            u0 = ((u0 & 3) << 24) | (u1 << 18) | (u2 << 12) | (u3 << 6) | u4;
          } else {
            u5 = u8Array[idx++] & 63;
            u0 = ((u0 & 1) << 30) | (u1 << 24) | (u2 << 18) | (u3 << 12) | (u4 << 6) | u5;
          }
        }
      }
      if (u0 < 0x10000) {
        str += String.fromCharCode(u0);
      } else {
        var ch = u0 - 0x10000;
        str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
      }
    }
  }
}

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function UTF8ToString(ptr) {
  return UTF8ArrayToString(HEAPU8,ptr);
}

// Copies the given Javascript String object 'str' to the given byte array at address 'outIdx',
// encoded in UTF8 form and null-terminated. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8 to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outU8Array: the array to copy to. Each index in this array is assumed to be one 8-byte element.
//   outIdx: The starting offset in the array to begin the copying.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=1, only the null terminator will be written and nothing else.
//                    maxBytesToWrite=0 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8Array(str, outU8Array, outIdx, maxBytesToWrite) {
  if (!(maxBytesToWrite > 0)) // Parameter maxBytesToWrite is not optional. Negative values, 0, null, undefined and false each don't write out any bytes.
    return 0;

  var startIdx = outIdx;
  var endIdx = outIdx + maxBytesToWrite - 1; // -1 for string null terminator.
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) u = 0x10000 + ((u & 0x3FF) << 10) | (str.charCodeAt(++i) & 0x3FF);
    if (u <= 0x7F) {
      if (outIdx >= endIdx) break;
      outU8Array[outIdx++] = u;
    } else if (u <= 0x7FF) {
      if (outIdx + 1 >= endIdx) break;
      outU8Array[outIdx++] = 0xC0 | (u >> 6);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0xFFFF) {
      if (outIdx + 2 >= endIdx) break;
      outU8Array[outIdx++] = 0xE0 | (u >> 12);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0x1FFFFF) {
      if (outIdx + 3 >= endIdx) break;
      outU8Array[outIdx++] = 0xF0 | (u >> 18);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0x3FFFFFF) {
      if (outIdx + 4 >= endIdx) break;
      outU8Array[outIdx++] = 0xF8 | (u >> 24);
      outU8Array[outIdx++] = 0x80 | ((u >> 18) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else {
      if (outIdx + 5 >= endIdx) break;
      outU8Array[outIdx++] = 0xFC | (u >> 30);
      outU8Array[outIdx++] = 0x80 | ((u >> 24) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 18) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    }
  }
  // Null-terminate the pointer to the buffer.
  outU8Array[outIdx] = 0;
  return outIdx - startIdx;
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF8 form. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8 to compute the exact number of bytes (excluding null terminator) that this function will write.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8(str, outPtr, maxBytesToWrite) {
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF8(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  return stringToUTF8Array(str, HEAPU8,outPtr, maxBytesToWrite);
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF8 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF8(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) u = 0x10000 + ((u & 0x3FF) << 10) | (str.charCodeAt(++i) & 0x3FF);
    if (u <= 0x7F) {
      ++len;
    } else if (u <= 0x7FF) {
      len += 2;
    } else if (u <= 0xFFFF) {
      len += 3;
    } else if (u <= 0x1FFFFF) {
      len += 4;
    } else if (u <= 0x3FFFFFF) {
      len += 5;
    } else {
      len += 6;
    }
  }
  return len;
}

// Given a pointer 'ptr' to a null-terminated UTF16LE-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

var UTF16Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-16le') : undefined;
function UTF16ToString(ptr) {
  assert(ptr % 2 == 0, 'Pointer passed to UTF16ToString must be aligned to two bytes!');
  var endPtr = ptr;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on null terminator by itself.
  // Also, use the length info to avoid running tiny strings through TextDecoder, since .subarray() allocates garbage.
  var idx = endPtr >> 1;
  while (HEAP16[idx]) ++idx;
  endPtr = idx << 1;

  if (endPtr - ptr > 32 && UTF16Decoder) {
    return UTF16Decoder.decode(HEAPU8.subarray(ptr, endPtr));
  } else {
    var i = 0;

    var str = '';
    while (1) {
      var codeUnit = HEAP16[(((ptr)+(i*2))>>1)];
      if (codeUnit == 0) return str;
      ++i;
      // fromCharCode constructs a character from a UTF-16 code unit, so we can pass the UTF16 string right through.
      str += String.fromCharCode(codeUnit);
    }
  }
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF16 form. The copy will require at most str.length*4+2 bytes of space in the HEAP.
// Use the function lengthBytesUTF16() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=2, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<2 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF16(str, outPtr, maxBytesToWrite) {
  assert(outPtr % 2 == 0, 'Pointer passed to stringToUTF16 must be aligned to two bytes!');
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF16(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 2) return 0;
  maxBytesToWrite -= 2; // Null terminator.
  var startPtr = outPtr;
  var numCharsToWrite = (maxBytesToWrite < str.length*2) ? (maxBytesToWrite / 2) : str.length;
  for (var i = 0; i < numCharsToWrite; ++i) {
    // charCodeAt returns a UTF-16 encoded code unit, so it can be directly written to the HEAP.
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    HEAP16[((outPtr)>>1)]=codeUnit;
    outPtr += 2;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP16[((outPtr)>>1)]=0;
  return outPtr - startPtr;
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF16(str) {
  return str.length*2;
}

function UTF32ToString(ptr) {
  assert(ptr % 4 == 0, 'Pointer passed to UTF32ToString must be aligned to four bytes!');
  var i = 0;

  var str = '';
  while (1) {
    var utf32 = HEAP32[(((ptr)+(i*4))>>2)];
    if (utf32 == 0)
      return str;
    ++i;
    // Gotcha: fromCharCode constructs a character from a UTF-16 encoded code (pair), not from a Unicode code point! So encode the code point to UTF-16 for constructing.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    if (utf32 >= 0x10000) {
      var ch = utf32 - 0x10000;
      str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
    } else {
      str += String.fromCharCode(utf32);
    }
  }
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF32 form. The copy will require at most str.length*4+4 bytes of space in the HEAP.
// Use the function lengthBytesUTF32() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=4, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<4 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF32(str, outPtr, maxBytesToWrite) {
  assert(outPtr % 4 == 0, 'Pointer passed to stringToUTF32 must be aligned to four bytes!');
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF32(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 4) return 0;
  var startPtr = outPtr;
  var endPtr = startPtr + maxBytesToWrite - 4;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) {
      var trailSurrogate = str.charCodeAt(++i);
      codeUnit = 0x10000 + ((codeUnit & 0x3FF) << 10) | (trailSurrogate & 0x3FF);
    }
    HEAP32[((outPtr)>>2)]=codeUnit;
    outPtr += 4;
    if (outPtr + 4 > endPtr) break;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP32[((outPtr)>>2)]=0;
  return outPtr - startPtr;
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF32(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i);
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) ++i; // possibly a lead surrogate, so skip over the tail surrogate.
    len += 4;
  }

  return len;
}

// Allocate heap space for a JS string, and write it there.
// It is the responsibility of the caller to free() that memory.
function allocateUTF8(str) {
  var size = lengthBytesUTF8(str) + 1;
  var ret = _malloc(size);
  if (ret) stringToUTF8Array(str, HEAP8, ret, size);
  return ret;
}

// Allocate stack space for a JS string, and write it there.
function allocateUTF8OnStack(str) {
  var size = lengthBytesUTF8(str) + 1;
  var ret = stackAlloc(size);
  stringToUTF8Array(str, HEAP8, ret, size);
  return ret;
}

function demangle(func) {
  warnOnce('warning: build with  -s DEMANGLE_SUPPORT=1  to link in libcxxabi demangling');
  return func;
}

function demangleAll(text) {
  var regex =
    /__Z[\w\d_]+/g;
  return text.replace(regex,
    function(x) {
      var y = demangle(x);
      return x === y ? x : (x + ' [' + y + ']');
    });
}

function jsStackTrace() {
  var err = new Error();
  if (!err.stack) {
    // IE10+ special cases: It does have callstack info, but it is only populated if an Error object is thrown,
    // so try that as a special-case.
    try {
      throw new Error(0);
    } catch(e) {
      err = e;
    }
    if (!err.stack) {
      return '(no stack trace available)';
    }
  }
  return err.stack.toString();
}

function stackTrace() {
  var js = jsStackTrace();
  if (Module['extraStackTrace']) js += '\n' + Module['extraStackTrace']();
  return demangleAll(js);
}

// Memory management

var PAGE_SIZE = 16384;
var WASM_PAGE_SIZE = 65536;
var ASMJS_PAGE_SIZE = 16777216;
var MIN_TOTAL_MEMORY = 16777216;

function alignUp(x, multiple) {
  if (x % multiple > 0) {
    x += multiple - (x % multiple);
  }
  return x;
}

var HEAP,
/** @type {ArrayBuffer} */
  buffer,
/** @type {Int8Array} */
  HEAP8,
/** @type {Uint8Array} */
  HEAPU8,
/** @type {Int16Array} */
  HEAP16,
/** @type {Uint16Array} */
  HEAPU16,
/** @type {Int32Array} */
  HEAP32,
/** @type {Uint32Array} */
  HEAPU32,
/** @type {Float32Array} */
  HEAPF32,
/** @type {Float64Array} */
  HEAPF64;

function updateGlobalBuffer(buf) {
  Module['buffer'] = buffer = buf;
}

function updateGlobalBufferViews() {
  Module['HEAP8'] = HEAP8 = new Int8Array(buffer);
  Module['HEAP16'] = HEAP16 = new Int16Array(buffer);
  Module['HEAP32'] = HEAP32 = new Int32Array(buffer);
  Module['HEAPU8'] = HEAPU8 = new Uint8Array(buffer);
  Module['HEAPU16'] = HEAPU16 = new Uint16Array(buffer);
  Module['HEAPU32'] = HEAPU32 = new Uint32Array(buffer);
  Module['HEAPF32'] = HEAPF32 = new Float32Array(buffer);
  Module['HEAPF64'] = HEAPF64 = new Float64Array(buffer);
}

var STATIC_BASE, STATICTOP, staticSealed; // static area
var STACK_BASE, STACKTOP, STACK_MAX; // stack area
var DYNAMIC_BASE, DYNAMICTOP_PTR; // dynamic area handled by sbrk

  STATIC_BASE = STATICTOP = STACK_BASE = STACKTOP = STACK_MAX = DYNAMIC_BASE = DYNAMICTOP_PTR = 0;
  staticSealed = false;


// Initializes the stack cookie. Called at the startup of main and at the startup of each thread in pthreads mode.
function writeStackCookie() {
  assert((STACK_MAX & 3) == 0);
  HEAPU32[(STACK_MAX >> 2)-1] = 0x02135467;
  HEAPU32[(STACK_MAX >> 2)-2] = 0x89BACDFE;
}

function checkStackCookie() {
  if (HEAPU32[(STACK_MAX >> 2)-1] != 0x02135467 || HEAPU32[(STACK_MAX >> 2)-2] != 0x89BACDFE) {
    abort('Stack overflow! Stack cookie has been overwritten, expected hex dwords 0x89BACDFE and 0x02135467, but received 0x' + HEAPU32[(STACK_MAX >> 2)-2].toString(16) + ' ' + HEAPU32[(STACK_MAX >> 2)-1].toString(16));
  }
  // Also test the global address 0 for integrity. This check is not compatible with SAFE_SPLIT_MEMORY though, since that mode already tests all address 0 accesses on its own.
  if (HEAP32[0] !== 0x63736d65 /* 'emsc' */) throw 'Runtime error: The application has corrupted its heap memory area (address zero)!';
}

function abortStackOverflow(allocSize) {
  abort('Stack overflow! Attempted to allocate ' + allocSize + ' bytes on the stack, but stack has only ' + (STACK_MAX - stackSave() + allocSize) + ' bytes available!');
}


function abortOnCannotGrowMemory() {
  abort('Cannot enlarge memory arrays. Either (1) compile with  -s TOTAL_MEMORY=X  with X higher than the current value ' + TOTAL_MEMORY + ', (2) compile with  -s ALLOW_MEMORY_GROWTH=1  which allows increasing the size at runtime but prevents some optimizations, (3) set Module.TOTAL_MEMORY to a higher value before the program runs, or (4) if you want malloc to return NULL (0) instead of this abort, compile with  -s ABORTING_MALLOC=0 ');
}


function enlargeMemory() {
  abortOnCannotGrowMemory();
}


var TOTAL_STACK = Module['TOTAL_STACK'] || 5242880;
var TOTAL_MEMORY = Module['TOTAL_MEMORY'] || 16777216;
if (TOTAL_MEMORY < TOTAL_STACK) err('TOTAL_MEMORY should be larger than TOTAL_STACK, was ' + TOTAL_MEMORY + '! (TOTAL_STACK=' + TOTAL_STACK + ')');

// Initialize the runtime's memory
// check for full engine support (use string 'subarray' to avoid closure compiler confusion)
assert(typeof Int32Array !== 'undefined' && typeof Float64Array !== 'undefined' && Int32Array.prototype.subarray !== undefined && Int32Array.prototype.set !== undefined,
       'JS engine does not provide full typed array support');



// Use a provided buffer, if there is one, or else allocate a new one
if (Module['buffer']) {
  buffer = Module['buffer'];
  assert(buffer.byteLength === TOTAL_MEMORY, 'provided buffer should be ' + TOTAL_MEMORY + ' bytes, but it is ' + buffer.byteLength);
} else {
  // Use a WebAssembly memory where available
  {
    buffer = new ArrayBuffer(TOTAL_MEMORY);
  }
  assert(buffer.byteLength === TOTAL_MEMORY);
  Module['buffer'] = buffer;
}
updateGlobalBufferViews();


function getTotalMemory() {
  return TOTAL_MEMORY;
}

// Endianness check (note: assumes compiler arch was little-endian)
  HEAP32[0] = 0x63736d65; /* 'emsc' */
HEAP16[1] = 0x6373;
if (HEAPU8[2] !== 0x73 || HEAPU8[3] !== 0x63) throw 'Runtime error: expected the system to be little-endian!';

function callRuntimeCallbacks(callbacks) {
  while(callbacks.length > 0) {
    var callback = callbacks.shift();
    if (typeof callback == 'function') {
      callback();
      continue;
    }
    var func = callback.func;
    if (typeof func === 'number') {
      if (callback.arg === undefined) {
        Module['dynCall_v'](func);
      } else {
        Module['dynCall_vi'](func, callback.arg);
      }
    } else {
      func(callback.arg === undefined ? null : callback.arg);
    }
  }
}

var __ATPRERUN__  = []; // functions called before the runtime is initialized
var __ATINIT__    = []; // functions called during startup
var __ATMAIN__    = []; // functions called when main() is to be run
var __ATEXIT__    = []; // functions called during shutdown
var __ATPOSTRUN__ = []; // functions called after the main() is called

var runtimeInitialized = false;
var runtimeExited = false;


function preRun() {
  // compatibility - merge in anything from Module['preRun'] at this time
  if (Module['preRun']) {
    if (typeof Module['preRun'] == 'function') Module['preRun'] = [Module['preRun']];
    while (Module['preRun'].length) {
      addOnPreRun(Module['preRun'].shift());
    }
  }
  callRuntimeCallbacks(__ATPRERUN__);
}

function ensureInitRuntime() {
  checkStackCookie();
  if (runtimeInitialized) return;
  runtimeInitialized = true;
  callRuntimeCallbacks(__ATINIT__);
}

function preMain() {
  checkStackCookie();
  callRuntimeCallbacks(__ATMAIN__);
}

function exitRuntime() {
  checkStackCookie();
  callRuntimeCallbacks(__ATEXIT__);
  runtimeExited = true;
}

function postRun() {
  checkStackCookie();
  // compatibility - merge in anything from Module['postRun'] at this time
  if (Module['postRun']) {
    if (typeof Module['postRun'] == 'function') Module['postRun'] = [Module['postRun']];
    while (Module['postRun'].length) {
      addOnPostRun(Module['postRun'].shift());
    }
  }
  callRuntimeCallbacks(__ATPOSTRUN__);
}

function addOnPreRun(cb) {
  __ATPRERUN__.unshift(cb);
}

function addOnInit(cb) {
  __ATINIT__.unshift(cb);
}

function addOnPreMain(cb) {
  __ATMAIN__.unshift(cb);
}

function addOnExit(cb) {
  __ATEXIT__.unshift(cb);
}

function addOnPostRun(cb) {
  __ATPOSTRUN__.unshift(cb);
}

// Deprecated: This function should not be called because it is unsafe and does not provide
// a maximum length limit of how many bytes it is allowed to write. Prefer calling the
// function stringToUTF8Array() instead, which takes in a maximum length that can be used
// to be secure from out of bounds writes.
/** @deprecated */
function writeStringToMemory(string, buffer, dontAddNull) {
  warnOnce('writeStringToMemory is deprecated and should not be called! Use stringToUTF8() instead!');

  var /** @type {number} */ lastChar, /** @type {number} */ end;
  if (dontAddNull) {
    // stringToUTF8Array always appends null. If we don't want to do that, remember the
    // character that existed at the location where the null will be placed, and restore
    // that after the write (below).
    end = buffer + lengthBytesUTF8(string);
    lastChar = HEAP8[end];
  }
  stringToUTF8(string, buffer, Infinity);
  if (dontAddNull) HEAP8[end] = lastChar; // Restore the value under the null character.
}

function writeArrayToMemory(array, buffer) {
  assert(array.length >= 0, 'writeArrayToMemory array must have a length (should be an array or typed array)')
  HEAP8.set(array, buffer);
}

function writeAsciiToMemory(str, buffer, dontAddNull) {
  for (var i = 0; i < str.length; ++i) {
    assert(str.charCodeAt(i) === str.charCodeAt(i)&0xff);
    HEAP8[((buffer++)>>0)]=str.charCodeAt(i);
  }
  // Null-terminate the pointer to the HEAP.
  if (!dontAddNull) HEAP8[((buffer)>>0)]=0;
}

function unSign(value, bits, ignore) {
  if (value >= 0) {
    return value;
  }
  return bits <= 32 ? 2*Math.abs(1 << (bits-1)) + value // Need some trickery, since if bits == 32, we are right at the limit of the bits JS uses in bitshifts
                    : Math.pow(2, bits)         + value;
}
function reSign(value, bits, ignore) {
  if (value <= 0) {
    return value;
  }
  var half = bits <= 32 ? Math.abs(1 << (bits-1)) // abs is needed if bits == 32
                        : Math.pow(2, bits-1);
  if (value >= half && (bits <= 32 || value > half)) { // for huge values, we can hit the precision limit and always get true here. so don't do that
                                                       // but, in general there is no perfect solution here. With 64-bit ints, we get rounding and errors
                                                       // TODO: In i64 mode 1, resign the two parts separately and safely
    value = -2*half + value; // Cannot bitshift half, as it may be at the limit of the bits JS uses in bitshifts
  }
  return value;
}

assert(Math['imul'] && Math['fround'] && Math['clz32'] && Math['trunc'], 'this is a legacy browser, build with LEGACY_VM_SUPPORT');

var Math_abs = Math.abs;
var Math_cos = Math.cos;
var Math_sin = Math.sin;
var Math_tan = Math.tan;
var Math_acos = Math.acos;
var Math_asin = Math.asin;
var Math_atan = Math.atan;
var Math_atan2 = Math.atan2;
var Math_exp = Math.exp;
var Math_log = Math.log;
var Math_sqrt = Math.sqrt;
var Math_ceil = Math.ceil;
var Math_floor = Math.floor;
var Math_pow = Math.pow;
var Math_imul = Math.imul;
var Math_fround = Math.fround;
var Math_round = Math.round;
var Math_min = Math.min;
var Math_max = Math.max;
var Math_clz32 = Math.clz32;
var Math_trunc = Math.trunc;

// A counter of dependencies for calling run(). If we need to
// do asynchronous work before running, increment this and
// decrement it. Incrementing must happen in a place like
// PRE_RUN_ADDITIONS (used by emcc to add file preloading).
// Note that you can add dependencies in preRun, even though
// it happens right before run - run will be postponed until
// the dependencies are met.
var runDependencies = 0;
var runDependencyWatcher = null;
var dependenciesFulfilled = null; // overridden to take different actions when all run dependencies are fulfilled
var runDependencyTracking = {};

function getUniqueRunDependency(id) {
  var orig = id;
  while (1) {
    if (!runDependencyTracking[id]) return id;
    id = orig + Math.random();
  }
  return id;
}

function addRunDependency(id) {
  runDependencies++;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
  if (id) {
    assert(!runDependencyTracking[id]);
    runDependencyTracking[id] = 1;
    if (runDependencyWatcher === null && typeof setInterval !== 'undefined') {
      // Check for missing dependencies every few seconds
      runDependencyWatcher = setInterval(function() {
        if (ABORT) {
          clearInterval(runDependencyWatcher);
          runDependencyWatcher = null;
          return;
        }
        var shown = false;
        for (var dep in runDependencyTracking) {
          if (!shown) {
            shown = true;
            err('still waiting on run dependencies:');
          }
          err('dependency: ' + dep);
        }
        if (shown) {
          err('(end of list)');
        }
      }, 10000);
    }
  } else {
    err('warning: run dependency added without ID');
  }
}

function removeRunDependency(id) {
  runDependencies--;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
  if (id) {
    assert(runDependencyTracking[id]);
    delete runDependencyTracking[id];
  } else {
    err('warning: run dependency removed without ID');
  }
  if (runDependencies == 0) {
    if (runDependencyWatcher !== null) {
      clearInterval(runDependencyWatcher);
      runDependencyWatcher = null;
    }
    if (dependenciesFulfilled) {
      var callback = dependenciesFulfilled;
      dependenciesFulfilled = null;
      callback(); // can add another dependenciesFulfilled
    }
  }
}

Module["preloadedImages"] = {}; // maps url to image data
Module["preloadedAudios"] = {}; // maps url to audio data



var memoryInitializer = null;






// Prefix of data URIs emitted by SINGLE_FILE and related options.
var dataURIPrefix = 'data:application/octet-stream;base64,';

// Indicates whether filename is a base64 data URI.
function isDataURI(filename) {
  return String.prototype.startsWith ?
      filename.startsWith(dataURIPrefix) :
      filename.indexOf(dataURIPrefix) === 0;
}





// === Body ===

var ASM_CONSTS = [];





STATIC_BASE = GLOBAL_BASE;

STATICTOP = STATIC_BASE + 33888;
/* global initializers */  __ATINIT__.push();


memoryInitializer = "data:application/octet-stream;base64,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";





/* no memory initializer */
var tempDoublePtr = STATICTOP; STATICTOP += 16;

assert(tempDoublePtr % 8 == 0);

function copyTempFloat(ptr) { // functions, because inlining this code increases code size too much

  HEAP8[tempDoublePtr] = HEAP8[ptr];

  HEAP8[tempDoublePtr+1] = HEAP8[ptr+1];

  HEAP8[tempDoublePtr+2] = HEAP8[ptr+2];

  HEAP8[tempDoublePtr+3] = HEAP8[ptr+3];

}

function copyTempDouble(ptr) {

  HEAP8[tempDoublePtr] = HEAP8[ptr];

  HEAP8[tempDoublePtr+1] = HEAP8[ptr+1];

  HEAP8[tempDoublePtr+2] = HEAP8[ptr+2];

  HEAP8[tempDoublePtr+3] = HEAP8[ptr+3];

  HEAP8[tempDoublePtr+4] = HEAP8[ptr+4];

  HEAP8[tempDoublePtr+5] = HEAP8[ptr+5];

  HEAP8[tempDoublePtr+6] = HEAP8[ptr+6];

  HEAP8[tempDoublePtr+7] = HEAP8[ptr+7];

}

// {{PRE_LIBRARY}}


  function ___lock() {}

  
    

  
  
  
  var ERRNO_CODES={EPERM:1,ENOENT:2,ESRCH:3,EINTR:4,EIO:5,ENXIO:6,E2BIG:7,ENOEXEC:8,EBADF:9,ECHILD:10,EAGAIN:11,EWOULDBLOCK:11,ENOMEM:12,EACCES:13,EFAULT:14,ENOTBLK:15,EBUSY:16,EEXIST:17,EXDEV:18,ENODEV:19,ENOTDIR:20,EISDIR:21,EINVAL:22,ENFILE:23,EMFILE:24,ENOTTY:25,ETXTBSY:26,EFBIG:27,ENOSPC:28,ESPIPE:29,EROFS:30,EMLINK:31,EPIPE:32,EDOM:33,ERANGE:34,ENOMSG:42,EIDRM:43,ECHRNG:44,EL2NSYNC:45,EL3HLT:46,EL3RST:47,ELNRNG:48,EUNATCH:49,ENOCSI:50,EL2HLT:51,EDEADLK:35,ENOLCK:37,EBADE:52,EBADR:53,EXFULL:54,ENOANO:55,EBADRQC:56,EBADSLT:57,EDEADLOCK:35,EBFONT:59,ENOSTR:60,ENODATA:61,ETIME:62,ENOSR:63,ENONET:64,ENOPKG:65,EREMOTE:66,ENOLINK:67,EADV:68,ESRMNT:69,ECOMM:70,EPROTO:71,EMULTIHOP:72,EDOTDOT:73,EBADMSG:74,ENOTUNIQ:76,EBADFD:77,EREMCHG:78,ELIBACC:79,ELIBBAD:80,ELIBSCN:81,ELIBMAX:82,ELIBEXEC:83,ENOSYS:38,ENOTEMPTY:39,ENAMETOOLONG:36,ELOOP:40,EOPNOTSUPP:95,EPFNOSUPPORT:96,ECONNRESET:104,ENOBUFS:105,EAFNOSUPPORT:97,EPROTOTYPE:91,ENOTSOCK:88,ENOPROTOOPT:92,ESHUTDOWN:108,ECONNREFUSED:111,EADDRINUSE:98,ECONNABORTED:103,ENETUNREACH:101,ENETDOWN:100,ETIMEDOUT:110,EHOSTDOWN:112,EHOSTUNREACH:113,EINPROGRESS:115,EALREADY:114,EDESTADDRREQ:89,EMSGSIZE:90,EPROTONOSUPPORT:93,ESOCKTNOSUPPORT:94,EADDRNOTAVAIL:99,ENETRESET:102,EISCONN:106,ENOTCONN:107,ETOOMANYREFS:109,EUSERS:87,EDQUOT:122,ESTALE:116,ENOTSUP:95,ENOMEDIUM:123,EILSEQ:84,EOVERFLOW:75,ECANCELED:125,ENOTRECOVERABLE:131,EOWNERDEAD:130,ESTRPIPE:86};
  
  var ERRNO_MESSAGES={0:"Success",1:"Not super-user",2:"No such file or directory",3:"No such process",4:"Interrupted system call",5:"I/O error",6:"No such device or address",7:"Arg list too long",8:"Exec format error",9:"Bad file number",10:"No children",11:"No more processes",12:"Not enough core",13:"Permission denied",14:"Bad address",15:"Block device required",16:"Mount device busy",17:"File exists",18:"Cross-device link",19:"No such device",20:"Not a directory",21:"Is a directory",22:"Invalid argument",23:"Too many open files in system",24:"Too many open files",25:"Not a typewriter",26:"Text file busy",27:"File too large",28:"No space left on device",29:"Illegal seek",30:"Read only file system",31:"Too many links",32:"Broken pipe",33:"Math arg out of domain of func",34:"Math result not representable",35:"File locking deadlock error",36:"File or path name too long",37:"No record locks available",38:"Function not implemented",39:"Directory not empty",40:"Too many symbolic links",42:"No message of desired type",43:"Identifier removed",44:"Channel number out of range",45:"Level 2 not synchronized",46:"Level 3 halted",47:"Level 3 reset",48:"Link number out of range",49:"Protocol driver not attached",50:"No CSI structure available",51:"Level 2 halted",52:"Invalid exchange",53:"Invalid request descriptor",54:"Exchange full",55:"No anode",56:"Invalid request code",57:"Invalid slot",59:"Bad font file fmt",60:"Device not a stream",61:"No data (for no delay io)",62:"Timer expired",63:"Out of streams resources",64:"Machine is not on the network",65:"Package not installed",66:"The object is remote",67:"The link has been severed",68:"Advertise error",69:"Srmount error",70:"Communication error on send",71:"Protocol error",72:"Multihop attempted",73:"Cross mount point (not really error)",74:"Trying to read unreadable message",75:"Value too large for defined data type",76:"Given log. name not unique",77:"f.d. invalid for this operation",78:"Remote address changed",79:"Can   access a needed shared lib",80:"Accessing a corrupted shared lib",81:".lib section in a.out corrupted",82:"Attempting to link in too many libs",83:"Attempting to exec a shared library",84:"Illegal byte sequence",86:"Streams pipe error",87:"Too many users",88:"Socket operation on non-socket",89:"Destination address required",90:"Message too long",91:"Protocol wrong type for socket",92:"Protocol not available",93:"Unknown protocol",94:"Socket type not supported",95:"Not supported",96:"Protocol family not supported",97:"Address family not supported by protocol family",98:"Address already in use",99:"Address not available",100:"Network interface is not configured",101:"Network is unreachable",102:"Connection reset by network",103:"Connection aborted",104:"Connection reset by peer",105:"No buffer space available",106:"Socket is already connected",107:"Socket is not connected",108:"Can't send after socket shutdown",109:"Too many references",110:"Connection timed out",111:"Connection refused",112:"Host is down",113:"Host is unreachable",114:"Socket already connected",115:"Connection already in progress",116:"Stale file handle",122:"Quota exceeded",123:"No medium (in tape drive)",125:"Operation canceled",130:"Previous owner died",131:"State not recoverable"};
  
  function ___setErrNo(value) {
      if (Module['___errno_location']) HEAP32[((Module['___errno_location']())>>2)]=value;
      else err('failed to set errno from JS');
      return value;
    }
  
  var PATH={splitPath:function (filename) {
        var splitPathRe = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
        return splitPathRe.exec(filename).slice(1);
      },normalizeArray:function (parts, allowAboveRoot) {
        // if the path tries to go above the root, `up` ends up > 0
        var up = 0;
        for (var i = parts.length - 1; i >= 0; i--) {
          var last = parts[i];
          if (last === '.') {
            parts.splice(i, 1);
          } else if (last === '..') {
            parts.splice(i, 1);
            up++;
          } else if (up) {
            parts.splice(i, 1);
            up--;
          }
        }
        // if the path is allowed to go above the root, restore leading ..s
        if (allowAboveRoot) {
          for (; up; up--) {
            parts.unshift('..');
          }
        }
        return parts;
      },normalize:function (path) {
        var isAbsolute = path.charAt(0) === '/',
            trailingSlash = path.substr(-1) === '/';
        // Normalize the path
        path = PATH.normalizeArray(path.split('/').filter(function(p) {
          return !!p;
        }), !isAbsolute).join('/');
        if (!path && !isAbsolute) {
          path = '.';
        }
        if (path && trailingSlash) {
          path += '/';
        }
        return (isAbsolute ? '/' : '') + path;
      },dirname:function (path) {
        var result = PATH.splitPath(path),
            root = result[0],
            dir = result[1];
        if (!root && !dir) {
          // No dirname whatsoever
          return '.';
        }
        if (dir) {
          // It has a dirname, strip trailing slash
          dir = dir.substr(0, dir.length - 1);
        }
        return root + dir;
      },basename:function (path) {
        // EMSCRIPTEN return '/'' for '/', not an empty string
        if (path === '/') return '/';
        var lastSlash = path.lastIndexOf('/');
        if (lastSlash === -1) return path;
        return path.substr(lastSlash+1);
      },extname:function (path) {
        return PATH.splitPath(path)[3];
      },join:function () {
        var paths = Array.prototype.slice.call(arguments, 0);
        return PATH.normalize(paths.join('/'));
      },join2:function (l, r) {
        return PATH.normalize(l + '/' + r);
      },resolve:function () {
        var resolvedPath = '',
          resolvedAbsolute = false;
        for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
          var path = (i >= 0) ? arguments[i] : FS.cwd();
          // Skip empty and invalid entries
          if (typeof path !== 'string') {
            throw new TypeError('Arguments to path.resolve must be strings');
          } else if (!path) {
            return ''; // an invalid portion invalidates the whole thing
          }
          resolvedPath = path + '/' + resolvedPath;
          resolvedAbsolute = path.charAt(0) === '/';
        }
        // At this point the path should be resolved to a full absolute path, but
        // handle relative paths to be safe (might happen when process.cwd() fails)
        resolvedPath = PATH.normalizeArray(resolvedPath.split('/').filter(function(p) {
          return !!p;
        }), !resolvedAbsolute).join('/');
        return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
      },relative:function (from, to) {
        from = PATH.resolve(from).substr(1);
        to = PATH.resolve(to).substr(1);
        function trim(arr) {
          var start = 0;
          for (; start < arr.length; start++) {
            if (arr[start] !== '') break;
          }
          var end = arr.length - 1;
          for (; end >= 0; end--) {
            if (arr[end] !== '') break;
          }
          if (start > end) return [];
          return arr.slice(start, end - start + 1);
        }
        var fromParts = trim(from.split('/'));
        var toParts = trim(to.split('/'));
        var length = Math.min(fromParts.length, toParts.length);
        var samePartsLength = length;
        for (var i = 0; i < length; i++) {
          if (fromParts[i] !== toParts[i]) {
            samePartsLength = i;
            break;
          }
        }
        var outputParts = [];
        for (var i = samePartsLength; i < fromParts.length; i++) {
          outputParts.push('..');
        }
        outputParts = outputParts.concat(toParts.slice(samePartsLength));
        return outputParts.join('/');
      }};
  
  var TTY={ttys:[],init:function () {
        // https://github.com/kripken/emscripten/pull/1555
        // if (ENVIRONMENT_IS_NODE) {
        //   // currently, FS.init does not distinguish if process.stdin is a file or TTY
        //   // device, it always assumes it's a TTY device. because of this, we're forcing
        //   // process.stdin to UTF8 encoding to at least make stdin reading compatible
        //   // with text files until FS.init can be refactored.
        //   process['stdin']['setEncoding']('utf8');
        // }
      },shutdown:function () {
        // https://github.com/kripken/emscripten/pull/1555
        // if (ENVIRONMENT_IS_NODE) {
        //   // inolen: any idea as to why node -e 'process.stdin.read()' wouldn't exit immediately (with process.stdin being a tty)?
        //   // isaacs: because now it's reading from the stream, you've expressed interest in it, so that read() kicks off a _read() which creates a ReadReq operation
        //   // inolen: I thought read() in that case was a synchronous operation that just grabbed some amount of buffered data if it exists?
        //   // isaacs: it is. but it also triggers a _read() call, which calls readStart() on the handle
        //   // isaacs: do process.stdin.pause() and i'd think it'd probably close the pending call
        //   process['stdin']['pause']();
        // }
      },register:function (dev, ops) {
        TTY.ttys[dev] = { input: [], output: [], ops: ops };
        FS.registerDevice(dev, TTY.stream_ops);
      },stream_ops:{open:function (stream) {
          var tty = TTY.ttys[stream.node.rdev];
          if (!tty) {
            throw new FS.ErrnoError(ERRNO_CODES.ENODEV);
          }
          stream.tty = tty;
          stream.seekable = false;
        },close:function (stream) {
          // flush any pending line data
          stream.tty.ops.flush(stream.tty);
        },flush:function (stream) {
          stream.tty.ops.flush(stream.tty);
        },read:function (stream, buffer, offset, length, pos /* ignored */) {
          if (!stream.tty || !stream.tty.ops.get_char) {
            throw new FS.ErrnoError(ERRNO_CODES.ENXIO);
          }
          var bytesRead = 0;
          for (var i = 0; i < length; i++) {
            var result;
            try {
              result = stream.tty.ops.get_char(stream.tty);
            } catch (e) {
              throw new FS.ErrnoError(ERRNO_CODES.EIO);
            }
            if (result === undefined && bytesRead === 0) {
              throw new FS.ErrnoError(ERRNO_CODES.EAGAIN);
            }
            if (result === null || result === undefined) break;
            bytesRead++;
            buffer[offset+i] = result;
          }
          if (bytesRead) {
            stream.node.timestamp = Date.now();
          }
          return bytesRead;
        },write:function (stream, buffer, offset, length, pos) {
          if (!stream.tty || !stream.tty.ops.put_char) {
            throw new FS.ErrnoError(ERRNO_CODES.ENXIO);
          }
          for (var i = 0; i < length; i++) {
            try {
              stream.tty.ops.put_char(stream.tty, buffer[offset+i]);
            } catch (e) {
              throw new FS.ErrnoError(ERRNO_CODES.EIO);
            }
          }
          if (length) {
            stream.node.timestamp = Date.now();
          }
          return i;
        }},default_tty_ops:{get_char:function (tty) {
          if (!tty.input.length) {
            var result = null;
            if (ENVIRONMENT_IS_NODE) {
              // we will read data by chunks of BUFSIZE
              var BUFSIZE = 256;
              var buf = new Buffer(BUFSIZE);
              var bytesRead = 0;
  
              var isPosixPlatform = (process.platform != 'win32'); // Node doesn't offer a direct check, so test by exclusion
  
              var fd = process.stdin.fd;
              if (isPosixPlatform) {
                // Linux and Mac cannot use process.stdin.fd (which isn't set up as sync)
                var usingDevice = false;
                try {
                  fd = fs.openSync('/dev/stdin', 'r');
                  usingDevice = true;
                } catch (e) {}
              }
  
              try {
                bytesRead = fs.readSync(fd, buf, 0, BUFSIZE, null);
              } catch(e) {
                // Cross-platform differences: on Windows, reading EOF throws an exception, but on other OSes,
                // reading EOF returns 0. Uniformize behavior by treating the EOF exception to return 0.
                if (e.toString().indexOf('EOF') != -1) bytesRead = 0;
                else throw e;
              }
  
              if (usingDevice) { fs.closeSync(fd); }
              if (bytesRead > 0) {
                result = buf.slice(0, bytesRead).toString('utf-8');
              } else {
                result = null;
              }
  
            } else if (typeof window != 'undefined' &&
              typeof window.prompt == 'function') {
              // Browser.
              result = window.prompt('Input: ');  // returns null on cancel
              if (result !== null) {
                result += '\n';
              }
            } else if (typeof readline == 'function') {
              // Command line.
              result = readline();
              if (result !== null) {
                result += '\n';
              }
            }
            if (!result) {
              return null;
            }
            tty.input = intArrayFromString(result, true);
          }
          return tty.input.shift();
        },put_char:function (tty, val) {
          if (val === null || val === 10) {
            out(UTF8ArrayToString(tty.output, 0));
            tty.output = [];
          } else {
            if (val != 0) tty.output.push(val); // val == 0 would cut text output off in the middle.
          }
        },flush:function (tty) {
          if (tty.output && tty.output.length > 0) {
            out(UTF8ArrayToString(tty.output, 0));
            tty.output = [];
          }
        }},default_tty1_ops:{put_char:function (tty, val) {
          if (val === null || val === 10) {
            err(UTF8ArrayToString(tty.output, 0));
            tty.output = [];
          } else {
            if (val != 0) tty.output.push(val);
          }
        },flush:function (tty) {
          if (tty.output && tty.output.length > 0) {
            err(UTF8ArrayToString(tty.output, 0));
            tty.output = [];
          }
        }}};
  
  var MEMFS={ops_table:null,mount:function (mount) {
        return MEMFS.createNode(null, '/', 16384 | 511 /* 0777 */, 0);
      },createNode:function (parent, name, mode, dev) {
        if (FS.isBlkdev(mode) || FS.isFIFO(mode)) {
          // no supported
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
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
          };
        }
        var node = FS.createNode(parent, name, mode, dev);
        if (FS.isDir(node.mode)) {
          node.node_ops = MEMFS.ops_table.dir.node;
          node.stream_ops = MEMFS.ops_table.dir.stream;
          node.contents = {};
        } else if (FS.isFile(node.mode)) {
          node.node_ops = MEMFS.ops_table.file.node;
          node.stream_ops = MEMFS.ops_table.file.stream;
          node.usedBytes = 0; // The actual number of bytes used in the typed array, as opposed to contents.length which gives the whole capacity.
          // When the byte data of the file is populated, this will point to either a typed array, or a normal JS array. Typed arrays are preferred
          // for performance, and used by default. However, typed arrays are not resizable like normal JS arrays are, so there is a small disk size
          // penalty involved for appending file writes that continuously grow a file similar to std::vector capacity vs used -scheme.
          node.contents = null; 
        } else if (FS.isLink(node.mode)) {
          node.node_ops = MEMFS.ops_table.link.node;
          node.stream_ops = MEMFS.ops_table.link.stream;
        } else if (FS.isChrdev(node.mode)) {
          node.node_ops = MEMFS.ops_table.chrdev.node;
          node.stream_ops = MEMFS.ops_table.chrdev.stream;
        }
        node.timestamp = Date.now();
        // add the new node to the parent
        if (parent) {
          parent.contents[name] = node;
        }
        return node;
      },getFileDataAsRegularArray:function (node) {
        if (node.contents && node.contents.subarray) {
          var arr = [];
          for (var i = 0; i < node.usedBytes; ++i) arr.push(node.contents[i]);
          return arr; // Returns a copy of the original data.
        }
        return node.contents; // No-op, the file contents are already in a JS array. Return as-is.
      },getFileDataAsTypedArray:function (node) {
        if (!node.contents) return new Uint8Array;
        if (node.contents.subarray) return node.contents.subarray(0, node.usedBytes); // Make sure to not return excess unused bytes.
        return new Uint8Array(node.contents);
      },expandFileStorage:function (node, newCapacity) {
        // If we are asked to expand the size of a file that already exists, revert to using a standard JS array to store the file
        // instead of a typed array. This makes resizing the array more flexible because we can just .push() elements at the back to
        // increase the size.
        if (node.contents && node.contents.subarray && newCapacity > node.contents.length) {
          node.contents = MEMFS.getFileDataAsRegularArray(node);
          node.usedBytes = node.contents.length; // We might be writing to a lazy-loaded file which had overridden this property, so force-reset it.
        }
  
        if (!node.contents || node.contents.subarray) { // Keep using a typed array if creating a new storage, or if old one was a typed array as well.
          var prevCapacity = node.contents ? node.contents.length : 0;
          if (prevCapacity >= newCapacity) return; // No need to expand, the storage was already large enough.
          // Don't expand strictly to the given requested limit if it's only a very small increase, but instead geometrically grow capacity.
          // For small filesizes (<1MB), perform size*2 geometric increase, but for large sizes, do a much more conservative size*1.125 increase to
          // avoid overshooting the allocation cap by a very large margin.
          var CAPACITY_DOUBLING_MAX = 1024 * 1024;
          newCapacity = Math.max(newCapacity, (prevCapacity * (prevCapacity < CAPACITY_DOUBLING_MAX ? 2.0 : 1.125)) | 0);
          if (prevCapacity != 0) newCapacity = Math.max(newCapacity, 256); // At minimum allocate 256b for each file when expanding.
          var oldContents = node.contents;
          node.contents = new Uint8Array(newCapacity); // Allocate new storage.
          if (node.usedBytes > 0) node.contents.set(oldContents.subarray(0, node.usedBytes), 0); // Copy old data over to the new storage.
          return;
        }
        // Not using a typed array to back the file storage. Use a standard JS array instead.
        if (!node.contents && newCapacity > 0) node.contents = [];
        while (node.contents.length < newCapacity) node.contents.push(0);
      },resizeFileStorage:function (node, newSize) {
        if (node.usedBytes == newSize) return;
        if (newSize == 0) {
          node.contents = null; // Fully decommit when requesting a resize to zero.
          node.usedBytes = 0;
          return;
        }
        if (!node.contents || node.contents.subarray) { // Resize a typed array if that is being used as the backing store.
          var oldContents = node.contents;
          node.contents = new Uint8Array(new ArrayBuffer(newSize)); // Allocate new storage.
          if (oldContents) {
            node.contents.set(oldContents.subarray(0, Math.min(newSize, node.usedBytes))); // Copy old data over to the new storage.
          }
          node.usedBytes = newSize;
          return;
        }
        // Backing with a JS array.
        if (!node.contents) node.contents = [];
        if (node.contents.length > newSize) node.contents.length = newSize;
        else while (node.contents.length < newSize) node.contents.push(0);
        node.usedBytes = newSize;
      },node_ops:{getattr:function (node) {
          var attr = {};
          // device numbers reuse inode numbers.
          attr.dev = FS.isChrdev(node.mode) ? node.id : 1;
          attr.ino = node.id;
          attr.mode = node.mode;
          attr.nlink = 1;
          attr.uid = 0;
          attr.gid = 0;
          attr.rdev = node.rdev;
          if (FS.isDir(node.mode)) {
            attr.size = 4096;
          } else if (FS.isFile(node.mode)) {
            attr.size = node.usedBytes;
          } else if (FS.isLink(node.mode)) {
            attr.size = node.link.length;
          } else {
            attr.size = 0;
          }
          attr.atime = new Date(node.timestamp);
          attr.mtime = new Date(node.timestamp);
          attr.ctime = new Date(node.timestamp);
          // NOTE: In our implementation, st_blocks = Math.ceil(st_size/st_blksize),
          //       but this is not required by the standard.
          attr.blksize = 4096;
          attr.blocks = Math.ceil(attr.size / attr.blksize);
          return attr;
        },setattr:function (node, attr) {
          if (attr.mode !== undefined) {
            node.mode = attr.mode;
          }
          if (attr.timestamp !== undefined) {
            node.timestamp = attr.timestamp;
          }
          if (attr.size !== undefined) {
            MEMFS.resizeFileStorage(node, attr.size);
          }
        },lookup:function (parent, name) {
          throw FS.genericErrors[ERRNO_CODES.ENOENT];
        },mknod:function (parent, name, mode, dev) {
          return MEMFS.createNode(parent, name, mode, dev);
        },rename:function (old_node, new_dir, new_name) {
          // if we're overwriting a directory at new_name, make sure it's empty.
          if (FS.isDir(old_node.mode)) {
            var new_node;
            try {
              new_node = FS.lookupNode(new_dir, new_name);
            } catch (e) {
            }
            if (new_node) {
              for (var i in new_node.contents) {
                throw new FS.ErrnoError(ERRNO_CODES.ENOTEMPTY);
              }
            }
          }
          // do the internal rewiring
          delete old_node.parent.contents[old_node.name];
          old_node.name = new_name;
          new_dir.contents[new_name] = old_node;
          old_node.parent = new_dir;
        },unlink:function (parent, name) {
          delete parent.contents[name];
        },rmdir:function (parent, name) {
          var node = FS.lookupNode(parent, name);
          for (var i in node.contents) {
            throw new FS.ErrnoError(ERRNO_CODES.ENOTEMPTY);
          }
          delete parent.contents[name];
        },readdir:function (node) {
          var entries = ['.', '..']
          for (var key in node.contents) {
            if (!node.contents.hasOwnProperty(key)) {
              continue;
            }
            entries.push(key);
          }
          return entries;
        },symlink:function (parent, newname, oldpath) {
          var node = MEMFS.createNode(parent, newname, 511 /* 0777 */ | 40960, 0);
          node.link = oldpath;
          return node;
        },readlink:function (node) {
          if (!FS.isLink(node.mode)) {
            throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
          }
          return node.link;
        }},stream_ops:{read:function (stream, buffer, offset, length, position) {
          var contents = stream.node.contents;
          if (position >= stream.node.usedBytes) return 0;
          var size = Math.min(stream.node.usedBytes - position, length);
          assert(size >= 0);
          if (size > 8 && contents.subarray) { // non-trivial, and typed array
            buffer.set(contents.subarray(position, position + size), offset);
          } else {
            for (var i = 0; i < size; i++) buffer[offset + i] = contents[position + i];
          }
          return size;
        },write:function (stream, buffer, offset, length, position, canOwn) {
          if (!length) return 0;
          var node = stream.node;
          node.timestamp = Date.now();
  
          if (buffer.subarray && (!node.contents || node.contents.subarray)) { // This write is from a typed array to a typed array?
            if (canOwn) {
              assert(position === 0, 'canOwn must imply no weird position inside the file');
              node.contents = buffer.subarray(offset, offset + length);
              node.usedBytes = length;
              return length;
            } else if (node.usedBytes === 0 && position === 0) { // If this is a simple first write to an empty file, do a fast set since we don't need to care about old data.
              node.contents = new Uint8Array(buffer.subarray(offset, offset + length));
              node.usedBytes = length;
              return length;
            } else if (position + length <= node.usedBytes) { // Writing to an already allocated and used subrange of the file?
              node.contents.set(buffer.subarray(offset, offset + length), position);
              return length;
            }
          }
  
          // Appending to an existing file and we need to reallocate, or source data did not come as a typed array.
          MEMFS.expandFileStorage(node, position+length);
          if (node.contents.subarray && buffer.subarray) node.contents.set(buffer.subarray(offset, offset + length), position); // Use typed array write if available.
          else {
            for (var i = 0; i < length; i++) {
             node.contents[position + i] = buffer[offset + i]; // Or fall back to manual write if not.
            }
          }
          node.usedBytes = Math.max(node.usedBytes, position+length);
          return length;
        },llseek:function (stream, offset, whence) {
          var position = offset;
          if (whence === 1) {  // SEEK_CUR.
            position += stream.position;
          } else if (whence === 2) {  // SEEK_END.
            if (FS.isFile(stream.node.mode)) {
              position += stream.node.usedBytes;
            }
          }
          if (position < 0) {
            throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
          }
          return position;
        },allocate:function (stream, offset, length) {
          MEMFS.expandFileStorage(stream.node, offset + length);
          stream.node.usedBytes = Math.max(stream.node.usedBytes, offset + length);
        },mmap:function (stream, buffer, offset, length, position, prot, flags) {
          if (!FS.isFile(stream.node.mode)) {
            throw new FS.ErrnoError(ERRNO_CODES.ENODEV);
          }
          var ptr;
          var allocated;
          var contents = stream.node.contents;
          // Only make a new copy when MAP_PRIVATE is specified.
          if ( !(flags & 2) &&
                (contents.buffer === buffer || contents.buffer === buffer.buffer) ) {
            // We can't emulate MAP_SHARED when the file is not backed by the buffer
            // we're mapping to (e.g. the HEAP buffer).
            allocated = false;
            ptr = contents.byteOffset;
          } else {
            // Try to avoid unnecessary slices.
            if (position > 0 || position + length < stream.node.usedBytes) {
              if (contents.subarray) {
                contents = contents.subarray(position, position + length);
              } else {
                contents = Array.prototype.slice.call(contents, position, position + length);
              }
            }
            allocated = true;
            ptr = _malloc(length);
            if (!ptr) {
              throw new FS.ErrnoError(ERRNO_CODES.ENOMEM);
            }
            buffer.set(contents, ptr);
          }
          return { ptr: ptr, allocated: allocated };
        },msync:function (stream, buffer, offset, length, mmapFlags) {
          if (!FS.isFile(stream.node.mode)) {
            throw new FS.ErrnoError(ERRNO_CODES.ENODEV);
          }
          if (mmapFlags & 2) {
            // MAP_PRIVATE calls need not to be synced back to underlying fs
            return 0;
          }
  
          var bytesWritten = MEMFS.stream_ops.write(stream, buffer, 0, length, offset, false);
          // should we check if bytesWritten and length are the same?
          return 0;
        }}};
  
  var IDBFS={dbs:{},indexedDB:function () {
        if (typeof indexedDB !== 'undefined') return indexedDB;
        var ret = null;
        if (typeof window === 'object') ret = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
        assert(ret, 'IDBFS used, but indexedDB not supported');
        return ret;
      },DB_VERSION:21,DB_STORE_NAME:"FILE_DATA",mount:function (mount) {
        // reuse all of the core MEMFS functionality
        return MEMFS.mount.apply(null, arguments);
      },syncfs:function (mount, populate, callback) {
        IDBFS.getLocalSet(mount, function(err, local) {
          if (err) return callback(err);
  
          IDBFS.getRemoteSet(mount, function(err, remote) {
            if (err) return callback(err);
  
            var src = populate ? remote : local;
            var dst = populate ? local : remote;
  
            IDBFS.reconcile(src, dst, callback);
          });
        });
      },getDB:function (name, callback) {
        // check the cache first
        var db = IDBFS.dbs[name];
        if (db) {
          return callback(null, db);
        }
  
        var req;
        try {
          req = IDBFS.indexedDB().open(name, IDBFS.DB_VERSION);
        } catch (e) {
          return callback(e);
        }
        if (!req) {
          return callback("Unable to connect to IndexedDB");
        }
        req.onupgradeneeded = function(e) {
          var db = e.target.result;
          var transaction = e.target.transaction;
  
          var fileStore;
  
          if (db.objectStoreNames.contains(IDBFS.DB_STORE_NAME)) {
            fileStore = transaction.objectStore(IDBFS.DB_STORE_NAME);
          } else {
            fileStore = db.createObjectStore(IDBFS.DB_STORE_NAME);
          }
  
          if (!fileStore.indexNames.contains('timestamp')) {
            fileStore.createIndex('timestamp', 'timestamp', { unique: false });
          }
        };
        req.onsuccess = function() {
          db = req.result;
  
          // add to the cache
          IDBFS.dbs[name] = db;
          callback(null, db);
        };
        req.onerror = function(e) {
          callback(this.error);
          e.preventDefault();
        };
      },getLocalSet:function (mount, callback) {
        var entries = {};
  
        function isRealDir(p) {
          return p !== '.' && p !== '..';
        };
        function toAbsolute(root) {
          return function(p) {
            return PATH.join2(root, p);
          }
        };
  
        var check = FS.readdir(mount.mountpoint).filter(isRealDir).map(toAbsolute(mount.mountpoint));
  
        while (check.length) {
          var path = check.pop();
          var stat;
  
          try {
            stat = FS.stat(path);
          } catch (e) {
            return callback(e);
          }
  
          if (FS.isDir(stat.mode)) {
            check.push.apply(check, FS.readdir(path).filter(isRealDir).map(toAbsolute(path)));
          }
  
          entries[path] = { timestamp: stat.mtime };
        }
  
        return callback(null, { type: 'local', entries: entries });
      },getRemoteSet:function (mount, callback) {
        var entries = {};
  
        IDBFS.getDB(mount.mountpoint, function(err, db) {
          if (err) return callback(err);
  
          try {
            var transaction = db.transaction([IDBFS.DB_STORE_NAME], 'readonly');
            transaction.onerror = function(e) {
              callback(this.error);
              e.preventDefault();
            };
  
            var store = transaction.objectStore(IDBFS.DB_STORE_NAME);
            var index = store.index('timestamp');
  
            index.openKeyCursor().onsuccess = function(event) {
              var cursor = event.target.result;
  
              if (!cursor) {
                return callback(null, { type: 'remote', db: db, entries: entries });
              }
  
              entries[cursor.primaryKey] = { timestamp: cursor.key };
  
              cursor.continue();
            };
          } catch (e) {
            return callback(e);
          }
        });
      },loadLocalEntry:function (path, callback) {
        var stat, node;
  
        try {
          var lookup = FS.lookupPath(path);
          node = lookup.node;
          stat = FS.stat(path);
        } catch (e) {
          return callback(e);
        }
  
        if (FS.isDir(stat.mode)) {
          return callback(null, { timestamp: stat.mtime, mode: stat.mode });
        } else if (FS.isFile(stat.mode)) {
          // Performance consideration: storing a normal JavaScript array to a IndexedDB is much slower than storing a typed array.
          // Therefore always convert the file contents to a typed array first before writing the data to IndexedDB.
          node.contents = MEMFS.getFileDataAsTypedArray(node);
          return callback(null, { timestamp: stat.mtime, mode: stat.mode, contents: node.contents });
        } else {
          return callback(new Error('node type not supported'));
        }
      },storeLocalEntry:function (path, entry, callback) {
        try {
          if (FS.isDir(entry.mode)) {
            FS.mkdir(path, entry.mode);
          } else if (FS.isFile(entry.mode)) {
            FS.writeFile(path, entry.contents, { canOwn: true });
          } else {
            return callback(new Error('node type not supported'));
          }
  
          FS.chmod(path, entry.mode);
          FS.utime(path, entry.timestamp, entry.timestamp);
        } catch (e) {
          return callback(e);
        }
  
        callback(null);
      },removeLocalEntry:function (path, callback) {
        try {
          var lookup = FS.lookupPath(path);
          var stat = FS.stat(path);
  
          if (FS.isDir(stat.mode)) {
            FS.rmdir(path);
          } else if (FS.isFile(stat.mode)) {
            FS.unlink(path);
          }
        } catch (e) {
          return callback(e);
        }
  
        callback(null);
      },loadRemoteEntry:function (store, path, callback) {
        var req = store.get(path);
        req.onsuccess = function(event) { callback(null, event.target.result); };
        req.onerror = function(e) {
          callback(this.error);
          e.preventDefault();
        };
      },storeRemoteEntry:function (store, path, entry, callback) {
        var req = store.put(entry, path);
        req.onsuccess = function() { callback(null); };
        req.onerror = function(e) {
          callback(this.error);
          e.preventDefault();
        };
      },removeRemoteEntry:function (store, path, callback) {
        var req = store.delete(path);
        req.onsuccess = function() { callback(null); };
        req.onerror = function(e) {
          callback(this.error);
          e.preventDefault();
        };
      },reconcile:function (src, dst, callback) {
        var total = 0;
  
        var create = [];
        Object.keys(src.entries).forEach(function (key) {
          var e = src.entries[key];
          var e2 = dst.entries[key];
          if (!e2 || e.timestamp > e2.timestamp) {
            create.push(key);
            total++;
          }
        });
  
        var remove = [];
        Object.keys(dst.entries).forEach(function (key) {
          var e = dst.entries[key];
          var e2 = src.entries[key];
          if (!e2) {
            remove.push(key);
            total++;
          }
        });
  
        if (!total) {
          return callback(null);
        }
  
        var errored = false;
        var completed = 0;
        var db = src.type === 'remote' ? src.db : dst.db;
        var transaction = db.transaction([IDBFS.DB_STORE_NAME], 'readwrite');
        var store = transaction.objectStore(IDBFS.DB_STORE_NAME);
  
        function done(err) {
          if (err) {
            if (!done.errored) {
              done.errored = true;
              return callback(err);
            }
            return;
          }
          if (++completed >= total) {
            return callback(null);
          }
        };
  
        transaction.onerror = function(e) {
          done(this.error);
          e.preventDefault();
        };
  
        // sort paths in ascending order so directory entries are created
        // before the files inside them
        create.sort().forEach(function (path) {
          if (dst.type === 'local') {
            IDBFS.loadRemoteEntry(store, path, function (err, entry) {
              if (err) return done(err);
              IDBFS.storeLocalEntry(path, entry, done);
            });
          } else {
            IDBFS.loadLocalEntry(path, function (err, entry) {
              if (err) return done(err);
              IDBFS.storeRemoteEntry(store, path, entry, done);
            });
          }
        });
  
        // sort paths in descending order so files are deleted before their
        // parent directories
        remove.sort().reverse().forEach(function(path) {
          if (dst.type === 'local') {
            IDBFS.removeLocalEntry(path, done);
          } else {
            IDBFS.removeRemoteEntry(store, path, done);
          }
        });
      }};
  
  var NODEFS={isWindows:false,staticInit:function () {
        NODEFS.isWindows = !!process.platform.match(/^win/);
        var flags = process["binding"]("constants");
        // Node.js 4 compatibility: it has no namespaces for constants
        if (flags["fs"]) {
          flags = flags["fs"];
        }
        NODEFS.flagsForNodeMap = {
          "1024": flags["O_APPEND"],
          "64": flags["O_CREAT"],
          "128": flags["O_EXCL"],
          "0": flags["O_RDONLY"],
          "2": flags["O_RDWR"],
          "4096": flags["O_SYNC"],
          "512": flags["O_TRUNC"],
          "1": flags["O_WRONLY"]
        };
      },bufferFrom:function (arrayBuffer) {
        // Node.js < 4.5 compatibility: Buffer.from does not support ArrayBuffer
        // Buffer.from before 4.5 was just a method inherited from Uint8Array
        // Buffer.alloc has been added with Buffer.from together, so check it instead
        return Buffer.alloc ? Buffer.from(arrayBuffer) : new Buffer(arrayBuffer);
      },mount:function (mount) {
        assert(ENVIRONMENT_IS_NODE);
        return NODEFS.createNode(null, '/', NODEFS.getMode(mount.opts.root), 0);
      },createNode:function (parent, name, mode, dev) {
        if (!FS.isDir(mode) && !FS.isFile(mode) && !FS.isLink(mode)) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        var node = FS.createNode(parent, name, mode);
        node.node_ops = NODEFS.node_ops;
        node.stream_ops = NODEFS.stream_ops;
        return node;
      },getMode:function (path) {
        var stat;
        try {
          stat = fs.lstatSync(path);
          if (NODEFS.isWindows) {
            // Node.js on Windows never represents permission bit 'x', so
            // propagate read bits to execute bits
            stat.mode = stat.mode | ((stat.mode & 292) >> 2);
          }
        } catch (e) {
          if (!e.code) throw e;
          throw new FS.ErrnoError(ERRNO_CODES[e.code]);
        }
        return stat.mode;
      },realPath:function (node) {
        var parts = [];
        while (node.parent !== node) {
          parts.push(node.name);
          node = node.parent;
        }
        parts.push(node.mount.opts.root);
        parts.reverse();
        return PATH.join.apply(null, parts);
      },flagsForNode:function (flags) {
        flags &= ~0x200000 /*O_PATH*/; // Ignore this flag from musl, otherwise node.js fails to open the file.
        flags &= ~0x800 /*O_NONBLOCK*/; // Ignore this flag from musl, otherwise node.js fails to open the file.
        flags &= ~0x8000 /*O_LARGEFILE*/; // Ignore this flag from musl, otherwise node.js fails to open the file.
        flags &= ~0x80000 /*O_CLOEXEC*/; // Some applications may pass it; it makes no sense for a single process.
        var newFlags = 0;
        for (var k in NODEFS.flagsForNodeMap) {
          if (flags & k) {
            newFlags |= NODEFS.flagsForNodeMap[k];
            flags ^= k;
          }
        }
  
        if (!flags) {
          return newFlags;
        } else {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
      },node_ops:{getattr:function (node) {
          var path = NODEFS.realPath(node);
          var stat;
          try {
            stat = fs.lstatSync(path);
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
          // node.js v0.10.20 doesn't report blksize and blocks on Windows. Fake them with default blksize of 4096.
          // See http://support.microsoft.com/kb/140365
          if (NODEFS.isWindows && !stat.blksize) {
            stat.blksize = 4096;
          }
          if (NODEFS.isWindows && !stat.blocks) {
            stat.blocks = (stat.size+stat.blksize-1)/stat.blksize|0;
          }
          return {
            dev: stat.dev,
            ino: stat.ino,
            mode: stat.mode,
            nlink: stat.nlink,
            uid: stat.uid,
            gid: stat.gid,
            rdev: stat.rdev,
            size: stat.size,
            atime: stat.atime,
            mtime: stat.mtime,
            ctime: stat.ctime,
            blksize: stat.blksize,
            blocks: stat.blocks
          };
        },setattr:function (node, attr) {
          var path = NODEFS.realPath(node);
          try {
            if (attr.mode !== undefined) {
              fs.chmodSync(path, attr.mode);
              // update the common node structure mode as well
              node.mode = attr.mode;
            }
            if (attr.timestamp !== undefined) {
              var date = new Date(attr.timestamp);
              fs.utimesSync(path, date, date);
            }
            if (attr.size !== undefined) {
              fs.truncateSync(path, attr.size);
            }
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        },lookup:function (parent, name) {
          var path = PATH.join2(NODEFS.realPath(parent), name);
          var mode = NODEFS.getMode(path);
          return NODEFS.createNode(parent, name, mode);
        },mknod:function (parent, name, mode, dev) {
          var node = NODEFS.createNode(parent, name, mode, dev);
          // create the backing node for this in the fs root as well
          var path = NODEFS.realPath(node);
          try {
            if (FS.isDir(node.mode)) {
              fs.mkdirSync(path, node.mode);
            } else {
              fs.writeFileSync(path, '', { mode: node.mode });
            }
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
          return node;
        },rename:function (oldNode, newDir, newName) {
          var oldPath = NODEFS.realPath(oldNode);
          var newPath = PATH.join2(NODEFS.realPath(newDir), newName);
          try {
            fs.renameSync(oldPath, newPath);
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        },unlink:function (parent, name) {
          var path = PATH.join2(NODEFS.realPath(parent), name);
          try {
            fs.unlinkSync(path);
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        },rmdir:function (parent, name) {
          var path = PATH.join2(NODEFS.realPath(parent), name);
          try {
            fs.rmdirSync(path);
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        },readdir:function (node) {
          var path = NODEFS.realPath(node);
          try {
            return fs.readdirSync(path);
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        },symlink:function (parent, newName, oldPath) {
          var newPath = PATH.join2(NODEFS.realPath(parent), newName);
          try {
            fs.symlinkSync(oldPath, newPath);
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        },readlink:function (node) {
          var path = NODEFS.realPath(node);
          try {
            path = fs.readlinkSync(path);
            path = NODEJS_PATH.relative(NODEJS_PATH.resolve(node.mount.opts.root), path);
            return path;
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        }},stream_ops:{open:function (stream) {
          var path = NODEFS.realPath(stream.node);
          try {
            if (FS.isFile(stream.node.mode)) {
              stream.nfd = fs.openSync(path, NODEFS.flagsForNode(stream.flags));
            }
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        },close:function (stream) {
          try {
            if (FS.isFile(stream.node.mode) && stream.nfd) {
              fs.closeSync(stream.nfd);
            }
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        },read:function (stream, buffer, offset, length, position) {
          // Node.js < 6 compatibility: node errors on 0 length reads
          if (length === 0) return 0;
          try {
            return fs.readSync(stream.nfd, NODEFS.bufferFrom(buffer.buffer), offset, length, position);
          } catch (e) {
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        },write:function (stream, buffer, offset, length, position) {
          try {
            return fs.writeSync(stream.nfd, NODEFS.bufferFrom(buffer.buffer), offset, length, position);
          } catch (e) {
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        },llseek:function (stream, offset, whence) {
          var position = offset;
          if (whence === 1) {  // SEEK_CUR.
            position += stream.position;
          } else if (whence === 2) {  // SEEK_END.
            if (FS.isFile(stream.node.mode)) {
              try {
                var stat = fs.fstatSync(stream.nfd);
                position += stat.size;
              } catch (e) {
                throw new FS.ErrnoError(ERRNO_CODES[e.code]);
              }
            }
          }
  
          if (position < 0) {
            throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
          }
  
          return position;
        }}};
  
  var WORKERFS={DIR_MODE:16895,FILE_MODE:33279,reader:null,mount:function (mount) {
        assert(ENVIRONMENT_IS_WORKER);
        if (!WORKERFS.reader) WORKERFS.reader = new FileReaderSync();
        var root = WORKERFS.createNode(null, '/', WORKERFS.DIR_MODE, 0);
        var createdParents = {};
        function ensureParent(path) {
          // return the parent node, creating subdirs as necessary
          var parts = path.split('/');
          var parent = root;
          for (var i = 0; i < parts.length-1; i++) {
            var curr = parts.slice(0, i+1).join('/');
            // Issue 4254: Using curr as a node name will prevent the node
            // from being found in FS.nameTable when FS.open is called on
            // a path which holds a child of this node,
            // given that all FS functions assume node names
            // are just their corresponding parts within their given path,
            // rather than incremental aggregates which include their parent's
            // directories.
            if (!createdParents[curr]) {
              createdParents[curr] = WORKERFS.createNode(parent, parts[i], WORKERFS.DIR_MODE, 0);
            }
            parent = createdParents[curr];
          }
          return parent;
        }
        function base(path) {
          var parts = path.split('/');
          return parts[parts.length-1];
        }
        // We also accept FileList here, by using Array.prototype
        Array.prototype.forEach.call(mount.opts["files"] || [], function(file) {
          WORKERFS.createNode(ensureParent(file.name), base(file.name), WORKERFS.FILE_MODE, 0, file, file.lastModifiedDate);
        });
        (mount.opts["blobs"] || []).forEach(function(obj) {
          WORKERFS.createNode(ensureParent(obj["name"]), base(obj["name"]), WORKERFS.FILE_MODE, 0, obj["data"]);
        });
        (mount.opts["packages"] || []).forEach(function(pack) {
          pack['metadata'].files.forEach(function(file) {
            var name = file.filename.substr(1); // remove initial slash
            WORKERFS.createNode(ensureParent(name), base(name), WORKERFS.FILE_MODE, 0, pack['blob'].slice(file.start, file.end));
          });
        });
        return root;
      },createNode:function (parent, name, mode, dev, contents, mtime) {
        var node = FS.createNode(parent, name, mode);
        node.mode = mode;
        node.node_ops = WORKERFS.node_ops;
        node.stream_ops = WORKERFS.stream_ops;
        node.timestamp = (mtime || new Date).getTime();
        assert(WORKERFS.FILE_MODE !== WORKERFS.DIR_MODE);
        if (mode === WORKERFS.FILE_MODE) {
          node.size = contents.size;
          node.contents = contents;
        } else {
          node.size = 4096;
          node.contents = {};
        }
        if (parent) {
          parent.contents[name] = node;
        }
        return node;
      },node_ops:{getattr:function (node) {
          return {
            dev: 1,
            ino: undefined,
            mode: node.mode,
            nlink: 1,
            uid: 0,
            gid: 0,
            rdev: undefined,
            size: node.size,
            atime: new Date(node.timestamp),
            mtime: new Date(node.timestamp),
            ctime: new Date(node.timestamp),
            blksize: 4096,
            blocks: Math.ceil(node.size / 4096),
          };
        },setattr:function (node, attr) {
          if (attr.mode !== undefined) {
            node.mode = attr.mode;
          }
          if (attr.timestamp !== undefined) {
            node.timestamp = attr.timestamp;
          }
        },lookup:function (parent, name) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
        },mknod:function (parent, name, mode, dev) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        },rename:function (oldNode, newDir, newName) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        },unlink:function (parent, name) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        },rmdir:function (parent, name) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        },readdir:function (node) {
          var entries = ['.', '..'];
          for (var key in node.contents) {
            if (!node.contents.hasOwnProperty(key)) {
              continue;
            }
            entries.push(key);
          }
          return entries;
        },symlink:function (parent, newName, oldPath) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        },readlink:function (node) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }},stream_ops:{read:function (stream, buffer, offset, length, position) {
          if (position >= stream.node.size) return 0;
          var chunk = stream.node.contents.slice(position, position + length);
          var ab = WORKERFS.reader.readAsArrayBuffer(chunk);
          buffer.set(new Uint8Array(ab), offset);
          return chunk.size;
        },write:function (stream, buffer, offset, length, position) {
          throw new FS.ErrnoError(ERRNO_CODES.EIO);
        },llseek:function (stream, offset, whence) {
          var position = offset;
          if (whence === 1) {  // SEEK_CUR.
            position += stream.position;
          } else if (whence === 2) {  // SEEK_END.
            if (FS.isFile(stream.node.mode)) {
              position += stream.node.size;
            }
          }
          if (position < 0) {
            throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
          }
          return position;
        }}};
  
  var _stdin=STATICTOP; STATICTOP += 16;;
  
  var _stdout=STATICTOP; STATICTOP += 16;;
  
  var _stderr=STATICTOP; STATICTOP += 16;;var FS={root:null,mounts:[],devices:{},streams:[],nextInode:1,nameTable:null,currentPath:"/",initialized:false,ignorePermissions:true,trackingDelegate:{},tracking:{openFlags:{READ:1,WRITE:2}},ErrnoError:null,genericErrors:{},filesystems:null,syncFSRequests:0,handleFSError:function (e) {
        if (!(e instanceof FS.ErrnoError)) throw e + ' : ' + stackTrace();
        return ___setErrNo(e.errno);
      },lookupPath:function (path, opts) {
        path = PATH.resolve(FS.cwd(), path);
        opts = opts || {};
  
        if (!path) return { path: '', node: null };
  
        var defaults = {
          follow_mount: true,
          recurse_count: 0
        };
        for (var key in defaults) {
          if (opts[key] === undefined) {
            opts[key] = defaults[key];
          }
        }
  
        if (opts.recurse_count > 8) {  // max recursive lookup of 8
          throw new FS.ErrnoError(ERRNO_CODES.ELOOP);
        }
  
        // split the path
        var parts = PATH.normalizeArray(path.split('/').filter(function(p) {
          return !!p;
        }), false);
  
        // start at the root
        var current = FS.root;
        var current_path = '/';
  
        for (var i = 0; i < parts.length; i++) {
          var islast = (i === parts.length-1);
          if (islast && opts.parent) {
            // stop resolving
            break;
          }
  
          current = FS.lookupNode(current, parts[i]);
          current_path = PATH.join2(current_path, parts[i]);
  
          // jump to the mount's root node if this is a mountpoint
          if (FS.isMountpoint(current)) {
            if (!islast || (islast && opts.follow_mount)) {
              current = current.mounted.root;
            }
          }
  
          // by default, lookupPath will not follow a symlink if it is the final path component.
          // setting opts.follow = true will override this behavior.
          if (!islast || opts.follow) {
            var count = 0;
            while (FS.isLink(current.mode)) {
              var link = FS.readlink(current_path);
              current_path = PATH.resolve(PATH.dirname(current_path), link);
  
              var lookup = FS.lookupPath(current_path, { recurse_count: opts.recurse_count });
              current = lookup.node;
  
              if (count++ > 40) {  // limit max consecutive symlinks to 40 (SYMLOOP_MAX).
                throw new FS.ErrnoError(ERRNO_CODES.ELOOP);
              }
            }
          }
        }
  
        return { path: current_path, node: current };
      },getPath:function (node) {
        var path;
        while (true) {
          if (FS.isRoot(node)) {
            var mount = node.mount.mountpoint;
            if (!path) return mount;
            return mount[mount.length-1] !== '/' ? mount + '/' + path : mount + path;
          }
          path = path ? node.name + '/' + path : node.name;
          node = node.parent;
        }
      },hashName:function (parentid, name) {
        var hash = 0;
  
  
        for (var i = 0; i < name.length; i++) {
          hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
        }
        return ((parentid + hash) >>> 0) % FS.nameTable.length;
      },hashAddNode:function (node) {
        var hash = FS.hashName(node.parent.id, node.name);
        node.name_next = FS.nameTable[hash];
        FS.nameTable[hash] = node;
      },hashRemoveNode:function (node) {
        var hash = FS.hashName(node.parent.id, node.name);
        if (FS.nameTable[hash] === node) {
          FS.nameTable[hash] = node.name_next;
        } else {
          var current = FS.nameTable[hash];
          while (current) {
            if (current.name_next === node) {
              current.name_next = node.name_next;
              break;
            }
            current = current.name_next;
          }
        }
      },lookupNode:function (parent, name) {
        var err = FS.mayLookup(parent);
        if (err) {
          throw new FS.ErrnoError(err, parent);
        }
        var hash = FS.hashName(parent.id, name);
        for (var node = FS.nameTable[hash]; node; node = node.name_next) {
          var nodeName = node.name;
          if (node.parent.id === parent.id && nodeName === name) {
            return node;
          }
        }
        // if we failed to find it in the cache, call into the VFS
        return FS.lookup(parent, name);
      },createNode:function (parent, name, mode, rdev) {
        if (!FS.FSNode) {
          FS.FSNode = function(parent, name, mode, rdev) {
            if (!parent) {
              parent = this;  // root node sets parent to itself
            }
            this.parent = parent;
            this.mount = parent.mount;
            this.mounted = null;
            this.id = FS.nextInode++;
            this.name = name;
            this.mode = mode;
            this.node_ops = {};
            this.stream_ops = {};
            this.rdev = rdev;
          };
  
          FS.FSNode.prototype = {};
  
          // compatibility
          var readMode = 292 | 73;
          var writeMode = 146;
  
          // NOTE we must use Object.defineProperties instead of individual calls to
          // Object.defineProperty in order to make closure compiler happy
          Object.defineProperties(FS.FSNode.prototype, {
            read: {
              get: function() { return (this.mode & readMode) === readMode; },
              set: function(val) { val ? this.mode |= readMode : this.mode &= ~readMode; }
            },
            write: {
              get: function() { return (this.mode & writeMode) === writeMode; },
              set: function(val) { val ? this.mode |= writeMode : this.mode &= ~writeMode; }
            },
            isFolder: {
              get: function() { return FS.isDir(this.mode); }
            },
            isDevice: {
              get: function() { return FS.isChrdev(this.mode); }
            }
          });
        }
  
        var node = new FS.FSNode(parent, name, mode, rdev);
  
        FS.hashAddNode(node);
  
        return node;
      },destroyNode:function (node) {
        FS.hashRemoveNode(node);
      },isRoot:function (node) {
        return node === node.parent;
      },isMountpoint:function (node) {
        return !!node.mounted;
      },isFile:function (mode) {
        return (mode & 61440) === 32768;
      },isDir:function (mode) {
        return (mode & 61440) === 16384;
      },isLink:function (mode) {
        return (mode & 61440) === 40960;
      },isChrdev:function (mode) {
        return (mode & 61440) === 8192;
      },isBlkdev:function (mode) {
        return (mode & 61440) === 24576;
      },isFIFO:function (mode) {
        return (mode & 61440) === 4096;
      },isSocket:function (mode) {
        return (mode & 49152) === 49152;
      },flagModes:{"r":0,"rs":1052672,"r+":2,"w":577,"wx":705,"xw":705,"w+":578,"wx+":706,"xw+":706,"a":1089,"ax":1217,"xa":1217,"a+":1090,"ax+":1218,"xa+":1218},modeStringToFlags:function (str) {
        var flags = FS.flagModes[str];
        if (typeof flags === 'undefined') {
          throw new Error('Unknown file open mode: ' + str);
        }
        return flags;
      },flagsToPermissionString:function (flag) {
        var perms = ['r', 'w', 'rw'][flag & 3];
        if ((flag & 512)) {
          perms += 'w';
        }
        return perms;
      },nodePermissions:function (node, perms) {
        if (FS.ignorePermissions) {
          return 0;
        }
        // return 0 if any user, group or owner bits are set.
        if (perms.indexOf('r') !== -1 && !(node.mode & 292)) {
          return ERRNO_CODES.EACCES;
        } else if (perms.indexOf('w') !== -1 && !(node.mode & 146)) {
          return ERRNO_CODES.EACCES;
        } else if (perms.indexOf('x') !== -1 && !(node.mode & 73)) {
          return ERRNO_CODES.EACCES;
        }
        return 0;
      },mayLookup:function (dir) {
        var err = FS.nodePermissions(dir, 'x');
        if (err) return err;
        if (!dir.node_ops.lookup) return ERRNO_CODES.EACCES;
        return 0;
      },mayCreate:function (dir, name) {
        try {
          var node = FS.lookupNode(dir, name);
          return ERRNO_CODES.EEXIST;
        } catch (e) {
        }
        return FS.nodePermissions(dir, 'wx');
      },mayDelete:function (dir, name, isdir) {
        var node;
        try {
          node = FS.lookupNode(dir, name);
        } catch (e) {
          return e.errno;
        }
        var err = FS.nodePermissions(dir, 'wx');
        if (err) {
          return err;
        }
        if (isdir) {
          if (!FS.isDir(node.mode)) {
            return ERRNO_CODES.ENOTDIR;
          }
          if (FS.isRoot(node) || FS.getPath(node) === FS.cwd()) {
            return ERRNO_CODES.EBUSY;
          }
        } else {
          if (FS.isDir(node.mode)) {
            return ERRNO_CODES.EISDIR;
          }
        }
        return 0;
      },mayOpen:function (node, flags) {
        if (!node) {
          return ERRNO_CODES.ENOENT;
        }
        if (FS.isLink(node.mode)) {
          return ERRNO_CODES.ELOOP;
        } else if (FS.isDir(node.mode)) {
          if (FS.flagsToPermissionString(flags) !== 'r' || // opening for write
              (flags & 512)) { // TODO: check for O_SEARCH? (== search for dir only)
            return ERRNO_CODES.EISDIR;
          }
        }
        return FS.nodePermissions(node, FS.flagsToPermissionString(flags));
      },MAX_OPEN_FDS:4096,nextfd:function (fd_start, fd_end) {
        fd_start = fd_start || 0;
        fd_end = fd_end || FS.MAX_OPEN_FDS;
        for (var fd = fd_start; fd <= fd_end; fd++) {
          if (!FS.streams[fd]) {
            return fd;
          }
        }
        throw new FS.ErrnoError(ERRNO_CODES.EMFILE);
      },getStream:function (fd) {
        return FS.streams[fd];
      },createStream:function (stream, fd_start, fd_end) {
        if (!FS.FSStream) {
          FS.FSStream = function(){};
          FS.FSStream.prototype = {};
          // compatibility
          Object.defineProperties(FS.FSStream.prototype, {
            object: {
              get: function() { return this.node; },
              set: function(val) { this.node = val; }
            },
            isRead: {
              get: function() { return (this.flags & 2097155) !== 1; }
            },
            isWrite: {
              get: function() { return (this.flags & 2097155) !== 0; }
            },
            isAppend: {
              get: function() { return (this.flags & 1024); }
            }
          });
        }
        // clone it, so we can return an instance of FSStream
        var newStream = new FS.FSStream();
        for (var p in stream) {
          newStream[p] = stream[p];
        }
        stream = newStream;
        var fd = FS.nextfd(fd_start, fd_end);
        stream.fd = fd;
        FS.streams[fd] = stream;
        return stream;
      },closeStream:function (fd) {
        FS.streams[fd] = null;
      },chrdev_stream_ops:{open:function (stream) {
          var device = FS.getDevice(stream.node.rdev);
          // override node's stream ops with the device's
          stream.stream_ops = device.stream_ops;
          // forward the open call
          if (stream.stream_ops.open) {
            stream.stream_ops.open(stream);
          }
        },llseek:function () {
          throw new FS.ErrnoError(ERRNO_CODES.ESPIPE);
        }},major:function (dev) {
        return ((dev) >> 8);
      },minor:function (dev) {
        return ((dev) & 0xff);
      },makedev:function (ma, mi) {
        return ((ma) << 8 | (mi));
      },registerDevice:function (dev, ops) {
        FS.devices[dev] = { stream_ops: ops };
      },getDevice:function (dev) {
        return FS.devices[dev];
      },getMounts:function (mount) {
        var mounts = [];
        var check = [mount];
  
        while (check.length) {
          var m = check.pop();
  
          mounts.push(m);
  
          check.push.apply(check, m.mounts);
        }
  
        return mounts;
      },syncfs:function (populate, callback) {
        if (typeof(populate) === 'function') {
          callback = populate;
          populate = false;
        }
  
        FS.syncFSRequests++;
  
        if (FS.syncFSRequests > 1) {
          console.log('warning: ' + FS.syncFSRequests + ' FS.syncfs operations in flight at once, probably just doing extra work');
        }
  
        var mounts = FS.getMounts(FS.root.mount);
        var completed = 0;
  
        function doCallback(err) {
          assert(FS.syncFSRequests > 0);
          FS.syncFSRequests--;
          return callback(err);
        }
  
        function done(err) {
          if (err) {
            if (!done.errored) {
              done.errored = true;
              return doCallback(err);
            }
            return;
          }
          if (++completed >= mounts.length) {
            doCallback(null);
          }
        };
  
        // sync all mounts
        mounts.forEach(function (mount) {
          if (!mount.type.syncfs) {
            return done(null);
          }
          mount.type.syncfs(mount, populate, done);
        });
      },mount:function (type, opts, mountpoint) {
        var root = mountpoint === '/';
        var pseudo = !mountpoint;
        var node;
  
        if (root && FS.root) {
          throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
        } else if (!root && !pseudo) {
          var lookup = FS.lookupPath(mountpoint, { follow_mount: false });
  
          mountpoint = lookup.path;  // use the absolute path
          node = lookup.node;
  
          if (FS.isMountpoint(node)) {
            throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
          }
  
          if (!FS.isDir(node.mode)) {
            throw new FS.ErrnoError(ERRNO_CODES.ENOTDIR);
          }
        }
  
        var mount = {
          type: type,
          opts: opts,
          mountpoint: mountpoint,
          mounts: []
        };
  
        // create a root node for the fs
        var mountRoot = type.mount(mount);
        mountRoot.mount = mount;
        mount.root = mountRoot;
  
        if (root) {
          FS.root = mountRoot;
        } else if (node) {
          // set as a mountpoint
          node.mounted = mount;
  
          // add the new mount to the current mount's children
          if (node.mount) {
            node.mount.mounts.push(mount);
          }
        }
  
        return mountRoot;
      },unmount:function (mountpoint) {
        var lookup = FS.lookupPath(mountpoint, { follow_mount: false });
  
        if (!FS.isMountpoint(lookup.node)) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
  
        // destroy the nodes for this mount, and all its child mounts
        var node = lookup.node;
        var mount = node.mounted;
        var mounts = FS.getMounts(mount);
  
        Object.keys(FS.nameTable).forEach(function (hash) {
          var current = FS.nameTable[hash];
  
          while (current) {
            var next = current.name_next;
  
            if (mounts.indexOf(current.mount) !== -1) {
              FS.destroyNode(current);
            }
  
            current = next;
          }
        });
  
        // no longer a mountpoint
        node.mounted = null;
  
        // remove this mount from the child mounts
        var idx = node.mount.mounts.indexOf(mount);
        assert(idx !== -1);
        node.mount.mounts.splice(idx, 1);
      },lookup:function (parent, name) {
        return parent.node_ops.lookup(parent, name);
      },mknod:function (path, mode, dev) {
        var lookup = FS.lookupPath(path, { parent: true });
        var parent = lookup.node;
        var name = PATH.basename(path);
        if (!name || name === '.' || name === '..') {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        var err = FS.mayCreate(parent, name);
        if (err) {
          throw new FS.ErrnoError(err);
        }
        if (!parent.node_ops.mknod) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }
        return parent.node_ops.mknod(parent, name, mode, dev);
      },create:function (path, mode) {
        mode = mode !== undefined ? mode : 438 /* 0666 */;
        mode &= 4095;
        mode |= 32768;
        return FS.mknod(path, mode, 0);
      },mkdir:function (path, mode) {
        mode = mode !== undefined ? mode : 511 /* 0777 */;
        mode &= 511 | 512;
        mode |= 16384;
        return FS.mknod(path, mode, 0);
      },mkdirTree:function (path, mode) {
        var dirs = path.split('/');
        var d = '';
        for (var i = 0; i < dirs.length; ++i) {
          if (!dirs[i]) continue;
          d += '/' + dirs[i];
          try {
            FS.mkdir(d, mode);
          } catch(e) {
            if (e.errno != ERRNO_CODES.EEXIST) throw e;
          }
        }
      },mkdev:function (path, mode, dev) {
        if (typeof(dev) === 'undefined') {
          dev = mode;
          mode = 438 /* 0666 */;
        }
        mode |= 8192;
        return FS.mknod(path, mode, dev);
      },symlink:function (oldpath, newpath) {
        if (!PATH.resolve(oldpath)) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
        }
        var lookup = FS.lookupPath(newpath, { parent: true });
        var parent = lookup.node;
        if (!parent) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
        }
        var newname = PATH.basename(newpath);
        var err = FS.mayCreate(parent, newname);
        if (err) {
          throw new FS.ErrnoError(err);
        }
        if (!parent.node_ops.symlink) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }
        return parent.node_ops.symlink(parent, newname, oldpath);
      },rename:function (old_path, new_path) {
        var old_dirname = PATH.dirname(old_path);
        var new_dirname = PATH.dirname(new_path);
        var old_name = PATH.basename(old_path);
        var new_name = PATH.basename(new_path);
        // parents must exist
        var lookup, old_dir, new_dir;
        try {
          lookup = FS.lookupPath(old_path, { parent: true });
          old_dir = lookup.node;
          lookup = FS.lookupPath(new_path, { parent: true });
          new_dir = lookup.node;
        } catch (e) {
          throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
        }
        if (!old_dir || !new_dir) throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
        // need to be part of the same mount
        if (old_dir.mount !== new_dir.mount) {
          throw new FS.ErrnoError(ERRNO_CODES.EXDEV);
        }
        // source must exist
        var old_node = FS.lookupNode(old_dir, old_name);
        // old path should not be an ancestor of the new path
        var relative = PATH.relative(old_path, new_dirname);
        if (relative.charAt(0) !== '.') {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        // new path should not be an ancestor of the old path
        relative = PATH.relative(new_path, old_dirname);
        if (relative.charAt(0) !== '.') {
          throw new FS.ErrnoError(ERRNO_CODES.ENOTEMPTY);
        }
        // see if the new path already exists
        var new_node;
        try {
          new_node = FS.lookupNode(new_dir, new_name);
        } catch (e) {
          // not fatal
        }
        // early out if nothing needs to change
        if (old_node === new_node) {
          return;
        }
        // we'll need to delete the old entry
        var isdir = FS.isDir(old_node.mode);
        var err = FS.mayDelete(old_dir, old_name, isdir);
        if (err) {
          throw new FS.ErrnoError(err);
        }
        // need delete permissions if we'll be overwriting.
        // need create permissions if new doesn't already exist.
        err = new_node ?
          FS.mayDelete(new_dir, new_name, isdir) :
          FS.mayCreate(new_dir, new_name);
        if (err) {
          throw new FS.ErrnoError(err);
        }
        if (!old_dir.node_ops.rename) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }
        if (FS.isMountpoint(old_node) || (new_node && FS.isMountpoint(new_node))) {
          throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
        }
        // if we are going to change the parent, check write permissions
        if (new_dir !== old_dir) {
          err = FS.nodePermissions(old_dir, 'w');
          if (err) {
            throw new FS.ErrnoError(err);
          }
        }
        try {
          if (FS.trackingDelegate['willMovePath']) {
            FS.trackingDelegate['willMovePath'](old_path, new_path);
          }
        } catch(e) {
          console.log("FS.trackingDelegate['willMovePath']('"+old_path+"', '"+new_path+"') threw an exception: " + e.message);
        }
        // remove the node from the lookup hash
        FS.hashRemoveNode(old_node);
        // do the underlying fs rename
        try {
          old_dir.node_ops.rename(old_node, new_dir, new_name);
        } catch (e) {
          throw e;
        } finally {
          // add the node back to the hash (in case node_ops.rename
          // changed its name)
          FS.hashAddNode(old_node);
        }
        try {
          if (FS.trackingDelegate['onMovePath']) FS.trackingDelegate['onMovePath'](old_path, new_path);
        } catch(e) {
          console.log("FS.trackingDelegate['onMovePath']('"+old_path+"', '"+new_path+"') threw an exception: " + e.message);
        }
      },rmdir:function (path) {
        var lookup = FS.lookupPath(path, { parent: true });
        var parent = lookup.node;
        var name = PATH.basename(path);
        var node = FS.lookupNode(parent, name);
        var err = FS.mayDelete(parent, name, true);
        if (err) {
          throw new FS.ErrnoError(err);
        }
        if (!parent.node_ops.rmdir) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }
        if (FS.isMountpoint(node)) {
          throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
        }
        try {
          if (FS.trackingDelegate['willDeletePath']) {
            FS.trackingDelegate['willDeletePath'](path);
          }
        } catch(e) {
          console.log("FS.trackingDelegate['willDeletePath']('"+path+"') threw an exception: " + e.message);
        }
        parent.node_ops.rmdir(parent, name);
        FS.destroyNode(node);
        try {
          if (FS.trackingDelegate['onDeletePath']) FS.trackingDelegate['onDeletePath'](path);
        } catch(e) {
          console.log("FS.trackingDelegate['onDeletePath']('"+path+"') threw an exception: " + e.message);
        }
      },readdir:function (path) {
        var lookup = FS.lookupPath(path, { follow: true });
        var node = lookup.node;
        if (!node.node_ops.readdir) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOTDIR);
        }
        return node.node_ops.readdir(node);
      },unlink:function (path) {
        var lookup = FS.lookupPath(path, { parent: true });
        var parent = lookup.node;
        var name = PATH.basename(path);
        var node = FS.lookupNode(parent, name);
        var err = FS.mayDelete(parent, name, false);
        if (err) {
          // According to POSIX, we should map EISDIR to EPERM, but
          // we instead do what Linux does (and we must, as we use
          // the musl linux libc).
          throw new FS.ErrnoError(err);
        }
        if (!parent.node_ops.unlink) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }
        if (FS.isMountpoint(node)) {
          throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
        }
        try {
          if (FS.trackingDelegate['willDeletePath']) {
            FS.trackingDelegate['willDeletePath'](path);
          }
        } catch(e) {
          console.log("FS.trackingDelegate['willDeletePath']('"+path+"') threw an exception: " + e.message);
        }
        parent.node_ops.unlink(parent, name);
        FS.destroyNode(node);
        try {
          if (FS.trackingDelegate['onDeletePath']) FS.trackingDelegate['onDeletePath'](path);
        } catch(e) {
          console.log("FS.trackingDelegate['onDeletePath']('"+path+"') threw an exception: " + e.message);
        }
      },readlink:function (path) {
        var lookup = FS.lookupPath(path);
        var link = lookup.node;
        if (!link) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
        }
        if (!link.node_ops.readlink) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        return PATH.resolve(FS.getPath(link.parent), link.node_ops.readlink(link));
      },stat:function (path, dontFollow) {
        var lookup = FS.lookupPath(path, { follow: !dontFollow });
        var node = lookup.node;
        if (!node) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
        }
        if (!node.node_ops.getattr) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }
        return node.node_ops.getattr(node);
      },lstat:function (path) {
        return FS.stat(path, true);
      },chmod:function (path, mode, dontFollow) {
        var node;
        if (typeof path === 'string') {
          var lookup = FS.lookupPath(path, { follow: !dontFollow });
          node = lookup.node;
        } else {
          node = path;
        }
        if (!node.node_ops.setattr) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }
        node.node_ops.setattr(node, {
          mode: (mode & 4095) | (node.mode & ~4095),
          timestamp: Date.now()
        });
      },lchmod:function (path, mode) {
        FS.chmod(path, mode, true);
      },fchmod:function (fd, mode) {
        var stream = FS.getStream(fd);
        if (!stream) {
          throw new FS.ErrnoError(ERRNO_CODES.EBADF);
        }
        FS.chmod(stream.node, mode);
      },chown:function (path, uid, gid, dontFollow) {
        var node;
        if (typeof path === 'string') {
          var lookup = FS.lookupPath(path, { follow: !dontFollow });
          node = lookup.node;
        } else {
          node = path;
        }
        if (!node.node_ops.setattr) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }
        node.node_ops.setattr(node, {
          timestamp: Date.now()
          // we ignore the uid / gid for now
        });
      },lchown:function (path, uid, gid) {
        FS.chown(path, uid, gid, true);
      },fchown:function (fd, uid, gid) {
        var stream = FS.getStream(fd);
        if (!stream) {
          throw new FS.ErrnoError(ERRNO_CODES.EBADF);
        }
        FS.chown(stream.node, uid, gid);
      },truncate:function (path, len) {
        if (len < 0) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        var node;
        if (typeof path === 'string') {
          var lookup = FS.lookupPath(path, { follow: true });
          node = lookup.node;
        } else {
          node = path;
        }
        if (!node.node_ops.setattr) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }
        if (FS.isDir(node.mode)) {
          throw new FS.ErrnoError(ERRNO_CODES.EISDIR);
        }
        if (!FS.isFile(node.mode)) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        var err = FS.nodePermissions(node, 'w');
        if (err) {
          throw new FS.ErrnoError(err);
        }
        node.node_ops.setattr(node, {
          size: len,
          timestamp: Date.now()
        });
      },ftruncate:function (fd, len) {
        var stream = FS.getStream(fd);
        if (!stream) {
          throw new FS.ErrnoError(ERRNO_CODES.EBADF);
        }
        if ((stream.flags & 2097155) === 0) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        FS.truncate(stream.node, len);
      },utime:function (path, atime, mtime) {
        var lookup = FS.lookupPath(path, { follow: true });
        var node = lookup.node;
        node.node_ops.setattr(node, {
          timestamp: Math.max(atime, mtime)
        });
      },open:function (path, flags, mode, fd_start, fd_end) {
        if (path === "") {
          throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
        }
        flags = typeof flags === 'string' ? FS.modeStringToFlags(flags) : flags;
        mode = typeof mode === 'undefined' ? 438 /* 0666 */ : mode;
        if ((flags & 64)) {
          mode = (mode & 4095) | 32768;
        } else {
          mode = 0;
        }
        var node;
        if (typeof path === 'object') {
          node = path;
        } else {
          path = PATH.normalize(path);
          try {
            var lookup = FS.lookupPath(path, {
              follow: !(flags & 131072)
            });
            node = lookup.node;
          } catch (e) {
            // ignore
          }
        }
        // perhaps we need to create the node
        var created = false;
        if ((flags & 64)) {
          if (node) {
            // if O_CREAT and O_EXCL are set, error out if the node already exists
            if ((flags & 128)) {
              throw new FS.ErrnoError(ERRNO_CODES.EEXIST);
            }
          } else {
            // node doesn't exist, try to create it
            node = FS.mknod(path, mode, 0);
            created = true;
          }
        }
        if (!node) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
        }
        // can't truncate a device
        if (FS.isChrdev(node.mode)) {
          flags &= ~512;
        }
        // if asked only for a directory, then this must be one
        if ((flags & 65536) && !FS.isDir(node.mode)) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOTDIR);
        }
        // check permissions, if this is not a file we just created now (it is ok to
        // create and write to a file with read-only permissions; it is read-only
        // for later use)
        if (!created) {
          var err = FS.mayOpen(node, flags);
          if (err) {
            throw new FS.ErrnoError(err);
          }
        }
        // do truncation if necessary
        if ((flags & 512)) {
          FS.truncate(node, 0);
        }
        // we've already handled these, don't pass down to the underlying vfs
        flags &= ~(128 | 512);
  
        // register the stream with the filesystem
        var stream = FS.createStream({
          node: node,
          path: FS.getPath(node),  // we want the absolute path to the node
          flags: flags,
          seekable: true,
          position: 0,
          stream_ops: node.stream_ops,
          // used by the file family libc calls (fopen, fwrite, ferror, etc.)
          ungotten: [],
          error: false
        }, fd_start, fd_end);
        // call the new stream's open function
        if (stream.stream_ops.open) {
          stream.stream_ops.open(stream);
        }
        if (Module['logReadFiles'] && !(flags & 1)) {
          if (!FS.readFiles) FS.readFiles = {};
          if (!(path in FS.readFiles)) {
            FS.readFiles[path] = 1;
            err('read file: ' + path);
          }
        }
        try {
          if (FS.trackingDelegate['onOpenFile']) {
            var trackingFlags = 0;
            if ((flags & 2097155) !== 1) {
              trackingFlags |= FS.tracking.openFlags.READ;
            }
            if ((flags & 2097155) !== 0) {
              trackingFlags |= FS.tracking.openFlags.WRITE;
            }
            FS.trackingDelegate['onOpenFile'](path, trackingFlags);
          }
        } catch(e) {
          console.log("FS.trackingDelegate['onOpenFile']('"+path+"', flags) threw an exception: " + e.message);
        }
        return stream;
      },close:function (stream) {
        if (FS.isClosed(stream)) {
          throw new FS.ErrnoError(ERRNO_CODES.EBADF);
        }
        if (stream.getdents) stream.getdents = null; // free readdir state
        try {
          if (stream.stream_ops.close) {
            stream.stream_ops.close(stream);
          }
        } catch (e) {
          throw e;
        } finally {
          FS.closeStream(stream.fd);
        }
        stream.fd = null;
      },isClosed:function (stream) {
        return stream.fd === null;
      },llseek:function (stream, offset, whence) {
        if (FS.isClosed(stream)) {
          throw new FS.ErrnoError(ERRNO_CODES.EBADF);
        }
        if (!stream.seekable || !stream.stream_ops.llseek) {
          throw new FS.ErrnoError(ERRNO_CODES.ESPIPE);
        }
        stream.position = stream.stream_ops.llseek(stream, offset, whence);
        stream.ungotten = [];
        return stream.position;
      },read:function (stream, buffer, offset, length, position) {
        if (length < 0 || position < 0) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        if (FS.isClosed(stream)) {
          throw new FS.ErrnoError(ERRNO_CODES.EBADF);
        }
        if ((stream.flags & 2097155) === 1) {
          throw new FS.ErrnoError(ERRNO_CODES.EBADF);
        }
        if (FS.isDir(stream.node.mode)) {
          throw new FS.ErrnoError(ERRNO_CODES.EISDIR);
        }
        if (!stream.stream_ops.read) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        var seeking = typeof position !== 'undefined';
        if (!seeking) {
          position = stream.position;
        } else if (!stream.seekable) {
          throw new FS.ErrnoError(ERRNO_CODES.ESPIPE);
        }
        var bytesRead = stream.stream_ops.read(stream, buffer, offset, length, position);
        if (!seeking) stream.position += bytesRead;
        return bytesRead;
      },write:function (stream, buffer, offset, length, position, canOwn) {
        if (length < 0 || position < 0) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        if (FS.isClosed(stream)) {
          throw new FS.ErrnoError(ERRNO_CODES.EBADF);
        }
        if ((stream.flags & 2097155) === 0) {
          throw new FS.ErrnoError(ERRNO_CODES.EBADF);
        }
        if (FS.isDir(stream.node.mode)) {
          throw new FS.ErrnoError(ERRNO_CODES.EISDIR);
        }
        if (!stream.stream_ops.write) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        if (stream.flags & 1024) {
          // seek to the end before writing in append mode
          FS.llseek(stream, 0, 2);
        }
        var seeking = typeof position !== 'undefined';
        if (!seeking) {
          position = stream.position;
        } else if (!stream.seekable) {
          throw new FS.ErrnoError(ERRNO_CODES.ESPIPE);
        }
        var bytesWritten = stream.stream_ops.write(stream, buffer, offset, length, position, canOwn);
        if (!seeking) stream.position += bytesWritten;
        try {
          if (stream.path && FS.trackingDelegate['onWriteToFile']) FS.trackingDelegate['onWriteToFile'](stream.path);
        } catch(e) {
          console.log("FS.trackingDelegate['onWriteToFile']('"+path+"') threw an exception: " + e.message);
        }
        return bytesWritten;
      },allocate:function (stream, offset, length) {
        if (FS.isClosed(stream)) {
          throw new FS.ErrnoError(ERRNO_CODES.EBADF);
        }
        if (offset < 0 || length <= 0) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        if ((stream.flags & 2097155) === 0) {
          throw new FS.ErrnoError(ERRNO_CODES.EBADF);
        }
        if (!FS.isFile(stream.node.mode) && !FS.isDir(stream.node.mode)) {
          throw new FS.ErrnoError(ERRNO_CODES.ENODEV);
        }
        if (!stream.stream_ops.allocate) {
          throw new FS.ErrnoError(ERRNO_CODES.EOPNOTSUPP);
        }
        stream.stream_ops.allocate(stream, offset, length);
      },mmap:function (stream, buffer, offset, length, position, prot, flags) {
        // TODO if PROT is PROT_WRITE, make sure we have write access
        if ((stream.flags & 2097155) === 1) {
          throw new FS.ErrnoError(ERRNO_CODES.EACCES);
        }
        if (!stream.stream_ops.mmap) {
          throw new FS.ErrnoError(ERRNO_CODES.ENODEV);
        }
        return stream.stream_ops.mmap(stream, buffer, offset, length, position, prot, flags);
      },msync:function (stream, buffer, offset, length, mmapFlags) {
        if (!stream || !stream.stream_ops.msync) {
          return 0;
        }
        return stream.stream_ops.msync(stream, buffer, offset, length, mmapFlags);
      },munmap:function (stream) {
        return 0;
      },ioctl:function (stream, cmd, arg) {
        if (!stream.stream_ops.ioctl) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOTTY);
        }
        return stream.stream_ops.ioctl(stream, cmd, arg);
      },readFile:function (path, opts) {
        opts = opts || {};
        opts.flags = opts.flags || 'r';
        opts.encoding = opts.encoding || 'binary';
        if (opts.encoding !== 'utf8' && opts.encoding !== 'binary') {
          throw new Error('Invalid encoding type "' + opts.encoding + '"');
        }
        var ret;
        var stream = FS.open(path, opts.flags);
        var stat = FS.stat(path);
        var length = stat.size;
        var buf = new Uint8Array(length);
        FS.read(stream, buf, 0, length, 0);
        if (opts.encoding === 'utf8') {
          ret = UTF8ArrayToString(buf, 0);
        } else if (opts.encoding === 'binary') {
          ret = buf;
        }
        FS.close(stream);
        return ret;
      },writeFile:function (path, data, opts) {
        opts = opts || {};
        opts.flags = opts.flags || 'w';
        var stream = FS.open(path, opts.flags, opts.mode);
        if (typeof data === 'string') {
          var buf = new Uint8Array(lengthBytesUTF8(data)+1);
          var actualNumBytes = stringToUTF8Array(data, buf, 0, buf.length);
          FS.write(stream, buf, 0, actualNumBytes, undefined, opts.canOwn);
        } else if (ArrayBuffer.isView(data)) {
          FS.write(stream, data, 0, data.byteLength, undefined, opts.canOwn);
        } else {
          throw new Error('Unsupported data type');
        }
        FS.close(stream);
      },cwd:function () {
        return FS.currentPath;
      },chdir:function (path) {
        var lookup = FS.lookupPath(path, { follow: true });
        if (lookup.node === null) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
        }
        if (!FS.isDir(lookup.node.mode)) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOTDIR);
        }
        var err = FS.nodePermissions(lookup.node, 'x');
        if (err) {
          throw new FS.ErrnoError(err);
        }
        FS.currentPath = lookup.path;
      },createDefaultDirectories:function () {
        FS.mkdir('/tmp');
        FS.mkdir('/home');
        FS.mkdir('/home/web_user');
      },createDefaultDevices:function () {
        // create /dev
        FS.mkdir('/dev');
        // setup /dev/null
        FS.registerDevice(FS.makedev(1, 3), {
          read: function() { return 0; },
          write: function(stream, buffer, offset, length, pos) { return length; }
        });
        FS.mkdev('/dev/null', FS.makedev(1, 3));
        // setup /dev/tty and /dev/tty1
        // stderr needs to print output using Module['printErr']
        // so we register a second tty just for it.
        TTY.register(FS.makedev(5, 0), TTY.default_tty_ops);
        TTY.register(FS.makedev(6, 0), TTY.default_tty1_ops);
        FS.mkdev('/dev/tty', FS.makedev(5, 0));
        FS.mkdev('/dev/tty1', FS.makedev(6, 0));
        // setup /dev/[u]random
        var random_device;
        if (typeof crypto !== 'undefined') {
          // for modern web browsers
          var randomBuffer = new Uint8Array(1);
          random_device = function() { crypto.getRandomValues(randomBuffer); return randomBuffer[0]; };
        } else if (ENVIRONMENT_IS_NODE) {
          // for nodejs
          random_device = function() { return require('crypto')['randomBytes'](1)[0]; };
        } else {
          // default for ES5 platforms
          random_device = function() { return (Math.random()*256)|0; };
        }
        FS.createDevice('/dev', 'random', random_device);
        FS.createDevice('/dev', 'urandom', random_device);
        // we're not going to emulate the actual shm device,
        // just create the tmp dirs that reside in it commonly
        FS.mkdir('/dev/shm');
        FS.mkdir('/dev/shm/tmp');
      },createSpecialDirectories:function () {
        // create /proc/self/fd which allows /proc/self/fd/6 => readlink gives the name of the stream for fd 6 (see test_unistd_ttyname)
        FS.mkdir('/proc');
        FS.mkdir('/proc/self');
        FS.mkdir('/proc/self/fd');
        FS.mount({
          mount: function() {
            var node = FS.createNode('/proc/self', 'fd', 16384 | 511 /* 0777 */, 73);
            node.node_ops = {
              lookup: function(parent, name) {
                var fd = +name;
                var stream = FS.getStream(fd);
                if (!stream) throw new FS.ErrnoError(ERRNO_CODES.EBADF);
                var ret = {
                  parent: null,
                  mount: { mountpoint: 'fake' },
                  node_ops: { readlink: function() { return stream.path } }
                };
                ret.parent = ret; // make it look like a simple root node
                return ret;
              }
            };
            return node;
          }
        }, {}, '/proc/self/fd');
      },createStandardStreams:function () {
        // TODO deprecate the old functionality of a single
        // input / output callback and that utilizes FS.createDevice
        // and instead require a unique set of stream ops
  
        // by default, we symlink the standard streams to the
        // default tty devices. however, if the standard streams
        // have been overwritten we create a unique device for
        // them instead.
        if (Module['stdin']) {
          FS.createDevice('/dev', 'stdin', Module['stdin']);
        } else {
          FS.symlink('/dev/tty', '/dev/stdin');
        }
        if (Module['stdout']) {
          FS.createDevice('/dev', 'stdout', null, Module['stdout']);
        } else {
          FS.symlink('/dev/tty', '/dev/stdout');
        }
        if (Module['stderr']) {
          FS.createDevice('/dev', 'stderr', null, Module['stderr']);
        } else {
          FS.symlink('/dev/tty1', '/dev/stderr');
        }
  
        // open default streams for the stdin, stdout and stderr devices
        var stdin = FS.open('/dev/stdin', 'r');
        assert(stdin.fd === 0, 'invalid handle for stdin (' + stdin.fd + ')');
  
        var stdout = FS.open('/dev/stdout', 'w');
        assert(stdout.fd === 1, 'invalid handle for stdout (' + stdout.fd + ')');
  
        var stderr = FS.open('/dev/stderr', 'w');
        assert(stderr.fd === 2, 'invalid handle for stderr (' + stderr.fd + ')');
      },ensureErrnoError:function () {
        if (FS.ErrnoError) return;
        FS.ErrnoError = function ErrnoError(errno, node) {
          //err(stackTrace()); // useful for debugging
          this.node = node;
          this.setErrno = function(errno) {
            this.errno = errno;
            for (var key in ERRNO_CODES) {
              if (ERRNO_CODES[key] === errno) {
                this.code = key;
                break;
              }
            }
          };
          this.setErrno(errno);
          this.message = ERRNO_MESSAGES[errno];
          // Node.js compatibility: assigning on this.stack fails on Node 4 (but fixed on Node 8)
          if (this.stack) Object.defineProperty(this, "stack", { value: (new Error).stack, writable: true });
          if (this.stack) this.stack = demangleAll(this.stack);
        };
        FS.ErrnoError.prototype = new Error();
        FS.ErrnoError.prototype.constructor = FS.ErrnoError;
        // Some errors may happen quite a bit, to avoid overhead we reuse them (and suffer a lack of stack info)
        [ERRNO_CODES.ENOENT].forEach(function(code) {
          FS.genericErrors[code] = new FS.ErrnoError(code);
          FS.genericErrors[code].stack = '<generic error, no stack>';
        });
      },staticInit:function () {
        FS.ensureErrnoError();
  
        FS.nameTable = new Array(4096);
  
        FS.mount(MEMFS, {}, '/');
  
        FS.createDefaultDirectories();
        FS.createDefaultDevices();
        FS.createSpecialDirectories();
  
        FS.filesystems = {
          'MEMFS': MEMFS,
          'IDBFS': IDBFS,
          'NODEFS': NODEFS,
          'WORKERFS': WORKERFS,
        };
      },init:function (input, output, error) {
        assert(!FS.init.initialized, 'FS.init was previously called. If you want to initialize later with custom parameters, remove any earlier calls (note that one is automatically added to the generated code)');
        FS.init.initialized = true;
  
        FS.ensureErrnoError();
  
        // Allow Module.stdin etc. to provide defaults, if none explicitly passed to us here
        Module['stdin'] = input || Module['stdin'];
        Module['stdout'] = output || Module['stdout'];
        Module['stderr'] = error || Module['stderr'];
  
        FS.createStandardStreams();
      },quit:function () {
        FS.init.initialized = false;
        // force-flush all streams, so we get musl std streams printed out
        var fflush = Module['_fflush'];
        if (fflush) fflush(0);
        // close all of our streams
        for (var i = 0; i < FS.streams.length; i++) {
          var stream = FS.streams[i];
          if (!stream) {
            continue;
          }
          FS.close(stream);
        }
      },getMode:function (canRead, canWrite) {
        var mode = 0;
        if (canRead) mode |= 292 | 73;
        if (canWrite) mode |= 146;
        return mode;
      },joinPath:function (parts, forceRelative) {
        var path = PATH.join.apply(null, parts);
        if (forceRelative && path[0] == '/') path = path.substr(1);
        return path;
      },absolutePath:function (relative, base) {
        return PATH.resolve(base, relative);
      },standardizePath:function (path) {
        return PATH.normalize(path);
      },findObject:function (path, dontResolveLastLink) {
        var ret = FS.analyzePath(path, dontResolveLastLink);
        if (ret.exists) {
          return ret.object;
        } else {
          ___setErrNo(ret.error);
          return null;
        }
      },analyzePath:function (path, dontResolveLastLink) {
        // operate from within the context of the symlink's target
        try {
          var lookup = FS.lookupPath(path, { follow: !dontResolveLastLink });
          path = lookup.path;
        } catch (e) {
        }
        var ret = {
          isRoot: false, exists: false, error: 0, name: null, path: null, object: null,
          parentExists: false, parentPath: null, parentObject: null
        };
        try {
          var lookup = FS.lookupPath(path, { parent: true });
          ret.parentExists = true;
          ret.parentPath = lookup.path;
          ret.parentObject = lookup.node;
          ret.name = PATH.basename(path);
          lookup = FS.lookupPath(path, { follow: !dontResolveLastLink });
          ret.exists = true;
          ret.path = lookup.path;
          ret.object = lookup.node;
          ret.name = lookup.node.name;
          ret.isRoot = lookup.path === '/';
        } catch (e) {
          ret.error = e.errno;
        };
        return ret;
      },createFolder:function (parent, name, canRead, canWrite) {
        var path = PATH.join2(typeof parent === 'string' ? parent : FS.getPath(parent), name);
        var mode = FS.getMode(canRead, canWrite);
        return FS.mkdir(path, mode);
      },createPath:function (parent, path, canRead, canWrite) {
        parent = typeof parent === 'string' ? parent : FS.getPath(parent);
        var parts = path.split('/').reverse();
        while (parts.length) {
          var part = parts.pop();
          if (!part) continue;
          var current = PATH.join2(parent, part);
          try {
            FS.mkdir(current);
          } catch (e) {
            // ignore EEXIST
          }
          parent = current;
        }
        return current;
      },createFile:function (parent, name, properties, canRead, canWrite) {
        var path = PATH.join2(typeof parent === 'string' ? parent : FS.getPath(parent), name);
        var mode = FS.getMode(canRead, canWrite);
        return FS.create(path, mode);
      },createDataFile:function (parent, name, data, canRead, canWrite, canOwn) {
        var path = name ? PATH.join2(typeof parent === 'string' ? parent : FS.getPath(parent), name) : parent;
        var mode = FS.getMode(canRead, canWrite);
        var node = FS.create(path, mode);
        if (data) {
          if (typeof data === 'string') {
            var arr = new Array(data.length);
            for (var i = 0, len = data.length; i < len; ++i) arr[i] = data.charCodeAt(i);
            data = arr;
          }
          // make sure we can write to the file
          FS.chmod(node, mode | 146);
          var stream = FS.open(node, 'w');
          FS.write(stream, data, 0, data.length, 0, canOwn);
          FS.close(stream);
          FS.chmod(node, mode);
        }
        return node;
      },createDevice:function (parent, name, input, output) {
        var path = PATH.join2(typeof parent === 'string' ? parent : FS.getPath(parent), name);
        var mode = FS.getMode(!!input, !!output);
        if (!FS.createDevice.major) FS.createDevice.major = 64;
        var dev = FS.makedev(FS.createDevice.major++, 0);
        // Create a fake device that a set of stream ops to emulate
        // the old behavior.
        FS.registerDevice(dev, {
          open: function(stream) {
            stream.seekable = false;
          },
          close: function(stream) {
            // flush any pending line data
            if (output && output.buffer && output.buffer.length) {
              output(10);
            }
          },
          read: function(stream, buffer, offset, length, pos /* ignored */) {
            var bytesRead = 0;
            for (var i = 0; i < length; i++) {
              var result;
              try {
                result = input();
              } catch (e) {
                throw new FS.ErrnoError(ERRNO_CODES.EIO);
              }
              if (result === undefined && bytesRead === 0) {
                throw new FS.ErrnoError(ERRNO_CODES.EAGAIN);
              }
              if (result === null || result === undefined) break;
              bytesRead++;
              buffer[offset+i] = result;
            }
            if (bytesRead) {
              stream.node.timestamp = Date.now();
            }
            return bytesRead;
          },
          write: function(stream, buffer, offset, length, pos) {
            for (var i = 0; i < length; i++) {
              try {
                output(buffer[offset+i]);
              } catch (e) {
                throw new FS.ErrnoError(ERRNO_CODES.EIO);
              }
            }
            if (length) {
              stream.node.timestamp = Date.now();
            }
            return i;
          }
        });
        return FS.mkdev(path, mode, dev);
      },createLink:function (parent, name, target, canRead, canWrite) {
        var path = PATH.join2(typeof parent === 'string' ? parent : FS.getPath(parent), name);
        return FS.symlink(target, path);
      },forceLoadFile:function (obj) {
        if (obj.isDevice || obj.isFolder || obj.link || obj.contents) return true;
        var success = true;
        if (typeof XMLHttpRequest !== 'undefined') {
          throw new Error("Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread.");
        } else if (Module['read']) {
          // Command-line.
          try {
            // WARNING: Can't read binary files in V8's d8 or tracemonkey's js, as
            //          read() will try to parse UTF8.
            obj.contents = intArrayFromString(Module['read'](obj.url), true);
            obj.usedBytes = obj.contents.length;
          } catch (e) {
            success = false;
          }
        } else {
          throw new Error('Cannot load without read() or XMLHttpRequest.');
        }
        if (!success) ___setErrNo(ERRNO_CODES.EIO);
        return success;
      },createLazyFile:function (parent, name, url, canRead, canWrite) {
        // Lazy chunked Uint8Array (implements get and length from Uint8Array). Actual getting is abstracted away for eventual reuse.
        function LazyUint8Array() {
          this.lengthKnown = false;
          this.chunks = []; // Loaded chunks. Index is the chunk number
        }
        LazyUint8Array.prototype.get = function LazyUint8Array_get(idx) {
          if (idx > this.length-1 || idx < 0) {
            return undefined;
          }
          var chunkOffset = idx % this.chunkSize;
          var chunkNum = (idx / this.chunkSize)|0;
          return this.getter(chunkNum)[chunkOffset];
        }
        LazyUint8Array.prototype.setDataGetter = function LazyUint8Array_setDataGetter(getter) {
          this.getter = getter;
        }
        LazyUint8Array.prototype.cacheLength = function LazyUint8Array_cacheLength() {
          // Find length
          var xhr = new XMLHttpRequest();
          xhr.open('HEAD', url, false);
          xhr.send(null);
          if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
          var datalength = Number(xhr.getResponseHeader("Content-length"));
          var header;
          var hasByteServing = (header = xhr.getResponseHeader("Accept-Ranges")) && header === "bytes";
          var usesGzip = (header = xhr.getResponseHeader("Content-Encoding")) && header === "gzip";
  
          var chunkSize = 1024*1024; // Chunk size in bytes
  
          if (!hasByteServing) chunkSize = datalength;
  
          // Function to get a range from the remote URL.
          var doXHR = (function(from, to) {
            if (from > to) throw new Error("invalid range (" + from + ", " + to + ") or no bytes requested!");
            if (to > datalength-1) throw new Error("only " + datalength + " bytes available! programmer error!");
  
            // TODO: Use mozResponseArrayBuffer, responseStream, etc. if available.
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, false);
            if (datalength !== chunkSize) xhr.setRequestHeader("Range", "bytes=" + from + "-" + to);
  
            // Some hints to the browser that we want binary data.
            if (typeof Uint8Array != 'undefined') xhr.responseType = 'arraybuffer';
            if (xhr.overrideMimeType) {
              xhr.overrideMimeType('text/plain; charset=x-user-defined');
            }
  
            xhr.send(null);
            if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
            if (xhr.response !== undefined) {
              return new Uint8Array(xhr.response || []);
            } else {
              return intArrayFromString(xhr.responseText || '', true);
            }
          });
          var lazyArray = this;
          lazyArray.setDataGetter(function(chunkNum) {
            var start = chunkNum * chunkSize;
            var end = (chunkNum+1) * chunkSize - 1; // including this byte
            end = Math.min(end, datalength-1); // if datalength-1 is selected, this is the last block
            if (typeof(lazyArray.chunks[chunkNum]) === "undefined") {
              lazyArray.chunks[chunkNum] = doXHR(start, end);
            }
            if (typeof(lazyArray.chunks[chunkNum]) === "undefined") throw new Error("doXHR failed!");
            return lazyArray.chunks[chunkNum];
          });
  
          if (usesGzip || !datalength) {
            // if the server uses gzip or doesn't supply the length, we have to download the whole file to get the (uncompressed) length
            chunkSize = datalength = 1; // this will force getter(0)/doXHR do download the whole file
            datalength = this.getter(0).length;
            chunkSize = datalength;
            console.log("LazyFiles on gzip forces download of the whole file when length is accessed");
          }
  
          this._length = datalength;
          this._chunkSize = chunkSize;
          this.lengthKnown = true;
        }
        if (typeof XMLHttpRequest !== 'undefined') {
          if (!ENVIRONMENT_IS_WORKER) throw 'Cannot do synchronous binary XHRs outside webworkers in modern browsers. Use --embed-file or --preload-file in emcc';
          var lazyArray = new LazyUint8Array();
          Object.defineProperties(lazyArray, {
            length: {
              get: function() {
                if(!this.lengthKnown) {
                  this.cacheLength();
                }
                return this._length;
              }
            },
            chunkSize: {
              get: function() {
                if(!this.lengthKnown) {
                  this.cacheLength();
                }
                return this._chunkSize;
              }
            }
          });
  
          var properties = { isDevice: false, contents: lazyArray };
        } else {
          var properties = { isDevice: false, url: url };
        }
  
        var node = FS.createFile(parent, name, properties, canRead, canWrite);
        // This is a total hack, but I want to get this lazy file code out of the
        // core of MEMFS. If we want to keep this lazy file concept I feel it should
        // be its own thin LAZYFS proxying calls to MEMFS.
        if (properties.contents) {
          node.contents = properties.contents;
        } else if (properties.url) {
          node.contents = null;
          node.url = properties.url;
        }
        // Add a function that defers querying the file size until it is asked the first time.
        Object.defineProperties(node, {
          usedBytes: {
            get: function() { return this.contents.length; }
          }
        });
        // override each stream op with one that tries to force load the lazy file first
        var stream_ops = {};
        var keys = Object.keys(node.stream_ops);
        keys.forEach(function(key) {
          var fn = node.stream_ops[key];
          stream_ops[key] = function forceLoadLazyFile() {
            if (!FS.forceLoadFile(node)) {
              throw new FS.ErrnoError(ERRNO_CODES.EIO);
            }
            return fn.apply(null, arguments);
          };
        });
        // use a custom read function
        stream_ops.read = function stream_ops_read(stream, buffer, offset, length, position) {
          if (!FS.forceLoadFile(node)) {
            throw new FS.ErrnoError(ERRNO_CODES.EIO);
          }
          var contents = stream.node.contents;
          if (position >= contents.length)
            return 0;
          var size = Math.min(contents.length - position, length);
          assert(size >= 0);
          if (contents.slice) { // normal array
            for (var i = 0; i < size; i++) {
              buffer[offset + i] = contents[position + i];
            }
          } else {
            for (var i = 0; i < size; i++) { // LazyUint8Array from sync binary XHR
              buffer[offset + i] = contents.get(position + i);
            }
          }
          return size;
        };
        node.stream_ops = stream_ops;
        return node;
      },createPreloadedFile:function (parent, name, url, canRead, canWrite, onload, onerror, dontCreateFile, canOwn, preFinish) {
        Browser.init(); // XXX perhaps this method should move onto Browser?
        // TODO we should allow people to just pass in a complete filename instead
        // of parent and name being that we just join them anyways
        var fullname = name ? PATH.resolve(PATH.join2(parent, name)) : parent;
        var dep = getUniqueRunDependency('cp ' + fullname); // might have several active requests for the same fullname
        function processData(byteArray) {
          function finish(byteArray) {
            if (preFinish) preFinish();
            if (!dontCreateFile) {
              FS.createDataFile(parent, name, byteArray, canRead, canWrite, canOwn);
            }
            if (onload) onload();
            removeRunDependency(dep);
          }
          var handled = false;
          Module['preloadPlugins'].forEach(function(plugin) {
            if (handled) return;
            if (plugin['canHandle'](fullname)) {
              plugin['handle'](byteArray, fullname, finish, function() {
                if (onerror) onerror();
                removeRunDependency(dep);
              });
              handled = true;
            }
          });
          if (!handled) finish(byteArray);
        }
        addRunDependency(dep);
        if (typeof url == 'string') {
          Browser.asyncLoad(url, function(byteArray) {
            processData(byteArray);
          }, onerror);
        } else {
          processData(url);
        }
      },indexedDB:function () {
        return window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
      },DB_NAME:function () {
        return 'EM_FS_' + window.location.pathname;
      },DB_VERSION:20,DB_STORE_NAME:"FILE_DATA",saveFilesToDB:function (paths, onload, onerror) {
        onload = onload || function(){};
        onerror = onerror || function(){};
        var indexedDB = FS.indexedDB();
        try {
          var openRequest = indexedDB.open(FS.DB_NAME(), FS.DB_VERSION);
        } catch (e) {
          return onerror(e);
        }
        openRequest.onupgradeneeded = function openRequest_onupgradeneeded() {
          console.log('creating db');
          var db = openRequest.result;
          db.createObjectStore(FS.DB_STORE_NAME);
        };
        openRequest.onsuccess = function openRequest_onsuccess() {
          var db = openRequest.result;
          var transaction = db.transaction([FS.DB_STORE_NAME], 'readwrite');
          var files = transaction.objectStore(FS.DB_STORE_NAME);
          var ok = 0, fail = 0, total = paths.length;
          function finish() {
            if (fail == 0) onload(); else onerror();
          }
          paths.forEach(function(path) {
            var putRequest = files.put(FS.analyzePath(path).object.contents, path);
            putRequest.onsuccess = function putRequest_onsuccess() { ok++; if (ok + fail == total) finish() };
            putRequest.onerror = function putRequest_onerror() { fail++; if (ok + fail == total) finish() };
          });
          transaction.onerror = onerror;
        };
        openRequest.onerror = onerror;
      },loadFilesFromDB:function (paths, onload, onerror) {
        onload = onload || function(){};
        onerror = onerror || function(){};
        var indexedDB = FS.indexedDB();
        try {
          var openRequest = indexedDB.open(FS.DB_NAME(), FS.DB_VERSION);
        } catch (e) {
          return onerror(e);
        }
        openRequest.onupgradeneeded = onerror; // no database to load from
        openRequest.onsuccess = function openRequest_onsuccess() {
          var db = openRequest.result;
          try {
            var transaction = db.transaction([FS.DB_STORE_NAME], 'readonly');
          } catch(e) {
            onerror(e);
            return;
          }
          var files = transaction.objectStore(FS.DB_STORE_NAME);
          var ok = 0, fail = 0, total = paths.length;
          function finish() {
            if (fail == 0) onload(); else onerror();
          }
          paths.forEach(function(path) {
            var getRequest = files.get(path);
            getRequest.onsuccess = function getRequest_onsuccess() {
              if (FS.analyzePath(path).exists) {
                FS.unlink(path);
              }
              FS.createDataFile(PATH.dirname(path), PATH.basename(path), getRequest.result, true, true, true);
              ok++;
              if (ok + fail == total) finish();
            };
            getRequest.onerror = function getRequest_onerror() { fail++; if (ok + fail == total) finish() };
          });
          transaction.onerror = onerror;
        };
        openRequest.onerror = onerror;
      }};var SYSCALLS={DEFAULT_POLLMASK:5,mappings:{},umask:511,calculateAt:function (dirfd, path) {
        if (path[0] !== '/') {
          // relative path
          var dir;
          if (dirfd === -100) {
            dir = FS.cwd();
          } else {
            var dirstream = FS.getStream(dirfd);
            if (!dirstream) throw new FS.ErrnoError(ERRNO_CODES.EBADF);
            dir = dirstream.path;
          }
          path = PATH.join2(dir, path);
        }
        return path;
      },doStat:function (func, path, buf) {
        try {
          var stat = func(path);
        } catch (e) {
          if (e && e.node && PATH.normalize(path) !== PATH.normalize(FS.getPath(e.node))) {
            // an error occurred while trying to look up the path; we should just report ENOTDIR
            return -ERRNO_CODES.ENOTDIR;
          }
          throw e;
        }
        HEAP32[((buf)>>2)]=stat.dev;
        HEAP32[(((buf)+(4))>>2)]=0;
        HEAP32[(((buf)+(8))>>2)]=stat.ino;
        HEAP32[(((buf)+(12))>>2)]=stat.mode;
        HEAP32[(((buf)+(16))>>2)]=stat.nlink;
        HEAP32[(((buf)+(20))>>2)]=stat.uid;
        HEAP32[(((buf)+(24))>>2)]=stat.gid;
        HEAP32[(((buf)+(28))>>2)]=stat.rdev;
        HEAP32[(((buf)+(32))>>2)]=0;
        HEAP32[(((buf)+(36))>>2)]=stat.size;
        HEAP32[(((buf)+(40))>>2)]=4096;
        HEAP32[(((buf)+(44))>>2)]=stat.blocks;
        HEAP32[(((buf)+(48))>>2)]=(stat.atime.getTime() / 1000)|0;
        HEAP32[(((buf)+(52))>>2)]=0;
        HEAP32[(((buf)+(56))>>2)]=(stat.mtime.getTime() / 1000)|0;
        HEAP32[(((buf)+(60))>>2)]=0;
        HEAP32[(((buf)+(64))>>2)]=(stat.ctime.getTime() / 1000)|0;
        HEAP32[(((buf)+(68))>>2)]=0;
        HEAP32[(((buf)+(72))>>2)]=stat.ino;
        return 0;
      },doMsync:function (addr, stream, len, flags) {
        var buffer = new Uint8Array(HEAPU8.subarray(addr, addr + len));
        FS.msync(stream, buffer, 0, len, flags);
      },doMkdir:function (path, mode) {
        // remove a trailing slash, if one - /a/b/ has basename of '', but
        // we want to create b in the context of this function
        path = PATH.normalize(path);
        if (path[path.length-1] === '/') path = path.substr(0, path.length-1);
        FS.mkdir(path, mode, 0);
        return 0;
      },doMknod:function (path, mode, dev) {
        // we don't want this in the JS API as it uses mknod to create all nodes.
        switch (mode & 61440) {
          case 32768:
          case 8192:
          case 24576:
          case 4096:
          case 49152:
            break;
          default: return -ERRNO_CODES.EINVAL;
        }
        FS.mknod(path, mode, dev);
        return 0;
      },doReadlink:function (path, buf, bufsize) {
        if (bufsize <= 0) return -ERRNO_CODES.EINVAL;
        var ret = FS.readlink(path);
  
        var len = Math.min(bufsize, lengthBytesUTF8(ret));
        var endChar = HEAP8[buf+len];
        stringToUTF8(ret, buf, bufsize+1);
        // readlink is one of the rare functions that write out a C string, but does never append a null to the output buffer(!)
        // stringToUTF8() always appends a null byte, so restore the character under the null byte after the write.
        HEAP8[buf+len] = endChar;
  
        return len;
      },doAccess:function (path, amode) {
        if (amode & ~7) {
          // need a valid mode
          return -ERRNO_CODES.EINVAL;
        }
        var node;
        var lookup = FS.lookupPath(path, { follow: true });
        node = lookup.node;
        var perms = '';
        if (amode & 4) perms += 'r';
        if (amode & 2) perms += 'w';
        if (amode & 1) perms += 'x';
        if (perms /* otherwise, they've just passed F_OK */ && FS.nodePermissions(node, perms)) {
          return -ERRNO_CODES.EACCES;
        }
        return 0;
      },doDup:function (path, flags, suggestFD) {
        var suggest = FS.getStream(suggestFD);
        if (suggest) FS.close(suggest);
        return FS.open(path, flags, 0, suggestFD, suggestFD).fd;
      },doReadv:function (stream, iov, iovcnt, offset) {
        var ret = 0;
        for (var i = 0; i < iovcnt; i++) {
          var ptr = HEAP32[(((iov)+(i*8))>>2)];
          var len = HEAP32[(((iov)+(i*8 + 4))>>2)];
          var curr = FS.read(stream, HEAP8,ptr, len, offset);
          if (curr < 0) return -1;
          ret += curr;
          if (curr < len) break; // nothing more to read
        }
        return ret;
      },doWritev:function (stream, iov, iovcnt, offset) {
        var ret = 0;
        for (var i = 0; i < iovcnt; i++) {
          var ptr = HEAP32[(((iov)+(i*8))>>2)];
          var len = HEAP32[(((iov)+(i*8 + 4))>>2)];
          var curr = FS.write(stream, HEAP8,ptr, len, offset);
          if (curr < 0) return -1;
          ret += curr;
        }
        return ret;
      },varargs:0,get:function (varargs) {
        SYSCALLS.varargs += 4;
        var ret = HEAP32[(((SYSCALLS.varargs)-(4))>>2)];
        return ret;
      },getStr:function () {
        var ret = Pointer_stringify(SYSCALLS.get());
        return ret;
      },getStreamFromFD:function () {
        var stream = FS.getStream(SYSCALLS.get());
        if (!stream) throw new FS.ErrnoError(ERRNO_CODES.EBADF);
        return stream;
      },getSocketFromFD:function () {
        var socket = SOCKFS.getSocket(SYSCALLS.get());
        if (!socket) throw new FS.ErrnoError(ERRNO_CODES.EBADF);
        return socket;
      },getSocketAddress:function (allowNull) {
        var addrp = SYSCALLS.get(), addrlen = SYSCALLS.get();
        if (allowNull && addrp === 0) return null;
        var info = __read_sockaddr(addrp, addrlen);
        if (info.errno) throw new FS.ErrnoError(info.errno);
        info.addr = DNS.lookup_addr(info.addr) || info.addr;
        return info;
      },get64:function () {
        var low = SYSCALLS.get(), high = SYSCALLS.get();
        if (low >= 0) assert(high === 0);
        else assert(high === -1);
        return low;
      },getZero:function () {
        assert(SYSCALLS.get() === 0);
      }};function ___syscall140(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // llseek
      var stream = SYSCALLS.getStreamFromFD(), offset_high = SYSCALLS.get(), offset_low = SYSCALLS.get(), result = SYSCALLS.get(), whence = SYSCALLS.get();
      // NOTE: offset_high is unused - Emscripten's off_t is 32-bit
      var offset = offset_low;
      FS.llseek(stream, offset, whence);
      HEAP32[((result)>>2)]=stream.position;
      if (stream.getdents && offset === 0 && whence === 0) stream.getdents = null; // reset readdir state
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall146(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // writev
      var stream = SYSCALLS.getStreamFromFD(), iov = SYSCALLS.get(), iovcnt = SYSCALLS.get();
      return SYSCALLS.doWritev(stream, iov, iovcnt);
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall221(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // fcntl64
      var stream = SYSCALLS.getStreamFromFD(), cmd = SYSCALLS.get();
      switch (cmd) {
        case 0: {
          var arg = SYSCALLS.get();
          if (arg < 0) {
            return -ERRNO_CODES.EINVAL;
          }
          var newStream;
          newStream = FS.open(stream.path, stream.flags, 0, arg);
          return newStream.fd;
        }
        case 1:
        case 2:
          return 0;  // FD_CLOEXEC makes no sense for a single process.
        case 3:
          return stream.flags;
        case 4: {
          var arg = SYSCALLS.get();
          stream.flags |= arg;
          return 0;
        }
        case 12:
        case 12: {
          var arg = SYSCALLS.get();
          var offset = 0;
          // We're always unlocked.
          HEAP16[(((arg)+(offset))>>1)]=2;
          return 0;
        }
        case 13:
        case 14:
        case 13:
        case 14:
          return 0; // Pretend that the locking is successful.
        case 16:
        case 8:
          return -ERRNO_CODES.EINVAL; // These are for sockets. We don't have them fully implemented yet.
        case 9:
          // musl trusts getown return values, due to a bug where they must be, as they overlap with errors. just return -1 here, so fnctl() returns that, and we set errno ourselves.
          ___setErrNo(ERRNO_CODES.EINVAL);
          return -1;
        default: {
          return -ERRNO_CODES.EINVAL;
        }
      }
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall3(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // read
      var stream = SYSCALLS.getStreamFromFD(), buf = SYSCALLS.get(), count = SYSCALLS.get();
      return FS.read(stream, HEAP8,buf, count);
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall5(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // open
      var pathname = SYSCALLS.getStr(), flags = SYSCALLS.get(), mode = SYSCALLS.get() // optional TODO
      var stream = FS.open(pathname, flags, mode);
      return stream.fd;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall54(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // ioctl
      var stream = SYSCALLS.getStreamFromFD(), op = SYSCALLS.get();
      switch (op) {
        case 21509:
        case 21505: {
          if (!stream.tty) return -ERRNO_CODES.ENOTTY;
          return 0;
        }
        case 21510:
        case 21511:
        case 21512:
        case 21506:
        case 21507:
        case 21508: {
          if (!stream.tty) return -ERRNO_CODES.ENOTTY;
          return 0; // no-op, not actually adjusting terminal settings
        }
        case 21519: {
          if (!stream.tty) return -ERRNO_CODES.ENOTTY;
          var argp = SYSCALLS.get();
          HEAP32[((argp)>>2)]=0;
          return 0;
        }
        case 21520: {
          if (!stream.tty) return -ERRNO_CODES.ENOTTY;
          return -ERRNO_CODES.EINVAL; // not supported
        }
        case 21531: {
          var argp = SYSCALLS.get();
          return FS.ioctl(stream, op, argp);
        }
        case 21523: {
          // TODO: in theory we should write to the winsize struct that gets
          // passed in, but for now musl doesn't read anything on it
          if (!stream.tty) return -ERRNO_CODES.ENOTTY;
          return 0;
        }
        case 21524: {
          // TODO: technically, this ioctl call should change the window size.
          // but, since emscripten doesn't have any concept of a terminal window
          // yet, we'll just silently throw it away as we do TIOCGWINSZ
          if (!stream.tty) return -ERRNO_CODES.ENOTTY;
          return 0;
        }
        default: abort('bad ioctl syscall ' + op);
      }
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall6(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // close
      var stream = SYSCALLS.getStreamFromFD();
      FS.close(stream);
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___unlock() {}

   

   

   

   

   

  
  function _emscripten_memcpy_big(dest, src, num) {
      HEAPU8.set(HEAPU8.subarray(src, src+num), dest);
      return dest;
    } 

   

   
FS.staticInit();__ATINIT__.unshift(function() { if (!Module["noFSInit"] && !FS.init.initialized) FS.init() });__ATMAIN__.push(function() { FS.ignorePermissions = false });__ATEXIT__.push(function() { FS.quit() });;
__ATINIT__.unshift(function() { TTY.init() });__ATEXIT__.push(function() { TTY.shutdown() });;
if (ENVIRONMENT_IS_NODE) { var fs = require("fs"); var NODEJS_PATH = require("path"); NODEFS.staticInit(); };
DYNAMICTOP_PTR = staticAlloc(4);

STACK_BASE = STACKTOP = alignMemory(STATICTOP);

STACK_MAX = STACK_BASE + TOTAL_STACK;

DYNAMIC_BASE = alignMemory(STACK_MAX);

HEAP32[DYNAMICTOP_PTR>>2] = DYNAMIC_BASE;

staticSealed = true; // seal the static portion of memory

assert(DYNAMIC_BASE < TOTAL_MEMORY, "TOTAL_MEMORY not big enough for stack");

var ASSERTIONS = true;

/** @type {function(string, boolean=, number=)} */
function intArrayFromString(stringy, dontAddNull, length) {
  var len = length > 0 ? length : lengthBytesUTF8(stringy)+1;
  var u8array = new Array(len);
  var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
  if (dontAddNull) u8array.length = numBytesWritten;
  return u8array;
}

function intArrayToString(array) {
  var ret = [];
  for (var i = 0; i < array.length; i++) {
    var chr = array[i];
    if (chr > 0xFF) {
      if (ASSERTIONS) {
        assert(false, 'Character code ' + chr + ' (' + String.fromCharCode(chr) + ')  at offset ' + i + ' not in 0x00-0xFF.');
      }
      chr &= 0xFF;
    }
    ret.push(String.fromCharCode(chr));
  }
  return ret.join('');
}


// Copied from https://github.com/strophe/strophejs/blob/e06d027/src/polyfills.js#L149

// This code was written by Tyler Akins and has been placed in the
// public domain.  It would be nice if you left this header intact.
// Base64 code from Tyler Akins -- http://rumkin.com

/**
 * Decodes a base64 string.
 * @param {String} input The string to decode.
 */
var decodeBase64 = typeof atob === 'function' ? atob : function (input) {
  var keyStr = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

  var output = '';
  var chr1, chr2, chr3;
  var enc1, enc2, enc3, enc4;
  var i = 0;
  // remove all characters that are not A-Z, a-z, 0-9, +, /, or =
  input = input.replace(/[^A-Za-z0-9\+\/\=]/g, '');
  do {
    enc1 = keyStr.indexOf(input.charAt(i++));
    enc2 = keyStr.indexOf(input.charAt(i++));
    enc3 = keyStr.indexOf(input.charAt(i++));
    enc4 = keyStr.indexOf(input.charAt(i++));

    chr1 = (enc1 << 2) | (enc2 >> 4);
    chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    chr3 = ((enc3 & 3) << 6) | enc4;

    output = output + String.fromCharCode(chr1);

    if (enc3 !== 64) {
      output = output + String.fromCharCode(chr2);
    }
    if (enc4 !== 64) {
      output = output + String.fromCharCode(chr3);
    }
  } while (i < input.length);
  return output;
};

// Converts a string of base64 into a byte array.
// Throws error on invalid input.
function intArrayFromBase64(s) {
  if (typeof ENVIRONMENT_IS_NODE === 'boolean' && ENVIRONMENT_IS_NODE) {
    var buf;
    try {
      buf = Buffer.from(s, 'base64');
    } catch (_) {
      buf = new Buffer(s, 'base64');
    }
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }

  try {
    var decoded = decodeBase64(s);
    var bytes = new Uint8Array(decoded.length);
    for (var i = 0 ; i < decoded.length ; ++i) {
      bytes[i] = decoded.charCodeAt(i);
    }
    return bytes;
  } catch (_) {
    throw new Error('Converting base64 string to bytes failed.');
  }
}

// If filename is a base64 data URI, parses and returns data (Buffer on node,
// Uint8Array otherwise). If filename is not a base64 data URI, returns undefined.
function tryParseAsDataURI(filename) {
  if (!isDataURI(filename)) {
    return;
  }

  return intArrayFromBase64(filename.slice(dataURIPrefix.length));
}



function nullFunc_ii(x) { err("Invalid function pointer called with signature 'ii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  err("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_iiii(x) { err("Invalid function pointer called with signature 'iiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  err("Build with ASSERTIONS=2 for more info.");abort(x) }

function invoke_ii(index,a1) {
  var sp = stackSave();
  try {
    return Module["dynCall_ii"](index,a1);
  } catch(e) {
    stackRestore(sp);
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_iiii(index,a1,a2,a3) {
  var sp = stackSave();
  try {
    return Module["dynCall_iiii"](index,a1,a2,a3);
  } catch(e) {
    stackRestore(sp);
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

Module.asmGlobalArg = { "Math": Math, "Int8Array": Int8Array, "Int16Array": Int16Array, "Int32Array": Int32Array, "Uint8Array": Uint8Array, "Uint16Array": Uint16Array, "Uint32Array": Uint32Array, "Float32Array": Float32Array, "Float64Array": Float64Array, "NaN": NaN, "Infinity": Infinity };

Module.asmLibraryArg = { "abort": abort, "assert": assert, "enlargeMemory": enlargeMemory, "getTotalMemory": getTotalMemory, "abortOnCannotGrowMemory": abortOnCannotGrowMemory, "abortStackOverflow": abortStackOverflow, "nullFunc_ii": nullFunc_ii, "nullFunc_iiii": nullFunc_iiii, "invoke_ii": invoke_ii, "invoke_iiii": invoke_iiii, "___lock": ___lock, "___setErrNo": ___setErrNo, "___syscall140": ___syscall140, "___syscall146": ___syscall146, "___syscall221": ___syscall221, "___syscall3": ___syscall3, "___syscall5": ___syscall5, "___syscall54": ___syscall54, "___syscall6": ___syscall6, "___unlock": ___unlock, "_emscripten_memcpy_big": _emscripten_memcpy_big, "DYNAMICTOP_PTR": DYNAMICTOP_PTR, "tempDoublePtr": tempDoublePtr, "ABORT": ABORT, "STACKTOP": STACKTOP, "STACK_MAX": STACK_MAX };
// EMSCRIPTEN_START_ASM
var asm = (/** @suppress {uselessCode} */ function(global, env, buffer) {
'almost asm';


  var HEAP8 = new global.Int8Array(buffer);
  var HEAP16 = new global.Int16Array(buffer);
  var HEAP32 = new global.Int32Array(buffer);
  var HEAPU8 = new global.Uint8Array(buffer);
  var HEAPU16 = new global.Uint16Array(buffer);
  var HEAPU32 = new global.Uint32Array(buffer);
  var HEAPF32 = new global.Float32Array(buffer);
  var HEAPF64 = new global.Float64Array(buffer);

  var DYNAMICTOP_PTR=env.DYNAMICTOP_PTR|0;
  var tempDoublePtr=env.tempDoublePtr|0;
  var ABORT=env.ABORT|0;
  var STACKTOP=env.STACKTOP|0;
  var STACK_MAX=env.STACK_MAX|0;

  var __THREW__ = 0;
  var threwValue = 0;
  var setjmpId = 0;
  var undef = 0;
  var nan = global.NaN, inf = global.Infinity;
  var tempInt = 0, tempBigInt = 0, tempBigIntS = 0, tempValue = 0, tempDouble = 0.0;
  var tempRet0 = 0;

  var Math_floor=global.Math.floor;
  var Math_abs=global.Math.abs;
  var Math_sqrt=global.Math.sqrt;
  var Math_pow=global.Math.pow;
  var Math_cos=global.Math.cos;
  var Math_sin=global.Math.sin;
  var Math_tan=global.Math.tan;
  var Math_acos=global.Math.acos;
  var Math_asin=global.Math.asin;
  var Math_atan=global.Math.atan;
  var Math_atan2=global.Math.atan2;
  var Math_exp=global.Math.exp;
  var Math_log=global.Math.log;
  var Math_ceil=global.Math.ceil;
  var Math_imul=global.Math.imul;
  var Math_min=global.Math.min;
  var Math_max=global.Math.max;
  var Math_clz32=global.Math.clz32;
  var abort=env.abort;
  var assert=env.assert;
  var enlargeMemory=env.enlargeMemory;
  var getTotalMemory=env.getTotalMemory;
  var abortOnCannotGrowMemory=env.abortOnCannotGrowMemory;
  var abortStackOverflow=env.abortStackOverflow;
  var nullFunc_ii=env.nullFunc_ii;
  var nullFunc_iiii=env.nullFunc_iiii;
  var invoke_ii=env.invoke_ii;
  var invoke_iiii=env.invoke_iiii;
  var ___lock=env.___lock;
  var ___setErrNo=env.___setErrNo;
  var ___syscall140=env.___syscall140;
  var ___syscall146=env.___syscall146;
  var ___syscall221=env.___syscall221;
  var ___syscall3=env.___syscall3;
  var ___syscall5=env.___syscall5;
  var ___syscall54=env.___syscall54;
  var ___syscall6=env.___syscall6;
  var ___unlock=env.___unlock;
  var _emscripten_memcpy_big=env._emscripten_memcpy_big;
  var tempFloat = 0.0;

// EMSCRIPTEN_START_FUNCS

function stackAlloc(size) {
  size = size|0;
  var ret = 0;
  ret = STACKTOP;
  STACKTOP = (STACKTOP + size)|0;
  STACKTOP = (STACKTOP + 15)&-16;
  if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(size|0);

  return ret|0;
}
function stackSave() {
  return STACKTOP|0;
}
function stackRestore(top) {
  top = top|0;
  STACKTOP = top;
}
function establishStackSpace(stackBase, stackMax) {
  stackBase = stackBase|0;
  stackMax = stackMax|0;
  STACKTOP = stackBase;
  STACK_MAX = stackMax;
}

function setThrew(threw, value) {
  threw = threw|0;
  value = value|0;
  if ((__THREW__|0) == 0) {
    __THREW__ = threw;
    threwValue = value;
  }
}

function setTempRet0(value) {
  value = value|0;
  tempRet0 = value;
}
function getTempRet0() {
  return tempRet0|0;
}

function _ed25519_create_keypair($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$0 = 0, $10 = 0, $11 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 224|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(224|0);
 $2 = sp + 160|0;
 $3 = sp;
 $4 = (_randombytes($0,32)|0);
 $5 = ($4|0)==(0);
 if ($5) {
  $$0 = 0;
  STACKTOP = sp;return ($$0|0);
 }
 (_sha512($2,$0,32,0)|0);
 $6 = HEAP8[$2>>0]|0;
 $7 = $6 & -8;
 HEAP8[$2>>0] = $7;
 $8 = ((($2)) + 31|0);
 $9 = HEAP8[$8>>0]|0;
 $10 = $9 & 63;
 $11 = $10 | 64;
 HEAP8[$8>>0] = $11;
 _crypto_sign_ed25519_ref10_ge_scalarmult_base($3,$2);
 _crypto_sign_ed25519_ref10_ge_p3_tobytes($1,$3);
 $$0 = 1;
 STACKTOP = sp;return ($$0|0);
}
function _ed25519_derive_public_key($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 224|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(224|0);
 $2 = sp + 160|0;
 $3 = sp;
 (_sha512($2,$0,32,0)|0);
 $4 = HEAP8[$2>>0]|0;
 $5 = $4 & -8;
 HEAP8[$2>>0] = $5;
 $6 = ((($2)) + 31|0);
 $7 = HEAP8[$6>>0]|0;
 $8 = $7 & 63;
 $9 = $8 | 64;
 HEAP8[$6>>0] = $9;
 _crypto_sign_ed25519_ref10_ge_scalarmult_base($3,$2);
 _crypto_sign_ed25519_ref10_ge_p3_tobytes($1,$3);
 STACKTOP = sp;return;
}
function _ed25519_sign($0,$1,$2,$3,$4,$5) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 $5 = $5|0;
 var $$alloca_mul = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 352|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(352|0);
 $6 = sp + 288|0;
 $7 = sp + 224|0;
 $8 = sp + 160|0;
 $9 = sp;
 $10 = HEAP32[8000]|0;
 $$alloca_mul = $10;
 $11 = STACKTOP; STACKTOP = STACKTOP + ((((1*$$alloca_mul)|0)+15)&-16)|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(((((1*$$alloca_mul)|0)+15)&-16)|0);;
 (_sha512_init($11)|0);
 (_sha512_update($11,$5,32,0)|0);
 (_sha512_final($11,$6)|0);
 $12 = HEAP8[$6>>0]|0;
 $13 = $12 & -8;
 HEAP8[$6>>0] = $13;
 $14 = ((($6)) + 31|0);
 $15 = HEAP8[$14>>0]|0;
 $16 = $15 & 63;
 $17 = $16 | 64;
 HEAP8[$14>>0] = $17;
 (_sha512_init($11)|0);
 $18 = ((($6)) + 32|0);
 (_sha512_update($11,$18,32,0)|0);
 (_sha512_update($11,$1,$2,$3)|0);
 (_sha512_final($11,$7)|0);
 _crypto_sign_ed25519_ref10_sc_reduce($7);
 _crypto_sign_ed25519_ref10_ge_scalarmult_base($9,$7);
 _crypto_sign_ed25519_ref10_ge_p3_tobytes($0,$9);
 (_sha512_init($11)|0);
 (_sha512_update($11,$0,32,0)|0);
 (_sha512_update($11,$4,32,0)|0);
 (_sha512_update($11,$1,$2,$3)|0);
 (_sha512_final($11,$8)|0);
 _crypto_sign_ed25519_ref10_sc_reduce($8);
 $19 = ((($0)) + 32|0);
 _crypto_sign_ed25519_ref10_sc_muladd($19,$8,$6,$7);
 STACKTOP = sp;return;
}
function _ed25519_verify($0,$1,$2,$3,$4) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 var $$0 = 0, $$alloca_mul = 0, $$sroa$0$0$copyload = 0, $$sroa$10$0$$sroa_idx = 0, $$sroa$10$0$copyload = 0, $$sroa$11$0$$sroa_idx = 0, $$sroa$11$0$copyload = 0, $$sroa$12$0$$sroa_idx = 0, $$sroa$12$0$copyload = 0, $$sroa$13$0$$sroa_idx = 0, $$sroa$13$0$copyload = 0, $$sroa$14$0$$sroa_idx = 0, $$sroa$14$0$copyload = 0, $$sroa$15$0$$sroa_idx = 0, $$sroa$15$0$copyload = 0, $$sroa$16$0$$sroa_idx = 0, $$sroa$16$0$copyload = 0, $$sroa$17$0$$sroa_idx = 0, $$sroa$17$0$copyload = 0, $$sroa$18$0$$sroa_idx = 0;
 var $$sroa$18$0$copyload = 0, $$sroa$19$0$$sroa_idx = 0, $$sroa$19$0$copyload = 0, $$sroa$20$0$$sroa_idx = 0, $$sroa$20$0$copyload = 0, $$sroa$21$0$$sroa_idx = 0, $$sroa$21$0$copyload = 0, $$sroa$22$0$$sroa_idx = 0, $$sroa$22$0$copyload = 0, $$sroa$23$0$$sroa_idx = 0, $$sroa$23$0$copyload = 0, $$sroa$24$0$$sroa_idx = 0, $$sroa$24$0$copyload = 0, $$sroa$25$0$$sroa_idx = 0, $$sroa$25$0$copyload = 0, $$sroa$26$0$$sroa_idx = 0, $$sroa$26$0$copyload = 0, $$sroa$27$0$$sroa_idx = 0, $$sroa$27$0$copyload = 0, $$sroa$28$0$$sroa_idx = 0;
 var $$sroa$28$0$copyload = 0, $$sroa$29$0$$sroa_idx = 0, $$sroa$29$0$copyload = 0, $$sroa$30$0$$sroa_idx = 0, $$sroa$30$0$copyload = 0, $$sroa$31$0$$sroa_idx = 0, $$sroa$31$0$copyload = 0, $$sroa$32$0$$sroa_idx = 0, $$sroa$32$0$copyload = 0, $$sroa$33$0$$sroa_idx = 0, $$sroa$33$0$copyload = 0, $$sroa$34$0$$sroa_idx = 0, $$sroa$34$0$copyload = 0, $$sroa$4$0$$sroa_idx = 0, $$sroa$4$0$copyload = 0, $$sroa$5$0$$sroa_idx = 0, $$sroa$5$0$copyload = 0, $$sroa$6$0$$sroa_idx = 0, $$sroa$6$0$copyload = 0, $$sroa$7$0$$sroa_idx = 0;
 var $$sroa$7$0$copyload = 0, $$sroa$8$0$$sroa_idx = 0, $$sroa$8$0$copyload = 0, $$sroa$9$0$$sroa_idx = 0, $$sroa$9$0$copyload = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0;
 var $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0;
 var $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $15 = 0, $16 = 0, $17 = 0;
 var $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0;
 var $38 = 0, $39 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0;
 var $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0;
 var $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0;
 var $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 384|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(384|0);
 $5 = sp + 312|0;
 $6 = sp + 280|0;
 $7 = sp + 120|0;
 $8 = sp;
 $9 = HEAP32[8000]|0;
 $$alloca_mul = $9;
 $10 = STACKTOP; STACKTOP = STACKTOP + ((((1*$$alloca_mul)|0)+15)&-16)|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(((((1*$$alloca_mul)|0)+15)&-16)|0);;
 $11 = ((($0)) + 63|0);
 $12 = HEAP8[$11>>0]|0;
 $13 = ($12&255)>(31);
 if (!($13)) {
  $14 = (_crypto_sign_ed25519_ref10_ge_frombytes_negate_vartime($7,$4)|0);
  $15 = ($14|0)==(0);
  if ($15) {
   $$sroa$0$0$copyload = HEAP8[$0>>0]|0;
   $$sroa$4$0$$sroa_idx = ((($0)) + 1|0);
   $$sroa$4$0$copyload = HEAP8[$$sroa$4$0$$sroa_idx>>0]|0;
   $$sroa$5$0$$sroa_idx = ((($0)) + 2|0);
   $$sroa$5$0$copyload = HEAP8[$$sroa$5$0$$sroa_idx>>0]|0;
   $$sroa$6$0$$sroa_idx = ((($0)) + 3|0);
   $$sroa$6$0$copyload = HEAP8[$$sroa$6$0$$sroa_idx>>0]|0;
   $$sroa$7$0$$sroa_idx = ((($0)) + 4|0);
   $$sroa$7$0$copyload = HEAP8[$$sroa$7$0$$sroa_idx>>0]|0;
   $$sroa$8$0$$sroa_idx = ((($0)) + 5|0);
   $$sroa$8$0$copyload = HEAP8[$$sroa$8$0$$sroa_idx>>0]|0;
   $$sroa$9$0$$sroa_idx = ((($0)) + 6|0);
   $$sroa$9$0$copyload = HEAP8[$$sroa$9$0$$sroa_idx>>0]|0;
   $$sroa$10$0$$sroa_idx = ((($0)) + 7|0);
   $$sroa$10$0$copyload = HEAP8[$$sroa$10$0$$sroa_idx>>0]|0;
   $$sroa$11$0$$sroa_idx = ((($0)) + 8|0);
   $$sroa$11$0$copyload = HEAP8[$$sroa$11$0$$sroa_idx>>0]|0;
   $$sroa$12$0$$sroa_idx = ((($0)) + 9|0);
   $$sroa$12$0$copyload = HEAP8[$$sroa$12$0$$sroa_idx>>0]|0;
   $$sroa$13$0$$sroa_idx = ((($0)) + 10|0);
   $$sroa$13$0$copyload = HEAP8[$$sroa$13$0$$sroa_idx>>0]|0;
   $$sroa$14$0$$sroa_idx = ((($0)) + 11|0);
   $$sroa$14$0$copyload = HEAP8[$$sroa$14$0$$sroa_idx>>0]|0;
   $$sroa$15$0$$sroa_idx = ((($0)) + 12|0);
   $$sroa$15$0$copyload = HEAP8[$$sroa$15$0$$sroa_idx>>0]|0;
   $$sroa$16$0$$sroa_idx = ((($0)) + 13|0);
   $$sroa$16$0$copyload = HEAP8[$$sroa$16$0$$sroa_idx>>0]|0;
   $$sroa$17$0$$sroa_idx = ((($0)) + 14|0);
   $$sroa$17$0$copyload = HEAP8[$$sroa$17$0$$sroa_idx>>0]|0;
   $$sroa$18$0$$sroa_idx = ((($0)) + 15|0);
   $$sroa$18$0$copyload = HEAP8[$$sroa$18$0$$sroa_idx>>0]|0;
   $$sroa$19$0$$sroa_idx = ((($0)) + 16|0);
   $$sroa$19$0$copyload = HEAP8[$$sroa$19$0$$sroa_idx>>0]|0;
   $$sroa$20$0$$sroa_idx = ((($0)) + 17|0);
   $$sroa$20$0$copyload = HEAP8[$$sroa$20$0$$sroa_idx>>0]|0;
   $$sroa$21$0$$sroa_idx = ((($0)) + 18|0);
   $$sroa$21$0$copyload = HEAP8[$$sroa$21$0$$sroa_idx>>0]|0;
   $$sroa$22$0$$sroa_idx = ((($0)) + 19|0);
   $$sroa$22$0$copyload = HEAP8[$$sroa$22$0$$sroa_idx>>0]|0;
   $$sroa$23$0$$sroa_idx = ((($0)) + 20|0);
   $$sroa$23$0$copyload = HEAP8[$$sroa$23$0$$sroa_idx>>0]|0;
   $$sroa$24$0$$sroa_idx = ((($0)) + 21|0);
   $$sroa$24$0$copyload = HEAP8[$$sroa$24$0$$sroa_idx>>0]|0;
   $$sroa$25$0$$sroa_idx = ((($0)) + 22|0);
   $$sroa$25$0$copyload = HEAP8[$$sroa$25$0$$sroa_idx>>0]|0;
   $$sroa$26$0$$sroa_idx = ((($0)) + 23|0);
   $$sroa$26$0$copyload = HEAP8[$$sroa$26$0$$sroa_idx>>0]|0;
   $$sroa$27$0$$sroa_idx = ((($0)) + 24|0);
   $$sroa$27$0$copyload = HEAP8[$$sroa$27$0$$sroa_idx>>0]|0;
   $$sroa$28$0$$sroa_idx = ((($0)) + 25|0);
   $$sroa$28$0$copyload = HEAP8[$$sroa$28$0$$sroa_idx>>0]|0;
   $$sroa$29$0$$sroa_idx = ((($0)) + 26|0);
   $$sroa$29$0$copyload = HEAP8[$$sroa$29$0$$sroa_idx>>0]|0;
   $$sroa$30$0$$sroa_idx = ((($0)) + 27|0);
   $$sroa$30$0$copyload = HEAP8[$$sroa$30$0$$sroa_idx>>0]|0;
   $$sroa$31$0$$sroa_idx = ((($0)) + 28|0);
   $$sroa$31$0$copyload = HEAP8[$$sroa$31$0$$sroa_idx>>0]|0;
   $$sroa$32$0$$sroa_idx = ((($0)) + 29|0);
   $$sroa$32$0$copyload = HEAP8[$$sroa$32$0$$sroa_idx>>0]|0;
   $$sroa$33$0$$sroa_idx = ((($0)) + 30|0);
   $$sroa$33$0$copyload = HEAP8[$$sroa$33$0$$sroa_idx>>0]|0;
   $$sroa$34$0$$sroa_idx = ((($0)) + 31|0);
   $$sroa$34$0$copyload = HEAP8[$$sroa$34$0$$sroa_idx>>0]|0;
   (_sha512_init($10)|0);
   (_sha512_update($10,$0,32,0)|0);
   (_sha512_update($10,$4,32,0)|0);
   (_sha512_update($10,$1,$2,$3)|0);
   (_sha512_final($10,$5)|0);
   _crypto_sign_ed25519_ref10_sc_reduce($5);
   $16 = ((($0)) + 32|0);
   _crypto_sign_ed25519_ref10_ge_double_scalarmult_vartime($8,$5,$7,$16);
   _crypto_sign_ed25519_ref10_ge_tobytes($6,$8);
   $17 = HEAP8[$6>>0]|0;
   $18 = $17 ^ $$sroa$0$0$copyload;
   $19 = ((($6)) + 1|0);
   $20 = HEAP8[$19>>0]|0;
   $21 = $20 ^ $$sroa$4$0$copyload;
   $22 = $21 | $18;
   $23 = ((($6)) + 2|0);
   $24 = HEAP8[$23>>0]|0;
   $25 = $24 ^ $$sroa$5$0$copyload;
   $26 = $22 | $25;
   $27 = ((($6)) + 3|0);
   $28 = HEAP8[$27>>0]|0;
   $29 = $28 ^ $$sroa$6$0$copyload;
   $30 = $26 | $29;
   $31 = ((($6)) + 4|0);
   $32 = HEAP8[$31>>0]|0;
   $33 = $32 ^ $$sroa$7$0$copyload;
   $34 = $30 | $33;
   $35 = ((($6)) + 5|0);
   $36 = HEAP8[$35>>0]|0;
   $37 = $36 ^ $$sroa$8$0$copyload;
   $38 = $34 | $37;
   $39 = ((($6)) + 6|0);
   $40 = HEAP8[$39>>0]|0;
   $41 = $40 ^ $$sroa$9$0$copyload;
   $42 = $38 | $41;
   $43 = ((($6)) + 7|0);
   $44 = HEAP8[$43>>0]|0;
   $45 = $44 ^ $$sroa$10$0$copyload;
   $46 = $42 | $45;
   $47 = ((($6)) + 8|0);
   $48 = HEAP8[$47>>0]|0;
   $49 = $48 ^ $$sroa$11$0$copyload;
   $50 = $46 | $49;
   $51 = ((($6)) + 9|0);
   $52 = HEAP8[$51>>0]|0;
   $53 = $52 ^ $$sroa$12$0$copyload;
   $54 = $50 | $53;
   $55 = ((($6)) + 10|0);
   $56 = HEAP8[$55>>0]|0;
   $57 = $56 ^ $$sroa$13$0$copyload;
   $58 = $54 | $57;
   $59 = ((($6)) + 11|0);
   $60 = HEAP8[$59>>0]|0;
   $61 = $60 ^ $$sroa$14$0$copyload;
   $62 = $58 | $61;
   $63 = ((($6)) + 12|0);
   $64 = HEAP8[$63>>0]|0;
   $65 = $64 ^ $$sroa$15$0$copyload;
   $66 = $62 | $65;
   $67 = ((($6)) + 13|0);
   $68 = HEAP8[$67>>0]|0;
   $69 = $68 ^ $$sroa$16$0$copyload;
   $70 = $66 | $69;
   $71 = ((($6)) + 14|0);
   $72 = HEAP8[$71>>0]|0;
   $73 = $72 ^ $$sroa$17$0$copyload;
   $74 = $70 | $73;
   $75 = ((($6)) + 15|0);
   $76 = HEAP8[$75>>0]|0;
   $77 = $76 ^ $$sroa$18$0$copyload;
   $78 = $74 | $77;
   $79 = ((($6)) + 16|0);
   $80 = HEAP8[$79>>0]|0;
   $81 = $80 ^ $$sroa$19$0$copyload;
   $82 = $78 | $81;
   $83 = ((($6)) + 17|0);
   $84 = HEAP8[$83>>0]|0;
   $85 = $84 ^ $$sroa$20$0$copyload;
   $86 = $82 | $85;
   $87 = ((($6)) + 18|0);
   $88 = HEAP8[$87>>0]|0;
   $89 = $88 ^ $$sroa$21$0$copyload;
   $90 = $86 | $89;
   $91 = ((($6)) + 19|0);
   $92 = HEAP8[$91>>0]|0;
   $93 = $92 ^ $$sroa$22$0$copyload;
   $94 = $90 | $93;
   $95 = ((($6)) + 20|0);
   $96 = HEAP8[$95>>0]|0;
   $97 = $96 ^ $$sroa$23$0$copyload;
   $98 = $94 | $97;
   $99 = ((($6)) + 21|0);
   $100 = HEAP8[$99>>0]|0;
   $101 = $100 ^ $$sroa$24$0$copyload;
   $102 = $98 | $101;
   $103 = ((($6)) + 22|0);
   $104 = HEAP8[$103>>0]|0;
   $105 = $104 ^ $$sroa$25$0$copyload;
   $106 = $102 | $105;
   $107 = ((($6)) + 23|0);
   $108 = HEAP8[$107>>0]|0;
   $109 = $108 ^ $$sroa$26$0$copyload;
   $110 = $106 | $109;
   $111 = ((($6)) + 24|0);
   $112 = HEAP8[$111>>0]|0;
   $113 = $112 ^ $$sroa$27$0$copyload;
   $114 = $110 | $113;
   $115 = ((($6)) + 25|0);
   $116 = HEAP8[$115>>0]|0;
   $117 = $116 ^ $$sroa$28$0$copyload;
   $118 = $114 | $117;
   $119 = ((($6)) + 26|0);
   $120 = HEAP8[$119>>0]|0;
   $121 = $120 ^ $$sroa$29$0$copyload;
   $122 = $118 | $121;
   $123 = ((($6)) + 27|0);
   $124 = HEAP8[$123>>0]|0;
   $125 = $124 ^ $$sroa$30$0$copyload;
   $126 = $122 | $125;
   $127 = ((($6)) + 28|0);
   $128 = HEAP8[$127>>0]|0;
   $129 = $128 ^ $$sroa$31$0$copyload;
   $130 = $126 | $129;
   $131 = ((($6)) + 29|0);
   $132 = HEAP8[$131>>0]|0;
   $133 = $132 ^ $$sroa$32$0$copyload;
   $134 = $130 | $133;
   $135 = ((($6)) + 30|0);
   $136 = HEAP8[$135>>0]|0;
   $137 = $136 ^ $$sroa$33$0$copyload;
   $138 = $134 | $137;
   $139 = ((($6)) + 31|0);
   $140 = HEAP8[$139>>0]|0;
   $141 = $140 ^ $$sroa$34$0$copyload;
   $142 = $138 | $141;
   $143 = $142&255;
   $144 = (($143) + 511)|0;
   $145 = $144 & 256;
   $146 = ($145|0)==(0);
   if (!($146)) {
    $$0 = 1;
    STACKTOP = sp;return ($$0|0);
   }
  }
 }
 $$0 = 0;
 STACKTOP = sp;return ($$0|0);
}
function _crypto_sign_ed25519_ref10_fe_0($0) {
 $0 = $0|0;
 var dest = 0, label = 0, sp = 0, stop = 0;
 sp = STACKTOP;
 dest=$0; stop=dest+40|0; do { HEAP32[dest>>2]=0|0; dest=dest+4|0; } while ((dest|0) < (stop|0));
 return;
}
function _crypto_sign_ed25519_ref10_fe_1($0) {
 $0 = $0|0;
 var $1 = 0, dest = 0, label = 0, sp = 0, stop = 0;
 sp = STACKTOP;
 HEAP32[$0>>2] = 1;
 $1 = ((($0)) + 4|0);
 dest=$1; stop=dest+36|0; do { HEAP32[dest>>2]=0|0; dest=dest+4|0; } while ((dest|0) < (stop|0));
 return;
}
function _crypto_sign_ed25519_ref10_fe_add($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0;
 var $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0;
 var $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = HEAP32[$1>>2]|0;
 $4 = ((($1)) + 4|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = ((($1)) + 8|0);
 $7 = HEAP32[$6>>2]|0;
 $8 = ((($1)) + 12|0);
 $9 = HEAP32[$8>>2]|0;
 $10 = ((($1)) + 16|0);
 $11 = HEAP32[$10>>2]|0;
 $12 = ((($1)) + 20|0);
 $13 = HEAP32[$12>>2]|0;
 $14 = ((($1)) + 24|0);
 $15 = HEAP32[$14>>2]|0;
 $16 = ((($1)) + 28|0);
 $17 = HEAP32[$16>>2]|0;
 $18 = ((($1)) + 32|0);
 $19 = HEAP32[$18>>2]|0;
 $20 = ((($1)) + 36|0);
 $21 = HEAP32[$20>>2]|0;
 $22 = HEAP32[$2>>2]|0;
 $23 = ((($2)) + 4|0);
 $24 = HEAP32[$23>>2]|0;
 $25 = ((($2)) + 8|0);
 $26 = HEAP32[$25>>2]|0;
 $27 = ((($2)) + 12|0);
 $28 = HEAP32[$27>>2]|0;
 $29 = ((($2)) + 16|0);
 $30 = HEAP32[$29>>2]|0;
 $31 = ((($2)) + 20|0);
 $32 = HEAP32[$31>>2]|0;
 $33 = ((($2)) + 24|0);
 $34 = HEAP32[$33>>2]|0;
 $35 = ((($2)) + 28|0);
 $36 = HEAP32[$35>>2]|0;
 $37 = ((($2)) + 32|0);
 $38 = HEAP32[$37>>2]|0;
 $39 = ((($2)) + 36|0);
 $40 = HEAP32[$39>>2]|0;
 $41 = (($22) + ($3))|0;
 $42 = (($24) + ($5))|0;
 $43 = (($26) + ($7))|0;
 $44 = (($28) + ($9))|0;
 $45 = (($30) + ($11))|0;
 $46 = (($32) + ($13))|0;
 $47 = (($34) + ($15))|0;
 $48 = (($36) + ($17))|0;
 $49 = (($38) + ($19))|0;
 $50 = (($40) + ($21))|0;
 HEAP32[$0>>2] = $41;
 $51 = ((($0)) + 4|0);
 HEAP32[$51>>2] = $42;
 $52 = ((($0)) + 8|0);
 HEAP32[$52>>2] = $43;
 $53 = ((($0)) + 12|0);
 HEAP32[$53>>2] = $44;
 $54 = ((($0)) + 16|0);
 HEAP32[$54>>2] = $45;
 $55 = ((($0)) + 20|0);
 HEAP32[$55>>2] = $46;
 $56 = ((($0)) + 24|0);
 HEAP32[$56>>2] = $47;
 $57 = ((($0)) + 28|0);
 HEAP32[$57>>2] = $48;
 $58 = ((($0)) + 32|0);
 HEAP32[$58>>2] = $49;
 $59 = ((($0)) + 36|0);
 HEAP32[$59>>2] = $50;
 return;
}
function _crypto_sign_ed25519_ref10_fe_cmov($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0;
 var $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0;
 var $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0;
 var $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = HEAP32[$0>>2]|0;
 $4 = ((($0)) + 4|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = ((($0)) + 8|0);
 $7 = HEAP32[$6>>2]|0;
 $8 = ((($0)) + 12|0);
 $9 = HEAP32[$8>>2]|0;
 $10 = ((($0)) + 16|0);
 $11 = HEAP32[$10>>2]|0;
 $12 = ((($0)) + 20|0);
 $13 = HEAP32[$12>>2]|0;
 $14 = ((($0)) + 24|0);
 $15 = HEAP32[$14>>2]|0;
 $16 = ((($0)) + 28|0);
 $17 = HEAP32[$16>>2]|0;
 $18 = ((($0)) + 32|0);
 $19 = HEAP32[$18>>2]|0;
 $20 = ((($0)) + 36|0);
 $21 = HEAP32[$20>>2]|0;
 $22 = HEAP32[$1>>2]|0;
 $23 = ((($1)) + 4|0);
 $24 = HEAP32[$23>>2]|0;
 $25 = ((($1)) + 8|0);
 $26 = HEAP32[$25>>2]|0;
 $27 = ((($1)) + 12|0);
 $28 = HEAP32[$27>>2]|0;
 $29 = ((($1)) + 16|0);
 $30 = HEAP32[$29>>2]|0;
 $31 = ((($1)) + 20|0);
 $32 = HEAP32[$31>>2]|0;
 $33 = ((($1)) + 24|0);
 $34 = HEAP32[$33>>2]|0;
 $35 = ((($1)) + 28|0);
 $36 = HEAP32[$35>>2]|0;
 $37 = ((($1)) + 32|0);
 $38 = HEAP32[$37>>2]|0;
 $39 = ((($1)) + 36|0);
 $40 = HEAP32[$39>>2]|0;
 $41 = $22 ^ $3;
 $42 = $24 ^ $5;
 $43 = $26 ^ $7;
 $44 = $28 ^ $9;
 $45 = $30 ^ $11;
 $46 = $32 ^ $13;
 $47 = $34 ^ $15;
 $48 = $36 ^ $17;
 $49 = $38 ^ $19;
 $50 = $40 ^ $21;
 $51 = (0 - ($2))|0;
 $52 = $41 & $51;
 $53 = $42 & $51;
 $54 = $43 & $51;
 $55 = $44 & $51;
 $56 = $45 & $51;
 $57 = $46 & $51;
 $58 = $47 & $51;
 $59 = $48 & $51;
 $60 = $49 & $51;
 $61 = $50 & $51;
 $62 = $52 ^ $3;
 HEAP32[$0>>2] = $62;
 $63 = $53 ^ $5;
 HEAP32[$4>>2] = $63;
 $64 = $54 ^ $7;
 HEAP32[$6>>2] = $64;
 $65 = $55 ^ $9;
 HEAP32[$8>>2] = $65;
 $66 = $56 ^ $11;
 HEAP32[$10>>2] = $66;
 $67 = $57 ^ $13;
 HEAP32[$12>>2] = $67;
 $68 = $58 ^ $15;
 HEAP32[$14>>2] = $68;
 $69 = $59 ^ $17;
 HEAP32[$16>>2] = $69;
 $70 = $60 ^ $19;
 HEAP32[$18>>2] = $70;
 $71 = $61 ^ $21;
 HEAP32[$20>>2] = $71;
 return;
}
function _crypto_sign_ed25519_ref10_fe_copy($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0;
 var $29 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = HEAP32[$1>>2]|0;
 $3 = ((($1)) + 4|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = ((($1)) + 8|0);
 $6 = HEAP32[$5>>2]|0;
 $7 = ((($1)) + 12|0);
 $8 = HEAP32[$7>>2]|0;
 $9 = ((($1)) + 16|0);
 $10 = HEAP32[$9>>2]|0;
 $11 = ((($1)) + 20|0);
 $12 = HEAP32[$11>>2]|0;
 $13 = ((($1)) + 24|0);
 $14 = HEAP32[$13>>2]|0;
 $15 = ((($1)) + 28|0);
 $16 = HEAP32[$15>>2]|0;
 $17 = ((($1)) + 32|0);
 $18 = HEAP32[$17>>2]|0;
 $19 = ((($1)) + 36|0);
 $20 = HEAP32[$19>>2]|0;
 HEAP32[$0>>2] = $2;
 $21 = ((($0)) + 4|0);
 HEAP32[$21>>2] = $4;
 $22 = ((($0)) + 8|0);
 HEAP32[$22>>2] = $6;
 $23 = ((($0)) + 12|0);
 HEAP32[$23>>2] = $8;
 $24 = ((($0)) + 16|0);
 HEAP32[$24>>2] = $10;
 $25 = ((($0)) + 20|0);
 HEAP32[$25>>2] = $12;
 $26 = ((($0)) + 24|0);
 HEAP32[$26>>2] = $14;
 $27 = ((($0)) + 28|0);
 HEAP32[$27>>2] = $16;
 $28 = ((($0)) + 32|0);
 HEAP32[$28>>2] = $18;
 $29 = ((($0)) + 36|0);
 HEAP32[$29>>2] = $20;
 return;
}
function _crypto_sign_ed25519_ref10_fe_frombytes($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$idx = 0, $$idx$val = 0, $$idx118 = 0, $$idx118$val = 0, $$idx120 = 0, $$idx120$val = 0, $$idx121 = 0, $$idx121$val = 0, $$idx123 = 0, $$idx123$val = 0, $$idx124 = 0, $$idx124$val = 0, $$idx126 = 0, $$idx126$val = 0, $$idx127 = 0, $$idx127$val = 0, $$idx129 = 0, $$idx129$val = 0, $$idx130 = 0, $$idx130$val = 0;
 var $$idx132 = 0, $$idx132$val = 0, $$idx133 = 0, $$idx133$val = 0, $$idx135 = 0, $$idx135$val = 0, $$idx136 = 0, $$idx136$val = 0, $$idx138 = 0, $$idx138$val = 0, $$idx139 = 0, $$idx139$val = 0, $$val = 0, $$val119 = 0, $$val122 = 0, $$val125 = 0, $$val128 = 0, $$val131 = 0, $$val134 = 0, $$val137 = 0;
 var $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0;
 var $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0;
 var $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0;
 var $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0;
 var $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0;
 var $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0;
 var $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0;
 var $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0;
 var $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0;
 var $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0;
 var $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0;
 var $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0;
 var $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = HEAP8[$1>>0]|0;
 $3 = $2&255;
 $4 = ((($1)) + 1|0);
 $5 = HEAP8[$4>>0]|0;
 $6 = $5&255;
 $7 = (_bitshift64Shl(($6|0),0,8)|0);
 $8 = tempRet0;
 $9 = $7 | $3;
 $10 = ((($1)) + 2|0);
 $11 = HEAP8[$10>>0]|0;
 $12 = $11&255;
 $13 = (_bitshift64Shl(($12|0),0,16)|0);
 $14 = tempRet0;
 $15 = $9 | $13;
 $16 = $8 | $14;
 $17 = ((($1)) + 3|0);
 $18 = HEAP8[$17>>0]|0;
 $19 = $18&255;
 $20 = (_bitshift64Shl(($19|0),0,24)|0);
 $21 = tempRet0;
 $22 = $15 | $20;
 $23 = $16 | $21;
 $24 = ((($1)) + 4|0);
 $$val137 = HEAP8[$24>>0]|0;
 $$idx138 = ((($1)) + 5|0);
 $$idx138$val = HEAP8[$$idx138>>0]|0;
 $$idx139 = ((($1)) + 6|0);
 $$idx139$val = HEAP8[$$idx139>>0]|0;
 $25 = $$val137&255;
 $26 = $$idx138$val&255;
 $27 = (_bitshift64Shl(($26|0),0,8)|0);
 $28 = tempRet0;
 $29 = $27 | $25;
 $30 = $$idx139$val&255;
 $31 = (_bitshift64Shl(($30|0),0,16)|0);
 $32 = tempRet0;
 $33 = $29 | $31;
 $34 = $28 | $32;
 $35 = (_bitshift64Shl(($33|0),($34|0),6)|0);
 $36 = tempRet0;
 $37 = ((($1)) + 7|0);
 $$val134 = HEAP8[$37>>0]|0;
 $$idx135 = ((($1)) + 8|0);
 $$idx135$val = HEAP8[$$idx135>>0]|0;
 $$idx136 = ((($1)) + 9|0);
 $$idx136$val = HEAP8[$$idx136>>0]|0;
 $38 = $$val134&255;
 $39 = $$idx135$val&255;
 $40 = (_bitshift64Shl(($39|0),0,8)|0);
 $41 = tempRet0;
 $42 = $40 | $38;
 $43 = $$idx136$val&255;
 $44 = (_bitshift64Shl(($43|0),0,16)|0);
 $45 = tempRet0;
 $46 = $42 | $44;
 $47 = $41 | $45;
 $48 = (_bitshift64Shl(($46|0),($47|0),5)|0);
 $49 = tempRet0;
 $50 = ((($1)) + 10|0);
 $$val131 = HEAP8[$50>>0]|0;
 $$idx132 = ((($1)) + 11|0);
 $$idx132$val = HEAP8[$$idx132>>0]|0;
 $$idx133 = ((($1)) + 12|0);
 $$idx133$val = HEAP8[$$idx133>>0]|0;
 $51 = $$val131&255;
 $52 = $$idx132$val&255;
 $53 = (_bitshift64Shl(($52|0),0,8)|0);
 $54 = tempRet0;
 $55 = $53 | $51;
 $56 = $$idx133$val&255;
 $57 = (_bitshift64Shl(($56|0),0,16)|0);
 $58 = tempRet0;
 $59 = $55 | $57;
 $60 = $54 | $58;
 $61 = (_bitshift64Shl(($59|0),($60|0),3)|0);
 $62 = tempRet0;
 $63 = ((($1)) + 13|0);
 $$val128 = HEAP8[$63>>0]|0;
 $$idx129 = ((($1)) + 14|0);
 $$idx129$val = HEAP8[$$idx129>>0]|0;
 $$idx130 = ((($1)) + 15|0);
 $$idx130$val = HEAP8[$$idx130>>0]|0;
 $64 = $$val128&255;
 $65 = $$idx129$val&255;
 $66 = (_bitshift64Shl(($65|0),0,8)|0);
 $67 = tempRet0;
 $68 = $66 | $64;
 $69 = $$idx130$val&255;
 $70 = (_bitshift64Shl(($69|0),0,16)|0);
 $71 = tempRet0;
 $72 = $68 | $70;
 $73 = $67 | $71;
 $74 = (_bitshift64Shl(($72|0),($73|0),2)|0);
 $75 = tempRet0;
 $76 = ((($1)) + 16|0);
 $77 = HEAP8[$76>>0]|0;
 $78 = $77&255;
 $79 = ((($1)) + 17|0);
 $80 = HEAP8[$79>>0]|0;
 $81 = $80&255;
 $82 = (_bitshift64Shl(($81|0),0,8)|0);
 $83 = tempRet0;
 $84 = $82 | $78;
 $85 = ((($1)) + 18|0);
 $86 = HEAP8[$85>>0]|0;
 $87 = $86&255;
 $88 = (_bitshift64Shl(($87|0),0,16)|0);
 $89 = tempRet0;
 $90 = $84 | $88;
 $91 = $83 | $89;
 $92 = ((($1)) + 19|0);
 $93 = HEAP8[$92>>0]|0;
 $94 = $93&255;
 $95 = (_bitshift64Shl(($94|0),0,24)|0);
 $96 = tempRet0;
 $97 = $90 | $95;
 $98 = $91 | $96;
 $99 = ((($1)) + 20|0);
 $$val125 = HEAP8[$99>>0]|0;
 $$idx126 = ((($1)) + 21|0);
 $$idx126$val = HEAP8[$$idx126>>0]|0;
 $$idx127 = ((($1)) + 22|0);
 $$idx127$val = HEAP8[$$idx127>>0]|0;
 $100 = $$val125&255;
 $101 = $$idx126$val&255;
 $102 = (_bitshift64Shl(($101|0),0,8)|0);
 $103 = tempRet0;
 $104 = $102 | $100;
 $105 = $$idx127$val&255;
 $106 = (_bitshift64Shl(($105|0),0,16)|0);
 $107 = tempRet0;
 $108 = $104 | $106;
 $109 = $103 | $107;
 $110 = (_bitshift64Shl(($108|0),($109|0),7)|0);
 $111 = tempRet0;
 $112 = ((($1)) + 23|0);
 $$val122 = HEAP8[$112>>0]|0;
 $$idx123 = ((($1)) + 24|0);
 $$idx123$val = HEAP8[$$idx123>>0]|0;
 $$idx124 = ((($1)) + 25|0);
 $$idx124$val = HEAP8[$$idx124>>0]|0;
 $113 = $$val122&255;
 $114 = $$idx123$val&255;
 $115 = (_bitshift64Shl(($114|0),0,8)|0);
 $116 = tempRet0;
 $117 = $115 | $113;
 $118 = $$idx124$val&255;
 $119 = (_bitshift64Shl(($118|0),0,16)|0);
 $120 = tempRet0;
 $121 = $117 | $119;
 $122 = $116 | $120;
 $123 = (_bitshift64Shl(($121|0),($122|0),5)|0);
 $124 = tempRet0;
 $125 = ((($1)) + 26|0);
 $$val119 = HEAP8[$125>>0]|0;
 $$idx120 = ((($1)) + 27|0);
 $$idx120$val = HEAP8[$$idx120>>0]|0;
 $$idx121 = ((($1)) + 28|0);
 $$idx121$val = HEAP8[$$idx121>>0]|0;
 $126 = $$val119&255;
 $127 = $$idx120$val&255;
 $128 = (_bitshift64Shl(($127|0),0,8)|0);
 $129 = tempRet0;
 $130 = $128 | $126;
 $131 = $$idx121$val&255;
 $132 = (_bitshift64Shl(($131|0),0,16)|0);
 $133 = tempRet0;
 $134 = $130 | $132;
 $135 = $129 | $133;
 $136 = (_bitshift64Shl(($134|0),($135|0),4)|0);
 $137 = tempRet0;
 $138 = ((($1)) + 29|0);
 $$val = HEAP8[$138>>0]|0;
 $$idx = ((($1)) + 30|0);
 $$idx$val = HEAP8[$$idx>>0]|0;
 $$idx118 = ((($1)) + 31|0);
 $$idx118$val = HEAP8[$$idx118>>0]|0;
 $139 = $$val&255;
 $140 = $$idx$val&255;
 $141 = (_bitshift64Shl(($140|0),0,8)|0);
 $142 = tempRet0;
 $143 = $141 | $139;
 $144 = $$idx118$val&255;
 $145 = (_bitshift64Shl(($144|0),0,16)|0);
 $146 = tempRet0;
 $147 = $143 | $145;
 $148 = $142 | $146;
 $149 = (_bitshift64Shl(($147|0),($148|0),2)|0);
 $150 = tempRet0;
 $151 = $149 & 33554428;
 $152 = (_i64Add(($151|0),0,16777216,0)|0);
 $153 = tempRet0;
 $154 = (_bitshift64Lshr(($152|0),($153|0),25)|0);
 $155 = tempRet0;
 $156 = (_i64Subtract(0,0,($154|0),($155|0))|0);
 $157 = tempRet0;
 $158 = $156 & 19;
 $159 = (_i64Add(($158|0),0,($22|0),($23|0))|0);
 $160 = tempRet0;
 $161 = $152 & 33554432;
 $162 = (_i64Add(($35|0),($36|0),16777216,0)|0);
 $163 = tempRet0;
 $164 = (_bitshift64Lshr(($162|0),($163|0),25)|0);
 $165 = tempRet0;
 $166 = (_i64Add(($48|0),($49|0),($164|0),($165|0))|0);
 $167 = tempRet0;
 $168 = $162 & -33554432;
 $169 = (_i64Subtract(($35|0),($36|0),($168|0),0)|0);
 $170 = tempRet0;
 $171 = (_i64Add(($61|0),($62|0),16777216,0)|0);
 $172 = tempRet0;
 $173 = (_bitshift64Lshr(($171|0),($172|0),25)|0);
 $174 = tempRet0;
 $175 = (_i64Add(($74|0),($75|0),($173|0),($174|0))|0);
 $176 = tempRet0;
 $177 = $171 & -33554432;
 $178 = (_i64Add(($97|0),($98|0),16777216,0)|0);
 $179 = tempRet0;
 $180 = (_bitshift64Lshr(($178|0),($179|0),25)|0);
 $181 = tempRet0;
 $182 = (_i64Add(($110|0),($111|0),($180|0),($181|0))|0);
 $183 = tempRet0;
 $184 = $178 & -33554432;
 $185 = (_i64Add(($123|0),($124|0),16777216,0)|0);
 $186 = tempRet0;
 $187 = (_bitshift64Lshr(($185|0),($186|0),25)|0);
 $188 = tempRet0;
 $189 = (_i64Add(($136|0),($137|0),($187|0),($188|0))|0);
 $190 = tempRet0;
 $191 = $185 & -33554432;
 $192 = (_i64Add(($159|0),($160|0),33554432,0)|0);
 $193 = tempRet0;
 $194 = (_bitshift64Lshr(($192|0),($193|0),26)|0);
 $195 = tempRet0;
 $196 = (_i64Add(($169|0),($170|0),($194|0),($195|0))|0);
 $197 = tempRet0;
 $198 = $192 & -67108864;
 $199 = (_i64Subtract(($159|0),($160|0),($198|0),0)|0);
 $200 = tempRet0;
 $201 = (_i64Add(($166|0),($167|0),33554432,0)|0);
 $202 = tempRet0;
 $203 = (_bitshift64Lshr(($201|0),($202|0),26)|0);
 $204 = tempRet0;
 $205 = (_i64Add(($203|0),($204|0),($61|0),($62|0))|0);
 $206 = tempRet0;
 $207 = (_i64Subtract(($205|0),($206|0),($177|0),0)|0);
 $208 = tempRet0;
 $209 = $201 & -67108864;
 $210 = (_i64Subtract(($166|0),($167|0),($209|0),0)|0);
 $211 = tempRet0;
 $212 = (_i64Add(($175|0),($176|0),33554432,0)|0);
 $213 = tempRet0;
 $214 = (_bitshift64Lshr(($212|0),($213|0),26)|0);
 $215 = tempRet0;
 $216 = (_i64Add(($214|0),($215|0),($97|0),($98|0))|0);
 $217 = tempRet0;
 $218 = (_i64Subtract(($216|0),($217|0),($184|0),0)|0);
 $219 = tempRet0;
 $220 = $212 & -67108864;
 $221 = (_i64Subtract(($175|0),($176|0),($220|0),0)|0);
 $222 = tempRet0;
 $223 = (_i64Add(($182|0),($183|0),33554432,0)|0);
 $224 = tempRet0;
 $225 = (_bitshift64Lshr(($223|0),($224|0),26)|0);
 $226 = tempRet0;
 $227 = (_i64Add(($225|0),($226|0),($123|0),($124|0))|0);
 $228 = tempRet0;
 $229 = (_i64Subtract(($227|0),($228|0),($191|0),0)|0);
 $230 = tempRet0;
 $231 = $223 & -67108864;
 $232 = (_i64Subtract(($182|0),($183|0),($231|0),0)|0);
 $233 = tempRet0;
 $234 = (_i64Add(($189|0),($190|0),33554432,0)|0);
 $235 = tempRet0;
 $236 = (_bitshift64Lshr(($234|0),($235|0),26)|0);
 $237 = tempRet0;
 $238 = (_i64Add(($151|0),0,($236|0),($237|0))|0);
 $239 = tempRet0;
 $240 = (_i64Subtract(($238|0),($239|0),($161|0),0)|0);
 $241 = tempRet0;
 $242 = $234 & -67108864;
 $243 = (_i64Subtract(($189|0),($190|0),($242|0),0)|0);
 $244 = tempRet0;
 HEAP32[$0>>2] = $199;
 $245 = ((($0)) + 4|0);
 HEAP32[$245>>2] = $196;
 $246 = ((($0)) + 8|0);
 HEAP32[$246>>2] = $210;
 $247 = ((($0)) + 12|0);
 HEAP32[$247>>2] = $207;
 $248 = ((($0)) + 16|0);
 HEAP32[$248>>2] = $221;
 $249 = ((($0)) + 20|0);
 HEAP32[$249>>2] = $218;
 $250 = ((($0)) + 24|0);
 HEAP32[$250>>2] = $232;
 $251 = ((($0)) + 28|0);
 HEAP32[$251>>2] = $229;
 $252 = ((($0)) + 32|0);
 HEAP32[$252>>2] = $243;
 $253 = ((($0)) + 36|0);
 HEAP32[$253>>2] = $240;
 return;
}
function _crypto_sign_ed25519_ref10_fe_invert($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$827 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $exitcond = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 160|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(160|0);
 $2 = sp + 120|0;
 $3 = sp + 80|0;
 $4 = sp + 40|0;
 $5 = sp;
 _crypto_sign_ed25519_ref10_fe_sq($2,$1);
 _crypto_sign_ed25519_ref10_fe_sq($3,$2);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_mul($3,$1,$3);
 _crypto_sign_ed25519_ref10_fe_mul($2,$2,$3);
 _crypto_sign_ed25519_ref10_fe_sq($4,$2);
 _crypto_sign_ed25519_ref10_fe_mul($3,$3,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$3);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_mul($3,$4,$3);
 _crypto_sign_ed25519_ref10_fe_sq($4,$3);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_mul($4,$4,$3);
 _crypto_sign_ed25519_ref10_fe_sq($5,$4);
 _crypto_sign_ed25519_ref10_fe_sq($5,$5);
 _crypto_sign_ed25519_ref10_fe_sq($5,$5);
 _crypto_sign_ed25519_ref10_fe_sq($5,$5);
 _crypto_sign_ed25519_ref10_fe_sq($5,$5);
 _crypto_sign_ed25519_ref10_fe_sq($5,$5);
 _crypto_sign_ed25519_ref10_fe_sq($5,$5);
 _crypto_sign_ed25519_ref10_fe_sq($5,$5);
 _crypto_sign_ed25519_ref10_fe_sq($5,$5);
 _crypto_sign_ed25519_ref10_fe_sq($5,$5);
 _crypto_sign_ed25519_ref10_fe_sq($5,$5);
 _crypto_sign_ed25519_ref10_fe_sq($5,$5);
 _crypto_sign_ed25519_ref10_fe_sq($5,$5);
 _crypto_sign_ed25519_ref10_fe_sq($5,$5);
 _crypto_sign_ed25519_ref10_fe_sq($5,$5);
 _crypto_sign_ed25519_ref10_fe_sq($5,$5);
 _crypto_sign_ed25519_ref10_fe_sq($5,$5);
 _crypto_sign_ed25519_ref10_fe_sq($5,$5);
 _crypto_sign_ed25519_ref10_fe_sq($5,$5);
 _crypto_sign_ed25519_ref10_fe_sq($5,$5);
 _crypto_sign_ed25519_ref10_fe_mul($4,$5,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_mul($3,$4,$3);
 _crypto_sign_ed25519_ref10_fe_sq($4,$3);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_mul($4,$4,$3);
 _crypto_sign_ed25519_ref10_fe_sq($5,$4);
 $$827 = 1;
 while(1) {
  _crypto_sign_ed25519_ref10_fe_sq($5,$5);
  $6 = (($$827) + 1)|0;
  $exitcond = ($6|0)==(100);
  if ($exitcond) {
   break;
  } else {
   $$827 = $6;
  }
 }
 _crypto_sign_ed25519_ref10_fe_mul($4,$5,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_mul($3,$4,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_mul($0,$3,$2);
 STACKTOP = sp;return;
}
function _crypto_sign_ed25519_ref10_fe_isnegative($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(32|0);
 $1 = sp;
 _crypto_sign_ed25519_ref10_fe_tobytes($1,$0);
 $2 = HEAP8[$1>>0]|0;
 $3 = $2 & 1;
 $4 = $3&255;
 STACKTOP = sp;return ($4|0);
}
function _crypto_sign_ed25519_ref10_fe_isnonzero($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $100 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0;
 var $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0;
 var $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(32|0);
 $1 = sp;
 _crypto_sign_ed25519_ref10_fe_tobytes($1,$0);
 $2 = HEAP8[$1>>0]|0;
 $3 = ((($1)) + 1|0);
 $4 = HEAP8[$3>>0]|0;
 $5 = $4 | $2;
 $6 = ((($1)) + 2|0);
 $7 = HEAP8[$6>>0]|0;
 $8 = $5 | $7;
 $9 = ((($1)) + 3|0);
 $10 = HEAP8[$9>>0]|0;
 $11 = $8 | $10;
 $12 = ((($1)) + 4|0);
 $13 = HEAP8[$12>>0]|0;
 $14 = $11 | $13;
 $15 = ((($1)) + 5|0);
 $16 = HEAP8[$15>>0]|0;
 $17 = $14 | $16;
 $18 = ((($1)) + 6|0);
 $19 = HEAP8[$18>>0]|0;
 $20 = $17 | $19;
 $21 = ((($1)) + 7|0);
 $22 = HEAP8[$21>>0]|0;
 $23 = $20 | $22;
 $24 = ((($1)) + 8|0);
 $25 = HEAP8[$24>>0]|0;
 $26 = $23 | $25;
 $27 = ((($1)) + 9|0);
 $28 = HEAP8[$27>>0]|0;
 $29 = $26 | $28;
 $30 = ((($1)) + 10|0);
 $31 = HEAP8[$30>>0]|0;
 $32 = $29 | $31;
 $33 = ((($1)) + 11|0);
 $34 = HEAP8[$33>>0]|0;
 $35 = $32 | $34;
 $36 = ((($1)) + 12|0);
 $37 = HEAP8[$36>>0]|0;
 $38 = $35 | $37;
 $39 = ((($1)) + 13|0);
 $40 = HEAP8[$39>>0]|0;
 $41 = $38 | $40;
 $42 = ((($1)) + 14|0);
 $43 = HEAP8[$42>>0]|0;
 $44 = $41 | $43;
 $45 = ((($1)) + 15|0);
 $46 = HEAP8[$45>>0]|0;
 $47 = $44 | $46;
 $48 = ((($1)) + 16|0);
 $49 = HEAP8[$48>>0]|0;
 $50 = $47 | $49;
 $51 = ((($1)) + 17|0);
 $52 = HEAP8[$51>>0]|0;
 $53 = $50 | $52;
 $54 = ((($1)) + 18|0);
 $55 = HEAP8[$54>>0]|0;
 $56 = $53 | $55;
 $57 = ((($1)) + 19|0);
 $58 = HEAP8[$57>>0]|0;
 $59 = $56 | $58;
 $60 = ((($1)) + 20|0);
 $61 = HEAP8[$60>>0]|0;
 $62 = $59 | $61;
 $63 = ((($1)) + 21|0);
 $64 = HEAP8[$63>>0]|0;
 $65 = $62 | $64;
 $66 = ((($1)) + 22|0);
 $67 = HEAP8[$66>>0]|0;
 $68 = $65 | $67;
 $69 = ((($1)) + 23|0);
 $70 = HEAP8[$69>>0]|0;
 $71 = $68 | $70;
 $72 = ((($1)) + 24|0);
 $73 = HEAP8[$72>>0]|0;
 $74 = $71 | $73;
 $75 = ((($1)) + 25|0);
 $76 = HEAP8[$75>>0]|0;
 $77 = $74 | $76;
 $78 = ((($1)) + 26|0);
 $79 = HEAP8[$78>>0]|0;
 $80 = $77 | $79;
 $81 = ((($1)) + 27|0);
 $82 = HEAP8[$81>>0]|0;
 $83 = $80 | $82;
 $84 = ((($1)) + 28|0);
 $85 = HEAP8[$84>>0]|0;
 $86 = $83 | $85;
 $87 = ((($1)) + 29|0);
 $88 = HEAP8[$87>>0]|0;
 $89 = $86 | $88;
 $90 = ((($1)) + 30|0);
 $91 = HEAP8[$90>>0]|0;
 $92 = $89 | $91;
 $93 = ((($1)) + 31|0);
 $94 = HEAP8[$93>>0]|0;
 $95 = $92 | $94;
 $96 = $95&255;
 $97 = (($96) + 511)|0;
 $98 = $97 >>> 8;
 $99 = $98 & 1;
 $100 = (($99) + -1)|0;
 STACKTOP = sp;return ($100|0);
}
function _crypto_sign_ed25519_ref10_fe_mul($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0;
 var $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0;
 var $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0;
 var $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0;
 var $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0;
 var $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0;
 var $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0;
 var $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0;
 var $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0;
 var $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0, $280 = 0;
 var $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0, $299 = 0;
 var $3 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0, $312 = 0, $313 = 0, $314 = 0, $315 = 0, $316 = 0;
 var $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0, $321 = 0, $322 = 0, $323 = 0, $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0, $329 = 0, $33 = 0, $330 = 0, $331 = 0, $332 = 0, $333 = 0, $334 = 0;
 var $335 = 0, $336 = 0, $337 = 0, $338 = 0, $339 = 0, $34 = 0, $340 = 0, $341 = 0, $342 = 0, $343 = 0, $344 = 0, $345 = 0, $346 = 0, $347 = 0, $348 = 0, $349 = 0, $35 = 0, $350 = 0, $351 = 0, $352 = 0;
 var $353 = 0, $354 = 0, $355 = 0, $356 = 0, $357 = 0, $358 = 0, $359 = 0, $36 = 0, $360 = 0, $361 = 0, $362 = 0, $363 = 0, $364 = 0, $365 = 0, $366 = 0, $367 = 0, $368 = 0, $369 = 0, $37 = 0, $370 = 0;
 var $371 = 0, $372 = 0, $373 = 0, $374 = 0, $375 = 0, $376 = 0, $377 = 0, $378 = 0, $379 = 0, $38 = 0, $380 = 0, $381 = 0, $382 = 0, $383 = 0, $384 = 0, $385 = 0, $386 = 0, $387 = 0, $388 = 0, $389 = 0;
 var $39 = 0, $390 = 0, $391 = 0, $392 = 0, $393 = 0, $394 = 0, $395 = 0, $396 = 0, $397 = 0, $398 = 0, $399 = 0, $4 = 0, $40 = 0, $400 = 0, $401 = 0, $402 = 0, $403 = 0, $404 = 0, $405 = 0, $406 = 0;
 var $407 = 0, $408 = 0, $409 = 0, $41 = 0, $410 = 0, $411 = 0, $412 = 0, $413 = 0, $414 = 0, $415 = 0, $416 = 0, $417 = 0, $418 = 0, $419 = 0, $42 = 0, $420 = 0, $421 = 0, $422 = 0, $423 = 0, $424 = 0;
 var $425 = 0, $426 = 0, $427 = 0, $428 = 0, $429 = 0, $43 = 0, $430 = 0, $431 = 0, $432 = 0, $433 = 0, $434 = 0, $435 = 0, $436 = 0, $437 = 0, $438 = 0, $439 = 0, $44 = 0, $440 = 0, $441 = 0, $442 = 0;
 var $443 = 0, $444 = 0, $445 = 0, $446 = 0, $447 = 0, $448 = 0, $449 = 0, $45 = 0, $450 = 0, $451 = 0, $452 = 0, $453 = 0, $454 = 0, $455 = 0, $456 = 0, $457 = 0, $458 = 0, $459 = 0, $46 = 0, $460 = 0;
 var $461 = 0, $462 = 0, $463 = 0, $464 = 0, $465 = 0, $466 = 0, $467 = 0, $468 = 0, $469 = 0, $47 = 0, $470 = 0, $471 = 0, $472 = 0, $473 = 0, $474 = 0, $475 = 0, $476 = 0, $477 = 0, $478 = 0, $479 = 0;
 var $48 = 0, $480 = 0, $481 = 0, $482 = 0, $483 = 0, $484 = 0, $485 = 0, $486 = 0, $487 = 0, $488 = 0, $489 = 0, $49 = 0, $490 = 0, $491 = 0, $492 = 0, $493 = 0, $494 = 0, $495 = 0, $496 = 0, $497 = 0;
 var $498 = 0, $499 = 0, $5 = 0, $50 = 0, $500 = 0, $501 = 0, $502 = 0, $503 = 0, $504 = 0, $505 = 0, $506 = 0, $507 = 0, $508 = 0, $509 = 0, $51 = 0, $510 = 0, $511 = 0, $512 = 0, $513 = 0, $514 = 0;
 var $515 = 0, $516 = 0, $517 = 0, $518 = 0, $519 = 0, $52 = 0, $520 = 0, $521 = 0, $522 = 0, $523 = 0, $524 = 0, $525 = 0, $526 = 0, $527 = 0, $528 = 0, $529 = 0, $53 = 0, $530 = 0, $531 = 0, $532 = 0;
 var $533 = 0, $534 = 0, $535 = 0, $536 = 0, $537 = 0, $538 = 0, $539 = 0, $54 = 0, $540 = 0, $541 = 0, $542 = 0, $543 = 0, $544 = 0, $545 = 0, $546 = 0, $547 = 0, $548 = 0, $549 = 0, $55 = 0, $550 = 0;
 var $551 = 0, $552 = 0, $553 = 0, $554 = 0, $555 = 0, $556 = 0, $557 = 0, $558 = 0, $559 = 0, $56 = 0, $560 = 0, $561 = 0, $562 = 0, $563 = 0, $564 = 0, $565 = 0, $566 = 0, $567 = 0, $568 = 0, $569 = 0;
 var $57 = 0, $570 = 0, $571 = 0, $572 = 0, $573 = 0, $574 = 0, $575 = 0, $576 = 0, $577 = 0, $578 = 0, $579 = 0, $58 = 0, $580 = 0, $581 = 0, $582 = 0, $583 = 0, $584 = 0, $585 = 0, $586 = 0, $587 = 0;
 var $588 = 0, $589 = 0, $59 = 0, $590 = 0, $591 = 0, $592 = 0, $593 = 0, $594 = 0, $595 = 0, $596 = 0, $597 = 0, $598 = 0, $599 = 0, $6 = 0, $60 = 0, $600 = 0, $601 = 0, $602 = 0, $603 = 0, $604 = 0;
 var $605 = 0, $606 = 0, $607 = 0, $608 = 0, $609 = 0, $61 = 0, $610 = 0, $611 = 0, $612 = 0, $613 = 0, $614 = 0, $615 = 0, $616 = 0, $617 = 0, $618 = 0, $619 = 0, $62 = 0, $620 = 0, $621 = 0, $63 = 0;
 var $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0;
 var $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 $3 = HEAP32[$1>>2]|0;
 $4 = ((($1)) + 4|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = ((($1)) + 8|0);
 $7 = HEAP32[$6>>2]|0;
 $8 = ((($1)) + 12|0);
 $9 = HEAP32[$8>>2]|0;
 $10 = ((($1)) + 16|0);
 $11 = HEAP32[$10>>2]|0;
 $12 = ((($1)) + 20|0);
 $13 = HEAP32[$12>>2]|0;
 $14 = ((($1)) + 24|0);
 $15 = HEAP32[$14>>2]|0;
 $16 = ((($1)) + 28|0);
 $17 = HEAP32[$16>>2]|0;
 $18 = ((($1)) + 32|0);
 $19 = HEAP32[$18>>2]|0;
 $20 = ((($1)) + 36|0);
 $21 = HEAP32[$20>>2]|0;
 $22 = HEAP32[$2>>2]|0;
 $23 = ((($2)) + 4|0);
 $24 = HEAP32[$23>>2]|0;
 $25 = ((($2)) + 8|0);
 $26 = HEAP32[$25>>2]|0;
 $27 = ((($2)) + 12|0);
 $28 = HEAP32[$27>>2]|0;
 $29 = ((($2)) + 16|0);
 $30 = HEAP32[$29>>2]|0;
 $31 = ((($2)) + 20|0);
 $32 = HEAP32[$31>>2]|0;
 $33 = ((($2)) + 24|0);
 $34 = HEAP32[$33>>2]|0;
 $35 = ((($2)) + 28|0);
 $36 = HEAP32[$35>>2]|0;
 $37 = ((($2)) + 32|0);
 $38 = HEAP32[$37>>2]|0;
 $39 = ((($2)) + 36|0);
 $40 = HEAP32[$39>>2]|0;
 $41 = ($24*19)|0;
 $42 = ($26*19)|0;
 $43 = ($28*19)|0;
 $44 = ($30*19)|0;
 $45 = ($32*19)|0;
 $46 = ($34*19)|0;
 $47 = ($36*19)|0;
 $48 = ($38*19)|0;
 $49 = ($40*19)|0;
 $50 = $5 << 1;
 $51 = $9 << 1;
 $52 = $13 << 1;
 $53 = $17 << 1;
 $54 = $21 << 1;
 $55 = ($3|0)<(0);
 $56 = $55 << 31 >> 31;
 $57 = ($22|0)<(0);
 $58 = $57 << 31 >> 31;
 $59 = (___muldi3(($22|0),($58|0),($3|0),($56|0))|0);
 $60 = tempRet0;
 $61 = ($24|0)<(0);
 $62 = $61 << 31 >> 31;
 $63 = (___muldi3(($24|0),($62|0),($3|0),($56|0))|0);
 $64 = tempRet0;
 $65 = ($26|0)<(0);
 $66 = $65 << 31 >> 31;
 $67 = (___muldi3(($26|0),($66|0),($3|0),($56|0))|0);
 $68 = tempRet0;
 $69 = ($28|0)<(0);
 $70 = $69 << 31 >> 31;
 $71 = (___muldi3(($28|0),($70|0),($3|0),($56|0))|0);
 $72 = tempRet0;
 $73 = ($30|0)<(0);
 $74 = $73 << 31 >> 31;
 $75 = (___muldi3(($30|0),($74|0),($3|0),($56|0))|0);
 $76 = tempRet0;
 $77 = ($32|0)<(0);
 $78 = $77 << 31 >> 31;
 $79 = (___muldi3(($32|0),($78|0),($3|0),($56|0))|0);
 $80 = tempRet0;
 $81 = ($34|0)<(0);
 $82 = $81 << 31 >> 31;
 $83 = (___muldi3(($34|0),($82|0),($3|0),($56|0))|0);
 $84 = tempRet0;
 $85 = ($36|0)<(0);
 $86 = $85 << 31 >> 31;
 $87 = (___muldi3(($36|0),($86|0),($3|0),($56|0))|0);
 $88 = tempRet0;
 $89 = ($38|0)<(0);
 $90 = $89 << 31 >> 31;
 $91 = (___muldi3(($38|0),($90|0),($3|0),($56|0))|0);
 $92 = tempRet0;
 $93 = ($40|0)<(0);
 $94 = $93 << 31 >> 31;
 $95 = (___muldi3(($40|0),($94|0),($3|0),($56|0))|0);
 $96 = tempRet0;
 $97 = ($5|0)<(0);
 $98 = $97 << 31 >> 31;
 $99 = (___muldi3(($22|0),($58|0),($5|0),($98|0))|0);
 $100 = tempRet0;
 $101 = ($50|0)<(0);
 $102 = $101 << 31 >> 31;
 $103 = (___muldi3(($24|0),($62|0),($50|0),($102|0))|0);
 $104 = tempRet0;
 $105 = (___muldi3(($26|0),($66|0),($5|0),($98|0))|0);
 $106 = tempRet0;
 $107 = (___muldi3(($28|0),($70|0),($50|0),($102|0))|0);
 $108 = tempRet0;
 $109 = (___muldi3(($30|0),($74|0),($5|0),($98|0))|0);
 $110 = tempRet0;
 $111 = (___muldi3(($32|0),($78|0),($50|0),($102|0))|0);
 $112 = tempRet0;
 $113 = (___muldi3(($34|0),($82|0),($5|0),($98|0))|0);
 $114 = tempRet0;
 $115 = (___muldi3(($36|0),($86|0),($50|0),($102|0))|0);
 $116 = tempRet0;
 $117 = (___muldi3(($38|0),($90|0),($5|0),($98|0))|0);
 $118 = tempRet0;
 $119 = ($49|0)<(0);
 $120 = $119 << 31 >> 31;
 $121 = (___muldi3(($49|0),($120|0),($50|0),($102|0))|0);
 $122 = tempRet0;
 $123 = ($7|0)<(0);
 $124 = $123 << 31 >> 31;
 $125 = (___muldi3(($22|0),($58|0),($7|0),($124|0))|0);
 $126 = tempRet0;
 $127 = (___muldi3(($24|0),($62|0),($7|0),($124|0))|0);
 $128 = tempRet0;
 $129 = (___muldi3(($26|0),($66|0),($7|0),($124|0))|0);
 $130 = tempRet0;
 $131 = (___muldi3(($28|0),($70|0),($7|0),($124|0))|0);
 $132 = tempRet0;
 $133 = (___muldi3(($30|0),($74|0),($7|0),($124|0))|0);
 $134 = tempRet0;
 $135 = (___muldi3(($32|0),($78|0),($7|0),($124|0))|0);
 $136 = tempRet0;
 $137 = (___muldi3(($34|0),($82|0),($7|0),($124|0))|0);
 $138 = tempRet0;
 $139 = (___muldi3(($36|0),($86|0),($7|0),($124|0))|0);
 $140 = tempRet0;
 $141 = ($48|0)<(0);
 $142 = $141 << 31 >> 31;
 $143 = (___muldi3(($48|0),($142|0),($7|0),($124|0))|0);
 $144 = tempRet0;
 $145 = (___muldi3(($49|0),($120|0),($7|0),($124|0))|0);
 $146 = tempRet0;
 $147 = ($9|0)<(0);
 $148 = $147 << 31 >> 31;
 $149 = (___muldi3(($22|0),($58|0),($9|0),($148|0))|0);
 $150 = tempRet0;
 $151 = ($51|0)<(0);
 $152 = $151 << 31 >> 31;
 $153 = (___muldi3(($24|0),($62|0),($51|0),($152|0))|0);
 $154 = tempRet0;
 $155 = (___muldi3(($26|0),($66|0),($9|0),($148|0))|0);
 $156 = tempRet0;
 $157 = (___muldi3(($28|0),($70|0),($51|0),($152|0))|0);
 $158 = tempRet0;
 $159 = (___muldi3(($30|0),($74|0),($9|0),($148|0))|0);
 $160 = tempRet0;
 $161 = (___muldi3(($32|0),($78|0),($51|0),($152|0))|0);
 $162 = tempRet0;
 $163 = (___muldi3(($34|0),($82|0),($9|0),($148|0))|0);
 $164 = tempRet0;
 $165 = ($47|0)<(0);
 $166 = $165 << 31 >> 31;
 $167 = (___muldi3(($47|0),($166|0),($51|0),($152|0))|0);
 $168 = tempRet0;
 $169 = (___muldi3(($48|0),($142|0),($9|0),($148|0))|0);
 $170 = tempRet0;
 $171 = (___muldi3(($49|0),($120|0),($51|0),($152|0))|0);
 $172 = tempRet0;
 $173 = ($11|0)<(0);
 $174 = $173 << 31 >> 31;
 $175 = (___muldi3(($22|0),($58|0),($11|0),($174|0))|0);
 $176 = tempRet0;
 $177 = (___muldi3(($24|0),($62|0),($11|0),($174|0))|0);
 $178 = tempRet0;
 $179 = (___muldi3(($26|0),($66|0),($11|0),($174|0))|0);
 $180 = tempRet0;
 $181 = (___muldi3(($28|0),($70|0),($11|0),($174|0))|0);
 $182 = tempRet0;
 $183 = (___muldi3(($30|0),($74|0),($11|0),($174|0))|0);
 $184 = tempRet0;
 $185 = (___muldi3(($32|0),($78|0),($11|0),($174|0))|0);
 $186 = tempRet0;
 $187 = ($46|0)<(0);
 $188 = $187 << 31 >> 31;
 $189 = (___muldi3(($46|0),($188|0),($11|0),($174|0))|0);
 $190 = tempRet0;
 $191 = (___muldi3(($47|0),($166|0),($11|0),($174|0))|0);
 $192 = tempRet0;
 $193 = (___muldi3(($48|0),($142|0),($11|0),($174|0))|0);
 $194 = tempRet0;
 $195 = (___muldi3(($49|0),($120|0),($11|0),($174|0))|0);
 $196 = tempRet0;
 $197 = ($13|0)<(0);
 $198 = $197 << 31 >> 31;
 $199 = (___muldi3(($22|0),($58|0),($13|0),($198|0))|0);
 $200 = tempRet0;
 $201 = ($52|0)<(0);
 $202 = $201 << 31 >> 31;
 $203 = (___muldi3(($24|0),($62|0),($52|0),($202|0))|0);
 $204 = tempRet0;
 $205 = (___muldi3(($26|0),($66|0),($13|0),($198|0))|0);
 $206 = tempRet0;
 $207 = (___muldi3(($28|0),($70|0),($52|0),($202|0))|0);
 $208 = tempRet0;
 $209 = (___muldi3(($30|0),($74|0),($13|0),($198|0))|0);
 $210 = tempRet0;
 $211 = ($45|0)<(0);
 $212 = $211 << 31 >> 31;
 $213 = (___muldi3(($45|0),($212|0),($52|0),($202|0))|0);
 $214 = tempRet0;
 $215 = (___muldi3(($46|0),($188|0),($13|0),($198|0))|0);
 $216 = tempRet0;
 $217 = (___muldi3(($47|0),($166|0),($52|0),($202|0))|0);
 $218 = tempRet0;
 $219 = (___muldi3(($48|0),($142|0),($13|0),($198|0))|0);
 $220 = tempRet0;
 $221 = (___muldi3(($49|0),($120|0),($52|0),($202|0))|0);
 $222 = tempRet0;
 $223 = ($15|0)<(0);
 $224 = $223 << 31 >> 31;
 $225 = (___muldi3(($22|0),($58|0),($15|0),($224|0))|0);
 $226 = tempRet0;
 $227 = (___muldi3(($24|0),($62|0),($15|0),($224|0))|0);
 $228 = tempRet0;
 $229 = (___muldi3(($26|0),($66|0),($15|0),($224|0))|0);
 $230 = tempRet0;
 $231 = (___muldi3(($28|0),($70|0),($15|0),($224|0))|0);
 $232 = tempRet0;
 $233 = ($44|0)<(0);
 $234 = $233 << 31 >> 31;
 $235 = (___muldi3(($44|0),($234|0),($15|0),($224|0))|0);
 $236 = tempRet0;
 $237 = (___muldi3(($45|0),($212|0),($15|0),($224|0))|0);
 $238 = tempRet0;
 $239 = (___muldi3(($46|0),($188|0),($15|0),($224|0))|0);
 $240 = tempRet0;
 $241 = (___muldi3(($47|0),($166|0),($15|0),($224|0))|0);
 $242 = tempRet0;
 $243 = (___muldi3(($48|0),($142|0),($15|0),($224|0))|0);
 $244 = tempRet0;
 $245 = (___muldi3(($49|0),($120|0),($15|0),($224|0))|0);
 $246 = tempRet0;
 $247 = ($17|0)<(0);
 $248 = $247 << 31 >> 31;
 $249 = (___muldi3(($22|0),($58|0),($17|0),($248|0))|0);
 $250 = tempRet0;
 $251 = ($53|0)<(0);
 $252 = $251 << 31 >> 31;
 $253 = (___muldi3(($24|0),($62|0),($53|0),($252|0))|0);
 $254 = tempRet0;
 $255 = (___muldi3(($26|0),($66|0),($17|0),($248|0))|0);
 $256 = tempRet0;
 $257 = ($43|0)<(0);
 $258 = $257 << 31 >> 31;
 $259 = (___muldi3(($43|0),($258|0),($53|0),($252|0))|0);
 $260 = tempRet0;
 $261 = (___muldi3(($44|0),($234|0),($17|0),($248|0))|0);
 $262 = tempRet0;
 $263 = (___muldi3(($45|0),($212|0),($53|0),($252|0))|0);
 $264 = tempRet0;
 $265 = (___muldi3(($46|0),($188|0),($17|0),($248|0))|0);
 $266 = tempRet0;
 $267 = (___muldi3(($47|0),($166|0),($53|0),($252|0))|0);
 $268 = tempRet0;
 $269 = (___muldi3(($48|0),($142|0),($17|0),($248|0))|0);
 $270 = tempRet0;
 $271 = (___muldi3(($49|0),($120|0),($53|0),($252|0))|0);
 $272 = tempRet0;
 $273 = ($19|0)<(0);
 $274 = $273 << 31 >> 31;
 $275 = (___muldi3(($22|0),($58|0),($19|0),($274|0))|0);
 $276 = tempRet0;
 $277 = (___muldi3(($24|0),($62|0),($19|0),($274|0))|0);
 $278 = tempRet0;
 $279 = ($42|0)<(0);
 $280 = $279 << 31 >> 31;
 $281 = (___muldi3(($42|0),($280|0),($19|0),($274|0))|0);
 $282 = tempRet0;
 $283 = (___muldi3(($43|0),($258|0),($19|0),($274|0))|0);
 $284 = tempRet0;
 $285 = (___muldi3(($44|0),($234|0),($19|0),($274|0))|0);
 $286 = tempRet0;
 $287 = (___muldi3(($45|0),($212|0),($19|0),($274|0))|0);
 $288 = tempRet0;
 $289 = (___muldi3(($46|0),($188|0),($19|0),($274|0))|0);
 $290 = tempRet0;
 $291 = (___muldi3(($47|0),($166|0),($19|0),($274|0))|0);
 $292 = tempRet0;
 $293 = (___muldi3(($48|0),($142|0),($19|0),($274|0))|0);
 $294 = tempRet0;
 $295 = (___muldi3(($49|0),($120|0),($19|0),($274|0))|0);
 $296 = tempRet0;
 $297 = ($21|0)<(0);
 $298 = $297 << 31 >> 31;
 $299 = (___muldi3(($22|0),($58|0),($21|0),($298|0))|0);
 $300 = tempRet0;
 $301 = ($54|0)<(0);
 $302 = $301 << 31 >> 31;
 $303 = ($41|0)<(0);
 $304 = $303 << 31 >> 31;
 $305 = (___muldi3(($41|0),($304|0),($54|0),($302|0))|0);
 $306 = tempRet0;
 $307 = (___muldi3(($42|0),($280|0),($21|0),($298|0))|0);
 $308 = tempRet0;
 $309 = (___muldi3(($43|0),($258|0),($54|0),($302|0))|0);
 $310 = tempRet0;
 $311 = (___muldi3(($44|0),($234|0),($21|0),($298|0))|0);
 $312 = tempRet0;
 $313 = (___muldi3(($45|0),($212|0),($54|0),($302|0))|0);
 $314 = tempRet0;
 $315 = (___muldi3(($46|0),($188|0),($21|0),($298|0))|0);
 $316 = tempRet0;
 $317 = (___muldi3(($47|0),($166|0),($54|0),($302|0))|0);
 $318 = tempRet0;
 $319 = (___muldi3(($48|0),($142|0),($21|0),($298|0))|0);
 $320 = tempRet0;
 $321 = (___muldi3(($49|0),($120|0),($54|0),($302|0))|0);
 $322 = tempRet0;
 $323 = (_i64Add(($305|0),($306|0),($59|0),($60|0))|0);
 $324 = tempRet0;
 $325 = (_i64Add(($323|0),($324|0),($281|0),($282|0))|0);
 $326 = tempRet0;
 $327 = (_i64Add(($325|0),($326|0),($259|0),($260|0))|0);
 $328 = tempRet0;
 $329 = (_i64Add(($327|0),($328|0),($235|0),($236|0))|0);
 $330 = tempRet0;
 $331 = (_i64Add(($329|0),($330|0),($213|0),($214|0))|0);
 $332 = tempRet0;
 $333 = (_i64Add(($331|0),($332|0),($189|0),($190|0))|0);
 $334 = tempRet0;
 $335 = (_i64Add(($333|0),($334|0),($167|0),($168|0))|0);
 $336 = tempRet0;
 $337 = (_i64Add(($335|0),($336|0),($143|0),($144|0))|0);
 $338 = tempRet0;
 $339 = (_i64Add(($337|0),($338|0),($121|0),($122|0))|0);
 $340 = tempRet0;
 $341 = (_i64Add(($63|0),($64|0),($99|0),($100|0))|0);
 $342 = tempRet0;
 $343 = (_i64Add(($153|0),($154|0),($175|0),($176|0))|0);
 $344 = tempRet0;
 $345 = (_i64Add(($343|0),($344|0),($129|0),($130|0))|0);
 $346 = tempRet0;
 $347 = (_i64Add(($345|0),($346|0),($107|0),($108|0))|0);
 $348 = tempRet0;
 $349 = (_i64Add(($347|0),($348|0),($75|0),($76|0))|0);
 $350 = tempRet0;
 $351 = (_i64Add(($349|0),($350|0),($313|0),($314|0))|0);
 $352 = tempRet0;
 $353 = (_i64Add(($351|0),($352|0),($289|0),($290|0))|0);
 $354 = tempRet0;
 $355 = (_i64Add(($353|0),($354|0),($267|0),($268|0))|0);
 $356 = tempRet0;
 $357 = (_i64Add(($355|0),($356|0),($243|0),($244|0))|0);
 $358 = tempRet0;
 $359 = (_i64Add(($357|0),($358|0),($221|0),($222|0))|0);
 $360 = tempRet0;
 $361 = (_i64Add(($339|0),($340|0),33554432,0)|0);
 $362 = tempRet0;
 $363 = (_bitshift64Ashr(($361|0),($362|0),26)|0);
 $364 = tempRet0;
 $365 = (_i64Add(($341|0),($342|0),($307|0),($308|0))|0);
 $366 = tempRet0;
 $367 = (_i64Add(($365|0),($366|0),($283|0),($284|0))|0);
 $368 = tempRet0;
 $369 = (_i64Add(($367|0),($368|0),($261|0),($262|0))|0);
 $370 = tempRet0;
 $371 = (_i64Add(($369|0),($370|0),($237|0),($238|0))|0);
 $372 = tempRet0;
 $373 = (_i64Add(($371|0),($372|0),($215|0),($216|0))|0);
 $374 = tempRet0;
 $375 = (_i64Add(($373|0),($374|0),($191|0),($192|0))|0);
 $376 = tempRet0;
 $377 = (_i64Add(($375|0),($376|0),($169|0),($170|0))|0);
 $378 = tempRet0;
 $379 = (_i64Add(($377|0),($378|0),($145|0),($146|0))|0);
 $380 = tempRet0;
 $381 = (_i64Add(($379|0),($380|0),($363|0),($364|0))|0);
 $382 = tempRet0;
 $383 = $361 & -67108864;
 $384 = (_i64Subtract(($339|0),($340|0),($383|0),($362|0))|0);
 $385 = tempRet0;
 $386 = (_i64Add(($359|0),($360|0),33554432,0)|0);
 $387 = tempRet0;
 $388 = (_bitshift64Ashr(($386|0),($387|0),26)|0);
 $389 = tempRet0;
 $390 = (_i64Add(($177|0),($178|0),($199|0),($200|0))|0);
 $391 = tempRet0;
 $392 = (_i64Add(($390|0),($391|0),($155|0),($156|0))|0);
 $393 = tempRet0;
 $394 = (_i64Add(($392|0),($393|0),($131|0),($132|0))|0);
 $395 = tempRet0;
 $396 = (_i64Add(($394|0),($395|0),($109|0),($110|0))|0);
 $397 = tempRet0;
 $398 = (_i64Add(($396|0),($397|0),($79|0),($80|0))|0);
 $399 = tempRet0;
 $400 = (_i64Add(($398|0),($399|0),($315|0),($316|0))|0);
 $401 = tempRet0;
 $402 = (_i64Add(($400|0),($401|0),($291|0),($292|0))|0);
 $403 = tempRet0;
 $404 = (_i64Add(($402|0),($403|0),($269|0),($270|0))|0);
 $405 = tempRet0;
 $406 = (_i64Add(($404|0),($405|0),($245|0),($246|0))|0);
 $407 = tempRet0;
 $408 = (_i64Add(($406|0),($407|0),($388|0),($389|0))|0);
 $409 = tempRet0;
 $410 = $386 & -67108864;
 $411 = (_i64Subtract(($359|0),($360|0),($410|0),($387|0))|0);
 $412 = tempRet0;
 $413 = (_i64Add(($381|0),($382|0),16777216,0)|0);
 $414 = tempRet0;
 $415 = (_bitshift64Ashr(($413|0),($414|0),25)|0);
 $416 = tempRet0;
 $417 = (_i64Add(($103|0),($104|0),($125|0),($126|0))|0);
 $418 = tempRet0;
 $419 = (_i64Add(($417|0),($418|0),($67|0),($68|0))|0);
 $420 = tempRet0;
 $421 = (_i64Add(($419|0),($420|0),($309|0),($310|0))|0);
 $422 = tempRet0;
 $423 = (_i64Add(($421|0),($422|0),($285|0),($286|0))|0);
 $424 = tempRet0;
 $425 = (_i64Add(($423|0),($424|0),($263|0),($264|0))|0);
 $426 = tempRet0;
 $427 = (_i64Add(($425|0),($426|0),($239|0),($240|0))|0);
 $428 = tempRet0;
 $429 = (_i64Add(($427|0),($428|0),($217|0),($218|0))|0);
 $430 = tempRet0;
 $431 = (_i64Add(($429|0),($430|0),($193|0),($194|0))|0);
 $432 = tempRet0;
 $433 = (_i64Add(($431|0),($432|0),($171|0),($172|0))|0);
 $434 = tempRet0;
 $435 = (_i64Add(($433|0),($434|0),($415|0),($416|0))|0);
 $436 = tempRet0;
 $437 = $413 & -33554432;
 $438 = (_i64Subtract(($381|0),($382|0),($437|0),0)|0);
 $439 = tempRet0;
 $440 = (_i64Add(($408|0),($409|0),16777216,0)|0);
 $441 = tempRet0;
 $442 = (_bitshift64Ashr(($440|0),($441|0),25)|0);
 $443 = tempRet0;
 $444 = (_i64Add(($203|0),($204|0),($225|0),($226|0))|0);
 $445 = tempRet0;
 $446 = (_i64Add(($444|0),($445|0),($179|0),($180|0))|0);
 $447 = tempRet0;
 $448 = (_i64Add(($446|0),($447|0),($157|0),($158|0))|0);
 $449 = tempRet0;
 $450 = (_i64Add(($448|0),($449|0),($133|0),($134|0))|0);
 $451 = tempRet0;
 $452 = (_i64Add(($450|0),($451|0),($111|0),($112|0))|0);
 $453 = tempRet0;
 $454 = (_i64Add(($452|0),($453|0),($83|0),($84|0))|0);
 $455 = tempRet0;
 $456 = (_i64Add(($454|0),($455|0),($317|0),($318|0))|0);
 $457 = tempRet0;
 $458 = (_i64Add(($456|0),($457|0),($293|0),($294|0))|0);
 $459 = tempRet0;
 $460 = (_i64Add(($458|0),($459|0),($271|0),($272|0))|0);
 $461 = tempRet0;
 $462 = (_i64Add(($460|0),($461|0),($442|0),($443|0))|0);
 $463 = tempRet0;
 $464 = $440 & -33554432;
 $465 = (_i64Subtract(($408|0),($409|0),($464|0),0)|0);
 $466 = tempRet0;
 $467 = (_i64Add(($435|0),($436|0),33554432,0)|0);
 $468 = tempRet0;
 $469 = (_bitshift64Ashr(($467|0),($468|0),26)|0);
 $470 = tempRet0;
 $471 = (_i64Add(($127|0),($128|0),($149|0),($150|0))|0);
 $472 = tempRet0;
 $473 = (_i64Add(($471|0),($472|0),($105|0),($106|0))|0);
 $474 = tempRet0;
 $475 = (_i64Add(($473|0),($474|0),($71|0),($72|0))|0);
 $476 = tempRet0;
 $477 = (_i64Add(($475|0),($476|0),($311|0),($312|0))|0);
 $478 = tempRet0;
 $479 = (_i64Add(($477|0),($478|0),($287|0),($288|0))|0);
 $480 = tempRet0;
 $481 = (_i64Add(($479|0),($480|0),($265|0),($266|0))|0);
 $482 = tempRet0;
 $483 = (_i64Add(($481|0),($482|0),($241|0),($242|0))|0);
 $484 = tempRet0;
 $485 = (_i64Add(($483|0),($484|0),($219|0),($220|0))|0);
 $486 = tempRet0;
 $487 = (_i64Add(($485|0),($486|0),($195|0),($196|0))|0);
 $488 = tempRet0;
 $489 = (_i64Add(($487|0),($488|0),($469|0),($470|0))|0);
 $490 = tempRet0;
 $491 = $467 & -67108864;
 $492 = (_i64Subtract(($435|0),($436|0),($491|0),0)|0);
 $493 = tempRet0;
 $494 = (_i64Add(($462|0),($463|0),33554432,0)|0);
 $495 = tempRet0;
 $496 = (_bitshift64Ashr(($494|0),($495|0),26)|0);
 $497 = tempRet0;
 $498 = (_i64Add(($227|0),($228|0),($249|0),($250|0))|0);
 $499 = tempRet0;
 $500 = (_i64Add(($498|0),($499|0),($205|0),($206|0))|0);
 $501 = tempRet0;
 $502 = (_i64Add(($500|0),($501|0),($181|0),($182|0))|0);
 $503 = tempRet0;
 $504 = (_i64Add(($502|0),($503|0),($159|0),($160|0))|0);
 $505 = tempRet0;
 $506 = (_i64Add(($504|0),($505|0),($135|0),($136|0))|0);
 $507 = tempRet0;
 $508 = (_i64Add(($506|0),($507|0),($113|0),($114|0))|0);
 $509 = tempRet0;
 $510 = (_i64Add(($508|0),($509|0),($87|0),($88|0))|0);
 $511 = tempRet0;
 $512 = (_i64Add(($510|0),($511|0),($319|0),($320|0))|0);
 $513 = tempRet0;
 $514 = (_i64Add(($512|0),($513|0),($295|0),($296|0))|0);
 $515 = tempRet0;
 $516 = (_i64Add(($514|0),($515|0),($496|0),($497|0))|0);
 $517 = tempRet0;
 $518 = $494 & -67108864;
 $519 = (_i64Subtract(($462|0),($463|0),($518|0),0)|0);
 $520 = tempRet0;
 $521 = (_i64Add(($489|0),($490|0),16777216,0)|0);
 $522 = tempRet0;
 $523 = (_bitshift64Ashr(($521|0),($522|0),25)|0);
 $524 = tempRet0;
 $525 = (_i64Add(($523|0),($524|0),($411|0),($412|0))|0);
 $526 = tempRet0;
 $527 = $521 & -33554432;
 $528 = (_i64Subtract(($489|0),($490|0),($527|0),0)|0);
 $529 = tempRet0;
 $530 = (_i64Add(($516|0),($517|0),16777216,0)|0);
 $531 = tempRet0;
 $532 = (_bitshift64Ashr(($530|0),($531|0),25)|0);
 $533 = tempRet0;
 $534 = (_i64Add(($253|0),($254|0),($275|0),($276|0))|0);
 $535 = tempRet0;
 $536 = (_i64Add(($534|0),($535|0),($229|0),($230|0))|0);
 $537 = tempRet0;
 $538 = (_i64Add(($536|0),($537|0),($207|0),($208|0))|0);
 $539 = tempRet0;
 $540 = (_i64Add(($538|0),($539|0),($183|0),($184|0))|0);
 $541 = tempRet0;
 $542 = (_i64Add(($540|0),($541|0),($161|0),($162|0))|0);
 $543 = tempRet0;
 $544 = (_i64Add(($542|0),($543|0),($137|0),($138|0))|0);
 $545 = tempRet0;
 $546 = (_i64Add(($544|0),($545|0),($115|0),($116|0))|0);
 $547 = tempRet0;
 $548 = (_i64Add(($546|0),($547|0),($91|0),($92|0))|0);
 $549 = tempRet0;
 $550 = (_i64Add(($548|0),($549|0),($321|0),($322|0))|0);
 $551 = tempRet0;
 $552 = (_i64Add(($550|0),($551|0),($532|0),($533|0))|0);
 $553 = tempRet0;
 $554 = $530 & -33554432;
 $555 = (_i64Subtract(($516|0),($517|0),($554|0),0)|0);
 $556 = tempRet0;
 $557 = (_i64Add(($525|0),($526|0),33554432,0)|0);
 $558 = tempRet0;
 $559 = (_bitshift64Lshr(($557|0),($558|0),26)|0);
 $560 = tempRet0;
 $561 = (_i64Add(($465|0),($466|0),($559|0),($560|0))|0);
 $562 = tempRet0;
 $563 = $557 & -67108864;
 $564 = (_i64Subtract(($525|0),($526|0),($563|0),0)|0);
 $565 = tempRet0;
 $566 = (_i64Add(($552|0),($553|0),33554432,0)|0);
 $567 = tempRet0;
 $568 = (_bitshift64Ashr(($566|0),($567|0),26)|0);
 $569 = tempRet0;
 $570 = (_i64Add(($277|0),($278|0),($299|0),($300|0))|0);
 $571 = tempRet0;
 $572 = (_i64Add(($570|0),($571|0),($255|0),($256|0))|0);
 $573 = tempRet0;
 $574 = (_i64Add(($572|0),($573|0),($231|0),($232|0))|0);
 $575 = tempRet0;
 $576 = (_i64Add(($574|0),($575|0),($209|0),($210|0))|0);
 $577 = tempRet0;
 $578 = (_i64Add(($576|0),($577|0),($185|0),($186|0))|0);
 $579 = tempRet0;
 $580 = (_i64Add(($578|0),($579|0),($163|0),($164|0))|0);
 $581 = tempRet0;
 $582 = (_i64Add(($580|0),($581|0),($139|0),($140|0))|0);
 $583 = tempRet0;
 $584 = (_i64Add(($582|0),($583|0),($117|0),($118|0))|0);
 $585 = tempRet0;
 $586 = (_i64Add(($584|0),($585|0),($95|0),($96|0))|0);
 $587 = tempRet0;
 $588 = (_i64Add(($586|0),($587|0),($568|0),($569|0))|0);
 $589 = tempRet0;
 $590 = $566 & -67108864;
 $591 = (_i64Subtract(($552|0),($553|0),($590|0),0)|0);
 $592 = tempRet0;
 $593 = (_i64Add(($588|0),($589|0),16777216,0)|0);
 $594 = tempRet0;
 $595 = (_bitshift64Ashr(($593|0),($594|0),25)|0);
 $596 = tempRet0;
 $597 = (___muldi3(($595|0),($596|0),19,0)|0);
 $598 = tempRet0;
 $599 = (_i64Add(($597|0),($598|0),($384|0),($385|0))|0);
 $600 = tempRet0;
 $601 = $593 & -33554432;
 $602 = (_i64Subtract(($588|0),($589|0),($601|0),0)|0);
 $603 = tempRet0;
 $604 = (_i64Add(($599|0),($600|0),33554432,0)|0);
 $605 = tempRet0;
 $606 = (_bitshift64Lshr(($604|0),($605|0),26)|0);
 $607 = tempRet0;
 $608 = (_i64Add(($438|0),($439|0),($606|0),($607|0))|0);
 $609 = tempRet0;
 $610 = $604 & -67108864;
 $611 = (_i64Subtract(($599|0),($600|0),($610|0),0)|0);
 $612 = tempRet0;
 HEAP32[$0>>2] = $611;
 $613 = ((($0)) + 4|0);
 HEAP32[$613>>2] = $608;
 $614 = ((($0)) + 8|0);
 HEAP32[$614>>2] = $492;
 $615 = ((($0)) + 12|0);
 HEAP32[$615>>2] = $528;
 $616 = ((($0)) + 16|0);
 HEAP32[$616>>2] = $564;
 $617 = ((($0)) + 20|0);
 HEAP32[$617>>2] = $561;
 $618 = ((($0)) + 24|0);
 HEAP32[$618>>2] = $519;
 $619 = ((($0)) + 28|0);
 HEAP32[$619>>2] = $555;
 $620 = ((($0)) + 32|0);
 HEAP32[$620>>2] = $591;
 $621 = ((($0)) + 36|0);
 HEAP32[$621>>2] = $602;
 return;
}
function _crypto_sign_ed25519_ref10_fe_neg($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0;
 var $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = HEAP32[$1>>2]|0;
 $3 = ((($1)) + 4|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = ((($1)) + 8|0);
 $6 = HEAP32[$5>>2]|0;
 $7 = ((($1)) + 12|0);
 $8 = HEAP32[$7>>2]|0;
 $9 = ((($1)) + 16|0);
 $10 = HEAP32[$9>>2]|0;
 $11 = ((($1)) + 20|0);
 $12 = HEAP32[$11>>2]|0;
 $13 = ((($1)) + 24|0);
 $14 = HEAP32[$13>>2]|0;
 $15 = ((($1)) + 28|0);
 $16 = HEAP32[$15>>2]|0;
 $17 = ((($1)) + 32|0);
 $18 = HEAP32[$17>>2]|0;
 $19 = ((($1)) + 36|0);
 $20 = HEAP32[$19>>2]|0;
 $21 = (0 - ($2))|0;
 $22 = (0 - ($4))|0;
 $23 = (0 - ($6))|0;
 $24 = (0 - ($8))|0;
 $25 = (0 - ($10))|0;
 $26 = (0 - ($12))|0;
 $27 = (0 - ($14))|0;
 $28 = (0 - ($16))|0;
 $29 = (0 - ($18))|0;
 $30 = (0 - ($20))|0;
 HEAP32[$0>>2] = $21;
 $31 = ((($0)) + 4|0);
 HEAP32[$31>>2] = $22;
 $32 = ((($0)) + 8|0);
 HEAP32[$32>>2] = $23;
 $33 = ((($0)) + 12|0);
 HEAP32[$33>>2] = $24;
 $34 = ((($0)) + 16|0);
 HEAP32[$34>>2] = $25;
 $35 = ((($0)) + 20|0);
 HEAP32[$35>>2] = $26;
 $36 = ((($0)) + 24|0);
 HEAP32[$36>>2] = $27;
 $37 = ((($0)) + 28|0);
 HEAP32[$37>>2] = $28;
 $38 = ((($0)) + 32|0);
 HEAP32[$38>>2] = $29;
 $39 = ((($0)) + 36|0);
 HEAP32[$39>>2] = $30;
 return;
}
function _crypto_sign_ed25519_ref10_fe_pow22523($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$828 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $exitcond = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 128|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(128|0);
 $2 = sp + 80|0;
 $3 = sp + 40|0;
 $4 = sp;
 _crypto_sign_ed25519_ref10_fe_sq($2,$1);
 _crypto_sign_ed25519_ref10_fe_sq($3,$2);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_mul($3,$1,$3);
 _crypto_sign_ed25519_ref10_fe_mul($2,$2,$3);
 _crypto_sign_ed25519_ref10_fe_sq($2,$2);
 _crypto_sign_ed25519_ref10_fe_mul($2,$3,$2);
 _crypto_sign_ed25519_ref10_fe_sq($3,$2);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_mul($2,$3,$2);
 _crypto_sign_ed25519_ref10_fe_sq($3,$2);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_mul($3,$3,$2);
 _crypto_sign_ed25519_ref10_fe_sq($4,$3);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_sq($4,$4);
 _crypto_sign_ed25519_ref10_fe_mul($3,$4,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_mul($2,$3,$2);
 _crypto_sign_ed25519_ref10_fe_sq($3,$2);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_mul($3,$3,$2);
 _crypto_sign_ed25519_ref10_fe_sq($4,$3);
 $$828 = 1;
 while(1) {
  _crypto_sign_ed25519_ref10_fe_sq($4,$4);
  $5 = (($$828) + 1)|0;
  $exitcond = ($5|0)==(100);
  if ($exitcond) {
   break;
  } else {
   $$828 = $5;
  }
 }
 _crypto_sign_ed25519_ref10_fe_mul($3,$4,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_sq($3,$3);
 _crypto_sign_ed25519_ref10_fe_mul($2,$3,$2);
 _crypto_sign_ed25519_ref10_fe_sq($2,$2);
 _crypto_sign_ed25519_ref10_fe_sq($2,$2);
 _crypto_sign_ed25519_ref10_fe_mul($0,$2,$1);
 STACKTOP = sp;return;
}
function _crypto_sign_ed25519_ref10_fe_sq($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0;
 var $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0;
 var $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0;
 var $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0;
 var $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0;
 var $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0;
 var $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0;
 var $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0;
 var $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0;
 var $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0;
 var $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0;
 var $299 = 0, $3 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0, $312 = 0, $313 = 0, $314 = 0, $315 = 0;
 var $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0, $321 = 0, $322 = 0, $323 = 0, $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0, $329 = 0, $33 = 0, $330 = 0, $331 = 0, $332 = 0, $333 = 0;
 var $334 = 0, $335 = 0, $336 = 0, $337 = 0, $338 = 0, $339 = 0, $34 = 0, $340 = 0, $341 = 0, $342 = 0, $343 = 0, $344 = 0, $345 = 0, $346 = 0, $347 = 0, $348 = 0, $349 = 0, $35 = 0, $350 = 0, $351 = 0;
 var $352 = 0, $353 = 0, $354 = 0, $355 = 0, $356 = 0, $357 = 0, $358 = 0, $359 = 0, $36 = 0, $360 = 0, $361 = 0, $362 = 0, $363 = 0, $364 = 0, $365 = 0, $366 = 0, $367 = 0, $368 = 0, $369 = 0, $37 = 0;
 var $370 = 0, $371 = 0, $372 = 0, $373 = 0, $374 = 0, $375 = 0, $376 = 0, $377 = 0, $378 = 0, $379 = 0, $38 = 0, $380 = 0, $381 = 0, $382 = 0, $383 = 0, $384 = 0, $385 = 0, $386 = 0, $387 = 0, $388 = 0;
 var $389 = 0, $39 = 0, $390 = 0, $391 = 0, $392 = 0, $393 = 0, $394 = 0, $395 = 0, $396 = 0, $397 = 0, $398 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0;
 var $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0;
 var $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0;
 var $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = HEAP32[$1>>2]|0;
 $3 = ((($1)) + 4|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = ((($1)) + 8|0);
 $6 = HEAP32[$5>>2]|0;
 $7 = ((($1)) + 12|0);
 $8 = HEAP32[$7>>2]|0;
 $9 = ((($1)) + 16|0);
 $10 = HEAP32[$9>>2]|0;
 $11 = ((($1)) + 20|0);
 $12 = HEAP32[$11>>2]|0;
 $13 = ((($1)) + 24|0);
 $14 = HEAP32[$13>>2]|0;
 $15 = ((($1)) + 28|0);
 $16 = HEAP32[$15>>2]|0;
 $17 = ((($1)) + 32|0);
 $18 = HEAP32[$17>>2]|0;
 $19 = ((($1)) + 36|0);
 $20 = HEAP32[$19>>2]|0;
 $21 = $2 << 1;
 $22 = $4 << 1;
 $23 = $6 << 1;
 $24 = $8 << 1;
 $25 = $10 << 1;
 $26 = $12 << 1;
 $27 = $14 << 1;
 $28 = $16 << 1;
 $29 = ($12*38)|0;
 $30 = ($14*19)|0;
 $31 = ($16*38)|0;
 $32 = ($18*19)|0;
 $33 = ($20*38)|0;
 $34 = ($2|0)<(0);
 $35 = $34 << 31 >> 31;
 $36 = (___muldi3(($2|0),($35|0),($2|0),($35|0))|0);
 $37 = tempRet0;
 $38 = ($21|0)<(0);
 $39 = $38 << 31 >> 31;
 $40 = ($4|0)<(0);
 $41 = $40 << 31 >> 31;
 $42 = (___muldi3(($21|0),($39|0),($4|0),($41|0))|0);
 $43 = tempRet0;
 $44 = ($6|0)<(0);
 $45 = $44 << 31 >> 31;
 $46 = (___muldi3(($6|0),($45|0),($21|0),($39|0))|0);
 $47 = tempRet0;
 $48 = ($8|0)<(0);
 $49 = $48 << 31 >> 31;
 $50 = (___muldi3(($8|0),($49|0),($21|0),($39|0))|0);
 $51 = tempRet0;
 $52 = ($10|0)<(0);
 $53 = $52 << 31 >> 31;
 $54 = (___muldi3(($10|0),($53|0),($21|0),($39|0))|0);
 $55 = tempRet0;
 $56 = ($12|0)<(0);
 $57 = $56 << 31 >> 31;
 $58 = (___muldi3(($12|0),($57|0),($21|0),($39|0))|0);
 $59 = tempRet0;
 $60 = ($14|0)<(0);
 $61 = $60 << 31 >> 31;
 $62 = (___muldi3(($14|0),($61|0),($21|0),($39|0))|0);
 $63 = tempRet0;
 $64 = ($16|0)<(0);
 $65 = $64 << 31 >> 31;
 $66 = (___muldi3(($16|0),($65|0),($21|0),($39|0))|0);
 $67 = tempRet0;
 $68 = ($18|0)<(0);
 $69 = $68 << 31 >> 31;
 $70 = (___muldi3(($18|0),($69|0),($21|0),($39|0))|0);
 $71 = tempRet0;
 $72 = ($20|0)<(0);
 $73 = $72 << 31 >> 31;
 $74 = (___muldi3(($20|0),($73|0),($21|0),($39|0))|0);
 $75 = tempRet0;
 $76 = ($22|0)<(0);
 $77 = $76 << 31 >> 31;
 $78 = (___muldi3(($22|0),($77|0),($4|0),($41|0))|0);
 $79 = tempRet0;
 $80 = (___muldi3(($22|0),($77|0),($6|0),($45|0))|0);
 $81 = tempRet0;
 $82 = ($24|0)<(0);
 $83 = $82 << 31 >> 31;
 $84 = (___muldi3(($24|0),($83|0),($22|0),($77|0))|0);
 $85 = tempRet0;
 $86 = (___muldi3(($10|0),($53|0),($22|0),($77|0))|0);
 $87 = tempRet0;
 $88 = ($26|0)<(0);
 $89 = $88 << 31 >> 31;
 $90 = (___muldi3(($26|0),($89|0),($22|0),($77|0))|0);
 $91 = tempRet0;
 $92 = (___muldi3(($14|0),($61|0),($22|0),($77|0))|0);
 $93 = tempRet0;
 $94 = ($28|0)<(0);
 $95 = $94 << 31 >> 31;
 $96 = (___muldi3(($28|0),($95|0),($22|0),($77|0))|0);
 $97 = tempRet0;
 $98 = (___muldi3(($18|0),($69|0),($22|0),($77|0))|0);
 $99 = tempRet0;
 $100 = ($33|0)<(0);
 $101 = $100 << 31 >> 31;
 $102 = (___muldi3(($33|0),($101|0),($22|0),($77|0))|0);
 $103 = tempRet0;
 $104 = (___muldi3(($6|0),($45|0),($6|0),($45|0))|0);
 $105 = tempRet0;
 $106 = ($23|0)<(0);
 $107 = $106 << 31 >> 31;
 $108 = (___muldi3(($23|0),($107|0),($8|0),($49|0))|0);
 $109 = tempRet0;
 $110 = (___muldi3(($10|0),($53|0),($23|0),($107|0))|0);
 $111 = tempRet0;
 $112 = (___muldi3(($12|0),($57|0),($23|0),($107|0))|0);
 $113 = tempRet0;
 $114 = (___muldi3(($14|0),($61|0),($23|0),($107|0))|0);
 $115 = tempRet0;
 $116 = (___muldi3(($16|0),($65|0),($23|0),($107|0))|0);
 $117 = tempRet0;
 $118 = ($32|0)<(0);
 $119 = $118 << 31 >> 31;
 $120 = (___muldi3(($32|0),($119|0),($23|0),($107|0))|0);
 $121 = tempRet0;
 $122 = (___muldi3(($33|0),($101|0),($6|0),($45|0))|0);
 $123 = tempRet0;
 $124 = (___muldi3(($24|0),($83|0),($8|0),($49|0))|0);
 $125 = tempRet0;
 $126 = (___muldi3(($24|0),($83|0),($10|0),($53|0))|0);
 $127 = tempRet0;
 $128 = (___muldi3(($26|0),($89|0),($24|0),($83|0))|0);
 $129 = tempRet0;
 $130 = (___muldi3(($14|0),($61|0),($24|0),($83|0))|0);
 $131 = tempRet0;
 $132 = ($31|0)<(0);
 $133 = $132 << 31 >> 31;
 $134 = (___muldi3(($31|0),($133|0),($24|0),($83|0))|0);
 $135 = tempRet0;
 $136 = (___muldi3(($32|0),($119|0),($24|0),($83|0))|0);
 $137 = tempRet0;
 $138 = (___muldi3(($33|0),($101|0),($24|0),($83|0))|0);
 $139 = tempRet0;
 $140 = (___muldi3(($10|0),($53|0),($10|0),($53|0))|0);
 $141 = tempRet0;
 $142 = ($25|0)<(0);
 $143 = $142 << 31 >> 31;
 $144 = (___muldi3(($25|0),($143|0),($12|0),($57|0))|0);
 $145 = tempRet0;
 $146 = ($30|0)<(0);
 $147 = $146 << 31 >> 31;
 $148 = (___muldi3(($30|0),($147|0),($25|0),($143|0))|0);
 $149 = tempRet0;
 $150 = (___muldi3(($31|0),($133|0),($10|0),($53|0))|0);
 $151 = tempRet0;
 $152 = (___muldi3(($32|0),($119|0),($25|0),($143|0))|0);
 $153 = tempRet0;
 $154 = (___muldi3(($33|0),($101|0),($10|0),($53|0))|0);
 $155 = tempRet0;
 $156 = ($29|0)<(0);
 $157 = $156 << 31 >> 31;
 $158 = (___muldi3(($29|0),($157|0),($12|0),($57|0))|0);
 $159 = tempRet0;
 $160 = (___muldi3(($30|0),($147|0),($26|0),($89|0))|0);
 $161 = tempRet0;
 $162 = (___muldi3(($31|0),($133|0),($26|0),($89|0))|0);
 $163 = tempRet0;
 $164 = (___muldi3(($32|0),($119|0),($26|0),($89|0))|0);
 $165 = tempRet0;
 $166 = (___muldi3(($33|0),($101|0),($26|0),($89|0))|0);
 $167 = tempRet0;
 $168 = (___muldi3(($30|0),($147|0),($14|0),($61|0))|0);
 $169 = tempRet0;
 $170 = (___muldi3(($31|0),($133|0),($14|0),($61|0))|0);
 $171 = tempRet0;
 $172 = ($27|0)<(0);
 $173 = $172 << 31 >> 31;
 $174 = (___muldi3(($32|0),($119|0),($27|0),($173|0))|0);
 $175 = tempRet0;
 $176 = (___muldi3(($33|0),($101|0),($14|0),($61|0))|0);
 $177 = tempRet0;
 $178 = (___muldi3(($31|0),($133|0),($16|0),($65|0))|0);
 $179 = tempRet0;
 $180 = (___muldi3(($32|0),($119|0),($28|0),($95|0))|0);
 $181 = tempRet0;
 $182 = (___muldi3(($33|0),($101|0),($28|0),($95|0))|0);
 $183 = tempRet0;
 $184 = (___muldi3(($32|0),($119|0),($18|0),($69|0))|0);
 $185 = tempRet0;
 $186 = (___muldi3(($33|0),($101|0),($18|0),($69|0))|0);
 $187 = tempRet0;
 $188 = (___muldi3(($33|0),($101|0),($20|0),($73|0))|0);
 $189 = tempRet0;
 $190 = (_i64Add(($158|0),($159|0),($36|0),($37|0))|0);
 $191 = tempRet0;
 $192 = (_i64Add(($190|0),($191|0),($148|0),($149|0))|0);
 $193 = tempRet0;
 $194 = (_i64Add(($192|0),($193|0),($134|0),($135|0))|0);
 $195 = tempRet0;
 $196 = (_i64Add(($194|0),($195|0),($120|0),($121|0))|0);
 $197 = tempRet0;
 $198 = (_i64Add(($196|0),($197|0),($102|0),($103|0))|0);
 $199 = tempRet0;
 $200 = (_i64Add(($46|0),($47|0),($78|0),($79|0))|0);
 $201 = tempRet0;
 $202 = (_i64Add(($50|0),($51|0),($80|0),($81|0))|0);
 $203 = tempRet0;
 $204 = (_i64Add(($84|0),($85|0),($104|0),($105|0))|0);
 $205 = tempRet0;
 $206 = (_i64Add(($204|0),($205|0),($54|0),($55|0))|0);
 $207 = tempRet0;
 $208 = (_i64Add(($206|0),($207|0),($178|0),($179|0))|0);
 $209 = tempRet0;
 $210 = (_i64Add(($208|0),($209|0),($174|0),($175|0))|0);
 $211 = tempRet0;
 $212 = (_i64Add(($210|0),($211|0),($166|0),($167|0))|0);
 $213 = tempRet0;
 $214 = (_i64Add(($198|0),($199|0),33554432,0)|0);
 $215 = tempRet0;
 $216 = (_bitshift64Ashr(($214|0),($215|0),26)|0);
 $217 = tempRet0;
 $218 = (_i64Add(($160|0),($161|0),($42|0),($43|0))|0);
 $219 = tempRet0;
 $220 = (_i64Add(($218|0),($219|0),($150|0),($151|0))|0);
 $221 = tempRet0;
 $222 = (_i64Add(($220|0),($221|0),($136|0),($137|0))|0);
 $223 = tempRet0;
 $224 = (_i64Add(($222|0),($223|0),($122|0),($123|0))|0);
 $225 = tempRet0;
 $226 = (_i64Add(($224|0),($225|0),($216|0),($217|0))|0);
 $227 = tempRet0;
 $228 = $214 & -67108864;
 $229 = (_i64Subtract(($198|0),($199|0),($228|0),($215|0))|0);
 $230 = tempRet0;
 $231 = (_i64Add(($212|0),($213|0),33554432,0)|0);
 $232 = tempRet0;
 $233 = (_bitshift64Ashr(($231|0),($232|0),26)|0);
 $234 = tempRet0;
 $235 = (_i64Add(($86|0),($87|0),($108|0),($109|0))|0);
 $236 = tempRet0;
 $237 = (_i64Add(($235|0),($236|0),($58|0),($59|0))|0);
 $238 = tempRet0;
 $239 = (_i64Add(($237|0),($238|0),($180|0),($181|0))|0);
 $240 = tempRet0;
 $241 = (_i64Add(($239|0),($240|0),($176|0),($177|0))|0);
 $242 = tempRet0;
 $243 = (_i64Add(($241|0),($242|0),($233|0),($234|0))|0);
 $244 = tempRet0;
 $245 = $231 & -67108864;
 $246 = (_i64Subtract(($212|0),($213|0),($245|0),($232|0))|0);
 $247 = tempRet0;
 $248 = (_i64Add(($226|0),($227|0),16777216,0)|0);
 $249 = tempRet0;
 $250 = (_bitshift64Ashr(($248|0),($249|0),25)|0);
 $251 = tempRet0;
 $252 = (_i64Add(($200|0),($201|0),($168|0),($169|0))|0);
 $253 = tempRet0;
 $254 = (_i64Add(($252|0),($253|0),($162|0),($163|0))|0);
 $255 = tempRet0;
 $256 = (_i64Add(($254|0),($255|0),($152|0),($153|0))|0);
 $257 = tempRet0;
 $258 = (_i64Add(($256|0),($257|0),($138|0),($139|0))|0);
 $259 = tempRet0;
 $260 = (_i64Add(($258|0),($259|0),($250|0),($251|0))|0);
 $261 = tempRet0;
 $262 = $248 & -33554432;
 $263 = (_i64Subtract(($226|0),($227|0),($262|0),0)|0);
 $264 = tempRet0;
 $265 = (_i64Add(($243|0),($244|0),16777216,0)|0);
 $266 = tempRet0;
 $267 = (_bitshift64Ashr(($265|0),($266|0),25)|0);
 $268 = tempRet0;
 $269 = (_i64Add(($124|0),($125|0),($110|0),($111|0))|0);
 $270 = tempRet0;
 $271 = (_i64Add(($269|0),($270|0),($90|0),($91|0))|0);
 $272 = tempRet0;
 $273 = (_i64Add(($271|0),($272|0),($62|0),($63|0))|0);
 $274 = tempRet0;
 $275 = (_i64Add(($273|0),($274|0),($184|0),($185|0))|0);
 $276 = tempRet0;
 $277 = (_i64Add(($275|0),($276|0),($182|0),($183|0))|0);
 $278 = tempRet0;
 $279 = (_i64Add(($277|0),($278|0),($267|0),($268|0))|0);
 $280 = tempRet0;
 $281 = $265 & -33554432;
 $282 = (_i64Subtract(($243|0),($244|0),($281|0),0)|0);
 $283 = tempRet0;
 $284 = (_i64Add(($260|0),($261|0),33554432,0)|0);
 $285 = tempRet0;
 $286 = (_bitshift64Ashr(($284|0),($285|0),26)|0);
 $287 = tempRet0;
 $288 = (_i64Add(($202|0),($203|0),($170|0),($171|0))|0);
 $289 = tempRet0;
 $290 = (_i64Add(($288|0),($289|0),($164|0),($165|0))|0);
 $291 = tempRet0;
 $292 = (_i64Add(($290|0),($291|0),($154|0),($155|0))|0);
 $293 = tempRet0;
 $294 = (_i64Add(($292|0),($293|0),($286|0),($287|0))|0);
 $295 = tempRet0;
 $296 = $284 & -67108864;
 $297 = (_i64Subtract(($260|0),($261|0),($296|0),0)|0);
 $298 = tempRet0;
 $299 = (_i64Add(($279|0),($280|0),33554432,0)|0);
 $300 = tempRet0;
 $301 = (_bitshift64Ashr(($299|0),($300|0),26)|0);
 $302 = tempRet0;
 $303 = (_i64Add(($112|0),($113|0),($126|0),($127|0))|0);
 $304 = tempRet0;
 $305 = (_i64Add(($303|0),($304|0),($92|0),($93|0))|0);
 $306 = tempRet0;
 $307 = (_i64Add(($305|0),($306|0),($66|0),($67|0))|0);
 $308 = tempRet0;
 $309 = (_i64Add(($307|0),($308|0),($186|0),($187|0))|0);
 $310 = tempRet0;
 $311 = (_i64Add(($309|0),($310|0),($301|0),($302|0))|0);
 $312 = tempRet0;
 $313 = $299 & -67108864;
 $314 = (_i64Subtract(($279|0),($280|0),($313|0),0)|0);
 $315 = tempRet0;
 $316 = (_i64Add(($294|0),($295|0),16777216,0)|0);
 $317 = tempRet0;
 $318 = (_bitshift64Ashr(($316|0),($317|0),25)|0);
 $319 = tempRet0;
 $320 = (_i64Add(($318|0),($319|0),($246|0),($247|0))|0);
 $321 = tempRet0;
 $322 = $316 & -33554432;
 $323 = (_i64Subtract(($294|0),($295|0),($322|0),0)|0);
 $324 = tempRet0;
 $325 = (_i64Add(($311|0),($312|0),16777216,0)|0);
 $326 = tempRet0;
 $327 = (_bitshift64Ashr(($325|0),($326|0),25)|0);
 $328 = tempRet0;
 $329 = (_i64Add(($114|0),($115|0),($140|0),($141|0))|0);
 $330 = tempRet0;
 $331 = (_i64Add(($329|0),($330|0),($128|0),($129|0))|0);
 $332 = tempRet0;
 $333 = (_i64Add(($331|0),($332|0),($96|0),($97|0))|0);
 $334 = tempRet0;
 $335 = (_i64Add(($333|0),($334|0),($70|0),($71|0))|0);
 $336 = tempRet0;
 $337 = (_i64Add(($335|0),($336|0),($188|0),($189|0))|0);
 $338 = tempRet0;
 $339 = (_i64Add(($337|0),($338|0),($327|0),($328|0))|0);
 $340 = tempRet0;
 $341 = $325 & -33554432;
 $342 = (_i64Subtract(($311|0),($312|0),($341|0),0)|0);
 $343 = tempRet0;
 $344 = (_i64Add(($320|0),($321|0),33554432,0)|0);
 $345 = tempRet0;
 $346 = (_bitshift64Lshr(($344|0),($345|0),26)|0);
 $347 = tempRet0;
 $348 = (_i64Add(($282|0),($283|0),($346|0),($347|0))|0);
 $349 = tempRet0;
 $350 = $344 & -67108864;
 $351 = (_i64Subtract(($320|0),($321|0),($350|0),0)|0);
 $352 = tempRet0;
 $353 = (_i64Add(($339|0),($340|0),33554432,0)|0);
 $354 = tempRet0;
 $355 = (_bitshift64Ashr(($353|0),($354|0),26)|0);
 $356 = tempRet0;
 $357 = (_i64Add(($130|0),($131|0),($144|0),($145|0))|0);
 $358 = tempRet0;
 $359 = (_i64Add(($357|0),($358|0),($116|0),($117|0))|0);
 $360 = tempRet0;
 $361 = (_i64Add(($359|0),($360|0),($98|0),($99|0))|0);
 $362 = tempRet0;
 $363 = (_i64Add(($361|0),($362|0),($74|0),($75|0))|0);
 $364 = tempRet0;
 $365 = (_i64Add(($363|0),($364|0),($355|0),($356|0))|0);
 $366 = tempRet0;
 $367 = $353 & -67108864;
 $368 = (_i64Subtract(($339|0),($340|0),($367|0),0)|0);
 $369 = tempRet0;
 $370 = (_i64Add(($365|0),($366|0),16777216,0)|0);
 $371 = tempRet0;
 $372 = (_bitshift64Ashr(($370|0),($371|0),25)|0);
 $373 = tempRet0;
 $374 = (___muldi3(($372|0),($373|0),19,0)|0);
 $375 = tempRet0;
 $376 = (_i64Add(($374|0),($375|0),($229|0),($230|0))|0);
 $377 = tempRet0;
 $378 = $370 & -33554432;
 $379 = (_i64Subtract(($365|0),($366|0),($378|0),0)|0);
 $380 = tempRet0;
 $381 = (_i64Add(($376|0),($377|0),33554432,0)|0);
 $382 = tempRet0;
 $383 = (_bitshift64Lshr(($381|0),($382|0),26)|0);
 $384 = tempRet0;
 $385 = (_i64Add(($263|0),($264|0),($383|0),($384|0))|0);
 $386 = tempRet0;
 $387 = $381 & -67108864;
 $388 = (_i64Subtract(($376|0),($377|0),($387|0),0)|0);
 $389 = tempRet0;
 HEAP32[$0>>2] = $388;
 $390 = ((($0)) + 4|0);
 HEAP32[$390>>2] = $385;
 $391 = ((($0)) + 8|0);
 HEAP32[$391>>2] = $297;
 $392 = ((($0)) + 12|0);
 HEAP32[$392>>2] = $323;
 $393 = ((($0)) + 16|0);
 HEAP32[$393>>2] = $351;
 $394 = ((($0)) + 20|0);
 HEAP32[$394>>2] = $348;
 $395 = ((($0)) + 24|0);
 HEAP32[$395>>2] = $314;
 $396 = ((($0)) + 28|0);
 HEAP32[$396>>2] = $342;
 $397 = ((($0)) + 32|0);
 HEAP32[$397>>2] = $368;
 $398 = ((($0)) + 36|0);
 HEAP32[$398>>2] = $379;
 return;
}
function _crypto_sign_ed25519_ref10_fe_sq2($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0;
 var $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0;
 var $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0;
 var $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0;
 var $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0;
 var $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0;
 var $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0;
 var $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0;
 var $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0;
 var $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0;
 var $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0;
 var $299 = 0, $3 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0, $312 = 0, $313 = 0, $314 = 0, $315 = 0;
 var $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0, $321 = 0, $322 = 0, $323 = 0, $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0, $329 = 0, $33 = 0, $330 = 0, $331 = 0, $332 = 0, $333 = 0;
 var $334 = 0, $335 = 0, $336 = 0, $337 = 0, $338 = 0, $339 = 0, $34 = 0, $340 = 0, $341 = 0, $342 = 0, $343 = 0, $344 = 0, $345 = 0, $346 = 0, $347 = 0, $348 = 0, $349 = 0, $35 = 0, $350 = 0, $351 = 0;
 var $352 = 0, $353 = 0, $354 = 0, $355 = 0, $356 = 0, $357 = 0, $358 = 0, $359 = 0, $36 = 0, $360 = 0, $361 = 0, $362 = 0, $363 = 0, $364 = 0, $365 = 0, $366 = 0, $367 = 0, $368 = 0, $369 = 0, $37 = 0;
 var $370 = 0, $371 = 0, $372 = 0, $373 = 0, $374 = 0, $375 = 0, $376 = 0, $377 = 0, $378 = 0, $379 = 0, $38 = 0, $380 = 0, $381 = 0, $382 = 0, $383 = 0, $384 = 0, $385 = 0, $386 = 0, $387 = 0, $388 = 0;
 var $389 = 0, $39 = 0, $390 = 0, $391 = 0, $392 = 0, $393 = 0, $394 = 0, $395 = 0, $396 = 0, $397 = 0, $398 = 0, $399 = 0, $4 = 0, $40 = 0, $400 = 0, $401 = 0, $402 = 0, $403 = 0, $404 = 0, $405 = 0;
 var $406 = 0, $407 = 0, $408 = 0, $409 = 0, $41 = 0, $410 = 0, $411 = 0, $412 = 0, $413 = 0, $414 = 0, $415 = 0, $416 = 0, $417 = 0, $418 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0;
 var $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0;
 var $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0;
 var $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = HEAP32[$1>>2]|0;
 $3 = ((($1)) + 4|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = ((($1)) + 8|0);
 $6 = HEAP32[$5>>2]|0;
 $7 = ((($1)) + 12|0);
 $8 = HEAP32[$7>>2]|0;
 $9 = ((($1)) + 16|0);
 $10 = HEAP32[$9>>2]|0;
 $11 = ((($1)) + 20|0);
 $12 = HEAP32[$11>>2]|0;
 $13 = ((($1)) + 24|0);
 $14 = HEAP32[$13>>2]|0;
 $15 = ((($1)) + 28|0);
 $16 = HEAP32[$15>>2]|0;
 $17 = ((($1)) + 32|0);
 $18 = HEAP32[$17>>2]|0;
 $19 = ((($1)) + 36|0);
 $20 = HEAP32[$19>>2]|0;
 $21 = $2 << 1;
 $22 = $4 << 1;
 $23 = $6 << 1;
 $24 = $8 << 1;
 $25 = $10 << 1;
 $26 = $12 << 1;
 $27 = $14 << 1;
 $28 = $16 << 1;
 $29 = ($12*38)|0;
 $30 = ($14*19)|0;
 $31 = ($16*38)|0;
 $32 = ($18*19)|0;
 $33 = ($20*38)|0;
 $34 = ($2|0)<(0);
 $35 = $34 << 31 >> 31;
 $36 = (___muldi3(($2|0),($35|0),($2|0),($35|0))|0);
 $37 = tempRet0;
 $38 = ($21|0)<(0);
 $39 = $38 << 31 >> 31;
 $40 = ($4|0)<(0);
 $41 = $40 << 31 >> 31;
 $42 = (___muldi3(($21|0),($39|0),($4|0),($41|0))|0);
 $43 = tempRet0;
 $44 = ($6|0)<(0);
 $45 = $44 << 31 >> 31;
 $46 = (___muldi3(($6|0),($45|0),($21|0),($39|0))|0);
 $47 = tempRet0;
 $48 = ($8|0)<(0);
 $49 = $48 << 31 >> 31;
 $50 = (___muldi3(($8|0),($49|0),($21|0),($39|0))|0);
 $51 = tempRet0;
 $52 = ($10|0)<(0);
 $53 = $52 << 31 >> 31;
 $54 = (___muldi3(($10|0),($53|0),($21|0),($39|0))|0);
 $55 = tempRet0;
 $56 = ($12|0)<(0);
 $57 = $56 << 31 >> 31;
 $58 = (___muldi3(($12|0),($57|0),($21|0),($39|0))|0);
 $59 = tempRet0;
 $60 = ($14|0)<(0);
 $61 = $60 << 31 >> 31;
 $62 = (___muldi3(($14|0),($61|0),($21|0),($39|0))|0);
 $63 = tempRet0;
 $64 = ($16|0)<(0);
 $65 = $64 << 31 >> 31;
 $66 = (___muldi3(($16|0),($65|0),($21|0),($39|0))|0);
 $67 = tempRet0;
 $68 = ($18|0)<(0);
 $69 = $68 << 31 >> 31;
 $70 = (___muldi3(($18|0),($69|0),($21|0),($39|0))|0);
 $71 = tempRet0;
 $72 = ($20|0)<(0);
 $73 = $72 << 31 >> 31;
 $74 = (___muldi3(($20|0),($73|0),($21|0),($39|0))|0);
 $75 = tempRet0;
 $76 = ($22|0)<(0);
 $77 = $76 << 31 >> 31;
 $78 = (___muldi3(($22|0),($77|0),($4|0),($41|0))|0);
 $79 = tempRet0;
 $80 = (___muldi3(($22|0),($77|0),($6|0),($45|0))|0);
 $81 = tempRet0;
 $82 = ($24|0)<(0);
 $83 = $82 << 31 >> 31;
 $84 = (___muldi3(($24|0),($83|0),($22|0),($77|0))|0);
 $85 = tempRet0;
 $86 = (___muldi3(($10|0),($53|0),($22|0),($77|0))|0);
 $87 = tempRet0;
 $88 = ($26|0)<(0);
 $89 = $88 << 31 >> 31;
 $90 = (___muldi3(($26|0),($89|0),($22|0),($77|0))|0);
 $91 = tempRet0;
 $92 = (___muldi3(($14|0),($61|0),($22|0),($77|0))|0);
 $93 = tempRet0;
 $94 = ($28|0)<(0);
 $95 = $94 << 31 >> 31;
 $96 = (___muldi3(($28|0),($95|0),($22|0),($77|0))|0);
 $97 = tempRet0;
 $98 = (___muldi3(($18|0),($69|0),($22|0),($77|0))|0);
 $99 = tempRet0;
 $100 = ($33|0)<(0);
 $101 = $100 << 31 >> 31;
 $102 = (___muldi3(($33|0),($101|0),($22|0),($77|0))|0);
 $103 = tempRet0;
 $104 = (___muldi3(($6|0),($45|0),($6|0),($45|0))|0);
 $105 = tempRet0;
 $106 = ($23|0)<(0);
 $107 = $106 << 31 >> 31;
 $108 = (___muldi3(($23|0),($107|0),($8|0),($49|0))|0);
 $109 = tempRet0;
 $110 = (___muldi3(($10|0),($53|0),($23|0),($107|0))|0);
 $111 = tempRet0;
 $112 = (___muldi3(($12|0),($57|0),($23|0),($107|0))|0);
 $113 = tempRet0;
 $114 = (___muldi3(($14|0),($61|0),($23|0),($107|0))|0);
 $115 = tempRet0;
 $116 = (___muldi3(($16|0),($65|0),($23|0),($107|0))|0);
 $117 = tempRet0;
 $118 = ($32|0)<(0);
 $119 = $118 << 31 >> 31;
 $120 = (___muldi3(($32|0),($119|0),($23|0),($107|0))|0);
 $121 = tempRet0;
 $122 = (___muldi3(($33|0),($101|0),($6|0),($45|0))|0);
 $123 = tempRet0;
 $124 = (___muldi3(($24|0),($83|0),($8|0),($49|0))|0);
 $125 = tempRet0;
 $126 = (___muldi3(($24|0),($83|0),($10|0),($53|0))|0);
 $127 = tempRet0;
 $128 = (___muldi3(($26|0),($89|0),($24|0),($83|0))|0);
 $129 = tempRet0;
 $130 = (___muldi3(($14|0),($61|0),($24|0),($83|0))|0);
 $131 = tempRet0;
 $132 = ($31|0)<(0);
 $133 = $132 << 31 >> 31;
 $134 = (___muldi3(($31|0),($133|0),($24|0),($83|0))|0);
 $135 = tempRet0;
 $136 = (___muldi3(($32|0),($119|0),($24|0),($83|0))|0);
 $137 = tempRet0;
 $138 = (___muldi3(($33|0),($101|0),($24|0),($83|0))|0);
 $139 = tempRet0;
 $140 = (___muldi3(($10|0),($53|0),($10|0),($53|0))|0);
 $141 = tempRet0;
 $142 = ($25|0)<(0);
 $143 = $142 << 31 >> 31;
 $144 = (___muldi3(($25|0),($143|0),($12|0),($57|0))|0);
 $145 = tempRet0;
 $146 = ($30|0)<(0);
 $147 = $146 << 31 >> 31;
 $148 = (___muldi3(($30|0),($147|0),($25|0),($143|0))|0);
 $149 = tempRet0;
 $150 = (___muldi3(($31|0),($133|0),($10|0),($53|0))|0);
 $151 = tempRet0;
 $152 = (___muldi3(($32|0),($119|0),($25|0),($143|0))|0);
 $153 = tempRet0;
 $154 = (___muldi3(($33|0),($101|0),($10|0),($53|0))|0);
 $155 = tempRet0;
 $156 = ($29|0)<(0);
 $157 = $156 << 31 >> 31;
 $158 = (___muldi3(($29|0),($157|0),($12|0),($57|0))|0);
 $159 = tempRet0;
 $160 = (___muldi3(($30|0),($147|0),($26|0),($89|0))|0);
 $161 = tempRet0;
 $162 = (___muldi3(($31|0),($133|0),($26|0),($89|0))|0);
 $163 = tempRet0;
 $164 = (___muldi3(($32|0),($119|0),($26|0),($89|0))|0);
 $165 = tempRet0;
 $166 = (___muldi3(($33|0),($101|0),($26|0),($89|0))|0);
 $167 = tempRet0;
 $168 = (___muldi3(($30|0),($147|0),($14|0),($61|0))|0);
 $169 = tempRet0;
 $170 = (___muldi3(($31|0),($133|0),($14|0),($61|0))|0);
 $171 = tempRet0;
 $172 = ($27|0)<(0);
 $173 = $172 << 31 >> 31;
 $174 = (___muldi3(($32|0),($119|0),($27|0),($173|0))|0);
 $175 = tempRet0;
 $176 = (___muldi3(($33|0),($101|0),($14|0),($61|0))|0);
 $177 = tempRet0;
 $178 = (___muldi3(($31|0),($133|0),($16|0),($65|0))|0);
 $179 = tempRet0;
 $180 = (___muldi3(($32|0),($119|0),($28|0),($95|0))|0);
 $181 = tempRet0;
 $182 = (___muldi3(($33|0),($101|0),($28|0),($95|0))|0);
 $183 = tempRet0;
 $184 = (___muldi3(($32|0),($119|0),($18|0),($69|0))|0);
 $185 = tempRet0;
 $186 = (___muldi3(($33|0),($101|0),($18|0),($69|0))|0);
 $187 = tempRet0;
 $188 = (___muldi3(($33|0),($101|0),($20|0),($73|0))|0);
 $189 = tempRet0;
 $190 = (_i64Add(($158|0),($159|0),($36|0),($37|0))|0);
 $191 = tempRet0;
 $192 = (_i64Add(($190|0),($191|0),($148|0),($149|0))|0);
 $193 = tempRet0;
 $194 = (_i64Add(($192|0),($193|0),($134|0),($135|0))|0);
 $195 = tempRet0;
 $196 = (_i64Add(($194|0),($195|0),($120|0),($121|0))|0);
 $197 = tempRet0;
 $198 = (_i64Add(($196|0),($197|0),($102|0),($103|0))|0);
 $199 = tempRet0;
 $200 = (_i64Add(($160|0),($161|0),($42|0),($43|0))|0);
 $201 = tempRet0;
 $202 = (_i64Add(($200|0),($201|0),($150|0),($151|0))|0);
 $203 = tempRet0;
 $204 = (_i64Add(($202|0),($203|0),($136|0),($137|0))|0);
 $205 = tempRet0;
 $206 = (_i64Add(($204|0),($205|0),($122|0),($123|0))|0);
 $207 = tempRet0;
 $208 = (_i64Add(($46|0),($47|0),($78|0),($79|0))|0);
 $209 = tempRet0;
 $210 = (_i64Add(($208|0),($209|0),($168|0),($169|0))|0);
 $211 = tempRet0;
 $212 = (_i64Add(($210|0),($211|0),($162|0),($163|0))|0);
 $213 = tempRet0;
 $214 = (_i64Add(($212|0),($213|0),($152|0),($153|0))|0);
 $215 = tempRet0;
 $216 = (_i64Add(($214|0),($215|0),($138|0),($139|0))|0);
 $217 = tempRet0;
 $218 = (_i64Add(($50|0),($51|0),($80|0),($81|0))|0);
 $219 = tempRet0;
 $220 = (_i64Add(($218|0),($219|0),($170|0),($171|0))|0);
 $221 = tempRet0;
 $222 = (_i64Add(($220|0),($221|0),($164|0),($165|0))|0);
 $223 = tempRet0;
 $224 = (_i64Add(($222|0),($223|0),($154|0),($155|0))|0);
 $225 = tempRet0;
 $226 = (_i64Add(($84|0),($85|0),($104|0),($105|0))|0);
 $227 = tempRet0;
 $228 = (_i64Add(($226|0),($227|0),($54|0),($55|0))|0);
 $229 = tempRet0;
 $230 = (_i64Add(($228|0),($229|0),($178|0),($179|0))|0);
 $231 = tempRet0;
 $232 = (_i64Add(($230|0),($231|0),($174|0),($175|0))|0);
 $233 = tempRet0;
 $234 = (_i64Add(($232|0),($233|0),($166|0),($167|0))|0);
 $235 = tempRet0;
 $236 = (_i64Add(($86|0),($87|0),($108|0),($109|0))|0);
 $237 = tempRet0;
 $238 = (_i64Add(($236|0),($237|0),($58|0),($59|0))|0);
 $239 = tempRet0;
 $240 = (_i64Add(($238|0),($239|0),($180|0),($181|0))|0);
 $241 = tempRet0;
 $242 = (_i64Add(($240|0),($241|0),($176|0),($177|0))|0);
 $243 = tempRet0;
 $244 = (_i64Add(($124|0),($125|0),($110|0),($111|0))|0);
 $245 = tempRet0;
 $246 = (_i64Add(($244|0),($245|0),($90|0),($91|0))|0);
 $247 = tempRet0;
 $248 = (_i64Add(($246|0),($247|0),($62|0),($63|0))|0);
 $249 = tempRet0;
 $250 = (_i64Add(($248|0),($249|0),($184|0),($185|0))|0);
 $251 = tempRet0;
 $252 = (_i64Add(($250|0),($251|0),($182|0),($183|0))|0);
 $253 = tempRet0;
 $254 = (_i64Add(($112|0),($113|0),($126|0),($127|0))|0);
 $255 = tempRet0;
 $256 = (_i64Add(($254|0),($255|0),($92|0),($93|0))|0);
 $257 = tempRet0;
 $258 = (_i64Add(($256|0),($257|0),($66|0),($67|0))|0);
 $259 = tempRet0;
 $260 = (_i64Add(($258|0),($259|0),($186|0),($187|0))|0);
 $261 = tempRet0;
 $262 = (_i64Add(($114|0),($115|0),($140|0),($141|0))|0);
 $263 = tempRet0;
 $264 = (_i64Add(($262|0),($263|0),($128|0),($129|0))|0);
 $265 = tempRet0;
 $266 = (_i64Add(($264|0),($265|0),($96|0),($97|0))|0);
 $267 = tempRet0;
 $268 = (_i64Add(($266|0),($267|0),($70|0),($71|0))|0);
 $269 = tempRet0;
 $270 = (_i64Add(($268|0),($269|0),($188|0),($189|0))|0);
 $271 = tempRet0;
 $272 = (_i64Add(($130|0),($131|0),($144|0),($145|0))|0);
 $273 = tempRet0;
 $274 = (_i64Add(($272|0),($273|0),($116|0),($117|0))|0);
 $275 = tempRet0;
 $276 = (_i64Add(($274|0),($275|0),($98|0),($99|0))|0);
 $277 = tempRet0;
 $278 = (_i64Add(($276|0),($277|0),($74|0),($75|0))|0);
 $279 = tempRet0;
 $280 = (_bitshift64Shl(($198|0),($199|0),1)|0);
 $281 = tempRet0;
 $282 = (_bitshift64Shl(($206|0),($207|0),1)|0);
 $283 = tempRet0;
 $284 = (_bitshift64Shl(($216|0),($217|0),1)|0);
 $285 = tempRet0;
 $286 = (_bitshift64Shl(($224|0),($225|0),1)|0);
 $287 = tempRet0;
 $288 = (_bitshift64Shl(($234|0),($235|0),1)|0);
 $289 = tempRet0;
 $290 = (_bitshift64Shl(($242|0),($243|0),1)|0);
 $291 = tempRet0;
 $292 = (_bitshift64Shl(($252|0),($253|0),1)|0);
 $293 = tempRet0;
 $294 = (_bitshift64Shl(($260|0),($261|0),1)|0);
 $295 = tempRet0;
 $296 = (_bitshift64Shl(($270|0),($271|0),1)|0);
 $297 = tempRet0;
 $298 = (_bitshift64Shl(($278|0),($279|0),1)|0);
 $299 = tempRet0;
 $300 = (_i64Add(($280|0),($281|0),33554432,0)|0);
 $301 = tempRet0;
 $302 = (_bitshift64Ashr(($300|0),($301|0),26)|0);
 $303 = tempRet0;
 $304 = (_i64Add(($302|0),($303|0),($282|0),($283|0))|0);
 $305 = tempRet0;
 $306 = $300 & -67108864;
 $307 = (_i64Subtract(($280|0),($281|0),($306|0),($301|0))|0);
 $308 = tempRet0;
 $309 = (_i64Add(($288|0),($289|0),33554432,0)|0);
 $310 = tempRet0;
 $311 = (_bitshift64Ashr(($309|0),($310|0),26)|0);
 $312 = tempRet0;
 $313 = (_i64Add(($311|0),($312|0),($290|0),($291|0))|0);
 $314 = tempRet0;
 $315 = $309 & -67108864;
 $316 = (_i64Subtract(($288|0),($289|0),($315|0),($310|0))|0);
 $317 = tempRet0;
 $318 = (_i64Add(($304|0),($305|0),16777216,0)|0);
 $319 = tempRet0;
 $320 = (_bitshift64Ashr(($318|0),($319|0),25)|0);
 $321 = tempRet0;
 $322 = (_i64Add(($320|0),($321|0),($284|0),($285|0))|0);
 $323 = tempRet0;
 $324 = $318 & -33554432;
 $325 = (_i64Subtract(($304|0),($305|0),($324|0),0)|0);
 $326 = tempRet0;
 $327 = (_i64Add(($313|0),($314|0),16777216,0)|0);
 $328 = tempRet0;
 $329 = (_bitshift64Ashr(($327|0),($328|0),25)|0);
 $330 = tempRet0;
 $331 = (_i64Add(($329|0),($330|0),($292|0),($293|0))|0);
 $332 = tempRet0;
 $333 = $327 & -33554432;
 $334 = (_i64Subtract(($313|0),($314|0),($333|0),0)|0);
 $335 = tempRet0;
 $336 = (_i64Add(($322|0),($323|0),33554432,0)|0);
 $337 = tempRet0;
 $338 = (_bitshift64Ashr(($336|0),($337|0),26)|0);
 $339 = tempRet0;
 $340 = (_i64Add(($338|0),($339|0),($286|0),($287|0))|0);
 $341 = tempRet0;
 $342 = $336 & -67108864;
 $343 = (_i64Subtract(($322|0),($323|0),($342|0),0)|0);
 $344 = tempRet0;
 $345 = (_i64Add(($331|0),($332|0),33554432,0)|0);
 $346 = tempRet0;
 $347 = (_bitshift64Ashr(($345|0),($346|0),26)|0);
 $348 = tempRet0;
 $349 = (_i64Add(($347|0),($348|0),($294|0),($295|0))|0);
 $350 = tempRet0;
 $351 = $345 & -67108864;
 $352 = (_i64Subtract(($331|0),($332|0),($351|0),0)|0);
 $353 = tempRet0;
 $354 = (_i64Add(($340|0),($341|0),16777216,0)|0);
 $355 = tempRet0;
 $356 = (_bitshift64Ashr(($354|0),($355|0),25)|0);
 $357 = tempRet0;
 $358 = (_i64Add(($356|0),($357|0),($316|0),($317|0))|0);
 $359 = tempRet0;
 $360 = $354 & -33554432;
 $361 = (_i64Subtract(($340|0),($341|0),($360|0),0)|0);
 $362 = tempRet0;
 $363 = (_i64Add(($349|0),($350|0),16777216,0)|0);
 $364 = tempRet0;
 $365 = (_bitshift64Ashr(($363|0),($364|0),25)|0);
 $366 = tempRet0;
 $367 = (_i64Add(($365|0),($366|0),($296|0),($297|0))|0);
 $368 = tempRet0;
 $369 = $363 & -33554432;
 $370 = (_i64Subtract(($349|0),($350|0),($369|0),0)|0);
 $371 = tempRet0;
 $372 = (_i64Add(($358|0),($359|0),33554432,0)|0);
 $373 = tempRet0;
 $374 = (_bitshift64Lshr(($372|0),($373|0),26)|0);
 $375 = tempRet0;
 $376 = (_i64Add(($334|0),($335|0),($374|0),($375|0))|0);
 $377 = tempRet0;
 $378 = $372 & -67108864;
 $379 = (_i64Subtract(($358|0),($359|0),($378|0),0)|0);
 $380 = tempRet0;
 $381 = (_i64Add(($367|0),($368|0),33554432,0)|0);
 $382 = tempRet0;
 $383 = (_bitshift64Ashr(($381|0),($382|0),26)|0);
 $384 = tempRet0;
 $385 = (_i64Add(($383|0),($384|0),($298|0),($299|0))|0);
 $386 = tempRet0;
 $387 = $381 & -67108864;
 $388 = (_i64Subtract(($367|0),($368|0),($387|0),0)|0);
 $389 = tempRet0;
 $390 = (_i64Add(($385|0),($386|0),16777216,0)|0);
 $391 = tempRet0;
 $392 = (_bitshift64Ashr(($390|0),($391|0),25)|0);
 $393 = tempRet0;
 $394 = (___muldi3(($392|0),($393|0),19,0)|0);
 $395 = tempRet0;
 $396 = (_i64Add(($394|0),($395|0),($307|0),($308|0))|0);
 $397 = tempRet0;
 $398 = $390 & -33554432;
 $399 = (_i64Subtract(($385|0),($386|0),($398|0),0)|0);
 $400 = tempRet0;
 $401 = (_i64Add(($396|0),($397|0),33554432,0)|0);
 $402 = tempRet0;
 $403 = (_bitshift64Lshr(($401|0),($402|0),26)|0);
 $404 = tempRet0;
 $405 = (_i64Add(($325|0),($326|0),($403|0),($404|0))|0);
 $406 = tempRet0;
 $407 = $401 & -67108864;
 $408 = (_i64Subtract(($396|0),($397|0),($407|0),0)|0);
 $409 = tempRet0;
 HEAP32[$0>>2] = $408;
 $410 = ((($0)) + 4|0);
 HEAP32[$410>>2] = $405;
 $411 = ((($0)) + 8|0);
 HEAP32[$411>>2] = $343;
 $412 = ((($0)) + 12|0);
 HEAP32[$412>>2] = $361;
 $413 = ((($0)) + 16|0);
 HEAP32[$413>>2] = $379;
 $414 = ((($0)) + 20|0);
 HEAP32[$414>>2] = $376;
 $415 = ((($0)) + 24|0);
 HEAP32[$415>>2] = $352;
 $416 = ((($0)) + 28|0);
 HEAP32[$416>>2] = $370;
 $417 = ((($0)) + 32|0);
 HEAP32[$417>>2] = $388;
 $418 = ((($0)) + 36|0);
 HEAP32[$418>>2] = $399;
 return;
}
function _crypto_sign_ed25519_ref10_fe_sub($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0;
 var $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0;
 var $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = HEAP32[$1>>2]|0;
 $4 = ((($1)) + 4|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = ((($1)) + 8|0);
 $7 = HEAP32[$6>>2]|0;
 $8 = ((($1)) + 12|0);
 $9 = HEAP32[$8>>2]|0;
 $10 = ((($1)) + 16|0);
 $11 = HEAP32[$10>>2]|0;
 $12 = ((($1)) + 20|0);
 $13 = HEAP32[$12>>2]|0;
 $14 = ((($1)) + 24|0);
 $15 = HEAP32[$14>>2]|0;
 $16 = ((($1)) + 28|0);
 $17 = HEAP32[$16>>2]|0;
 $18 = ((($1)) + 32|0);
 $19 = HEAP32[$18>>2]|0;
 $20 = ((($1)) + 36|0);
 $21 = HEAP32[$20>>2]|0;
 $22 = HEAP32[$2>>2]|0;
 $23 = ((($2)) + 4|0);
 $24 = HEAP32[$23>>2]|0;
 $25 = ((($2)) + 8|0);
 $26 = HEAP32[$25>>2]|0;
 $27 = ((($2)) + 12|0);
 $28 = HEAP32[$27>>2]|0;
 $29 = ((($2)) + 16|0);
 $30 = HEAP32[$29>>2]|0;
 $31 = ((($2)) + 20|0);
 $32 = HEAP32[$31>>2]|0;
 $33 = ((($2)) + 24|0);
 $34 = HEAP32[$33>>2]|0;
 $35 = ((($2)) + 28|0);
 $36 = HEAP32[$35>>2]|0;
 $37 = ((($2)) + 32|0);
 $38 = HEAP32[$37>>2]|0;
 $39 = ((($2)) + 36|0);
 $40 = HEAP32[$39>>2]|0;
 $41 = (($3) - ($22))|0;
 $42 = (($5) - ($24))|0;
 $43 = (($7) - ($26))|0;
 $44 = (($9) - ($28))|0;
 $45 = (($11) - ($30))|0;
 $46 = (($13) - ($32))|0;
 $47 = (($15) - ($34))|0;
 $48 = (($17) - ($36))|0;
 $49 = (($19) - ($38))|0;
 $50 = (($21) - ($40))|0;
 HEAP32[$0>>2] = $41;
 $51 = ((($0)) + 4|0);
 HEAP32[$51>>2] = $42;
 $52 = ((($0)) + 8|0);
 HEAP32[$52>>2] = $43;
 $53 = ((($0)) + 12|0);
 HEAP32[$53>>2] = $44;
 $54 = ((($0)) + 16|0);
 HEAP32[$54>>2] = $45;
 $55 = ((($0)) + 20|0);
 HEAP32[$55>>2] = $46;
 $56 = ((($0)) + 24|0);
 HEAP32[$56>>2] = $47;
 $57 = ((($0)) + 28|0);
 HEAP32[$57>>2] = $48;
 $58 = ((($0)) + 32|0);
 HEAP32[$58>>2] = $49;
 $59 = ((($0)) + 36|0);
 HEAP32[$59>>2] = $50;
 return;
}
function _crypto_sign_ed25519_ref10_fe_tobytes($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0;
 var $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0;
 var $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0;
 var $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0;
 var $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0;
 var $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0;
 var $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 $2 = HEAP32[$1>>2]|0;
 $3 = ((($1)) + 4|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = ((($1)) + 8|0);
 $6 = HEAP32[$5>>2]|0;
 $7 = ((($1)) + 12|0);
 $8 = HEAP32[$7>>2]|0;
 $9 = ((($1)) + 16|0);
 $10 = HEAP32[$9>>2]|0;
 $11 = ((($1)) + 20|0);
 $12 = HEAP32[$11>>2]|0;
 $13 = ((($1)) + 24|0);
 $14 = HEAP32[$13>>2]|0;
 $15 = ((($1)) + 28|0);
 $16 = HEAP32[$15>>2]|0;
 $17 = ((($1)) + 32|0);
 $18 = HEAP32[$17>>2]|0;
 $19 = ((($1)) + 36|0);
 $20 = HEAP32[$19>>2]|0;
 $21 = ($20*19)|0;
 $22 = (($21) + 16777216)|0;
 $23 = $22 >> 25;
 $24 = (($23) + ($2))|0;
 $25 = $24 >> 26;
 $26 = (($25) + ($4))|0;
 $27 = $26 >> 25;
 $28 = (($27) + ($6))|0;
 $29 = $28 >> 26;
 $30 = (($29) + ($8))|0;
 $31 = $30 >> 25;
 $32 = (($31) + ($10))|0;
 $33 = $32 >> 26;
 $34 = (($33) + ($12))|0;
 $35 = $34 >> 25;
 $36 = (($35) + ($14))|0;
 $37 = $36 >> 26;
 $38 = (($37) + ($16))|0;
 $39 = $38 >> 25;
 $40 = (($39) + ($18))|0;
 $41 = $40 >> 26;
 $42 = (($41) + ($20))|0;
 $43 = $42 >> 25;
 $44 = ($43*19)|0;
 $45 = (($44) + ($2))|0;
 $46 = $45 >> 26;
 $47 = (($46) + ($4))|0;
 $48 = $47 >> 25;
 $49 = (($48) + ($6))|0;
 $50 = $47 & 33554431;
 $51 = $49 >> 26;
 $52 = (($51) + ($8))|0;
 $53 = $49 & 67108863;
 $54 = $52 >> 25;
 $55 = (($54) + ($10))|0;
 $56 = $52 & 33554431;
 $57 = $55 >> 26;
 $58 = (($57) + ($12))|0;
 $59 = $58 >> 25;
 $60 = (($59) + ($14))|0;
 $61 = $60 >> 26;
 $62 = (($61) + ($16))|0;
 $63 = $60 & 67108863;
 $64 = $62 >> 25;
 $65 = (($64) + ($18))|0;
 $66 = $62 & 33554431;
 $67 = $65 >> 26;
 $68 = (($67) + ($20))|0;
 $69 = $65 & 67108863;
 $70 = $68 & 33554431;
 $71 = $45&255;
 HEAP8[$0>>0] = $71;
 $72 = $45 >>> 8;
 $73 = $72&255;
 $74 = ((($0)) + 1|0);
 HEAP8[$74>>0] = $73;
 $75 = $45 >>> 16;
 $76 = $75&255;
 $77 = ((($0)) + 2|0);
 HEAP8[$77>>0] = $76;
 $78 = $45 >>> 24;
 $79 = $78 & 3;
 $80 = $50 << 2;
 $81 = $80 | $79;
 $82 = $81&255;
 $83 = ((($0)) + 3|0);
 HEAP8[$83>>0] = $82;
 $84 = $47 >>> 6;
 $85 = $84&255;
 $86 = ((($0)) + 4|0);
 HEAP8[$86>>0] = $85;
 $87 = $47 >>> 14;
 $88 = $87&255;
 $89 = ((($0)) + 5|0);
 HEAP8[$89>>0] = $88;
 $90 = $50 >>> 22;
 $91 = $53 << 3;
 $92 = $91 | $90;
 $93 = $92&255;
 $94 = ((($0)) + 6|0);
 HEAP8[$94>>0] = $93;
 $95 = $49 >>> 5;
 $96 = $95&255;
 $97 = ((($0)) + 7|0);
 HEAP8[$97>>0] = $96;
 $98 = $49 >>> 13;
 $99 = $98&255;
 $100 = ((($0)) + 8|0);
 HEAP8[$100>>0] = $99;
 $101 = $53 >>> 21;
 $102 = $56 << 5;
 $103 = $102 | $101;
 $104 = $103&255;
 $105 = ((($0)) + 9|0);
 HEAP8[$105>>0] = $104;
 $106 = $52 >>> 3;
 $107 = $106&255;
 $108 = ((($0)) + 10|0);
 HEAP8[$108>>0] = $107;
 $109 = $52 >>> 11;
 $110 = $109&255;
 $111 = ((($0)) + 11|0);
 HEAP8[$111>>0] = $110;
 $112 = $56 >>> 19;
 $113 = $55 << 6;
 $114 = $113 | $112;
 $115 = $114&255;
 $116 = ((($0)) + 12|0);
 HEAP8[$116>>0] = $115;
 $117 = $55 >>> 2;
 $118 = $117&255;
 $119 = ((($0)) + 13|0);
 HEAP8[$119>>0] = $118;
 $120 = $55 >>> 10;
 $121 = $120&255;
 $122 = ((($0)) + 14|0);
 HEAP8[$122>>0] = $121;
 $123 = $55 >>> 18;
 $124 = $123&255;
 $125 = ((($0)) + 15|0);
 HEAP8[$125>>0] = $124;
 $126 = $58&255;
 $127 = ((($0)) + 16|0);
 HEAP8[$127>>0] = $126;
 $128 = $58 >>> 8;
 $129 = $128&255;
 $130 = ((($0)) + 17|0);
 HEAP8[$130>>0] = $129;
 $131 = $58 >>> 16;
 $132 = $131&255;
 $133 = ((($0)) + 18|0);
 HEAP8[$133>>0] = $132;
 $134 = $58 >>> 24;
 $135 = $134 & 1;
 $136 = $63 << 1;
 $137 = $136 | $135;
 $138 = $137&255;
 $139 = ((($0)) + 19|0);
 HEAP8[$139>>0] = $138;
 $140 = $60 >>> 7;
 $141 = $140&255;
 $142 = ((($0)) + 20|0);
 HEAP8[$142>>0] = $141;
 $143 = $60 >>> 15;
 $144 = $143&255;
 $145 = ((($0)) + 21|0);
 HEAP8[$145>>0] = $144;
 $146 = $63 >>> 23;
 $147 = $66 << 3;
 $148 = $147 | $146;
 $149 = $148&255;
 $150 = ((($0)) + 22|0);
 HEAP8[$150>>0] = $149;
 $151 = $62 >>> 5;
 $152 = $151&255;
 $153 = ((($0)) + 23|0);
 HEAP8[$153>>0] = $152;
 $154 = $62 >>> 13;
 $155 = $154&255;
 $156 = ((($0)) + 24|0);
 HEAP8[$156>>0] = $155;
 $157 = $66 >>> 21;
 $158 = $69 << 4;
 $159 = $158 | $157;
 $160 = $159&255;
 $161 = ((($0)) + 25|0);
 HEAP8[$161>>0] = $160;
 $162 = $65 >>> 4;
 $163 = $162&255;
 $164 = ((($0)) + 26|0);
 HEAP8[$164>>0] = $163;
 $165 = $65 >>> 12;
 $166 = $165&255;
 $167 = ((($0)) + 27|0);
 HEAP8[$167>>0] = $166;
 $168 = $69 >>> 20;
 $169 = $70 << 6;
 $170 = $169 | $168;
 $171 = $170&255;
 $172 = ((($0)) + 28|0);
 HEAP8[$172>>0] = $171;
 $173 = $68 >>> 2;
 $174 = $173&255;
 $175 = ((($0)) + 29|0);
 HEAP8[$175>>0] = $174;
 $176 = $68 >>> 10;
 $177 = $176&255;
 $178 = ((($0)) + 30|0);
 HEAP8[$178>>0] = $177;
 $179 = $70 >>> 18;
 $180 = $179&255;
 $181 = ((($0)) + 31|0);
 HEAP8[$181>>0] = $180;
 return;
}
function _crypto_sign_ed25519_ref10_ge_add($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0, $12 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(48|0);
 $3 = sp;
 $4 = ((($1)) + 40|0);
 _crypto_sign_ed25519_ref10_fe_add($0,$4,$1);
 $5 = ((($0)) + 40|0);
 _crypto_sign_ed25519_ref10_fe_sub($5,$4,$1);
 $6 = ((($0)) + 80|0);
 _crypto_sign_ed25519_ref10_fe_mul($6,$0,$2);
 $7 = ((($2)) + 40|0);
 _crypto_sign_ed25519_ref10_fe_mul($5,$5,$7);
 $8 = ((($0)) + 120|0);
 $9 = ((($2)) + 120|0);
 $10 = ((($1)) + 120|0);
 _crypto_sign_ed25519_ref10_fe_mul($8,$9,$10);
 $11 = ((($1)) + 80|0);
 $12 = ((($2)) + 80|0);
 _crypto_sign_ed25519_ref10_fe_mul($0,$11,$12);
 _crypto_sign_ed25519_ref10_fe_add($3,$0,$0);
 _crypto_sign_ed25519_ref10_fe_sub($0,$6,$5);
 _crypto_sign_ed25519_ref10_fe_add($5,$6,$5);
 _crypto_sign_ed25519_ref10_fe_add($6,$3,$8);
 _crypto_sign_ed25519_ref10_fe_sub($8,$3,$8);
 STACKTOP = sp;return;
}
function _crypto_sign_ed25519_ref10_ge_double_scalarmult_vartime($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $$022 = 0, $$121 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0;
 var $28 = 0, $29 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0;
 var $47 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 2272|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(2272|0);
 $4 = sp + 2016|0;
 $5 = sp + 1760|0;
 $6 = sp + 480|0;
 $7 = sp + 320|0;
 $8 = sp + 160|0;
 $9 = sp;
 _slide($4,$1);
 _slide($5,$3);
 _crypto_sign_ed25519_ref10_ge_p3_to_cached($6,$2);
 _crypto_sign_ed25519_ref10_ge_p3_dbl($7,$2);
 _crypto_sign_ed25519_ref10_ge_p1p1_to_p3($9,$7);
 _crypto_sign_ed25519_ref10_ge_add($7,$9,$6);
 _crypto_sign_ed25519_ref10_ge_p1p1_to_p3($8,$7);
 $10 = ((($6)) + 160|0);
 _crypto_sign_ed25519_ref10_ge_p3_to_cached($10,$8);
 _crypto_sign_ed25519_ref10_ge_add($7,$9,$10);
 _crypto_sign_ed25519_ref10_ge_p1p1_to_p3($8,$7);
 $11 = ((($6)) + 320|0);
 _crypto_sign_ed25519_ref10_ge_p3_to_cached($11,$8);
 _crypto_sign_ed25519_ref10_ge_add($7,$9,$11);
 _crypto_sign_ed25519_ref10_ge_p1p1_to_p3($8,$7);
 $12 = ((($6)) + 480|0);
 _crypto_sign_ed25519_ref10_ge_p3_to_cached($12,$8);
 _crypto_sign_ed25519_ref10_ge_add($7,$9,$12);
 _crypto_sign_ed25519_ref10_ge_p1p1_to_p3($8,$7);
 $13 = ((($6)) + 640|0);
 _crypto_sign_ed25519_ref10_ge_p3_to_cached($13,$8);
 _crypto_sign_ed25519_ref10_ge_add($7,$9,$13);
 _crypto_sign_ed25519_ref10_ge_p1p1_to_p3($8,$7);
 $14 = ((($6)) + 800|0);
 _crypto_sign_ed25519_ref10_ge_p3_to_cached($14,$8);
 _crypto_sign_ed25519_ref10_ge_add($7,$9,$14);
 _crypto_sign_ed25519_ref10_ge_p1p1_to_p3($8,$7);
 $15 = ((($6)) + 960|0);
 _crypto_sign_ed25519_ref10_ge_p3_to_cached($15,$8);
 _crypto_sign_ed25519_ref10_ge_add($7,$9,$15);
 _crypto_sign_ed25519_ref10_ge_p1p1_to_p3($8,$7);
 $16 = ((($6)) + 1120|0);
 _crypto_sign_ed25519_ref10_ge_p3_to_cached($16,$8);
 _crypto_sign_ed25519_ref10_ge_p2_0($0);
 $$022 = 255;
 while(1) {
  $17 = (($4) + ($$022)|0);
  $18 = HEAP8[$17>>0]|0;
  $19 = ($18<<24>>24)==(0);
  if (!($19)) {
   break;
  }
  $20 = (($5) + ($$022)|0);
  $21 = HEAP8[$20>>0]|0;
  $22 = ($21<<24>>24)==(0);
  if (!($22)) {
   break;
  }
  $23 = (($$022) + -1)|0;
  $24 = ($$022|0)==(0);
  if ($24) {
   label = 16;
   break;
  } else {
   $$022 = $23;
  }
 }
 if ((label|0) == 16) {
  STACKTOP = sp;return;
 }
 $25 = ($$022|0)>(-1);
 if (!($25)) {
  STACKTOP = sp;return;
 }
 $$121 = $$022;
 while(1) {
  _crypto_sign_ed25519_ref10_ge_p2_dbl($7,$0);
  $26 = (($4) + ($$121)|0);
  $27 = HEAP8[$26>>0]|0;
  $28 = ($27<<24>>24)>(0);
  if ($28) {
   _crypto_sign_ed25519_ref10_ge_p1p1_to_p3($8,$7);
   $29 = ($27&255) >>> 1;
   $30 = $29&255;
   $31 = (($6) + (($30*160)|0)|0);
   _crypto_sign_ed25519_ref10_ge_add($7,$8,$31);
  } else {
   $32 = ($27<<24>>24)<(0);
   if ($32) {
    _crypto_sign_ed25519_ref10_ge_p1p1_to_p3($8,$7);
    $33 = (($27<<24>>24) / -2)&-1;
    $34 = $33 << 24 >> 24;
    $35 = (($6) + (($34*160)|0)|0);
    _crypto_sign_ed25519_ref10_ge_sub($7,$8,$35);
   }
  }
  $36 = (($5) + ($$121)|0);
  $37 = HEAP8[$36>>0]|0;
  $38 = ($37<<24>>24)>(0);
  if ($38) {
   _crypto_sign_ed25519_ref10_ge_p1p1_to_p3($8,$7);
   $39 = ($37&255) >>> 1;
   $40 = $39&255;
   $41 = (200 + (($40*120)|0)|0);
   _crypto_sign_ed25519_ref10_ge_madd($7,$8,$41);
  } else {
   $42 = ($37<<24>>24)<(0);
   if ($42) {
    _crypto_sign_ed25519_ref10_ge_p1p1_to_p3($8,$7);
    $43 = (($37<<24>>24) / -2)&-1;
    $44 = $43 << 24 >> 24;
    $45 = (200 + (($44*120)|0)|0);
    _crypto_sign_ed25519_ref10_ge_msub($7,$8,$45);
   }
  }
  _crypto_sign_ed25519_ref10_ge_p1p1_to_p2($0,$7);
  $46 = (($$121) + -1)|0;
  $47 = ($$121|0)>(0);
  if ($47) {
   $$121 = $46;
  } else {
   break;
  }
 }
 STACKTOP = sp;return;
}
function _slide($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$05662 = 0, $$057 = 0, $$057$1 = 0, $$057$2 = 0, $$057$3 = 0, $$057$4 = 0, $$057$5 = 0, $$159 = 0, $$pre = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0;
 var $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0;
 var $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0;
 var $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0;
 var $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0;
 var $exitcond = 0, $exitcond64 = 0, $or$cond = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $$05662 = 0;
 while(1) {
  $2 = $$05662 >>> 3;
  $3 = (($1) + ($2)|0);
  $4 = HEAP8[$3>>0]|0;
  $5 = $4&255;
  $6 = $$05662 & 7;
  $7 = $5 >>> $6;
  $8 = $7 & 1;
  $9 = $8&255;
  $10 = (($0) + ($$05662)|0);
  HEAP8[$10>>0] = $9;
  $11 = (($$05662) + 1)|0;
  $exitcond64 = ($11|0)==(256);
  if ($exitcond64) {
   break;
  } else {
   $$05662 = $11;
  }
 }
 $$159 = 0;
 while(1) {
  $12 = (($0) + ($$159)|0);
  $13 = HEAP8[$12>>0]|0;
  $14 = ($13<<24>>24)!=(0);
  $$pre = (($$159) + 1)|0;
  $15 = ($$pre>>>0)<(256);
  $or$cond = $14 & $15;
  L6: do {
   if ($or$cond) {
    $16 = (($0) + ($$pre)|0);
    $17 = HEAP8[$16>>0]|0;
    $18 = ($17<<24>>24)==(0);
    L8: do {
     if (!($18)) {
      $19 = $13 << 24 >> 24;
      $20 = $17 << 24 >> 24;
      $21 = $20 << 1;
      $22 = (($21) + ($19))|0;
      $23 = ($22|0)<(16);
      if ($23) {
       $24 = $22&255;
       HEAP8[$12>>0] = $24;
       HEAP8[$16>>0] = 0;
       break;
      }
      $25 = (($19) - ($21))|0;
      $26 = ($25|0)>(-16);
      if (!($26)) {
       break L6;
      }
      $27 = $25&255;
      HEAP8[$12>>0] = $27;
      $$057 = $$pre;
      while(1) {
       $28 = (($0) + ($$057)|0);
       $29 = HEAP8[$28>>0]|0;
       $30 = ($29<<24>>24)==(0);
       if ($30) {
        break;
       }
       HEAP8[$28>>0] = 0;
       $31 = (($$057) + 1)|0;
       $32 = ($$057>>>0)<(255);
       if ($32) {
        $$057 = $31;
       } else {
        break L8;
       }
      }
      HEAP8[$28>>0] = 1;
     }
    } while(0);
    $33 = (($$159) + 2)|0;
    $34 = ($33>>>0)<(256);
    if ($34) {
     $35 = (($0) + ($33)|0);
     $36 = HEAP8[$35>>0]|0;
     $37 = ($36<<24>>24)==(0);
     L20: do {
      if (!($37)) {
       $38 = HEAP8[$12>>0]|0;
       $39 = $38 << 24 >> 24;
       $40 = $36 << 24 >> 24;
       $41 = $40 << 2;
       $42 = (($41) + ($39))|0;
       $43 = ($42|0)<(16);
       if ($43) {
        $52 = $42&255;
        HEAP8[$12>>0] = $52;
        HEAP8[$35>>0] = 0;
        break;
       }
       $44 = (($39) - ($41))|0;
       $45 = ($44|0)>(-16);
       if (!($45)) {
        break L6;
       }
       $46 = $44&255;
       HEAP8[$12>>0] = $46;
       $$057$1 = $33;
       while(1) {
        $47 = (($0) + ($$057$1)|0);
        $48 = HEAP8[$47>>0]|0;
        $49 = ($48<<24>>24)==(0);
        if ($49) {
         break;
        }
        HEAP8[$47>>0] = 0;
        $50 = (($$057$1) + 1)|0;
        $51 = ($$057$1>>>0)<(255);
        if ($51) {
         $$057$1 = $50;
        } else {
         break L20;
        }
       }
       HEAP8[$47>>0] = 1;
      }
     } while(0);
     $53 = (($$159) + 3)|0;
     $54 = ($53>>>0)<(256);
     if ($54) {
      $55 = (($0) + ($53)|0);
      $56 = HEAP8[$55>>0]|0;
      $57 = ($56<<24>>24)==(0);
      L32: do {
       if (!($57)) {
        $58 = HEAP8[$12>>0]|0;
        $59 = $58 << 24 >> 24;
        $60 = $56 << 24 >> 24;
        $61 = $60 << 3;
        $62 = (($61) + ($59))|0;
        $63 = ($62|0)<(16);
        if ($63) {
         $72 = $62&255;
         HEAP8[$12>>0] = $72;
         HEAP8[$55>>0] = 0;
         break;
        }
        $64 = (($59) - ($61))|0;
        $65 = ($64|0)>(-16);
        if (!($65)) {
         break L6;
        }
        $66 = $64&255;
        HEAP8[$12>>0] = $66;
        $$057$2 = $53;
        while(1) {
         $67 = (($0) + ($$057$2)|0);
         $68 = HEAP8[$67>>0]|0;
         $69 = ($68<<24>>24)==(0);
         if ($69) {
          break;
         }
         HEAP8[$67>>0] = 0;
         $70 = (($$057$2) + 1)|0;
         $71 = ($$057$2>>>0)<(255);
         if ($71) {
          $$057$2 = $70;
         } else {
          break L32;
         }
        }
        HEAP8[$67>>0] = 1;
       }
      } while(0);
      $73 = (($$159) + 4)|0;
      $74 = ($73>>>0)<(256);
      if ($74) {
       $75 = (($0) + ($73)|0);
       $76 = HEAP8[$75>>0]|0;
       $77 = ($76<<24>>24)==(0);
       L44: do {
        if (!($77)) {
         $78 = HEAP8[$12>>0]|0;
         $79 = $78 << 24 >> 24;
         $80 = $76 << 24 >> 24;
         $81 = $80 << 4;
         $82 = (($81) + ($79))|0;
         $83 = ($82|0)<(16);
         if ($83) {
          $92 = $82&255;
          HEAP8[$12>>0] = $92;
          HEAP8[$75>>0] = 0;
          break;
         }
         $84 = (($79) - ($81))|0;
         $85 = ($84|0)>(-16);
         if (!($85)) {
          break L6;
         }
         $86 = $84&255;
         HEAP8[$12>>0] = $86;
         $$057$3 = $73;
         while(1) {
          $87 = (($0) + ($$057$3)|0);
          $88 = HEAP8[$87>>0]|0;
          $89 = ($88<<24>>24)==(0);
          if ($89) {
           break;
          }
          HEAP8[$87>>0] = 0;
          $90 = (($$057$3) + 1)|0;
          $91 = ($$057$3>>>0)<(255);
          if ($91) {
           $$057$3 = $90;
          } else {
           break L44;
          }
         }
         HEAP8[$87>>0] = 1;
        }
       } while(0);
       $93 = (($$159) + 5)|0;
       $94 = ($93>>>0)<(256);
       if ($94) {
        $95 = (($0) + ($93)|0);
        $96 = HEAP8[$95>>0]|0;
        $97 = ($96<<24>>24)==(0);
        L56: do {
         if (!($97)) {
          $98 = HEAP8[$12>>0]|0;
          $99 = $98 << 24 >> 24;
          $100 = $96 << 24 >> 24;
          $101 = $100 << 5;
          $102 = (($101) + ($99))|0;
          $103 = ($102|0)<(16);
          if ($103) {
           $112 = $102&255;
           HEAP8[$12>>0] = $112;
           HEAP8[$95>>0] = 0;
           break;
          }
          $104 = (($99) - ($101))|0;
          $105 = ($104|0)>(-16);
          if (!($105)) {
           break L6;
          }
          $106 = $104&255;
          HEAP8[$12>>0] = $106;
          $$057$4 = $93;
          while(1) {
           $107 = (($0) + ($$057$4)|0);
           $108 = HEAP8[$107>>0]|0;
           $109 = ($108<<24>>24)==(0);
           if ($109) {
            break;
           }
           HEAP8[$107>>0] = 0;
           $110 = (($$057$4) + 1)|0;
           $111 = ($$057$4>>>0)<(255);
           if ($111) {
            $$057$4 = $110;
           } else {
            break L56;
           }
          }
          HEAP8[$107>>0] = 1;
         }
        } while(0);
        $113 = (($$159) + 6)|0;
        $114 = ($113>>>0)<(256);
        if ($114) {
         $115 = (($0) + ($113)|0);
         $116 = HEAP8[$115>>0]|0;
         $117 = ($116<<24>>24)==(0);
         if (!($117)) {
          $118 = HEAP8[$12>>0]|0;
          $119 = $118 << 24 >> 24;
          $120 = $116 << 24 >> 24;
          $121 = $120 << 6;
          $122 = (($121) + ($119))|0;
          $123 = ($122|0)<(16);
          if ($123) {
           $132 = $122&255;
           HEAP8[$12>>0] = $132;
           HEAP8[$115>>0] = 0;
           break;
          }
          $124 = (($119) - ($121))|0;
          $125 = ($124|0)>(-16);
          if ($125) {
           $126 = $124&255;
           HEAP8[$12>>0] = $126;
           $$057$5 = $113;
           while(1) {
            $127 = (($0) + ($$057$5)|0);
            $128 = HEAP8[$127>>0]|0;
            $129 = ($128<<24>>24)==(0);
            if ($129) {
             break;
            }
            HEAP8[$127>>0] = 0;
            $130 = (($$057$5) + 1)|0;
            $131 = ($$057$5>>>0)<(255);
            if ($131) {
             $$057$5 = $130;
            } else {
             break L6;
            }
           }
           HEAP8[$127>>0] = 1;
          }
         }
        }
       }
      }
     }
    }
   }
  } while(0);
  $exitcond = ($$pre|0)==(256);
  if ($exitcond) {
   break;
  } else {
   $$159 = $$pre;
  }
 }
 return;
}
function _crypto_sign_ed25519_ref10_ge_frombytes_negate_vartime($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$0 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 208|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(208|0);
 $2 = sp + 160|0;
 $3 = sp + 120|0;
 $4 = sp + 80|0;
 $5 = sp + 40|0;
 $6 = sp;
 $7 = ((($0)) + 40|0);
 _crypto_sign_ed25519_ref10_fe_frombytes($7,$1);
 $8 = ((($0)) + 80|0);
 _crypto_sign_ed25519_ref10_fe_1($8);
 _crypto_sign_ed25519_ref10_fe_sq($2,$7);
 _crypto_sign_ed25519_ref10_fe_mul($3,$2,1160);
 _crypto_sign_ed25519_ref10_fe_sub($2,$2,$8);
 _crypto_sign_ed25519_ref10_fe_add($3,$3,$8);
 _crypto_sign_ed25519_ref10_fe_sq($4,$3);
 _crypto_sign_ed25519_ref10_fe_mul($4,$4,$3);
 _crypto_sign_ed25519_ref10_fe_sq($0,$4);
 _crypto_sign_ed25519_ref10_fe_mul($0,$0,$3);
 _crypto_sign_ed25519_ref10_fe_mul($0,$0,$2);
 _crypto_sign_ed25519_ref10_fe_pow22523($0,$0);
 _crypto_sign_ed25519_ref10_fe_mul($0,$0,$4);
 _crypto_sign_ed25519_ref10_fe_mul($0,$0,$2);
 _crypto_sign_ed25519_ref10_fe_sq($5,$0);
 _crypto_sign_ed25519_ref10_fe_mul($5,$5,$3);
 _crypto_sign_ed25519_ref10_fe_sub($6,$5,$2);
 $9 = (_crypto_sign_ed25519_ref10_fe_isnonzero($6)|0);
 $10 = ($9|0)==(0);
 do {
  if (!($10)) {
   _crypto_sign_ed25519_ref10_fe_add($6,$5,$2);
   $11 = (_crypto_sign_ed25519_ref10_fe_isnonzero($6)|0);
   $12 = ($11|0)==(0);
   if ($12) {
    _crypto_sign_ed25519_ref10_fe_mul($0,$0,1200);
    break;
   } else {
    $$0 = -1;
    STACKTOP = sp;return ($$0|0);
   }
  }
 } while(0);
 $13 = (_crypto_sign_ed25519_ref10_fe_isnegative($0)|0);
 $14 = ((($1)) + 31|0);
 $15 = HEAP8[$14>>0]|0;
 $16 = $15&255;
 $17 = $16 >>> 7;
 $18 = ($13|0)==($17|0);
 if ($18) {
  _crypto_sign_ed25519_ref10_fe_neg($0,$0);
 }
 $19 = ((($0)) + 120|0);
 _crypto_sign_ed25519_ref10_fe_mul($19,$0,$7);
 $$0 = 0;
 STACKTOP = sp;return ($$0|0);
}
function _crypto_sign_ed25519_ref10_ge_madd($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(48|0);
 $3 = sp;
 $4 = ((($1)) + 40|0);
 _crypto_sign_ed25519_ref10_fe_add($0,$4,$1);
 $5 = ((($0)) + 40|0);
 _crypto_sign_ed25519_ref10_fe_sub($5,$4,$1);
 $6 = ((($0)) + 80|0);
 _crypto_sign_ed25519_ref10_fe_mul($6,$0,$2);
 $7 = ((($2)) + 40|0);
 _crypto_sign_ed25519_ref10_fe_mul($5,$5,$7);
 $8 = ((($0)) + 120|0);
 $9 = ((($2)) + 80|0);
 $10 = ((($1)) + 120|0);
 _crypto_sign_ed25519_ref10_fe_mul($8,$9,$10);
 $11 = ((($1)) + 80|0);
 _crypto_sign_ed25519_ref10_fe_add($3,$11,$11);
 _crypto_sign_ed25519_ref10_fe_sub($0,$6,$5);
 _crypto_sign_ed25519_ref10_fe_add($5,$6,$5);
 _crypto_sign_ed25519_ref10_fe_add($6,$3,$8);
 _crypto_sign_ed25519_ref10_fe_sub($8,$3,$8);
 STACKTOP = sp;return;
}
function _crypto_sign_ed25519_ref10_ge_msub($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(48|0);
 $3 = sp;
 $4 = ((($1)) + 40|0);
 _crypto_sign_ed25519_ref10_fe_add($0,$4,$1);
 $5 = ((($0)) + 40|0);
 _crypto_sign_ed25519_ref10_fe_sub($5,$4,$1);
 $6 = ((($0)) + 80|0);
 $7 = ((($2)) + 40|0);
 _crypto_sign_ed25519_ref10_fe_mul($6,$0,$7);
 _crypto_sign_ed25519_ref10_fe_mul($5,$5,$2);
 $8 = ((($0)) + 120|0);
 $9 = ((($2)) + 80|0);
 $10 = ((($1)) + 120|0);
 _crypto_sign_ed25519_ref10_fe_mul($8,$9,$10);
 $11 = ((($1)) + 80|0);
 _crypto_sign_ed25519_ref10_fe_add($3,$11,$11);
 _crypto_sign_ed25519_ref10_fe_sub($0,$6,$5);
 _crypto_sign_ed25519_ref10_fe_add($5,$6,$5);
 _crypto_sign_ed25519_ref10_fe_sub($6,$3,$8);
 _crypto_sign_ed25519_ref10_fe_add($8,$3,$8);
 STACKTOP = sp;return;
}
function _crypto_sign_ed25519_ref10_ge_p1p1_to_p2($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = ((($1)) + 120|0);
 _crypto_sign_ed25519_ref10_fe_mul($0,$1,$2);
 $3 = ((($0)) + 40|0);
 $4 = ((($1)) + 40|0);
 $5 = ((($1)) + 80|0);
 _crypto_sign_ed25519_ref10_fe_mul($3,$4,$5);
 $6 = ((($0)) + 80|0);
 _crypto_sign_ed25519_ref10_fe_mul($6,$5,$2);
 return;
}
function _crypto_sign_ed25519_ref10_ge_p1p1_to_p3($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = ((($1)) + 120|0);
 _crypto_sign_ed25519_ref10_fe_mul($0,$1,$2);
 $3 = ((($0)) + 40|0);
 $4 = ((($1)) + 40|0);
 $5 = ((($1)) + 80|0);
 _crypto_sign_ed25519_ref10_fe_mul($3,$4,$5);
 $6 = ((($0)) + 80|0);
 _crypto_sign_ed25519_ref10_fe_mul($6,$5,$2);
 $7 = ((($0)) + 120|0);
 _crypto_sign_ed25519_ref10_fe_mul($7,$1,$4);
 return;
}
function _crypto_sign_ed25519_ref10_ge_p2_0($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 _crypto_sign_ed25519_ref10_fe_0($0);
 $1 = ((($0)) + 40|0);
 _crypto_sign_ed25519_ref10_fe_1($1);
 $2 = ((($0)) + 80|0);
 _crypto_sign_ed25519_ref10_fe_1($2);
 return;
}
function _crypto_sign_ed25519_ref10_ge_p2_dbl($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(48|0);
 $2 = sp;
 _crypto_sign_ed25519_ref10_fe_sq($0,$1);
 $3 = ((($0)) + 80|0);
 $4 = ((($1)) + 40|0);
 _crypto_sign_ed25519_ref10_fe_sq($3,$4);
 $5 = ((($0)) + 120|0);
 $6 = ((($1)) + 80|0);
 _crypto_sign_ed25519_ref10_fe_sq2($5,$6);
 $7 = ((($0)) + 40|0);
 _crypto_sign_ed25519_ref10_fe_add($7,$1,$4);
 _crypto_sign_ed25519_ref10_fe_sq($2,$7);
 _crypto_sign_ed25519_ref10_fe_add($7,$3,$0);
 _crypto_sign_ed25519_ref10_fe_sub($3,$3,$0);
 _crypto_sign_ed25519_ref10_fe_sub($0,$2,$7);
 _crypto_sign_ed25519_ref10_fe_sub($5,$5,$3);
 STACKTOP = sp;return;
}
function _crypto_sign_ed25519_ref10_ge_p3_0($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 _crypto_sign_ed25519_ref10_fe_0($0);
 $1 = ((($0)) + 40|0);
 _crypto_sign_ed25519_ref10_fe_1($1);
 $2 = ((($0)) + 80|0);
 _crypto_sign_ed25519_ref10_fe_1($2);
 $3 = ((($0)) + 120|0);
 _crypto_sign_ed25519_ref10_fe_0($3);
 return;
}
function _crypto_sign_ed25519_ref10_ge_p3_dbl($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 128|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(128|0);
 $2 = sp;
 _crypto_sign_ed25519_ref10_ge_p3_to_p2($2,$1);
 _crypto_sign_ed25519_ref10_ge_p2_dbl($0,$2);
 STACKTOP = sp;return;
}
function _crypto_sign_ed25519_ref10_ge_p3_to_cached($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = ((($1)) + 40|0);
 _crypto_sign_ed25519_ref10_fe_add($0,$2,$1);
 $3 = ((($0)) + 40|0);
 _crypto_sign_ed25519_ref10_fe_sub($3,$2,$1);
 $4 = ((($0)) + 80|0);
 $5 = ((($1)) + 80|0);
 _crypto_sign_ed25519_ref10_fe_copy($4,$5);
 $6 = ((($0)) + 120|0);
 $7 = ((($1)) + 120|0);
 _crypto_sign_ed25519_ref10_fe_mul($6,$7,1240);
 return;
}
function _crypto_sign_ed25519_ref10_ge_p3_to_p2($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 _crypto_sign_ed25519_ref10_fe_copy($0,$1);
 $2 = ((($0)) + 40|0);
 $3 = ((($1)) + 40|0);
 _crypto_sign_ed25519_ref10_fe_copy($2,$3);
 $4 = ((($0)) + 80|0);
 $5 = ((($1)) + 80|0);
 _crypto_sign_ed25519_ref10_fe_copy($4,$5);
 return;
}
function _crypto_sign_ed25519_ref10_ge_p3_tobytes($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 128|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(128|0);
 $2 = sp + 80|0;
 $3 = sp + 40|0;
 $4 = sp;
 $5 = ((($1)) + 80|0);
 _crypto_sign_ed25519_ref10_fe_invert($2,$5);
 _crypto_sign_ed25519_ref10_fe_mul($3,$1,$2);
 $6 = ((($1)) + 40|0);
 _crypto_sign_ed25519_ref10_fe_mul($4,$6,$2);
 _crypto_sign_ed25519_ref10_fe_tobytes($0,$4);
 $7 = (_crypto_sign_ed25519_ref10_fe_isnegative($3)|0);
 $8 = $7 << 7;
 $9 = ((($0)) + 31|0);
 $10 = HEAP8[$9>>0]|0;
 $11 = $10&255;
 $12 = $8 ^ $11;
 $13 = $12&255;
 HEAP8[$9>>0] = $13;
 STACKTOP = sp;return;
}
function _crypto_sign_ed25519_ref10_ge_precomp_0($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 _crypto_sign_ed25519_ref10_fe_1($0);
 $1 = ((($0)) + 40|0);
 _crypto_sign_ed25519_ref10_fe_1($1);
 $2 = ((($0)) + 80|0);
 _crypto_sign_ed25519_ref10_fe_0($2);
 return;
}
function _crypto_sign_ed25519_ref10_ge_scalarmult_base($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$03135 = 0, $$136 = 0, $$234 = 0, $$333 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0;
 var $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0;
 var $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0;
 var $150 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0;
 var $169 = 0, $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0;
 var $187 = 0, $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0;
 var $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0;
 var $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0;
 var $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0;
 var $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0;
 var $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0;
 var $99 = 0, $exitcond = 0, $sext = 0, $sext32 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 464|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(464|0);
 $2 = sp + 400|0;
 $3 = sp + 240|0;
 $4 = sp + 120|0;
 $5 = sp;
 $6 = HEAP8[$1>>0]|0;
 $7 = $6 & 15;
 HEAP8[$2>>0] = $7;
 $8 = ($6&255) >>> 4;
 $9 = ((($2)) + 1|0);
 HEAP8[$9>>0] = $8;
 $10 = ((($1)) + 1|0);
 $11 = HEAP8[$10>>0]|0;
 $12 = $11 & 15;
 $13 = ((($2)) + 2|0);
 HEAP8[$13>>0] = $12;
 $14 = ($11&255) >>> 4;
 $15 = ((($2)) + 3|0);
 HEAP8[$15>>0] = $14;
 $16 = ((($1)) + 2|0);
 $17 = HEAP8[$16>>0]|0;
 $18 = $17 & 15;
 $19 = ((($2)) + 4|0);
 HEAP8[$19>>0] = $18;
 $20 = ($17&255) >>> 4;
 $21 = ((($2)) + 5|0);
 HEAP8[$21>>0] = $20;
 $22 = ((($1)) + 3|0);
 $23 = HEAP8[$22>>0]|0;
 $24 = $23 & 15;
 $25 = ((($2)) + 6|0);
 HEAP8[$25>>0] = $24;
 $26 = ($23&255) >>> 4;
 $27 = ((($2)) + 7|0);
 HEAP8[$27>>0] = $26;
 $28 = ((($1)) + 4|0);
 $29 = HEAP8[$28>>0]|0;
 $30 = $29 & 15;
 $31 = ((($2)) + 8|0);
 HEAP8[$31>>0] = $30;
 $32 = ($29&255) >>> 4;
 $33 = ((($2)) + 9|0);
 HEAP8[$33>>0] = $32;
 $34 = ((($1)) + 5|0);
 $35 = HEAP8[$34>>0]|0;
 $36 = $35 & 15;
 $37 = ((($2)) + 10|0);
 HEAP8[$37>>0] = $36;
 $38 = ($35&255) >>> 4;
 $39 = ((($2)) + 11|0);
 HEAP8[$39>>0] = $38;
 $40 = ((($1)) + 6|0);
 $41 = HEAP8[$40>>0]|0;
 $42 = $41 & 15;
 $43 = ((($2)) + 12|0);
 HEAP8[$43>>0] = $42;
 $44 = ($41&255) >>> 4;
 $45 = ((($2)) + 13|0);
 HEAP8[$45>>0] = $44;
 $46 = ((($1)) + 7|0);
 $47 = HEAP8[$46>>0]|0;
 $48 = $47 & 15;
 $49 = ((($2)) + 14|0);
 HEAP8[$49>>0] = $48;
 $50 = ($47&255) >>> 4;
 $51 = ((($2)) + 15|0);
 HEAP8[$51>>0] = $50;
 $52 = ((($1)) + 8|0);
 $53 = HEAP8[$52>>0]|0;
 $54 = $53 & 15;
 $55 = ((($2)) + 16|0);
 HEAP8[$55>>0] = $54;
 $56 = ($53&255) >>> 4;
 $57 = ((($2)) + 17|0);
 HEAP8[$57>>0] = $56;
 $58 = ((($1)) + 9|0);
 $59 = HEAP8[$58>>0]|0;
 $60 = $59 & 15;
 $61 = ((($2)) + 18|0);
 HEAP8[$61>>0] = $60;
 $62 = ($59&255) >>> 4;
 $63 = ((($2)) + 19|0);
 HEAP8[$63>>0] = $62;
 $64 = ((($1)) + 10|0);
 $65 = HEAP8[$64>>0]|0;
 $66 = $65 & 15;
 $67 = ((($2)) + 20|0);
 HEAP8[$67>>0] = $66;
 $68 = ($65&255) >>> 4;
 $69 = ((($2)) + 21|0);
 HEAP8[$69>>0] = $68;
 $70 = ((($1)) + 11|0);
 $71 = HEAP8[$70>>0]|0;
 $72 = $71 & 15;
 $73 = ((($2)) + 22|0);
 HEAP8[$73>>0] = $72;
 $74 = ($71&255) >>> 4;
 $75 = ((($2)) + 23|0);
 HEAP8[$75>>0] = $74;
 $76 = ((($1)) + 12|0);
 $77 = HEAP8[$76>>0]|0;
 $78 = $77 & 15;
 $79 = ((($2)) + 24|0);
 HEAP8[$79>>0] = $78;
 $80 = ($77&255) >>> 4;
 $81 = ((($2)) + 25|0);
 HEAP8[$81>>0] = $80;
 $82 = ((($1)) + 13|0);
 $83 = HEAP8[$82>>0]|0;
 $84 = $83 & 15;
 $85 = ((($2)) + 26|0);
 HEAP8[$85>>0] = $84;
 $86 = ($83&255) >>> 4;
 $87 = ((($2)) + 27|0);
 HEAP8[$87>>0] = $86;
 $88 = ((($1)) + 14|0);
 $89 = HEAP8[$88>>0]|0;
 $90 = $89 & 15;
 $91 = ((($2)) + 28|0);
 HEAP8[$91>>0] = $90;
 $92 = ($89&255) >>> 4;
 $93 = ((($2)) + 29|0);
 HEAP8[$93>>0] = $92;
 $94 = ((($1)) + 15|0);
 $95 = HEAP8[$94>>0]|0;
 $96 = $95 & 15;
 $97 = ((($2)) + 30|0);
 HEAP8[$97>>0] = $96;
 $98 = ($95&255) >>> 4;
 $99 = ((($2)) + 31|0);
 HEAP8[$99>>0] = $98;
 $100 = ((($1)) + 16|0);
 $101 = HEAP8[$100>>0]|0;
 $102 = $101 & 15;
 $103 = ((($2)) + 32|0);
 HEAP8[$103>>0] = $102;
 $104 = ($101&255) >>> 4;
 $105 = ((($2)) + 33|0);
 HEAP8[$105>>0] = $104;
 $106 = ((($1)) + 17|0);
 $107 = HEAP8[$106>>0]|0;
 $108 = $107 & 15;
 $109 = ((($2)) + 34|0);
 HEAP8[$109>>0] = $108;
 $110 = ($107&255) >>> 4;
 $111 = ((($2)) + 35|0);
 HEAP8[$111>>0] = $110;
 $112 = ((($1)) + 18|0);
 $113 = HEAP8[$112>>0]|0;
 $114 = $113 & 15;
 $115 = ((($2)) + 36|0);
 HEAP8[$115>>0] = $114;
 $116 = ($113&255) >>> 4;
 $117 = ((($2)) + 37|0);
 HEAP8[$117>>0] = $116;
 $118 = ((($1)) + 19|0);
 $119 = HEAP8[$118>>0]|0;
 $120 = $119 & 15;
 $121 = ((($2)) + 38|0);
 HEAP8[$121>>0] = $120;
 $122 = ($119&255) >>> 4;
 $123 = ((($2)) + 39|0);
 HEAP8[$123>>0] = $122;
 $124 = ((($1)) + 20|0);
 $125 = HEAP8[$124>>0]|0;
 $126 = $125 & 15;
 $127 = ((($2)) + 40|0);
 HEAP8[$127>>0] = $126;
 $128 = ($125&255) >>> 4;
 $129 = ((($2)) + 41|0);
 HEAP8[$129>>0] = $128;
 $130 = ((($1)) + 21|0);
 $131 = HEAP8[$130>>0]|0;
 $132 = $131 & 15;
 $133 = ((($2)) + 42|0);
 HEAP8[$133>>0] = $132;
 $134 = ($131&255) >>> 4;
 $135 = ((($2)) + 43|0);
 HEAP8[$135>>0] = $134;
 $136 = ((($1)) + 22|0);
 $137 = HEAP8[$136>>0]|0;
 $138 = $137 & 15;
 $139 = ((($2)) + 44|0);
 HEAP8[$139>>0] = $138;
 $140 = ($137&255) >>> 4;
 $141 = ((($2)) + 45|0);
 HEAP8[$141>>0] = $140;
 $142 = ((($1)) + 23|0);
 $143 = HEAP8[$142>>0]|0;
 $144 = $143 & 15;
 $145 = ((($2)) + 46|0);
 HEAP8[$145>>0] = $144;
 $146 = ($143&255) >>> 4;
 $147 = ((($2)) + 47|0);
 HEAP8[$147>>0] = $146;
 $148 = ((($1)) + 24|0);
 $149 = HEAP8[$148>>0]|0;
 $150 = $149 & 15;
 $151 = ((($2)) + 48|0);
 HEAP8[$151>>0] = $150;
 $152 = ($149&255) >>> 4;
 $153 = ((($2)) + 49|0);
 HEAP8[$153>>0] = $152;
 $154 = ((($1)) + 25|0);
 $155 = HEAP8[$154>>0]|0;
 $156 = $155 & 15;
 $157 = ((($2)) + 50|0);
 HEAP8[$157>>0] = $156;
 $158 = ($155&255) >>> 4;
 $159 = ((($2)) + 51|0);
 HEAP8[$159>>0] = $158;
 $160 = ((($1)) + 26|0);
 $161 = HEAP8[$160>>0]|0;
 $162 = $161 & 15;
 $163 = ((($2)) + 52|0);
 HEAP8[$163>>0] = $162;
 $164 = ($161&255) >>> 4;
 $165 = ((($2)) + 53|0);
 HEAP8[$165>>0] = $164;
 $166 = ((($1)) + 27|0);
 $167 = HEAP8[$166>>0]|0;
 $168 = $167 & 15;
 $169 = ((($2)) + 54|0);
 HEAP8[$169>>0] = $168;
 $170 = ($167&255) >>> 4;
 $171 = ((($2)) + 55|0);
 HEAP8[$171>>0] = $170;
 $172 = ((($1)) + 28|0);
 $173 = HEAP8[$172>>0]|0;
 $174 = $173 & 15;
 $175 = ((($2)) + 56|0);
 HEAP8[$175>>0] = $174;
 $176 = ($173&255) >>> 4;
 $177 = ((($2)) + 57|0);
 HEAP8[$177>>0] = $176;
 $178 = ((($1)) + 29|0);
 $179 = HEAP8[$178>>0]|0;
 $180 = $179 & 15;
 $181 = ((($2)) + 58|0);
 HEAP8[$181>>0] = $180;
 $182 = ($179&255) >>> 4;
 $183 = ((($2)) + 59|0);
 HEAP8[$183>>0] = $182;
 $184 = ((($1)) + 30|0);
 $185 = HEAP8[$184>>0]|0;
 $186 = $185 & 15;
 $187 = ((($2)) + 60|0);
 HEAP8[$187>>0] = $186;
 $188 = ($185&255) >>> 4;
 $189 = ((($2)) + 61|0);
 HEAP8[$189>>0] = $188;
 $190 = ((($1)) + 31|0);
 $191 = HEAP8[$190>>0]|0;
 $192 = $191 & 15;
 $193 = ((($2)) + 62|0);
 HEAP8[$193>>0] = $192;
 $194 = ($191&255) >>> 4;
 $195 = ((($2)) + 63|0);
 HEAP8[$195>>0] = $194;
 $$03135 = 0;$$136 = 0;
 while(1) {
  $196 = (($2) + ($$136)|0);
  $197 = HEAP8[$196>>0]|0;
  $198 = $197&255;
  $199 = (($$03135) + ($198))|0;
  $sext = $199 << 24;
  $sext32 = (($sext) + 134217728)|0;
  $200 = $sext32 >> 28;
  $201 = $200 << 4;
  $202 = (($199) - ($201))|0;
  $203 = $202&255;
  HEAP8[$196>>0] = $203;
  $204 = (($$136) + 1)|0;
  $exitcond = ($204|0)==(63);
  if ($exitcond) {
   break;
  } else {
   $$03135 = $200;$$136 = $204;
  }
 }
 $205 = HEAP8[$195>>0]|0;
 $206 = $205&255;
 $207 = (($200) + ($206))|0;
 $208 = $207&255;
 HEAP8[$195>>0] = $208;
 _crypto_sign_ed25519_ref10_ge_p3_0($0);
 $$234 = 1;
 while(1) {
  $209 = $$234 >>> 1;
  $210 = (($2) + ($$234)|0);
  $211 = HEAP8[$210>>0]|0;
  _select_24($5,$209,$211);
  _crypto_sign_ed25519_ref10_ge_madd($3,$0,$5);
  _crypto_sign_ed25519_ref10_ge_p1p1_to_p3($0,$3);
  $212 = (($$234) + 2)|0;
  $213 = ($212>>>0)<(64);
  if ($213) {
   $$234 = $212;
  } else {
   break;
  }
 }
 _crypto_sign_ed25519_ref10_ge_p3_dbl($3,$0);
 _crypto_sign_ed25519_ref10_ge_p1p1_to_p2($4,$3);
 _crypto_sign_ed25519_ref10_ge_p2_dbl($3,$4);
 _crypto_sign_ed25519_ref10_ge_p1p1_to_p2($4,$3);
 _crypto_sign_ed25519_ref10_ge_p2_dbl($3,$4);
 _crypto_sign_ed25519_ref10_ge_p1p1_to_p2($4,$3);
 _crypto_sign_ed25519_ref10_ge_p2_dbl($3,$4);
 _crypto_sign_ed25519_ref10_ge_p1p1_to_p3($0,$3);
 $$333 = 0;
 while(1) {
  $214 = $$333 >>> 1;
  $215 = (($2) + ($$333)|0);
  $216 = HEAP8[$215>>0]|0;
  _select_24($5,$214,$216);
  _crypto_sign_ed25519_ref10_ge_madd($3,$0,$5);
  _crypto_sign_ed25519_ref10_ge_p1p1_to_p3($0,$3);
  $217 = (($$333) + 2)|0;
  $218 = ($217>>>0)<(64);
  if ($218) {
   $$333 = $217;
  } else {
   break;
  }
 }
 STACKTOP = sp;return;
}
function _select_24($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0;
 var $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0;
 var $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $7 = 0, $8 = 0;
 var $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 128|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(128|0);
 $3 = sp;
 $4 = ($2&255) >>> 7;
 $5 = $2 << 24 >> 24;
 $6 = $4&255;
 $7 = (0 - ($6))|0;
 $8 = $7 & $5;
 $9 = $8 << 1;
 $10 = (($5) - ($9))|0;
 _crypto_sign_ed25519_ref10_ge_precomp_0($0);
 $11 = $10 & 255;
 $12 = $11 ^ 1;
 $13 = (($12) + -1)|0;
 $14 = $13 >>> 31;
 $15 = (1280 + (($1*960)|0)|0);
 _crypto_sign_ed25519_ref10_fe_cmov($0,$15,$14);
 $16 = ((($0)) + 40|0);
 $17 = (((1280 + (($1*960)|0)|0)) + 40|0);
 _crypto_sign_ed25519_ref10_fe_cmov($16,$17,$14);
 $18 = ((($0)) + 80|0);
 $19 = (((1280 + (($1*960)|0)|0)) + 80|0);
 _crypto_sign_ed25519_ref10_fe_cmov($18,$19,$14);
 $20 = $11 ^ 2;
 $21 = (($20) + -1)|0;
 $22 = $21 >>> 31;
 $23 = (((1280 + (($1*960)|0)|0)) + 120|0);
 _crypto_sign_ed25519_ref10_fe_cmov($0,$23,$22);
 $24 = (((1280 + (($1*960)|0)|0)) + 160|0);
 _crypto_sign_ed25519_ref10_fe_cmov($16,$24,$22);
 $25 = (((1280 + (($1*960)|0)|0)) + 200|0);
 _crypto_sign_ed25519_ref10_fe_cmov($18,$25,$22);
 $26 = $11 ^ 3;
 $27 = (($26) + -1)|0;
 $28 = $27 >>> 31;
 $29 = (((1280 + (($1*960)|0)|0)) + 240|0);
 _crypto_sign_ed25519_ref10_fe_cmov($0,$29,$28);
 $30 = (((1280 + (($1*960)|0)|0)) + 280|0);
 _crypto_sign_ed25519_ref10_fe_cmov($16,$30,$28);
 $31 = (((1280 + (($1*960)|0)|0)) + 320|0);
 _crypto_sign_ed25519_ref10_fe_cmov($18,$31,$28);
 $32 = $11 ^ 4;
 $33 = (($32) + -1)|0;
 $34 = $33 >>> 31;
 $35 = (((1280 + (($1*960)|0)|0)) + 360|0);
 _crypto_sign_ed25519_ref10_fe_cmov($0,$35,$34);
 $36 = (((1280 + (($1*960)|0)|0)) + 400|0);
 _crypto_sign_ed25519_ref10_fe_cmov($16,$36,$34);
 $37 = (((1280 + (($1*960)|0)|0)) + 440|0);
 _crypto_sign_ed25519_ref10_fe_cmov($18,$37,$34);
 $38 = $11 ^ 5;
 $39 = (($38) + -1)|0;
 $40 = $39 >>> 31;
 $41 = (((1280 + (($1*960)|0)|0)) + 480|0);
 _crypto_sign_ed25519_ref10_fe_cmov($0,$41,$40);
 $42 = (((1280 + (($1*960)|0)|0)) + 520|0);
 _crypto_sign_ed25519_ref10_fe_cmov($16,$42,$40);
 $43 = (((1280 + (($1*960)|0)|0)) + 560|0);
 _crypto_sign_ed25519_ref10_fe_cmov($18,$43,$40);
 $44 = $11 ^ 6;
 $45 = (($44) + -1)|0;
 $46 = $45 >>> 31;
 $47 = (((1280 + (($1*960)|0)|0)) + 600|0);
 _crypto_sign_ed25519_ref10_fe_cmov($0,$47,$46);
 $48 = (((1280 + (($1*960)|0)|0)) + 640|0);
 _crypto_sign_ed25519_ref10_fe_cmov($16,$48,$46);
 $49 = (((1280 + (($1*960)|0)|0)) + 680|0);
 _crypto_sign_ed25519_ref10_fe_cmov($18,$49,$46);
 $50 = $11 ^ 7;
 $51 = (($50) + -1)|0;
 $52 = $51 >>> 31;
 $53 = (((1280 + (($1*960)|0)|0)) + 720|0);
 _crypto_sign_ed25519_ref10_fe_cmov($0,$53,$52);
 $54 = (((1280 + (($1*960)|0)|0)) + 760|0);
 _crypto_sign_ed25519_ref10_fe_cmov($16,$54,$52);
 $55 = (((1280 + (($1*960)|0)|0)) + 800|0);
 _crypto_sign_ed25519_ref10_fe_cmov($18,$55,$52);
 $56 = $11 ^ 8;
 $57 = (($56) + -1)|0;
 $58 = $57 >>> 31;
 $59 = (((1280 + (($1*960)|0)|0)) + 840|0);
 _crypto_sign_ed25519_ref10_fe_cmov($0,$59,$58);
 $60 = (((1280 + (($1*960)|0)|0)) + 880|0);
 _crypto_sign_ed25519_ref10_fe_cmov($16,$60,$58);
 $61 = (((1280 + (($1*960)|0)|0)) + 920|0);
 _crypto_sign_ed25519_ref10_fe_cmov($18,$61,$58);
 _crypto_sign_ed25519_ref10_fe_copy($3,$16);
 $62 = ((($3)) + 40|0);
 _crypto_sign_ed25519_ref10_fe_copy($62,$0);
 $63 = ((($3)) + 80|0);
 _crypto_sign_ed25519_ref10_fe_neg($63,$18);
 _crypto_sign_ed25519_ref10_fe_cmov($0,$3,$6);
 _crypto_sign_ed25519_ref10_fe_cmov($16,$62,$6);
 _crypto_sign_ed25519_ref10_fe_cmov($18,$63,$6);
 STACKTOP = sp;return;
}
function _crypto_sign_ed25519_ref10_ge_sub($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0, $12 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(48|0);
 $3 = sp;
 $4 = ((($1)) + 40|0);
 _crypto_sign_ed25519_ref10_fe_add($0,$4,$1);
 $5 = ((($0)) + 40|0);
 _crypto_sign_ed25519_ref10_fe_sub($5,$4,$1);
 $6 = ((($0)) + 80|0);
 $7 = ((($2)) + 40|0);
 _crypto_sign_ed25519_ref10_fe_mul($6,$0,$7);
 _crypto_sign_ed25519_ref10_fe_mul($5,$5,$2);
 $8 = ((($0)) + 120|0);
 $9 = ((($2)) + 120|0);
 $10 = ((($1)) + 120|0);
 _crypto_sign_ed25519_ref10_fe_mul($8,$9,$10);
 $11 = ((($1)) + 80|0);
 $12 = ((($2)) + 80|0);
 _crypto_sign_ed25519_ref10_fe_mul($0,$11,$12);
 _crypto_sign_ed25519_ref10_fe_add($3,$0,$0);
 _crypto_sign_ed25519_ref10_fe_sub($0,$6,$5);
 _crypto_sign_ed25519_ref10_fe_add($5,$6,$5);
 _crypto_sign_ed25519_ref10_fe_sub($6,$3,$8);
 _crypto_sign_ed25519_ref10_fe_add($8,$3,$8);
 STACKTOP = sp;return;
}
function _crypto_sign_ed25519_ref10_ge_tobytes($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 128|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(128|0);
 $2 = sp + 80|0;
 $3 = sp + 40|0;
 $4 = sp;
 $5 = ((($1)) + 80|0);
 _crypto_sign_ed25519_ref10_fe_invert($2,$5);
 _crypto_sign_ed25519_ref10_fe_mul($3,$1,$2);
 $6 = ((($1)) + 40|0);
 _crypto_sign_ed25519_ref10_fe_mul($4,$6,$2);
 _crypto_sign_ed25519_ref10_fe_tobytes($0,$4);
 $7 = (_crypto_sign_ed25519_ref10_fe_isnegative($3)|0);
 $8 = $7 << 7;
 $9 = ((($0)) + 31|0);
 $10 = HEAP8[$9>>0]|0;
 $11 = $10&255;
 $12 = $8 ^ $11;
 $13 = $12&255;
 HEAP8[$9>>0] = $13;
 STACKTOP = sp;return;
}
function _crypto_sign_ed25519_ref10_sc_muladd($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $$idx = 0, $$idx$val = 0, $$idx1087 = 0, $$idx1087$val = 0, $$idx1089 = 0, $$idx1089$val = 0, $$idx1090 = 0, $$idx1090$val = 0, $$idx1092 = 0, $$idx1092$val = 0, $$idx1093 = 0, $$idx1093$val = 0, $$idx1095 = 0, $$idx1095$val = 0, $$idx1096 = 0, $$idx1096$val = 0, $$idx1098 = 0, $$idx1098$val = 0, $$idx1099 = 0, $$idx1099$val = 0;
 var $$idx1101 = 0, $$idx1101$val = 0, $$idx1102 = 0, $$idx1102$val = 0, $$idx1104 = 0, $$idx1104$val = 0, $$idx1105 = 0, $$idx1105$val = 0, $$idx1107 = 0, $$idx1107$val = 0, $$idx1108 = 0, $$idx1108$val = 0, $$idx1110 = 0, $$idx1110$val = 0, $$idx1111 = 0, $$idx1111$val = 0, $$idx1113 = 0, $$idx1113$val = 0, $$idx1114 = 0, $$idx1114$val = 0;
 var $$idx1116 = 0, $$idx1116$val = 0, $$idx1117 = 0, $$idx1117$val = 0, $$idx1119 = 0, $$idx1119$val = 0, $$idx1120 = 0, $$idx1120$val = 0, $$idx1122 = 0, $$idx1122$val = 0, $$idx1123 = 0, $$idx1123$val = 0, $$idx1125 = 0, $$idx1125$val = 0, $$idx1126 = 0, $$idx1126$val = 0, $$idx1128 = 0, $$idx1128$val = 0, $$idx1129 = 0, $$idx1129$val = 0;
 var $$idx1131 = 0, $$idx1131$val = 0, $$idx1132 = 0, $$idx1132$val = 0, $$idx1134 = 0, $$idx1134$val = 0, $$idx1135 = 0, $$idx1135$val = 0, $$idx1137 = 0, $$idx1137$val = 0, $$idx1138 = 0, $$idx1138$val = 0, $$val1088 = 0, $$val1100 = 0, $$val1106 = 0, $$val1118 = 0, $$val1124 = 0, $$val1136 = 0, $10 = 0, $100 = 0;
 var $1000 = 0, $1001 = 0, $1002 = 0, $1003 = 0, $1004 = 0, $1005 = 0, $1006 = 0, $1007 = 0, $1008 = 0, $1009 = 0, $101 = 0, $1010 = 0, $1011 = 0, $1012 = 0, $1013 = 0, $1014 = 0, $1015 = 0, $1016 = 0, $1017 = 0, $1018 = 0;
 var $1019 = 0, $102 = 0, $1020 = 0, $1021 = 0, $1022 = 0, $1023 = 0, $1024 = 0, $1025 = 0, $1026 = 0, $1027 = 0, $1028 = 0, $1029 = 0, $103 = 0, $1030 = 0, $1031 = 0, $1032 = 0, $1033 = 0, $1034 = 0, $1035 = 0, $1036 = 0;
 var $1037 = 0, $1038 = 0, $1039 = 0, $104 = 0, $1040 = 0, $1041 = 0, $1042 = 0, $1043 = 0, $1044 = 0, $1045 = 0, $1046 = 0, $1047 = 0, $1048 = 0, $1049 = 0, $105 = 0, $1050 = 0, $1051 = 0, $1052 = 0, $1053 = 0, $1054 = 0;
 var $1055 = 0, $1056 = 0, $1057 = 0, $1058 = 0, $1059 = 0, $106 = 0, $1060 = 0, $1061 = 0, $1062 = 0, $1063 = 0, $1064 = 0, $1065 = 0, $1066 = 0, $1067 = 0, $1068 = 0, $1069 = 0, $107 = 0, $1070 = 0, $1071 = 0, $1072 = 0;
 var $1073 = 0, $1074 = 0, $1075 = 0, $1076 = 0, $1077 = 0, $1078 = 0, $1079 = 0, $108 = 0, $1080 = 0, $1081 = 0, $1082 = 0, $1083 = 0, $1084 = 0, $1085 = 0, $1086 = 0, $1087 = 0, $1088 = 0, $1089 = 0, $109 = 0, $1090 = 0;
 var $1091 = 0, $1092 = 0, $1093 = 0, $1094 = 0, $1095 = 0, $1096 = 0, $1097 = 0, $1098 = 0, $1099 = 0, $11 = 0, $110 = 0, $1100 = 0, $1101 = 0, $1102 = 0, $1103 = 0, $1104 = 0, $1105 = 0, $1106 = 0, $1107 = 0, $1108 = 0;
 var $1109 = 0, $111 = 0, $1110 = 0, $1111 = 0, $1112 = 0, $1113 = 0, $1114 = 0, $1115 = 0, $1116 = 0, $1117 = 0, $1118 = 0, $1119 = 0, $112 = 0, $1120 = 0, $1121 = 0, $1122 = 0, $1123 = 0, $1124 = 0, $1125 = 0, $1126 = 0;
 var $1127 = 0, $1128 = 0, $1129 = 0, $113 = 0, $1130 = 0, $1131 = 0, $1132 = 0, $1133 = 0, $1134 = 0, $1135 = 0, $1136 = 0, $1137 = 0, $1138 = 0, $1139 = 0, $114 = 0, $1140 = 0, $1141 = 0, $1142 = 0, $1143 = 0, $1144 = 0;
 var $1145 = 0, $1146 = 0, $1147 = 0, $1148 = 0, $1149 = 0, $115 = 0, $1150 = 0, $1151 = 0, $1152 = 0, $1153 = 0, $1154 = 0, $1155 = 0, $1156 = 0, $1157 = 0, $1158 = 0, $1159 = 0, $116 = 0, $1160 = 0, $1161 = 0, $1162 = 0;
 var $1163 = 0, $1164 = 0, $1165 = 0, $1166 = 0, $1167 = 0, $1168 = 0, $1169 = 0, $117 = 0, $1170 = 0, $1171 = 0, $1172 = 0, $1173 = 0, $1174 = 0, $1175 = 0, $1176 = 0, $1177 = 0, $1178 = 0, $1179 = 0, $118 = 0, $1180 = 0;
 var $1181 = 0, $1182 = 0, $1183 = 0, $1184 = 0, $1185 = 0, $1186 = 0, $1187 = 0, $1188 = 0, $1189 = 0, $119 = 0, $1190 = 0, $1191 = 0, $1192 = 0, $1193 = 0, $1194 = 0, $1195 = 0, $1196 = 0, $1197 = 0, $1198 = 0, $1199 = 0;
 var $12 = 0, $120 = 0, $1200 = 0, $1201 = 0, $1202 = 0, $1203 = 0, $1204 = 0, $1205 = 0, $1206 = 0, $1207 = 0, $1208 = 0, $1209 = 0, $121 = 0, $1210 = 0, $1211 = 0, $1212 = 0, $1213 = 0, $1214 = 0, $1215 = 0, $1216 = 0;
 var $1217 = 0, $1218 = 0, $1219 = 0, $122 = 0, $1220 = 0, $1221 = 0, $1222 = 0, $1223 = 0, $1224 = 0, $1225 = 0, $1226 = 0, $1227 = 0, $1228 = 0, $1229 = 0, $123 = 0, $1230 = 0, $1231 = 0, $1232 = 0, $1233 = 0, $1234 = 0;
 var $1235 = 0, $1236 = 0, $1237 = 0, $1238 = 0, $1239 = 0, $124 = 0, $1240 = 0, $1241 = 0, $1242 = 0, $1243 = 0, $1244 = 0, $1245 = 0, $1246 = 0, $1247 = 0, $1248 = 0, $1249 = 0, $125 = 0, $1250 = 0, $1251 = 0, $1252 = 0;
 var $1253 = 0, $1254 = 0, $1255 = 0, $1256 = 0, $1257 = 0, $1258 = 0, $1259 = 0, $126 = 0, $1260 = 0, $1261 = 0, $1262 = 0, $1263 = 0, $1264 = 0, $1265 = 0, $1266 = 0, $1267 = 0, $1268 = 0, $1269 = 0, $127 = 0, $1270 = 0;
 var $1271 = 0, $1272 = 0, $1273 = 0, $1274 = 0, $1275 = 0, $1276 = 0, $1277 = 0, $1278 = 0, $1279 = 0, $128 = 0, $1280 = 0, $1281 = 0, $1282 = 0, $1283 = 0, $1284 = 0, $1285 = 0, $1286 = 0, $1287 = 0, $1288 = 0, $1289 = 0;
 var $129 = 0, $1290 = 0, $1291 = 0, $1292 = 0, $1293 = 0, $1294 = 0, $1295 = 0, $1296 = 0, $1297 = 0, $1298 = 0, $1299 = 0, $13 = 0, $130 = 0, $1300 = 0, $1301 = 0, $1302 = 0, $1303 = 0, $1304 = 0, $1305 = 0, $1306 = 0;
 var $1307 = 0, $1308 = 0, $1309 = 0, $131 = 0, $1310 = 0, $1311 = 0, $1312 = 0, $1313 = 0, $1314 = 0, $1315 = 0, $1316 = 0, $1317 = 0, $1318 = 0, $1319 = 0, $132 = 0, $1320 = 0, $1321 = 0, $1322 = 0, $1323 = 0, $1324 = 0;
 var $1325 = 0, $1326 = 0, $1327 = 0, $1328 = 0, $1329 = 0, $133 = 0, $1330 = 0, $1331 = 0, $1332 = 0, $1333 = 0, $1334 = 0, $1335 = 0, $1336 = 0, $1337 = 0, $1338 = 0, $1339 = 0, $134 = 0, $1340 = 0, $1341 = 0, $1342 = 0;
 var $1343 = 0, $1344 = 0, $1345 = 0, $1346 = 0, $1347 = 0, $1348 = 0, $1349 = 0, $135 = 0, $1350 = 0, $1351 = 0, $1352 = 0, $1353 = 0, $1354 = 0, $1355 = 0, $1356 = 0, $1357 = 0, $1358 = 0, $1359 = 0, $136 = 0, $1360 = 0;
 var $1361 = 0, $1362 = 0, $1363 = 0, $1364 = 0, $1365 = 0, $1366 = 0, $1367 = 0, $1368 = 0, $1369 = 0, $137 = 0, $1370 = 0, $1371 = 0, $1372 = 0, $1373 = 0, $1374 = 0, $1375 = 0, $1376 = 0, $1377 = 0, $1378 = 0, $1379 = 0;
 var $138 = 0, $1380 = 0, $1381 = 0, $1382 = 0, $1383 = 0, $1384 = 0, $1385 = 0, $1386 = 0, $1387 = 0, $1388 = 0, $1389 = 0, $139 = 0, $1390 = 0, $1391 = 0, $1392 = 0, $1393 = 0, $1394 = 0, $1395 = 0, $1396 = 0, $1397 = 0;
 var $1398 = 0, $1399 = 0, $14 = 0, $140 = 0, $1400 = 0, $1401 = 0, $1402 = 0, $1403 = 0, $1404 = 0, $1405 = 0, $1406 = 0, $1407 = 0, $1408 = 0, $1409 = 0, $141 = 0, $1410 = 0, $1411 = 0, $1412 = 0, $1413 = 0, $1414 = 0;
 var $1415 = 0, $1416 = 0, $1417 = 0, $1418 = 0, $1419 = 0, $142 = 0, $1420 = 0, $1421 = 0, $1422 = 0, $1423 = 0, $1424 = 0, $1425 = 0, $1426 = 0, $1427 = 0, $1428 = 0, $1429 = 0, $143 = 0, $1430 = 0, $1431 = 0, $1432 = 0;
 var $1433 = 0, $1434 = 0, $1435 = 0, $1436 = 0, $1437 = 0, $1438 = 0, $1439 = 0, $144 = 0, $1440 = 0, $1441 = 0, $1442 = 0, $1443 = 0, $1444 = 0, $1445 = 0, $1446 = 0, $1447 = 0, $1448 = 0, $1449 = 0, $145 = 0, $1450 = 0;
 var $1451 = 0, $1452 = 0, $1453 = 0, $1454 = 0, $1455 = 0, $1456 = 0, $1457 = 0, $1458 = 0, $1459 = 0, $146 = 0, $1460 = 0, $1461 = 0, $1462 = 0, $1463 = 0, $1464 = 0, $1465 = 0, $1466 = 0, $1467 = 0, $1468 = 0, $1469 = 0;
 var $147 = 0, $1470 = 0, $1471 = 0, $1472 = 0, $1473 = 0, $1474 = 0, $1475 = 0, $1476 = 0, $1477 = 0, $1478 = 0, $1479 = 0, $148 = 0, $1480 = 0, $1481 = 0, $1482 = 0, $1483 = 0, $1484 = 0, $1485 = 0, $1486 = 0, $1487 = 0;
 var $1488 = 0, $1489 = 0, $149 = 0, $1490 = 0, $1491 = 0, $1492 = 0, $1493 = 0, $1494 = 0, $1495 = 0, $1496 = 0, $1497 = 0, $1498 = 0, $1499 = 0, $15 = 0, $150 = 0, $1500 = 0, $1501 = 0, $1502 = 0, $1503 = 0, $1504 = 0;
 var $1505 = 0, $1506 = 0, $1507 = 0, $1508 = 0, $1509 = 0, $151 = 0, $1510 = 0, $1511 = 0, $1512 = 0, $1513 = 0, $1514 = 0, $1515 = 0, $1516 = 0, $1517 = 0, $1518 = 0, $1519 = 0, $152 = 0, $1520 = 0, $1521 = 0, $1522 = 0;
 var $1523 = 0, $1524 = 0, $1525 = 0, $1526 = 0, $1527 = 0, $1528 = 0, $1529 = 0, $153 = 0, $1530 = 0, $1531 = 0, $1532 = 0, $1533 = 0, $1534 = 0, $1535 = 0, $1536 = 0, $1537 = 0, $1538 = 0, $1539 = 0, $154 = 0, $1540 = 0;
 var $1541 = 0, $1542 = 0, $1543 = 0, $1544 = 0, $1545 = 0, $1546 = 0, $1547 = 0, $1548 = 0, $1549 = 0, $155 = 0, $1550 = 0, $1551 = 0, $1552 = 0, $1553 = 0, $1554 = 0, $1555 = 0, $1556 = 0, $1557 = 0, $1558 = 0, $1559 = 0;
 var $156 = 0, $1560 = 0, $1561 = 0, $1562 = 0, $1563 = 0, $1564 = 0, $1565 = 0, $1566 = 0, $1567 = 0, $1568 = 0, $1569 = 0, $157 = 0, $1570 = 0, $1571 = 0, $1572 = 0, $1573 = 0, $1574 = 0, $1575 = 0, $1576 = 0, $1577 = 0;
 var $1578 = 0, $1579 = 0, $158 = 0, $1580 = 0, $1581 = 0, $1582 = 0, $1583 = 0, $1584 = 0, $1585 = 0, $1586 = 0, $1587 = 0, $1588 = 0, $1589 = 0, $159 = 0, $1590 = 0, $1591 = 0, $1592 = 0, $1593 = 0, $1594 = 0, $1595 = 0;
 var $1596 = 0, $1597 = 0, $1598 = 0, $1599 = 0, $16 = 0, $160 = 0, $1600 = 0, $1601 = 0, $1602 = 0, $1603 = 0, $1604 = 0, $1605 = 0, $1606 = 0, $1607 = 0, $1608 = 0, $1609 = 0, $161 = 0, $1610 = 0, $1611 = 0, $1612 = 0;
 var $1613 = 0, $1614 = 0, $1615 = 0, $1616 = 0, $1617 = 0, $1618 = 0, $1619 = 0, $162 = 0, $1620 = 0, $1621 = 0, $1622 = 0, $1623 = 0, $1624 = 0, $1625 = 0, $1626 = 0, $1627 = 0, $1628 = 0, $1629 = 0, $163 = 0, $1630 = 0;
 var $1631 = 0, $1632 = 0, $1633 = 0, $1634 = 0, $1635 = 0, $1636 = 0, $1637 = 0, $1638 = 0, $1639 = 0, $164 = 0, $1640 = 0, $1641 = 0, $1642 = 0, $1643 = 0, $1644 = 0, $1645 = 0, $1646 = 0, $1647 = 0, $1648 = 0, $1649 = 0;
 var $165 = 0, $1650 = 0, $1651 = 0, $1652 = 0, $1653 = 0, $1654 = 0, $1655 = 0, $1656 = 0, $1657 = 0, $1658 = 0, $1659 = 0, $166 = 0, $1660 = 0, $1661 = 0, $1662 = 0, $1663 = 0, $1664 = 0, $1665 = 0, $1666 = 0, $1667 = 0;
 var $1668 = 0, $1669 = 0, $167 = 0, $1670 = 0, $1671 = 0, $1672 = 0, $1673 = 0, $1674 = 0, $1675 = 0, $1676 = 0, $1677 = 0, $1678 = 0, $1679 = 0, $168 = 0, $1680 = 0, $1681 = 0, $1682 = 0, $1683 = 0, $1684 = 0, $1685 = 0;
 var $1686 = 0, $1687 = 0, $1688 = 0, $1689 = 0, $169 = 0, $1690 = 0, $1691 = 0, $1692 = 0, $1693 = 0, $1694 = 0, $1695 = 0, $1696 = 0, $1697 = 0, $1698 = 0, $1699 = 0, $17 = 0, $170 = 0, $1700 = 0, $1701 = 0, $1702 = 0;
 var $1703 = 0, $1704 = 0, $1705 = 0, $1706 = 0, $1707 = 0, $1708 = 0, $1709 = 0, $171 = 0, $1710 = 0, $1711 = 0, $1712 = 0, $1713 = 0, $1714 = 0, $1715 = 0, $1716 = 0, $1717 = 0, $1718 = 0, $1719 = 0, $172 = 0, $1720 = 0;
 var $1721 = 0, $1722 = 0, $1723 = 0, $1724 = 0, $1725 = 0, $1726 = 0, $1727 = 0, $1728 = 0, $1729 = 0, $173 = 0, $1730 = 0, $1731 = 0, $1732 = 0, $1733 = 0, $1734 = 0, $1735 = 0, $1736 = 0, $1737 = 0, $1738 = 0, $1739 = 0;
 var $174 = 0, $1740 = 0, $1741 = 0, $1742 = 0, $1743 = 0, $1744 = 0, $1745 = 0, $1746 = 0, $1747 = 0, $1748 = 0, $1749 = 0, $175 = 0, $1750 = 0, $1751 = 0, $1752 = 0, $1753 = 0, $1754 = 0, $1755 = 0, $1756 = 0, $1757 = 0;
 var $1758 = 0, $1759 = 0, $176 = 0, $1760 = 0, $1761 = 0, $1762 = 0, $1763 = 0, $1764 = 0, $1765 = 0, $1766 = 0, $1767 = 0, $1768 = 0, $1769 = 0, $177 = 0, $1770 = 0, $1771 = 0, $1772 = 0, $1773 = 0, $1774 = 0, $1775 = 0;
 var $1776 = 0, $1777 = 0, $1778 = 0, $1779 = 0, $178 = 0, $1780 = 0, $1781 = 0, $1782 = 0, $1783 = 0, $1784 = 0, $1785 = 0, $1786 = 0, $1787 = 0, $1788 = 0, $1789 = 0, $179 = 0, $1790 = 0, $1791 = 0, $1792 = 0, $1793 = 0;
 var $1794 = 0, $1795 = 0, $1796 = 0, $1797 = 0, $1798 = 0, $1799 = 0, $18 = 0, $180 = 0, $1800 = 0, $1801 = 0, $1802 = 0, $1803 = 0, $1804 = 0, $1805 = 0, $1806 = 0, $1807 = 0, $1808 = 0, $1809 = 0, $181 = 0, $1810 = 0;
 var $1811 = 0, $1812 = 0, $1813 = 0, $1814 = 0, $1815 = 0, $1816 = 0, $1817 = 0, $1818 = 0, $1819 = 0, $182 = 0, $1820 = 0, $1821 = 0, $1822 = 0, $1823 = 0, $1824 = 0, $1825 = 0, $1826 = 0, $1827 = 0, $1828 = 0, $1829 = 0;
 var $183 = 0, $1830 = 0, $1831 = 0, $1832 = 0, $1833 = 0, $1834 = 0, $1835 = 0, $1836 = 0, $1837 = 0, $1838 = 0, $1839 = 0, $184 = 0, $1840 = 0, $1841 = 0, $1842 = 0, $1843 = 0, $1844 = 0, $1845 = 0, $1846 = 0, $1847 = 0;
 var $1848 = 0, $1849 = 0, $185 = 0, $1850 = 0, $1851 = 0, $1852 = 0, $1853 = 0, $1854 = 0, $1855 = 0, $1856 = 0, $1857 = 0, $1858 = 0, $1859 = 0, $186 = 0, $1860 = 0, $1861 = 0, $1862 = 0, $1863 = 0, $1864 = 0, $1865 = 0;
 var $1866 = 0, $1867 = 0, $1868 = 0, $1869 = 0, $187 = 0, $1870 = 0, $1871 = 0, $1872 = 0, $1873 = 0, $1874 = 0, $1875 = 0, $1876 = 0, $1877 = 0, $1878 = 0, $1879 = 0, $188 = 0, $1880 = 0, $1881 = 0, $1882 = 0, $1883 = 0;
 var $1884 = 0, $1885 = 0, $1886 = 0, $1887 = 0, $1888 = 0, $1889 = 0, $189 = 0, $1890 = 0, $1891 = 0, $1892 = 0, $1893 = 0, $1894 = 0, $1895 = 0, $1896 = 0, $1897 = 0, $1898 = 0, $1899 = 0, $19 = 0, $190 = 0, $1900 = 0;
 var $1901 = 0, $1902 = 0, $1903 = 0, $1904 = 0, $1905 = 0, $1906 = 0, $1907 = 0, $1908 = 0, $1909 = 0, $191 = 0, $1910 = 0, $1911 = 0, $1912 = 0, $1913 = 0, $1914 = 0, $1915 = 0, $1916 = 0, $1917 = 0, $1918 = 0, $1919 = 0;
 var $192 = 0, $1920 = 0, $1921 = 0, $1922 = 0, $1923 = 0, $1924 = 0, $1925 = 0, $1926 = 0, $1927 = 0, $1928 = 0, $1929 = 0, $193 = 0, $1930 = 0, $1931 = 0, $1932 = 0, $1933 = 0, $1934 = 0, $1935 = 0, $1936 = 0, $1937 = 0;
 var $1938 = 0, $1939 = 0, $194 = 0, $1940 = 0, $1941 = 0, $1942 = 0, $1943 = 0, $1944 = 0, $1945 = 0, $1946 = 0, $1947 = 0, $1948 = 0, $1949 = 0, $195 = 0, $1950 = 0, $1951 = 0, $1952 = 0, $1953 = 0, $1954 = 0, $1955 = 0;
 var $1956 = 0, $1957 = 0, $1958 = 0, $1959 = 0, $196 = 0, $1960 = 0, $1961 = 0, $1962 = 0, $1963 = 0, $1964 = 0, $1965 = 0, $1966 = 0, $1967 = 0, $1968 = 0, $1969 = 0, $197 = 0, $1970 = 0, $1971 = 0, $1972 = 0, $1973 = 0;
 var $1974 = 0, $1975 = 0, $1976 = 0, $1977 = 0, $1978 = 0, $1979 = 0, $198 = 0, $1980 = 0, $1981 = 0, $1982 = 0, $1983 = 0, $1984 = 0, $1985 = 0, $1986 = 0, $1987 = 0, $1988 = 0, $1989 = 0, $199 = 0, $1990 = 0, $1991 = 0;
 var $1992 = 0, $1993 = 0, $1994 = 0, $1995 = 0, $1996 = 0, $1997 = 0, $1998 = 0, $1999 = 0, $20 = 0, $200 = 0, $2000 = 0, $2001 = 0, $2002 = 0, $2003 = 0, $2004 = 0, $2005 = 0, $2006 = 0, $2007 = 0, $2008 = 0, $2009 = 0;
 var $201 = 0, $2010 = 0, $2011 = 0, $2012 = 0, $2013 = 0, $2014 = 0, $2015 = 0, $2016 = 0, $2017 = 0, $2018 = 0, $2019 = 0, $202 = 0, $2020 = 0, $2021 = 0, $2022 = 0, $2023 = 0, $2024 = 0, $2025 = 0, $2026 = 0, $2027 = 0;
 var $2028 = 0, $2029 = 0, $203 = 0, $2030 = 0, $2031 = 0, $2032 = 0, $2033 = 0, $2034 = 0, $2035 = 0, $2036 = 0, $2037 = 0, $2038 = 0, $2039 = 0, $204 = 0, $2040 = 0, $2041 = 0, $2042 = 0, $2043 = 0, $2044 = 0, $2045 = 0;
 var $2046 = 0, $2047 = 0, $2048 = 0, $2049 = 0, $205 = 0, $2050 = 0, $2051 = 0, $2052 = 0, $2053 = 0, $2054 = 0, $2055 = 0, $2056 = 0, $2057 = 0, $2058 = 0, $2059 = 0, $206 = 0, $2060 = 0, $2061 = 0, $2062 = 0, $2063 = 0;
 var $2064 = 0, $2065 = 0, $2066 = 0, $2067 = 0, $2068 = 0, $2069 = 0, $207 = 0, $2070 = 0, $2071 = 0, $2072 = 0, $2073 = 0, $2074 = 0, $2075 = 0, $2076 = 0, $2077 = 0, $2078 = 0, $2079 = 0, $208 = 0, $2080 = 0, $2081 = 0;
 var $2082 = 0, $2083 = 0, $2084 = 0, $2085 = 0, $2086 = 0, $2087 = 0, $2088 = 0, $2089 = 0, $209 = 0, $2090 = 0, $2091 = 0, $2092 = 0, $2093 = 0, $2094 = 0, $2095 = 0, $2096 = 0, $2097 = 0, $2098 = 0, $2099 = 0, $21 = 0;
 var $210 = 0, $2100 = 0, $2101 = 0, $2102 = 0, $2103 = 0, $2104 = 0, $2105 = 0, $2106 = 0, $2107 = 0, $2108 = 0, $2109 = 0, $211 = 0, $2110 = 0, $2111 = 0, $2112 = 0, $2113 = 0, $2114 = 0, $2115 = 0, $2116 = 0, $2117 = 0;
 var $2118 = 0, $2119 = 0, $212 = 0, $2120 = 0, $2121 = 0, $2122 = 0, $2123 = 0, $2124 = 0, $2125 = 0, $2126 = 0, $2127 = 0, $2128 = 0, $2129 = 0, $213 = 0, $2130 = 0, $2131 = 0, $2132 = 0, $2133 = 0, $2134 = 0, $2135 = 0;
 var $2136 = 0, $2137 = 0, $2138 = 0, $2139 = 0, $214 = 0, $2140 = 0, $2141 = 0, $2142 = 0, $2143 = 0, $2144 = 0, $2145 = 0, $2146 = 0, $2147 = 0, $2148 = 0, $2149 = 0, $215 = 0, $2150 = 0, $2151 = 0, $2152 = 0, $2153 = 0;
 var $2154 = 0, $2155 = 0, $2156 = 0, $2157 = 0, $2158 = 0, $2159 = 0, $216 = 0, $2160 = 0, $2161 = 0, $2162 = 0, $2163 = 0, $2164 = 0, $2165 = 0, $2166 = 0, $2167 = 0, $2168 = 0, $2169 = 0, $217 = 0, $2170 = 0, $2171 = 0;
 var $2172 = 0, $2173 = 0, $2174 = 0, $2175 = 0, $2176 = 0, $2177 = 0, $2178 = 0, $2179 = 0, $218 = 0, $2180 = 0, $2181 = 0, $2182 = 0, $2183 = 0, $2184 = 0, $2185 = 0, $2186 = 0, $2187 = 0, $219 = 0, $22 = 0, $220 = 0;
 var $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0;
 var $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0;
 var $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0;
 var $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0;
 var $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0, $299 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0;
 var $312 = 0, $313 = 0, $314 = 0, $315 = 0, $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0, $321 = 0, $322 = 0, $323 = 0, $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0, $329 = 0, $33 = 0;
 var $330 = 0, $331 = 0, $332 = 0, $333 = 0, $334 = 0, $335 = 0, $336 = 0, $337 = 0, $338 = 0, $339 = 0, $34 = 0, $340 = 0, $341 = 0, $342 = 0, $343 = 0, $344 = 0, $345 = 0, $346 = 0, $347 = 0, $348 = 0;
 var $349 = 0, $35 = 0, $350 = 0, $351 = 0, $352 = 0, $353 = 0, $354 = 0, $355 = 0, $356 = 0, $357 = 0, $358 = 0, $359 = 0, $36 = 0, $360 = 0, $361 = 0, $362 = 0, $363 = 0, $364 = 0, $365 = 0, $366 = 0;
 var $367 = 0, $368 = 0, $369 = 0, $37 = 0, $370 = 0, $371 = 0, $372 = 0, $373 = 0, $374 = 0, $375 = 0, $376 = 0, $377 = 0, $378 = 0, $379 = 0, $38 = 0, $380 = 0, $381 = 0, $382 = 0, $383 = 0, $384 = 0;
 var $385 = 0, $386 = 0, $387 = 0, $388 = 0, $389 = 0, $39 = 0, $390 = 0, $391 = 0, $392 = 0, $393 = 0, $394 = 0, $395 = 0, $396 = 0, $397 = 0, $398 = 0, $399 = 0, $4 = 0, $40 = 0, $400 = 0, $401 = 0;
 var $402 = 0, $403 = 0, $404 = 0, $405 = 0, $406 = 0, $407 = 0, $408 = 0, $409 = 0, $41 = 0, $410 = 0, $411 = 0, $412 = 0, $413 = 0, $414 = 0, $415 = 0, $416 = 0, $417 = 0, $418 = 0, $419 = 0, $42 = 0;
 var $420 = 0, $421 = 0, $422 = 0, $423 = 0, $424 = 0, $425 = 0, $426 = 0, $427 = 0, $428 = 0, $429 = 0, $43 = 0, $430 = 0, $431 = 0, $432 = 0, $433 = 0, $434 = 0, $435 = 0, $436 = 0, $437 = 0, $438 = 0;
 var $439 = 0, $44 = 0, $440 = 0, $441 = 0, $442 = 0, $443 = 0, $444 = 0, $445 = 0, $446 = 0, $447 = 0, $448 = 0, $449 = 0, $45 = 0, $450 = 0, $451 = 0, $452 = 0, $453 = 0, $454 = 0, $455 = 0, $456 = 0;
 var $457 = 0, $458 = 0, $459 = 0, $46 = 0, $460 = 0, $461 = 0, $462 = 0, $463 = 0, $464 = 0, $465 = 0, $466 = 0, $467 = 0, $468 = 0, $469 = 0, $47 = 0, $470 = 0, $471 = 0, $472 = 0, $473 = 0, $474 = 0;
 var $475 = 0, $476 = 0, $477 = 0, $478 = 0, $479 = 0, $48 = 0, $480 = 0, $481 = 0, $482 = 0, $483 = 0, $484 = 0, $485 = 0, $486 = 0, $487 = 0, $488 = 0, $489 = 0, $49 = 0, $490 = 0, $491 = 0, $492 = 0;
 var $493 = 0, $494 = 0, $495 = 0, $496 = 0, $497 = 0, $498 = 0, $499 = 0, $5 = 0, $50 = 0, $500 = 0, $501 = 0, $502 = 0, $503 = 0, $504 = 0, $505 = 0, $506 = 0, $507 = 0, $508 = 0, $509 = 0, $51 = 0;
 var $510 = 0, $511 = 0, $512 = 0, $513 = 0, $514 = 0, $515 = 0, $516 = 0, $517 = 0, $518 = 0, $519 = 0, $52 = 0, $520 = 0, $521 = 0, $522 = 0, $523 = 0, $524 = 0, $525 = 0, $526 = 0, $527 = 0, $528 = 0;
 var $529 = 0, $53 = 0, $530 = 0, $531 = 0, $532 = 0, $533 = 0, $534 = 0, $535 = 0, $536 = 0, $537 = 0, $538 = 0, $539 = 0, $54 = 0, $540 = 0, $541 = 0, $542 = 0, $543 = 0, $544 = 0, $545 = 0, $546 = 0;
 var $547 = 0, $548 = 0, $549 = 0, $55 = 0, $550 = 0, $551 = 0, $552 = 0, $553 = 0, $554 = 0, $555 = 0, $556 = 0, $557 = 0, $558 = 0, $559 = 0, $56 = 0, $560 = 0, $561 = 0, $562 = 0, $563 = 0, $564 = 0;
 var $565 = 0, $566 = 0, $567 = 0, $568 = 0, $569 = 0, $57 = 0, $570 = 0, $571 = 0, $572 = 0, $573 = 0, $574 = 0, $575 = 0, $576 = 0, $577 = 0, $578 = 0, $579 = 0, $58 = 0, $580 = 0, $581 = 0, $582 = 0;
 var $583 = 0, $584 = 0, $585 = 0, $586 = 0, $587 = 0, $588 = 0, $589 = 0, $59 = 0, $590 = 0, $591 = 0, $592 = 0, $593 = 0, $594 = 0, $595 = 0, $596 = 0, $597 = 0, $598 = 0, $599 = 0, $6 = 0, $60 = 0;
 var $600 = 0, $601 = 0, $602 = 0, $603 = 0, $604 = 0, $605 = 0, $606 = 0, $607 = 0, $608 = 0, $609 = 0, $61 = 0, $610 = 0, $611 = 0, $612 = 0, $613 = 0, $614 = 0, $615 = 0, $616 = 0, $617 = 0, $618 = 0;
 var $619 = 0, $62 = 0, $620 = 0, $621 = 0, $622 = 0, $623 = 0, $624 = 0, $625 = 0, $626 = 0, $627 = 0, $628 = 0, $629 = 0, $63 = 0, $630 = 0, $631 = 0, $632 = 0, $633 = 0, $634 = 0, $635 = 0, $636 = 0;
 var $637 = 0, $638 = 0, $639 = 0, $64 = 0, $640 = 0, $641 = 0, $642 = 0, $643 = 0, $644 = 0, $645 = 0, $646 = 0, $647 = 0, $648 = 0, $649 = 0, $65 = 0, $650 = 0, $651 = 0, $652 = 0, $653 = 0, $654 = 0;
 var $655 = 0, $656 = 0, $657 = 0, $658 = 0, $659 = 0, $66 = 0, $660 = 0, $661 = 0, $662 = 0, $663 = 0, $664 = 0, $665 = 0, $666 = 0, $667 = 0, $668 = 0, $669 = 0, $67 = 0, $670 = 0, $671 = 0, $672 = 0;
 var $673 = 0, $674 = 0, $675 = 0, $676 = 0, $677 = 0, $678 = 0, $679 = 0, $68 = 0, $680 = 0, $681 = 0, $682 = 0, $683 = 0, $684 = 0, $685 = 0, $686 = 0, $687 = 0, $688 = 0, $689 = 0, $69 = 0, $690 = 0;
 var $691 = 0, $692 = 0, $693 = 0, $694 = 0, $695 = 0, $696 = 0, $697 = 0, $698 = 0, $699 = 0, $7 = 0, $70 = 0, $700 = 0, $701 = 0, $702 = 0, $703 = 0, $704 = 0, $705 = 0, $706 = 0, $707 = 0, $708 = 0;
 var $709 = 0, $71 = 0, $710 = 0, $711 = 0, $712 = 0, $713 = 0, $714 = 0, $715 = 0, $716 = 0, $717 = 0, $718 = 0, $719 = 0, $72 = 0, $720 = 0, $721 = 0, $722 = 0, $723 = 0, $724 = 0, $725 = 0, $726 = 0;
 var $727 = 0, $728 = 0, $729 = 0, $73 = 0, $730 = 0, $731 = 0, $732 = 0, $733 = 0, $734 = 0, $735 = 0, $736 = 0, $737 = 0, $738 = 0, $739 = 0, $74 = 0, $740 = 0, $741 = 0, $742 = 0, $743 = 0, $744 = 0;
 var $745 = 0, $746 = 0, $747 = 0, $748 = 0, $749 = 0, $75 = 0, $750 = 0, $751 = 0, $752 = 0, $753 = 0, $754 = 0, $755 = 0, $756 = 0, $757 = 0, $758 = 0, $759 = 0, $76 = 0, $760 = 0, $761 = 0, $762 = 0;
 var $763 = 0, $764 = 0, $765 = 0, $766 = 0, $767 = 0, $768 = 0, $769 = 0, $77 = 0, $770 = 0, $771 = 0, $772 = 0, $773 = 0, $774 = 0, $775 = 0, $776 = 0, $777 = 0, $778 = 0, $779 = 0, $78 = 0, $780 = 0;
 var $781 = 0, $782 = 0, $783 = 0, $784 = 0, $785 = 0, $786 = 0, $787 = 0, $788 = 0, $789 = 0, $79 = 0, $790 = 0, $791 = 0, $792 = 0, $793 = 0, $794 = 0, $795 = 0, $796 = 0, $797 = 0, $798 = 0, $799 = 0;
 var $8 = 0, $80 = 0, $800 = 0, $801 = 0, $802 = 0, $803 = 0, $804 = 0, $805 = 0, $806 = 0, $807 = 0, $808 = 0, $809 = 0, $81 = 0, $810 = 0, $811 = 0, $812 = 0, $813 = 0, $814 = 0, $815 = 0, $816 = 0;
 var $817 = 0, $818 = 0, $819 = 0, $82 = 0, $820 = 0, $821 = 0, $822 = 0, $823 = 0, $824 = 0, $825 = 0, $826 = 0, $827 = 0, $828 = 0, $829 = 0, $83 = 0, $830 = 0, $831 = 0, $832 = 0, $833 = 0, $834 = 0;
 var $835 = 0, $836 = 0, $837 = 0, $838 = 0, $839 = 0, $84 = 0, $840 = 0, $841 = 0, $842 = 0, $843 = 0, $844 = 0, $845 = 0, $846 = 0, $847 = 0, $848 = 0, $849 = 0, $85 = 0, $850 = 0, $851 = 0, $852 = 0;
 var $853 = 0, $854 = 0, $855 = 0, $856 = 0, $857 = 0, $858 = 0, $859 = 0, $86 = 0, $860 = 0, $861 = 0, $862 = 0, $863 = 0, $864 = 0, $865 = 0, $866 = 0, $867 = 0, $868 = 0, $869 = 0, $87 = 0, $870 = 0;
 var $871 = 0, $872 = 0, $873 = 0, $874 = 0, $875 = 0, $876 = 0, $877 = 0, $878 = 0, $879 = 0, $88 = 0, $880 = 0, $881 = 0, $882 = 0, $883 = 0, $884 = 0, $885 = 0, $886 = 0, $887 = 0, $888 = 0, $889 = 0;
 var $89 = 0, $890 = 0, $891 = 0, $892 = 0, $893 = 0, $894 = 0, $895 = 0, $896 = 0, $897 = 0, $898 = 0, $899 = 0, $9 = 0, $90 = 0, $900 = 0, $901 = 0, $902 = 0, $903 = 0, $904 = 0, $905 = 0, $906 = 0;
 var $907 = 0, $908 = 0, $909 = 0, $91 = 0, $910 = 0, $911 = 0, $912 = 0, $913 = 0, $914 = 0, $915 = 0, $916 = 0, $917 = 0, $918 = 0, $919 = 0, $92 = 0, $920 = 0, $921 = 0, $922 = 0, $923 = 0, $924 = 0;
 var $925 = 0, $926 = 0, $927 = 0, $928 = 0, $929 = 0, $93 = 0, $930 = 0, $931 = 0, $932 = 0, $933 = 0, $934 = 0, $935 = 0, $936 = 0, $937 = 0, $938 = 0, $939 = 0, $94 = 0, $940 = 0, $941 = 0, $942 = 0;
 var $943 = 0, $944 = 0, $945 = 0, $946 = 0, $947 = 0, $948 = 0, $949 = 0, $95 = 0, $950 = 0, $951 = 0, $952 = 0, $953 = 0, $954 = 0, $955 = 0, $956 = 0, $957 = 0, $958 = 0, $959 = 0, $96 = 0, $960 = 0;
 var $961 = 0, $962 = 0, $963 = 0, $964 = 0, $965 = 0, $966 = 0, $967 = 0, $968 = 0, $969 = 0, $97 = 0, $970 = 0, $971 = 0, $972 = 0, $973 = 0, $974 = 0, $975 = 0, $976 = 0, $977 = 0, $978 = 0, $979 = 0;
 var $98 = 0, $980 = 0, $981 = 0, $982 = 0, $983 = 0, $984 = 0, $985 = 0, $986 = 0, $987 = 0, $988 = 0, $989 = 0, $99 = 0, $990 = 0, $991 = 0, $992 = 0, $993 = 0, $994 = 0, $995 = 0, $996 = 0, $997 = 0;
 var $998 = 0, $999 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $$val1136 = HEAP8[$1>>0]|0;
 $$idx1137 = ((($1)) + 1|0);
 $$idx1137$val = HEAP8[$$idx1137>>0]|0;
 $$idx1138 = ((($1)) + 2|0);
 $$idx1138$val = HEAP8[$$idx1138>>0]|0;
 $4 = $$val1136&255;
 $5 = $$idx1137$val&255;
 $6 = (_bitshift64Shl(($5|0),0,8)|0);
 $7 = tempRet0;
 $8 = $6 | $4;
 $9 = $$idx1138$val&255;
 $10 = (_bitshift64Shl(($9|0),0,16)|0);
 $11 = tempRet0;
 $12 = $10 & 2031616;
 $13 = $8 | $12;
 $14 = ((($1)) + 3|0);
 $15 = HEAP8[$14>>0]|0;
 $16 = $15&255;
 $17 = (_bitshift64Shl(($16|0),0,8)|0);
 $18 = tempRet0;
 $19 = $17 | $9;
 $20 = ((($1)) + 4|0);
 $21 = HEAP8[$20>>0]|0;
 $22 = $21&255;
 $23 = (_bitshift64Shl(($22|0),0,16)|0);
 $24 = tempRet0;
 $25 = $19 | $23;
 $26 = $18 | $24;
 $27 = ((($1)) + 5|0);
 $28 = HEAP8[$27>>0]|0;
 $29 = $28&255;
 $30 = (_bitshift64Shl(($29|0),0,24)|0);
 $31 = tempRet0;
 $32 = $25 | $30;
 $33 = $26 | $31;
 $34 = (_bitshift64Lshr(($32|0),($33|0),5)|0);
 $35 = tempRet0;
 $36 = $34 & 2097151;
 $$idx1134 = ((($1)) + 6|0);
 $$idx1134$val = HEAP8[$$idx1134>>0]|0;
 $$idx1135 = ((($1)) + 7|0);
 $$idx1135$val = HEAP8[$$idx1135>>0]|0;
 $37 = $$idx1134$val&255;
 $38 = (_bitshift64Shl(($37|0),0,8)|0);
 $39 = tempRet0;
 $40 = $38 | $29;
 $41 = $$idx1135$val&255;
 $42 = (_bitshift64Shl(($41|0),0,16)|0);
 $43 = tempRet0;
 $44 = $40 | $42;
 $45 = $39 | $43;
 $46 = (_bitshift64Lshr(($44|0),($45|0),2)|0);
 $47 = tempRet0;
 $48 = $46 & 2097151;
 $49 = ((($1)) + 8|0);
 $50 = HEAP8[$49>>0]|0;
 $51 = $50&255;
 $52 = (_bitshift64Shl(($51|0),0,8)|0);
 $53 = tempRet0;
 $54 = $52 | $41;
 $55 = ((($1)) + 9|0);
 $56 = HEAP8[$55>>0]|0;
 $57 = $56&255;
 $58 = (_bitshift64Shl(($57|0),0,16)|0);
 $59 = tempRet0;
 $60 = $54 | $58;
 $61 = $53 | $59;
 $62 = ((($1)) + 10|0);
 $63 = HEAP8[$62>>0]|0;
 $64 = $63&255;
 $65 = (_bitshift64Shl(($64|0),0,24)|0);
 $66 = tempRet0;
 $67 = $60 | $65;
 $68 = $61 | $66;
 $69 = (_bitshift64Lshr(($67|0),($68|0),7)|0);
 $70 = tempRet0;
 $71 = $69 & 2097151;
 $72 = ((($1)) + 11|0);
 $73 = HEAP8[$72>>0]|0;
 $74 = $73&255;
 $75 = (_bitshift64Shl(($74|0),0,8)|0);
 $76 = tempRet0;
 $77 = $75 | $64;
 $78 = ((($1)) + 12|0);
 $79 = HEAP8[$78>>0]|0;
 $80 = $79&255;
 $81 = (_bitshift64Shl(($80|0),0,16)|0);
 $82 = tempRet0;
 $83 = $77 | $81;
 $84 = $76 | $82;
 $85 = ((($1)) + 13|0);
 $86 = HEAP8[$85>>0]|0;
 $87 = $86&255;
 $88 = (_bitshift64Shl(($87|0),0,24)|0);
 $89 = tempRet0;
 $90 = $83 | $88;
 $91 = $84 | $89;
 $92 = (_bitshift64Lshr(($90|0),($91|0),4)|0);
 $93 = tempRet0;
 $94 = $92 & 2097151;
 $$idx1131 = ((($1)) + 14|0);
 $$idx1131$val = HEAP8[$$idx1131>>0]|0;
 $$idx1132 = ((($1)) + 15|0);
 $$idx1132$val = HEAP8[$$idx1132>>0]|0;
 $95 = $$idx1131$val&255;
 $96 = (_bitshift64Shl(($95|0),0,8)|0);
 $97 = tempRet0;
 $98 = $96 | $87;
 $99 = $$idx1132$val&255;
 $100 = (_bitshift64Shl(($99|0),0,16)|0);
 $101 = tempRet0;
 $102 = $98 | $100;
 $103 = $97 | $101;
 $104 = (_bitshift64Lshr(($102|0),($103|0),1)|0);
 $105 = tempRet0;
 $106 = $104 & 2097151;
 $107 = ((($1)) + 16|0);
 $108 = HEAP8[$107>>0]|0;
 $109 = $108&255;
 $110 = (_bitshift64Shl(($109|0),0,8)|0);
 $111 = tempRet0;
 $112 = $110 | $99;
 $113 = ((($1)) + 17|0);
 $114 = HEAP8[$113>>0]|0;
 $115 = $114&255;
 $116 = (_bitshift64Shl(($115|0),0,16)|0);
 $117 = tempRet0;
 $118 = $112 | $116;
 $119 = $111 | $117;
 $120 = ((($1)) + 18|0);
 $121 = HEAP8[$120>>0]|0;
 $122 = $121&255;
 $123 = (_bitshift64Shl(($122|0),0,24)|0);
 $124 = tempRet0;
 $125 = $118 | $123;
 $126 = $119 | $124;
 $127 = (_bitshift64Lshr(($125|0),($126|0),6)|0);
 $128 = tempRet0;
 $129 = $127 & 2097151;
 $$idx1128 = ((($1)) + 19|0);
 $$idx1128$val = HEAP8[$$idx1128>>0]|0;
 $$idx1129 = ((($1)) + 20|0);
 $$idx1129$val = HEAP8[$$idx1129>>0]|0;
 $130 = $$idx1128$val&255;
 $131 = (_bitshift64Shl(($130|0),0,8)|0);
 $132 = tempRet0;
 $133 = $131 | $122;
 $134 = $$idx1129$val&255;
 $135 = (_bitshift64Shl(($134|0),0,16)|0);
 $136 = tempRet0;
 $137 = $133 | $135;
 $138 = $132 | $136;
 $139 = (_bitshift64Lshr(($137|0),($138|0),3)|0);
 $140 = tempRet0;
 $141 = ((($1)) + 21|0);
 $$val1124 = HEAP8[$141>>0]|0;
 $$idx1125 = ((($1)) + 22|0);
 $$idx1125$val = HEAP8[$$idx1125>>0]|0;
 $$idx1126 = ((($1)) + 23|0);
 $$idx1126$val = HEAP8[$$idx1126>>0]|0;
 $142 = $$val1124&255;
 $143 = $$idx1125$val&255;
 $144 = (_bitshift64Shl(($143|0),0,8)|0);
 $145 = tempRet0;
 $146 = $144 | $142;
 $147 = $$idx1126$val&255;
 $148 = (_bitshift64Shl(($147|0),0,16)|0);
 $149 = tempRet0;
 $150 = $148 & 2031616;
 $151 = $146 | $150;
 $152 = ((($1)) + 24|0);
 $153 = HEAP8[$152>>0]|0;
 $154 = $153&255;
 $155 = (_bitshift64Shl(($154|0),0,8)|0);
 $156 = tempRet0;
 $157 = $155 | $147;
 $158 = ((($1)) + 25|0);
 $159 = HEAP8[$158>>0]|0;
 $160 = $159&255;
 $161 = (_bitshift64Shl(($160|0),0,16)|0);
 $162 = tempRet0;
 $163 = $157 | $161;
 $164 = $156 | $162;
 $165 = ((($1)) + 26|0);
 $166 = HEAP8[$165>>0]|0;
 $167 = $166&255;
 $168 = (_bitshift64Shl(($167|0),0,24)|0);
 $169 = tempRet0;
 $170 = $163 | $168;
 $171 = $164 | $169;
 $172 = (_bitshift64Lshr(($170|0),($171|0),5)|0);
 $173 = tempRet0;
 $174 = $172 & 2097151;
 $$idx1122 = ((($1)) + 27|0);
 $$idx1122$val = HEAP8[$$idx1122>>0]|0;
 $$idx1123 = ((($1)) + 28|0);
 $$idx1123$val = HEAP8[$$idx1123>>0]|0;
 $175 = $$idx1122$val&255;
 $176 = (_bitshift64Shl(($175|0),0,8)|0);
 $177 = tempRet0;
 $178 = $176 | $167;
 $179 = $$idx1123$val&255;
 $180 = (_bitshift64Shl(($179|0),0,16)|0);
 $181 = tempRet0;
 $182 = $178 | $180;
 $183 = $177 | $181;
 $184 = (_bitshift64Lshr(($182|0),($183|0),2)|0);
 $185 = tempRet0;
 $186 = $184 & 2097151;
 $187 = ((($1)) + 29|0);
 $188 = HEAP8[$187>>0]|0;
 $189 = $188&255;
 $190 = (_bitshift64Shl(($189|0),0,8)|0);
 $191 = tempRet0;
 $192 = $190 | $179;
 $193 = ((($1)) + 30|0);
 $194 = HEAP8[$193>>0]|0;
 $195 = $194&255;
 $196 = (_bitshift64Shl(($195|0),0,16)|0);
 $197 = tempRet0;
 $198 = $192 | $196;
 $199 = $191 | $197;
 $200 = ((($1)) + 31|0);
 $201 = HEAP8[$200>>0]|0;
 $202 = $201&255;
 $203 = (_bitshift64Shl(($202|0),0,24)|0);
 $204 = tempRet0;
 $205 = $198 | $203;
 $206 = $199 | $204;
 $207 = (_bitshift64Lshr(($205|0),($206|0),7)|0);
 $208 = tempRet0;
 $$val1118 = HEAP8[$2>>0]|0;
 $$idx1119 = ((($2)) + 1|0);
 $$idx1119$val = HEAP8[$$idx1119>>0]|0;
 $$idx1120 = ((($2)) + 2|0);
 $$idx1120$val = HEAP8[$$idx1120>>0]|0;
 $209 = $$val1118&255;
 $210 = $$idx1119$val&255;
 $211 = (_bitshift64Shl(($210|0),0,8)|0);
 $212 = tempRet0;
 $213 = $211 | $209;
 $214 = $$idx1120$val&255;
 $215 = (_bitshift64Shl(($214|0),0,16)|0);
 $216 = tempRet0;
 $217 = $215 & 2031616;
 $218 = $213 | $217;
 $219 = ((($2)) + 3|0);
 $220 = HEAP8[$219>>0]|0;
 $221 = $220&255;
 $222 = (_bitshift64Shl(($221|0),0,8)|0);
 $223 = tempRet0;
 $224 = $222 | $214;
 $225 = ((($2)) + 4|0);
 $226 = HEAP8[$225>>0]|0;
 $227 = $226&255;
 $228 = (_bitshift64Shl(($227|0),0,16)|0);
 $229 = tempRet0;
 $230 = $224 | $228;
 $231 = $223 | $229;
 $232 = ((($2)) + 5|0);
 $233 = HEAP8[$232>>0]|0;
 $234 = $233&255;
 $235 = (_bitshift64Shl(($234|0),0,24)|0);
 $236 = tempRet0;
 $237 = $230 | $235;
 $238 = $231 | $236;
 $239 = (_bitshift64Lshr(($237|0),($238|0),5)|0);
 $240 = tempRet0;
 $241 = $239 & 2097151;
 $$idx1116 = ((($2)) + 6|0);
 $$idx1116$val = HEAP8[$$idx1116>>0]|0;
 $$idx1117 = ((($2)) + 7|0);
 $$idx1117$val = HEAP8[$$idx1117>>0]|0;
 $242 = $$idx1116$val&255;
 $243 = (_bitshift64Shl(($242|0),0,8)|0);
 $244 = tempRet0;
 $245 = $243 | $234;
 $246 = $$idx1117$val&255;
 $247 = (_bitshift64Shl(($246|0),0,16)|0);
 $248 = tempRet0;
 $249 = $245 | $247;
 $250 = $244 | $248;
 $251 = (_bitshift64Lshr(($249|0),($250|0),2)|0);
 $252 = tempRet0;
 $253 = $251 & 2097151;
 $254 = ((($2)) + 8|0);
 $255 = HEAP8[$254>>0]|0;
 $256 = $255&255;
 $257 = (_bitshift64Shl(($256|0),0,8)|0);
 $258 = tempRet0;
 $259 = $257 | $246;
 $260 = ((($2)) + 9|0);
 $261 = HEAP8[$260>>0]|0;
 $262 = $261&255;
 $263 = (_bitshift64Shl(($262|0),0,16)|0);
 $264 = tempRet0;
 $265 = $259 | $263;
 $266 = $258 | $264;
 $267 = ((($2)) + 10|0);
 $268 = HEAP8[$267>>0]|0;
 $269 = $268&255;
 $270 = (_bitshift64Shl(($269|0),0,24)|0);
 $271 = tempRet0;
 $272 = $265 | $270;
 $273 = $266 | $271;
 $274 = (_bitshift64Lshr(($272|0),($273|0),7)|0);
 $275 = tempRet0;
 $276 = $274 & 2097151;
 $277 = ((($2)) + 11|0);
 $278 = HEAP8[$277>>0]|0;
 $279 = $278&255;
 $280 = (_bitshift64Shl(($279|0),0,8)|0);
 $281 = tempRet0;
 $282 = $280 | $269;
 $283 = ((($2)) + 12|0);
 $284 = HEAP8[$283>>0]|0;
 $285 = $284&255;
 $286 = (_bitshift64Shl(($285|0),0,16)|0);
 $287 = tempRet0;
 $288 = $282 | $286;
 $289 = $281 | $287;
 $290 = ((($2)) + 13|0);
 $291 = HEAP8[$290>>0]|0;
 $292 = $291&255;
 $293 = (_bitshift64Shl(($292|0),0,24)|0);
 $294 = tempRet0;
 $295 = $288 | $293;
 $296 = $289 | $294;
 $297 = (_bitshift64Lshr(($295|0),($296|0),4)|0);
 $298 = tempRet0;
 $299 = $297 & 2097151;
 $$idx1113 = ((($2)) + 14|0);
 $$idx1113$val = HEAP8[$$idx1113>>0]|0;
 $$idx1114 = ((($2)) + 15|0);
 $$idx1114$val = HEAP8[$$idx1114>>0]|0;
 $300 = $$idx1113$val&255;
 $301 = (_bitshift64Shl(($300|0),0,8)|0);
 $302 = tempRet0;
 $303 = $301 | $292;
 $304 = $$idx1114$val&255;
 $305 = (_bitshift64Shl(($304|0),0,16)|0);
 $306 = tempRet0;
 $307 = $303 | $305;
 $308 = $302 | $306;
 $309 = (_bitshift64Lshr(($307|0),($308|0),1)|0);
 $310 = tempRet0;
 $311 = $309 & 2097151;
 $312 = ((($2)) + 16|0);
 $313 = HEAP8[$312>>0]|0;
 $314 = $313&255;
 $315 = (_bitshift64Shl(($314|0),0,8)|0);
 $316 = tempRet0;
 $317 = $315 | $304;
 $318 = ((($2)) + 17|0);
 $319 = HEAP8[$318>>0]|0;
 $320 = $319&255;
 $321 = (_bitshift64Shl(($320|0),0,16)|0);
 $322 = tempRet0;
 $323 = $317 | $321;
 $324 = $316 | $322;
 $325 = ((($2)) + 18|0);
 $326 = HEAP8[$325>>0]|0;
 $327 = $326&255;
 $328 = (_bitshift64Shl(($327|0),0,24)|0);
 $329 = tempRet0;
 $330 = $323 | $328;
 $331 = $324 | $329;
 $332 = (_bitshift64Lshr(($330|0),($331|0),6)|0);
 $333 = tempRet0;
 $334 = $332 & 2097151;
 $$idx1110 = ((($2)) + 19|0);
 $$idx1110$val = HEAP8[$$idx1110>>0]|0;
 $$idx1111 = ((($2)) + 20|0);
 $$idx1111$val = HEAP8[$$idx1111>>0]|0;
 $335 = $$idx1110$val&255;
 $336 = (_bitshift64Shl(($335|0),0,8)|0);
 $337 = tempRet0;
 $338 = $336 | $327;
 $339 = $$idx1111$val&255;
 $340 = (_bitshift64Shl(($339|0),0,16)|0);
 $341 = tempRet0;
 $342 = $338 | $340;
 $343 = $337 | $341;
 $344 = (_bitshift64Lshr(($342|0),($343|0),3)|0);
 $345 = tempRet0;
 $346 = ((($2)) + 21|0);
 $$val1106 = HEAP8[$346>>0]|0;
 $$idx1107 = ((($2)) + 22|0);
 $$idx1107$val = HEAP8[$$idx1107>>0]|0;
 $$idx1108 = ((($2)) + 23|0);
 $$idx1108$val = HEAP8[$$idx1108>>0]|0;
 $347 = $$val1106&255;
 $348 = $$idx1107$val&255;
 $349 = (_bitshift64Shl(($348|0),0,8)|0);
 $350 = tempRet0;
 $351 = $349 | $347;
 $352 = $$idx1108$val&255;
 $353 = (_bitshift64Shl(($352|0),0,16)|0);
 $354 = tempRet0;
 $355 = $353 & 2031616;
 $356 = $351 | $355;
 $357 = ((($2)) + 24|0);
 $358 = HEAP8[$357>>0]|0;
 $359 = $358&255;
 $360 = (_bitshift64Shl(($359|0),0,8)|0);
 $361 = tempRet0;
 $362 = $360 | $352;
 $363 = ((($2)) + 25|0);
 $364 = HEAP8[$363>>0]|0;
 $365 = $364&255;
 $366 = (_bitshift64Shl(($365|0),0,16)|0);
 $367 = tempRet0;
 $368 = $362 | $366;
 $369 = $361 | $367;
 $370 = ((($2)) + 26|0);
 $371 = HEAP8[$370>>0]|0;
 $372 = $371&255;
 $373 = (_bitshift64Shl(($372|0),0,24)|0);
 $374 = tempRet0;
 $375 = $368 | $373;
 $376 = $369 | $374;
 $377 = (_bitshift64Lshr(($375|0),($376|0),5)|0);
 $378 = tempRet0;
 $379 = $377 & 2097151;
 $$idx1104 = ((($2)) + 27|0);
 $$idx1104$val = HEAP8[$$idx1104>>0]|0;
 $$idx1105 = ((($2)) + 28|0);
 $$idx1105$val = HEAP8[$$idx1105>>0]|0;
 $380 = $$idx1104$val&255;
 $381 = (_bitshift64Shl(($380|0),0,8)|0);
 $382 = tempRet0;
 $383 = $381 | $372;
 $384 = $$idx1105$val&255;
 $385 = (_bitshift64Shl(($384|0),0,16)|0);
 $386 = tempRet0;
 $387 = $383 | $385;
 $388 = $382 | $386;
 $389 = (_bitshift64Lshr(($387|0),($388|0),2)|0);
 $390 = tempRet0;
 $391 = $389 & 2097151;
 $392 = ((($2)) + 29|0);
 $393 = HEAP8[$392>>0]|0;
 $394 = $393&255;
 $395 = (_bitshift64Shl(($394|0),0,8)|0);
 $396 = tempRet0;
 $397 = $395 | $384;
 $398 = ((($2)) + 30|0);
 $399 = HEAP8[$398>>0]|0;
 $400 = $399&255;
 $401 = (_bitshift64Shl(($400|0),0,16)|0);
 $402 = tempRet0;
 $403 = $397 | $401;
 $404 = $396 | $402;
 $405 = ((($2)) + 31|0);
 $406 = HEAP8[$405>>0]|0;
 $407 = $406&255;
 $408 = (_bitshift64Shl(($407|0),0,24)|0);
 $409 = tempRet0;
 $410 = $403 | $408;
 $411 = $404 | $409;
 $412 = (_bitshift64Lshr(($410|0),($411|0),7)|0);
 $413 = tempRet0;
 $$val1100 = HEAP8[$3>>0]|0;
 $$idx1101 = ((($3)) + 1|0);
 $$idx1101$val = HEAP8[$$idx1101>>0]|0;
 $$idx1102 = ((($3)) + 2|0);
 $$idx1102$val = HEAP8[$$idx1102>>0]|0;
 $414 = $$val1100&255;
 $415 = $$idx1101$val&255;
 $416 = (_bitshift64Shl(($415|0),0,8)|0);
 $417 = tempRet0;
 $418 = $416 | $414;
 $419 = $$idx1102$val&255;
 $420 = (_bitshift64Shl(($419|0),0,16)|0);
 $421 = tempRet0;
 $422 = $420 & 2031616;
 $423 = $418 | $422;
 $424 = ((($3)) + 3|0);
 $425 = HEAP8[$424>>0]|0;
 $426 = $425&255;
 $427 = (_bitshift64Shl(($426|0),0,8)|0);
 $428 = tempRet0;
 $429 = $427 | $419;
 $430 = ((($3)) + 4|0);
 $431 = HEAP8[$430>>0]|0;
 $432 = $431&255;
 $433 = (_bitshift64Shl(($432|0),0,16)|0);
 $434 = tempRet0;
 $435 = $429 | $433;
 $436 = $428 | $434;
 $437 = ((($3)) + 5|0);
 $438 = HEAP8[$437>>0]|0;
 $439 = $438&255;
 $440 = (_bitshift64Shl(($439|0),0,24)|0);
 $441 = tempRet0;
 $442 = $435 | $440;
 $443 = $436 | $441;
 $444 = (_bitshift64Lshr(($442|0),($443|0),5)|0);
 $445 = tempRet0;
 $446 = $444 & 2097151;
 $$idx1098 = ((($3)) + 6|0);
 $$idx1098$val = HEAP8[$$idx1098>>0]|0;
 $$idx1099 = ((($3)) + 7|0);
 $$idx1099$val = HEAP8[$$idx1099>>0]|0;
 $447 = $$idx1098$val&255;
 $448 = (_bitshift64Shl(($447|0),0,8)|0);
 $449 = tempRet0;
 $450 = $448 | $439;
 $451 = $$idx1099$val&255;
 $452 = (_bitshift64Shl(($451|0),0,16)|0);
 $453 = tempRet0;
 $454 = $450 | $452;
 $455 = $449 | $453;
 $456 = (_bitshift64Lshr(($454|0),($455|0),2)|0);
 $457 = tempRet0;
 $458 = $456 & 2097151;
 $459 = ((($3)) + 8|0);
 $460 = HEAP8[$459>>0]|0;
 $461 = $460&255;
 $462 = (_bitshift64Shl(($461|0),0,8)|0);
 $463 = tempRet0;
 $464 = $462 | $451;
 $465 = ((($3)) + 9|0);
 $466 = HEAP8[$465>>0]|0;
 $467 = $466&255;
 $468 = (_bitshift64Shl(($467|0),0,16)|0);
 $469 = tempRet0;
 $470 = $464 | $468;
 $471 = $463 | $469;
 $472 = ((($3)) + 10|0);
 $473 = HEAP8[$472>>0]|0;
 $474 = $473&255;
 $475 = (_bitshift64Shl(($474|0),0,24)|0);
 $476 = tempRet0;
 $477 = $470 | $475;
 $478 = $471 | $476;
 $479 = (_bitshift64Lshr(($477|0),($478|0),7)|0);
 $480 = tempRet0;
 $481 = $479 & 2097151;
 $482 = ((($3)) + 11|0);
 $483 = HEAP8[$482>>0]|0;
 $484 = $483&255;
 $485 = (_bitshift64Shl(($484|0),0,8)|0);
 $486 = tempRet0;
 $487 = $485 | $474;
 $488 = ((($3)) + 12|0);
 $489 = HEAP8[$488>>0]|0;
 $490 = $489&255;
 $491 = (_bitshift64Shl(($490|0),0,16)|0);
 $492 = tempRet0;
 $493 = $487 | $491;
 $494 = $486 | $492;
 $495 = ((($3)) + 13|0);
 $496 = HEAP8[$495>>0]|0;
 $497 = $496&255;
 $498 = (_bitshift64Shl(($497|0),0,24)|0);
 $499 = tempRet0;
 $500 = $493 | $498;
 $501 = $494 | $499;
 $502 = (_bitshift64Lshr(($500|0),($501|0),4)|0);
 $503 = tempRet0;
 $504 = $502 & 2097151;
 $$idx1095 = ((($3)) + 14|0);
 $$idx1095$val = HEAP8[$$idx1095>>0]|0;
 $$idx1096 = ((($3)) + 15|0);
 $$idx1096$val = HEAP8[$$idx1096>>0]|0;
 $505 = $$idx1095$val&255;
 $506 = (_bitshift64Shl(($505|0),0,8)|0);
 $507 = tempRet0;
 $508 = $506 | $497;
 $509 = $$idx1096$val&255;
 $510 = (_bitshift64Shl(($509|0),0,16)|0);
 $511 = tempRet0;
 $512 = $508 | $510;
 $513 = $507 | $511;
 $514 = (_bitshift64Lshr(($512|0),($513|0),1)|0);
 $515 = tempRet0;
 $516 = $514 & 2097151;
 $517 = ((($3)) + 16|0);
 $518 = HEAP8[$517>>0]|0;
 $519 = $518&255;
 $520 = (_bitshift64Shl(($519|0),0,8)|0);
 $521 = tempRet0;
 $522 = $520 | $509;
 $523 = ((($3)) + 17|0);
 $524 = HEAP8[$523>>0]|0;
 $525 = $524&255;
 $526 = (_bitshift64Shl(($525|0),0,16)|0);
 $527 = tempRet0;
 $528 = $522 | $526;
 $529 = $521 | $527;
 $530 = ((($3)) + 18|0);
 $531 = HEAP8[$530>>0]|0;
 $532 = $531&255;
 $533 = (_bitshift64Shl(($532|0),0,24)|0);
 $534 = tempRet0;
 $535 = $528 | $533;
 $536 = $529 | $534;
 $537 = (_bitshift64Lshr(($535|0),($536|0),6)|0);
 $538 = tempRet0;
 $539 = $537 & 2097151;
 $$idx1092 = ((($3)) + 19|0);
 $$idx1092$val = HEAP8[$$idx1092>>0]|0;
 $$idx1093 = ((($3)) + 20|0);
 $$idx1093$val = HEAP8[$$idx1093>>0]|0;
 $540 = $$idx1092$val&255;
 $541 = (_bitshift64Shl(($540|0),0,8)|0);
 $542 = tempRet0;
 $543 = $541 | $532;
 $544 = $$idx1093$val&255;
 $545 = (_bitshift64Shl(($544|0),0,16)|0);
 $546 = tempRet0;
 $547 = $543 | $545;
 $548 = $542 | $546;
 $549 = (_bitshift64Lshr(($547|0),($548|0),3)|0);
 $550 = tempRet0;
 $551 = ((($3)) + 21|0);
 $$val1088 = HEAP8[$551>>0]|0;
 $$idx1089 = ((($3)) + 22|0);
 $$idx1089$val = HEAP8[$$idx1089>>0]|0;
 $$idx1090 = ((($3)) + 23|0);
 $$idx1090$val = HEAP8[$$idx1090>>0]|0;
 $552 = $$val1088&255;
 $553 = $$idx1089$val&255;
 $554 = (_bitshift64Shl(($553|0),0,8)|0);
 $555 = tempRet0;
 $556 = $554 | $552;
 $557 = $$idx1090$val&255;
 $558 = (_bitshift64Shl(($557|0),0,16)|0);
 $559 = tempRet0;
 $560 = $558 & 2031616;
 $561 = $556 | $560;
 $562 = ((($3)) + 24|0);
 $563 = HEAP8[$562>>0]|0;
 $564 = $563&255;
 $565 = (_bitshift64Shl(($564|0),0,8)|0);
 $566 = tempRet0;
 $567 = $565 | $557;
 $568 = ((($3)) + 25|0);
 $569 = HEAP8[$568>>0]|0;
 $570 = $569&255;
 $571 = (_bitshift64Shl(($570|0),0,16)|0);
 $572 = tempRet0;
 $573 = $567 | $571;
 $574 = $566 | $572;
 $575 = ((($3)) + 26|0);
 $576 = HEAP8[$575>>0]|0;
 $577 = $576&255;
 $578 = (_bitshift64Shl(($577|0),0,24)|0);
 $579 = tempRet0;
 $580 = $573 | $578;
 $581 = $574 | $579;
 $582 = (_bitshift64Lshr(($580|0),($581|0),5)|0);
 $583 = tempRet0;
 $584 = $582 & 2097151;
 $$idx = ((($3)) + 27|0);
 $$idx$val = HEAP8[$$idx>>0]|0;
 $$idx1087 = ((($3)) + 28|0);
 $$idx1087$val = HEAP8[$$idx1087>>0]|0;
 $585 = $$idx$val&255;
 $586 = (_bitshift64Shl(($585|0),0,8)|0);
 $587 = tempRet0;
 $588 = $586 | $577;
 $589 = $$idx1087$val&255;
 $590 = (_bitshift64Shl(($589|0),0,16)|0);
 $591 = tempRet0;
 $592 = $588 | $590;
 $593 = $587 | $591;
 $594 = (_bitshift64Lshr(($592|0),($593|0),2)|0);
 $595 = tempRet0;
 $596 = $594 & 2097151;
 $597 = ((($3)) + 29|0);
 $598 = HEAP8[$597>>0]|0;
 $599 = $598&255;
 $600 = (_bitshift64Shl(($599|0),0,8)|0);
 $601 = tempRet0;
 $602 = $600 | $589;
 $603 = ((($3)) + 30|0);
 $604 = HEAP8[$603>>0]|0;
 $605 = $604&255;
 $606 = (_bitshift64Shl(($605|0),0,16)|0);
 $607 = tempRet0;
 $608 = $602 | $606;
 $609 = $601 | $607;
 $610 = ((($3)) + 31|0);
 $611 = HEAP8[$610>>0]|0;
 $612 = $611&255;
 $613 = (_bitshift64Shl(($612|0),0,24)|0);
 $614 = tempRet0;
 $615 = $608 | $613;
 $616 = $609 | $614;
 $617 = (_bitshift64Lshr(($615|0),($616|0),7)|0);
 $618 = tempRet0;
 $619 = (___muldi3(($218|0),($212|0),($13|0),($7|0))|0);
 $620 = tempRet0;
 $621 = (_i64Add(($423|0),($417|0),($619|0),($620|0))|0);
 $622 = tempRet0;
 $623 = (___muldi3(($241|0),0,($13|0),($7|0))|0);
 $624 = tempRet0;
 $625 = (___muldi3(($218|0),($212|0),($36|0),0)|0);
 $626 = tempRet0;
 $627 = (___muldi3(($253|0),0,($13|0),($7|0))|0);
 $628 = tempRet0;
 $629 = (___muldi3(($241|0),0,($36|0),0)|0);
 $630 = tempRet0;
 $631 = (___muldi3(($218|0),($212|0),($48|0),0)|0);
 $632 = tempRet0;
 $633 = (_i64Add(($629|0),($630|0),($631|0),($632|0))|0);
 $634 = tempRet0;
 $635 = (_i64Add(($633|0),($634|0),($627|0),($628|0))|0);
 $636 = tempRet0;
 $637 = (_i64Add(($635|0),($636|0),($458|0),0)|0);
 $638 = tempRet0;
 $639 = (___muldi3(($276|0),0,($13|0),($7|0))|0);
 $640 = tempRet0;
 $641 = (___muldi3(($253|0),0,($36|0),0)|0);
 $642 = tempRet0;
 $643 = (___muldi3(($241|0),0,($48|0),0)|0);
 $644 = tempRet0;
 $645 = (___muldi3(($218|0),($212|0),($71|0),0)|0);
 $646 = tempRet0;
 $647 = (___muldi3(($299|0),0,($13|0),($7|0))|0);
 $648 = tempRet0;
 $649 = (___muldi3(($276|0),0,($36|0),0)|0);
 $650 = tempRet0;
 $651 = (___muldi3(($253|0),0,($48|0),0)|0);
 $652 = tempRet0;
 $653 = (___muldi3(($241|0),0,($71|0),0)|0);
 $654 = tempRet0;
 $655 = (___muldi3(($218|0),($212|0),($94|0),0)|0);
 $656 = tempRet0;
 $657 = (_i64Add(($653|0),($654|0),($655|0),($656|0))|0);
 $658 = tempRet0;
 $659 = (_i64Add(($657|0),($658|0),($651|0),($652|0))|0);
 $660 = tempRet0;
 $661 = (_i64Add(($659|0),($660|0),($649|0),($650|0))|0);
 $662 = tempRet0;
 $663 = (_i64Add(($661|0),($662|0),($647|0),($648|0))|0);
 $664 = tempRet0;
 $665 = (_i64Add(($663|0),($664|0),($504|0),0)|0);
 $666 = tempRet0;
 $667 = (___muldi3(($311|0),0,($13|0),($7|0))|0);
 $668 = tempRet0;
 $669 = (___muldi3(($299|0),0,($36|0),0)|0);
 $670 = tempRet0;
 $671 = (___muldi3(($276|0),0,($48|0),0)|0);
 $672 = tempRet0;
 $673 = (___muldi3(($253|0),0,($71|0),0)|0);
 $674 = tempRet0;
 $675 = (___muldi3(($241|0),0,($94|0),0)|0);
 $676 = tempRet0;
 $677 = (___muldi3(($218|0),($212|0),($106|0),0)|0);
 $678 = tempRet0;
 $679 = (___muldi3(($334|0),0,($13|0),($7|0))|0);
 $680 = tempRet0;
 $681 = (___muldi3(($311|0),0,($36|0),0)|0);
 $682 = tempRet0;
 $683 = (___muldi3(($299|0),0,($48|0),0)|0);
 $684 = tempRet0;
 $685 = (___muldi3(($276|0),0,($71|0),0)|0);
 $686 = tempRet0;
 $687 = (___muldi3(($253|0),0,($94|0),0)|0);
 $688 = tempRet0;
 $689 = (___muldi3(($241|0),0,($106|0),0)|0);
 $690 = tempRet0;
 $691 = (___muldi3(($218|0),($212|0),($129|0),0)|0);
 $692 = tempRet0;
 $693 = (_i64Add(($689|0),($690|0),($691|0),($692|0))|0);
 $694 = tempRet0;
 $695 = (_i64Add(($693|0),($694|0),($687|0),($688|0))|0);
 $696 = tempRet0;
 $697 = (_i64Add(($695|0),($696|0),($685|0),($686|0))|0);
 $698 = tempRet0;
 $699 = (_i64Add(($697|0),($698|0),($683|0),($684|0))|0);
 $700 = tempRet0;
 $701 = (_i64Add(($699|0),($700|0),($681|0),($682|0))|0);
 $702 = tempRet0;
 $703 = (_i64Add(($701|0),($702|0),($679|0),($680|0))|0);
 $704 = tempRet0;
 $705 = (_i64Add(($703|0),($704|0),($539|0),0)|0);
 $706 = tempRet0;
 $707 = (___muldi3(($344|0),($345|0),($13|0),($7|0))|0);
 $708 = tempRet0;
 $709 = (___muldi3(($334|0),0,($36|0),0)|0);
 $710 = tempRet0;
 $711 = (___muldi3(($311|0),0,($48|0),0)|0);
 $712 = tempRet0;
 $713 = (___muldi3(($299|0),0,($71|0),0)|0);
 $714 = tempRet0;
 $715 = (___muldi3(($276|0),0,($94|0),0)|0);
 $716 = tempRet0;
 $717 = (___muldi3(($253|0),0,($106|0),0)|0);
 $718 = tempRet0;
 $719 = (___muldi3(($241|0),0,($129|0),0)|0);
 $720 = tempRet0;
 $721 = (___muldi3(($218|0),($212|0),($139|0),($140|0))|0);
 $722 = tempRet0;
 $723 = (___muldi3(($356|0),($350|0),($13|0),($7|0))|0);
 $724 = tempRet0;
 $725 = (___muldi3(($344|0),($345|0),($36|0),0)|0);
 $726 = tempRet0;
 $727 = (___muldi3(($334|0),0,($48|0),0)|0);
 $728 = tempRet0;
 $729 = (___muldi3(($311|0),0,($71|0),0)|0);
 $730 = tempRet0;
 $731 = (___muldi3(($299|0),0,($94|0),0)|0);
 $732 = tempRet0;
 $733 = (___muldi3(($276|0),0,($106|0),0)|0);
 $734 = tempRet0;
 $735 = (___muldi3(($253|0),0,($129|0),0)|0);
 $736 = tempRet0;
 $737 = (___muldi3(($241|0),0,($139|0),($140|0))|0);
 $738 = tempRet0;
 $739 = (___muldi3(($218|0),($212|0),($151|0),($145|0))|0);
 $740 = tempRet0;
 $741 = (_i64Add(($737|0),($738|0),($739|0),($740|0))|0);
 $742 = tempRet0;
 $743 = (_i64Add(($741|0),($742|0),($735|0),($736|0))|0);
 $744 = tempRet0;
 $745 = (_i64Add(($743|0),($744|0),($733|0),($734|0))|0);
 $746 = tempRet0;
 $747 = (_i64Add(($745|0),($746|0),($731|0),($732|0))|0);
 $748 = tempRet0;
 $749 = (_i64Add(($747|0),($748|0),($729|0),($730|0))|0);
 $750 = tempRet0;
 $751 = (_i64Add(($749|0),($750|0),($727|0),($728|0))|0);
 $752 = tempRet0;
 $753 = (_i64Add(($751|0),($752|0),($725|0),($726|0))|0);
 $754 = tempRet0;
 $755 = (_i64Add(($753|0),($754|0),($723|0),($724|0))|0);
 $756 = tempRet0;
 $757 = (_i64Add(($755|0),($756|0),($561|0),($555|0))|0);
 $758 = tempRet0;
 $759 = (___muldi3(($379|0),0,($13|0),($7|0))|0);
 $760 = tempRet0;
 $761 = (___muldi3(($356|0),($350|0),($36|0),0)|0);
 $762 = tempRet0;
 $763 = (___muldi3(($344|0),($345|0),($48|0),0)|0);
 $764 = tempRet0;
 $765 = (___muldi3(($334|0),0,($71|0),0)|0);
 $766 = tempRet0;
 $767 = (___muldi3(($311|0),0,($94|0),0)|0);
 $768 = tempRet0;
 $769 = (___muldi3(($299|0),0,($106|0),0)|0);
 $770 = tempRet0;
 $771 = (___muldi3(($276|0),0,($129|0),0)|0);
 $772 = tempRet0;
 $773 = (___muldi3(($253|0),0,($139|0),($140|0))|0);
 $774 = tempRet0;
 $775 = (___muldi3(($241|0),0,($151|0),($145|0))|0);
 $776 = tempRet0;
 $777 = (___muldi3(($218|0),($212|0),($174|0),0)|0);
 $778 = tempRet0;
 $779 = (___muldi3(($391|0),0,($13|0),($7|0))|0);
 $780 = tempRet0;
 $781 = (___muldi3(($379|0),0,($36|0),0)|0);
 $782 = tempRet0;
 $783 = (___muldi3(($356|0),($350|0),($48|0),0)|0);
 $784 = tempRet0;
 $785 = (___muldi3(($344|0),($345|0),($71|0),0)|0);
 $786 = tempRet0;
 $787 = (___muldi3(($334|0),0,($94|0),0)|0);
 $788 = tempRet0;
 $789 = (___muldi3(($311|0),0,($106|0),0)|0);
 $790 = tempRet0;
 $791 = (___muldi3(($299|0),0,($129|0),0)|0);
 $792 = tempRet0;
 $793 = (___muldi3(($276|0),0,($139|0),($140|0))|0);
 $794 = tempRet0;
 $795 = (___muldi3(($253|0),0,($151|0),($145|0))|0);
 $796 = tempRet0;
 $797 = (___muldi3(($241|0),0,($174|0),0)|0);
 $798 = tempRet0;
 $799 = (___muldi3(($218|0),($212|0),($186|0),0)|0);
 $800 = tempRet0;
 $801 = (_i64Add(($797|0),($798|0),($799|0),($800|0))|0);
 $802 = tempRet0;
 $803 = (_i64Add(($801|0),($802|0),($795|0),($796|0))|0);
 $804 = tempRet0;
 $805 = (_i64Add(($803|0),($804|0),($793|0),($794|0))|0);
 $806 = tempRet0;
 $807 = (_i64Add(($805|0),($806|0),($791|0),($792|0))|0);
 $808 = tempRet0;
 $809 = (_i64Add(($807|0),($808|0),($789|0),($790|0))|0);
 $810 = tempRet0;
 $811 = (_i64Add(($809|0),($810|0),($787|0),($788|0))|0);
 $812 = tempRet0;
 $813 = (_i64Add(($811|0),($812|0),($785|0),($786|0))|0);
 $814 = tempRet0;
 $815 = (_i64Add(($813|0),($814|0),($783|0),($784|0))|0);
 $816 = tempRet0;
 $817 = (_i64Add(($815|0),($816|0),($781|0),($782|0))|0);
 $818 = tempRet0;
 $819 = (_i64Add(($817|0),($818|0),($779|0),($780|0))|0);
 $820 = tempRet0;
 $821 = (_i64Add(($819|0),($820|0),($596|0),0)|0);
 $822 = tempRet0;
 $823 = (___muldi3(($412|0),($413|0),($13|0),($7|0))|0);
 $824 = tempRet0;
 $825 = (___muldi3(($391|0),0,($36|0),0)|0);
 $826 = tempRet0;
 $827 = (___muldi3(($379|0),0,($48|0),0)|0);
 $828 = tempRet0;
 $829 = (___muldi3(($356|0),($350|0),($71|0),0)|0);
 $830 = tempRet0;
 $831 = (___muldi3(($344|0),($345|0),($94|0),0)|0);
 $832 = tempRet0;
 $833 = (___muldi3(($334|0),0,($106|0),0)|0);
 $834 = tempRet0;
 $835 = (___muldi3(($311|0),0,($129|0),0)|0);
 $836 = tempRet0;
 $837 = (___muldi3(($299|0),0,($139|0),($140|0))|0);
 $838 = tempRet0;
 $839 = (___muldi3(($276|0),0,($151|0),($145|0))|0);
 $840 = tempRet0;
 $841 = (___muldi3(($253|0),0,($174|0),0)|0);
 $842 = tempRet0;
 $843 = (___muldi3(($241|0),0,($186|0),0)|0);
 $844 = tempRet0;
 $845 = (___muldi3(($218|0),($212|0),($207|0),($208|0))|0);
 $846 = tempRet0;
 $847 = (___muldi3(($412|0),($413|0),($36|0),0)|0);
 $848 = tempRet0;
 $849 = (___muldi3(($391|0),0,($48|0),0)|0);
 $850 = tempRet0;
 $851 = (___muldi3(($379|0),0,($71|0),0)|0);
 $852 = tempRet0;
 $853 = (___muldi3(($356|0),($350|0),($94|0),0)|0);
 $854 = tempRet0;
 $855 = (___muldi3(($344|0),($345|0),($106|0),0)|0);
 $856 = tempRet0;
 $857 = (___muldi3(($334|0),0,($129|0),0)|0);
 $858 = tempRet0;
 $859 = (___muldi3(($311|0),0,($139|0),($140|0))|0);
 $860 = tempRet0;
 $861 = (___muldi3(($299|0),0,($151|0),($145|0))|0);
 $862 = tempRet0;
 $863 = (___muldi3(($276|0),0,($174|0),0)|0);
 $864 = tempRet0;
 $865 = (___muldi3(($253|0),0,($186|0),0)|0);
 $866 = tempRet0;
 $867 = (___muldi3(($241|0),0,($207|0),($208|0))|0);
 $868 = tempRet0;
 $869 = (_i64Add(($865|0),($866|0),($867|0),($868|0))|0);
 $870 = tempRet0;
 $871 = (_i64Add(($869|0),($870|0),($863|0),($864|0))|0);
 $872 = tempRet0;
 $873 = (_i64Add(($871|0),($872|0),($861|0),($862|0))|0);
 $874 = tempRet0;
 $875 = (_i64Add(($873|0),($874|0),($859|0),($860|0))|0);
 $876 = tempRet0;
 $877 = (_i64Add(($875|0),($876|0),($857|0),($858|0))|0);
 $878 = tempRet0;
 $879 = (_i64Add(($877|0),($878|0),($855|0),($856|0))|0);
 $880 = tempRet0;
 $881 = (_i64Add(($879|0),($880|0),($853|0),($854|0))|0);
 $882 = tempRet0;
 $883 = (_i64Add(($881|0),($882|0),($851|0),($852|0))|0);
 $884 = tempRet0;
 $885 = (_i64Add(($883|0),($884|0),($849|0),($850|0))|0);
 $886 = tempRet0;
 $887 = (_i64Add(($885|0),($886|0),($847|0),($848|0))|0);
 $888 = tempRet0;
 $889 = (___muldi3(($412|0),($413|0),($48|0),0)|0);
 $890 = tempRet0;
 $891 = (___muldi3(($391|0),0,($71|0),0)|0);
 $892 = tempRet0;
 $893 = (___muldi3(($379|0),0,($94|0),0)|0);
 $894 = tempRet0;
 $895 = (___muldi3(($356|0),($350|0),($106|0),0)|0);
 $896 = tempRet0;
 $897 = (___muldi3(($344|0),($345|0),($129|0),0)|0);
 $898 = tempRet0;
 $899 = (___muldi3(($334|0),0,($139|0),($140|0))|0);
 $900 = tempRet0;
 $901 = (___muldi3(($311|0),0,($151|0),($145|0))|0);
 $902 = tempRet0;
 $903 = (___muldi3(($299|0),0,($174|0),0)|0);
 $904 = tempRet0;
 $905 = (___muldi3(($276|0),0,($186|0),0)|0);
 $906 = tempRet0;
 $907 = (___muldi3(($253|0),0,($207|0),($208|0))|0);
 $908 = tempRet0;
 $909 = (___muldi3(($412|0),($413|0),($71|0),0)|0);
 $910 = tempRet0;
 $911 = (___muldi3(($391|0),0,($94|0),0)|0);
 $912 = tempRet0;
 $913 = (___muldi3(($379|0),0,($106|0),0)|0);
 $914 = tempRet0;
 $915 = (___muldi3(($356|0),($350|0),($129|0),0)|0);
 $916 = tempRet0;
 $917 = (___muldi3(($344|0),($345|0),($139|0),($140|0))|0);
 $918 = tempRet0;
 $919 = (___muldi3(($334|0),0,($151|0),($145|0))|0);
 $920 = tempRet0;
 $921 = (___muldi3(($311|0),0,($174|0),0)|0);
 $922 = tempRet0;
 $923 = (___muldi3(($299|0),0,($186|0),0)|0);
 $924 = tempRet0;
 $925 = (___muldi3(($276|0),0,($207|0),($208|0))|0);
 $926 = tempRet0;
 $927 = (_i64Add(($923|0),($924|0),($925|0),($926|0))|0);
 $928 = tempRet0;
 $929 = (_i64Add(($927|0),($928|0),($921|0),($922|0))|0);
 $930 = tempRet0;
 $931 = (_i64Add(($929|0),($930|0),($919|0),($920|0))|0);
 $932 = tempRet0;
 $933 = (_i64Add(($931|0),($932|0),($917|0),($918|0))|0);
 $934 = tempRet0;
 $935 = (_i64Add(($933|0),($934|0),($915|0),($916|0))|0);
 $936 = tempRet0;
 $937 = (_i64Add(($935|0),($936|0),($913|0),($914|0))|0);
 $938 = tempRet0;
 $939 = (_i64Add(($937|0),($938|0),($911|0),($912|0))|0);
 $940 = tempRet0;
 $941 = (_i64Add(($939|0),($940|0),($909|0),($910|0))|0);
 $942 = tempRet0;
 $943 = (___muldi3(($412|0),($413|0),($94|0),0)|0);
 $944 = tempRet0;
 $945 = (___muldi3(($391|0),0,($106|0),0)|0);
 $946 = tempRet0;
 $947 = (___muldi3(($379|0),0,($129|0),0)|0);
 $948 = tempRet0;
 $949 = (___muldi3(($356|0),($350|0),($139|0),($140|0))|0);
 $950 = tempRet0;
 $951 = (___muldi3(($344|0),($345|0),($151|0),($145|0))|0);
 $952 = tempRet0;
 $953 = (___muldi3(($334|0),0,($174|0),0)|0);
 $954 = tempRet0;
 $955 = (___muldi3(($311|0),0,($186|0),0)|0);
 $956 = tempRet0;
 $957 = (___muldi3(($299|0),0,($207|0),($208|0))|0);
 $958 = tempRet0;
 $959 = (___muldi3(($412|0),($413|0),($106|0),0)|0);
 $960 = tempRet0;
 $961 = (___muldi3(($391|0),0,($129|0),0)|0);
 $962 = tempRet0;
 $963 = (___muldi3(($379|0),0,($139|0),($140|0))|0);
 $964 = tempRet0;
 $965 = (___muldi3(($356|0),($350|0),($151|0),($145|0))|0);
 $966 = tempRet0;
 $967 = (___muldi3(($344|0),($345|0),($174|0),0)|0);
 $968 = tempRet0;
 $969 = (___muldi3(($334|0),0,($186|0),0)|0);
 $970 = tempRet0;
 $971 = (___muldi3(($311|0),0,($207|0),($208|0))|0);
 $972 = tempRet0;
 $973 = (_i64Add(($969|0),($970|0),($971|0),($972|0))|0);
 $974 = tempRet0;
 $975 = (_i64Add(($973|0),($974|0),($967|0),($968|0))|0);
 $976 = tempRet0;
 $977 = (_i64Add(($975|0),($976|0),($965|0),($966|0))|0);
 $978 = tempRet0;
 $979 = (_i64Add(($977|0),($978|0),($963|0),($964|0))|0);
 $980 = tempRet0;
 $981 = (_i64Add(($979|0),($980|0),($961|0),($962|0))|0);
 $982 = tempRet0;
 $983 = (_i64Add(($981|0),($982|0),($959|0),($960|0))|0);
 $984 = tempRet0;
 $985 = (___muldi3(($412|0),($413|0),($129|0),0)|0);
 $986 = tempRet0;
 $987 = (___muldi3(($391|0),0,($139|0),($140|0))|0);
 $988 = tempRet0;
 $989 = (___muldi3(($379|0),0,($151|0),($145|0))|0);
 $990 = tempRet0;
 $991 = (___muldi3(($356|0),($350|0),($174|0),0)|0);
 $992 = tempRet0;
 $993 = (___muldi3(($344|0),($345|0),($186|0),0)|0);
 $994 = tempRet0;
 $995 = (___muldi3(($334|0),0,($207|0),($208|0))|0);
 $996 = tempRet0;
 $997 = (___muldi3(($412|0),($413|0),($139|0),($140|0))|0);
 $998 = tempRet0;
 $999 = (___muldi3(($391|0),0,($151|0),($145|0))|0);
 $1000 = tempRet0;
 $1001 = (___muldi3(($379|0),0,($174|0),0)|0);
 $1002 = tempRet0;
 $1003 = (___muldi3(($356|0),($350|0),($186|0),0)|0);
 $1004 = tempRet0;
 $1005 = (___muldi3(($344|0),($345|0),($207|0),($208|0))|0);
 $1006 = tempRet0;
 $1007 = (_i64Add(($1003|0),($1004|0),($1005|0),($1006|0))|0);
 $1008 = tempRet0;
 $1009 = (_i64Add(($1007|0),($1008|0),($1001|0),($1002|0))|0);
 $1010 = tempRet0;
 $1011 = (_i64Add(($1009|0),($1010|0),($999|0),($1000|0))|0);
 $1012 = tempRet0;
 $1013 = (_i64Add(($1011|0),($1012|0),($997|0),($998|0))|0);
 $1014 = tempRet0;
 $1015 = (___muldi3(($412|0),($413|0),($151|0),($145|0))|0);
 $1016 = tempRet0;
 $1017 = (___muldi3(($391|0),0,($174|0),0)|0);
 $1018 = tempRet0;
 $1019 = (___muldi3(($379|0),0,($186|0),0)|0);
 $1020 = tempRet0;
 $1021 = (___muldi3(($356|0),($350|0),($207|0),($208|0))|0);
 $1022 = tempRet0;
 $1023 = (___muldi3(($412|0),($413|0),($174|0),0)|0);
 $1024 = tempRet0;
 $1025 = (___muldi3(($391|0),0,($186|0),0)|0);
 $1026 = tempRet0;
 $1027 = (___muldi3(($379|0),0,($207|0),($208|0))|0);
 $1028 = tempRet0;
 $1029 = (_i64Add(($1025|0),($1026|0),($1027|0),($1028|0))|0);
 $1030 = tempRet0;
 $1031 = (_i64Add(($1029|0),($1030|0),($1023|0),($1024|0))|0);
 $1032 = tempRet0;
 $1033 = (___muldi3(($412|0),($413|0),($186|0),0)|0);
 $1034 = tempRet0;
 $1035 = (___muldi3(($391|0),0,($207|0),($208|0))|0);
 $1036 = tempRet0;
 $1037 = (_i64Add(($1033|0),($1034|0),($1035|0),($1036|0))|0);
 $1038 = tempRet0;
 $1039 = (___muldi3(($412|0),($413|0),($207|0),($208|0))|0);
 $1040 = tempRet0;
 $1041 = (_i64Add(($621|0),($622|0),1048576,0)|0);
 $1042 = tempRet0;
 $1043 = (_bitshift64Lshr(($1041|0),($1042|0),21)|0);
 $1044 = tempRet0;
 $1045 = (_i64Add(($623|0),($624|0),($625|0),($626|0))|0);
 $1046 = tempRet0;
 $1047 = (_i64Add(($1045|0),($1046|0),($1043|0),($1044|0))|0);
 $1048 = tempRet0;
 $1049 = (_i64Add(($1047|0),($1048|0),($446|0),0)|0);
 $1050 = tempRet0;
 $1051 = $1041 & -2097152;
 $1052 = $1042 & 4095;
 $1053 = (_i64Subtract(($621|0),($622|0),($1051|0),($1052|0))|0);
 $1054 = tempRet0;
 $1055 = (_i64Add(($637|0),($638|0),1048576,0)|0);
 $1056 = tempRet0;
 $1057 = (_bitshift64Lshr(($1055|0),($1056|0),21)|0);
 $1058 = tempRet0;
 $1059 = (_i64Add(($643|0),($644|0),($645|0),($646|0))|0);
 $1060 = tempRet0;
 $1061 = (_i64Add(($1059|0),($1060|0),($641|0),($642|0))|0);
 $1062 = tempRet0;
 $1063 = (_i64Add(($1061|0),($1062|0),($639|0),($640|0))|0);
 $1064 = tempRet0;
 $1065 = (_i64Add(($1063|0),($1064|0),($481|0),0)|0);
 $1066 = tempRet0;
 $1067 = (_i64Add(($1065|0),($1066|0),($1057|0),($1058|0))|0);
 $1068 = tempRet0;
 $1069 = $1055 & -2097152;
 $1070 = (_i64Add(($665|0),($666|0),1048576,0)|0);
 $1071 = tempRet0;
 $1072 = (_bitshift64Ashr(($1070|0),($1071|0),21)|0);
 $1073 = tempRet0;
 $1074 = (_i64Add(($675|0),($676|0),($677|0),($678|0))|0);
 $1075 = tempRet0;
 $1076 = (_i64Add(($1074|0),($1075|0),($673|0),($674|0))|0);
 $1077 = tempRet0;
 $1078 = (_i64Add(($1076|0),($1077|0),($671|0),($672|0))|0);
 $1079 = tempRet0;
 $1080 = (_i64Add(($1078|0),($1079|0),($669|0),($670|0))|0);
 $1081 = tempRet0;
 $1082 = (_i64Add(($1080|0),($1081|0),($667|0),($668|0))|0);
 $1083 = tempRet0;
 $1084 = (_i64Add(($1082|0),($1083|0),($516|0),0)|0);
 $1085 = tempRet0;
 $1086 = (_i64Add(($1084|0),($1085|0),($1072|0),($1073|0))|0);
 $1087 = tempRet0;
 $1088 = $1070 & -2097152;
 $1089 = (_i64Add(($705|0),($706|0),1048576,0)|0);
 $1090 = tempRet0;
 $1091 = (_bitshift64Ashr(($1089|0),($1090|0),21)|0);
 $1092 = tempRet0;
 $1093 = (_i64Add(($719|0),($720|0),($721|0),($722|0))|0);
 $1094 = tempRet0;
 $1095 = (_i64Add(($1093|0),($1094|0),($717|0),($718|0))|0);
 $1096 = tempRet0;
 $1097 = (_i64Add(($1095|0),($1096|0),($715|0),($716|0))|0);
 $1098 = tempRet0;
 $1099 = (_i64Add(($1097|0),($1098|0),($713|0),($714|0))|0);
 $1100 = tempRet0;
 $1101 = (_i64Add(($1099|0),($1100|0),($711|0),($712|0))|0);
 $1102 = tempRet0;
 $1103 = (_i64Add(($1101|0),($1102|0),($709|0),($710|0))|0);
 $1104 = tempRet0;
 $1105 = (_i64Add(($1103|0),($1104|0),($707|0),($708|0))|0);
 $1106 = tempRet0;
 $1107 = (_i64Add(($1105|0),($1106|0),($549|0),($550|0))|0);
 $1108 = tempRet0;
 $1109 = (_i64Add(($1107|0),($1108|0),($1091|0),($1092|0))|0);
 $1110 = tempRet0;
 $1111 = $1089 & -2097152;
 $1112 = (_i64Add(($757|0),($758|0),1048576,0)|0);
 $1113 = tempRet0;
 $1114 = (_bitshift64Ashr(($1112|0),($1113|0),21)|0);
 $1115 = tempRet0;
 $1116 = (_i64Add(($775|0),($776|0),($777|0),($778|0))|0);
 $1117 = tempRet0;
 $1118 = (_i64Add(($1116|0),($1117|0),($773|0),($774|0))|0);
 $1119 = tempRet0;
 $1120 = (_i64Add(($1118|0),($1119|0),($771|0),($772|0))|0);
 $1121 = tempRet0;
 $1122 = (_i64Add(($1120|0),($1121|0),($769|0),($770|0))|0);
 $1123 = tempRet0;
 $1124 = (_i64Add(($1122|0),($1123|0),($767|0),($768|0))|0);
 $1125 = tempRet0;
 $1126 = (_i64Add(($1124|0),($1125|0),($765|0),($766|0))|0);
 $1127 = tempRet0;
 $1128 = (_i64Add(($1126|0),($1127|0),($763|0),($764|0))|0);
 $1129 = tempRet0;
 $1130 = (_i64Add(($1128|0),($1129|0),($761|0),($762|0))|0);
 $1131 = tempRet0;
 $1132 = (_i64Add(($1130|0),($1131|0),($759|0),($760|0))|0);
 $1133 = tempRet0;
 $1134 = (_i64Add(($1132|0),($1133|0),($584|0),0)|0);
 $1135 = tempRet0;
 $1136 = (_i64Add(($1134|0),($1135|0),($1114|0),($1115|0))|0);
 $1137 = tempRet0;
 $1138 = $1112 & -2097152;
 $1139 = (_i64Add(($821|0),($822|0),1048576,0)|0);
 $1140 = tempRet0;
 $1141 = (_bitshift64Ashr(($1139|0),($1140|0),21)|0);
 $1142 = tempRet0;
 $1143 = (_i64Add(($843|0),($844|0),($845|0),($846|0))|0);
 $1144 = tempRet0;
 $1145 = (_i64Add(($1143|0),($1144|0),($841|0),($842|0))|0);
 $1146 = tempRet0;
 $1147 = (_i64Add(($1145|0),($1146|0),($839|0),($840|0))|0);
 $1148 = tempRet0;
 $1149 = (_i64Add(($1147|0),($1148|0),($837|0),($838|0))|0);
 $1150 = tempRet0;
 $1151 = (_i64Add(($1149|0),($1150|0),($835|0),($836|0))|0);
 $1152 = tempRet0;
 $1153 = (_i64Add(($1151|0),($1152|0),($833|0),($834|0))|0);
 $1154 = tempRet0;
 $1155 = (_i64Add(($1153|0),($1154|0),($831|0),($832|0))|0);
 $1156 = tempRet0;
 $1157 = (_i64Add(($1155|0),($1156|0),($829|0),($830|0))|0);
 $1158 = tempRet0;
 $1159 = (_i64Add(($1157|0),($1158|0),($827|0),($828|0))|0);
 $1160 = tempRet0;
 $1161 = (_i64Add(($1159|0),($1160|0),($825|0),($826|0))|0);
 $1162 = tempRet0;
 $1163 = (_i64Add(($1161|0),($1162|0),($823|0),($824|0))|0);
 $1164 = tempRet0;
 $1165 = (_i64Add(($1163|0),($1164|0),($617|0),($618|0))|0);
 $1166 = tempRet0;
 $1167 = (_i64Add(($1165|0),($1166|0),($1141|0),($1142|0))|0);
 $1168 = tempRet0;
 $1169 = $1139 & -2097152;
 $1170 = (_i64Add(($887|0),($888|0),1048576,0)|0);
 $1171 = tempRet0;
 $1172 = (_bitshift64Ashr(($1170|0),($1171|0),21)|0);
 $1173 = tempRet0;
 $1174 = (_i64Add(($905|0),($906|0),($907|0),($908|0))|0);
 $1175 = tempRet0;
 $1176 = (_i64Add(($1174|0),($1175|0),($903|0),($904|0))|0);
 $1177 = tempRet0;
 $1178 = (_i64Add(($1176|0),($1177|0),($901|0),($902|0))|0);
 $1179 = tempRet0;
 $1180 = (_i64Add(($1178|0),($1179|0),($899|0),($900|0))|0);
 $1181 = tempRet0;
 $1182 = (_i64Add(($1180|0),($1181|0),($897|0),($898|0))|0);
 $1183 = tempRet0;
 $1184 = (_i64Add(($1182|0),($1183|0),($895|0),($896|0))|0);
 $1185 = tempRet0;
 $1186 = (_i64Add(($1184|0),($1185|0),($893|0),($894|0))|0);
 $1187 = tempRet0;
 $1188 = (_i64Add(($1186|0),($1187|0),($891|0),($892|0))|0);
 $1189 = tempRet0;
 $1190 = (_i64Add(($1188|0),($1189|0),($889|0),($890|0))|0);
 $1191 = tempRet0;
 $1192 = (_i64Add(($1190|0),($1191|0),($1172|0),($1173|0))|0);
 $1193 = tempRet0;
 $1194 = $1170 & -2097152;
 $1195 = (_i64Add(($941|0),($942|0),1048576,0)|0);
 $1196 = tempRet0;
 $1197 = (_bitshift64Ashr(($1195|0),($1196|0),21)|0);
 $1198 = tempRet0;
 $1199 = (_i64Add(($955|0),($956|0),($957|0),($958|0))|0);
 $1200 = tempRet0;
 $1201 = (_i64Add(($1199|0),($1200|0),($953|0),($954|0))|0);
 $1202 = tempRet0;
 $1203 = (_i64Add(($1201|0),($1202|0),($951|0),($952|0))|0);
 $1204 = tempRet0;
 $1205 = (_i64Add(($1203|0),($1204|0),($949|0),($950|0))|0);
 $1206 = tempRet0;
 $1207 = (_i64Add(($1205|0),($1206|0),($947|0),($948|0))|0);
 $1208 = tempRet0;
 $1209 = (_i64Add(($1207|0),($1208|0),($945|0),($946|0))|0);
 $1210 = tempRet0;
 $1211 = (_i64Add(($1209|0),($1210|0),($943|0),($944|0))|0);
 $1212 = tempRet0;
 $1213 = (_i64Add(($1211|0),($1212|0),($1197|0),($1198|0))|0);
 $1214 = tempRet0;
 $1215 = $1195 & -2097152;
 $1216 = (_i64Add(($983|0),($984|0),1048576,0)|0);
 $1217 = tempRet0;
 $1218 = (_bitshift64Ashr(($1216|0),($1217|0),21)|0);
 $1219 = tempRet0;
 $1220 = (_i64Add(($993|0),($994|0),($995|0),($996|0))|0);
 $1221 = tempRet0;
 $1222 = (_i64Add(($1220|0),($1221|0),($991|0),($992|0))|0);
 $1223 = tempRet0;
 $1224 = (_i64Add(($1222|0),($1223|0),($989|0),($990|0))|0);
 $1225 = tempRet0;
 $1226 = (_i64Add(($1224|0),($1225|0),($987|0),($988|0))|0);
 $1227 = tempRet0;
 $1228 = (_i64Add(($1226|0),($1227|0),($985|0),($986|0))|0);
 $1229 = tempRet0;
 $1230 = (_i64Add(($1228|0),($1229|0),($1218|0),($1219|0))|0);
 $1231 = tempRet0;
 $1232 = $1216 & -2097152;
 $1233 = (_i64Add(($1013|0),($1014|0),1048576,0)|0);
 $1234 = tempRet0;
 $1235 = (_bitshift64Ashr(($1233|0),($1234|0),21)|0);
 $1236 = tempRet0;
 $1237 = (_i64Add(($1019|0),($1020|0),($1021|0),($1022|0))|0);
 $1238 = tempRet0;
 $1239 = (_i64Add(($1237|0),($1238|0),($1017|0),($1018|0))|0);
 $1240 = tempRet0;
 $1241 = (_i64Add(($1239|0),($1240|0),($1015|0),($1016|0))|0);
 $1242 = tempRet0;
 $1243 = (_i64Add(($1241|0),($1242|0),($1235|0),($1236|0))|0);
 $1244 = tempRet0;
 $1245 = $1233 & -2097152;
 $1246 = (_i64Subtract(($1013|0),($1014|0),($1245|0),($1234|0))|0);
 $1247 = tempRet0;
 $1248 = (_i64Add(($1031|0),($1032|0),1048576,0)|0);
 $1249 = tempRet0;
 $1250 = (_bitshift64Lshr(($1248|0),($1249|0),21)|0);
 $1251 = tempRet0;
 $1252 = (_i64Add(($1037|0),($1038|0),($1250|0),($1251|0))|0);
 $1253 = tempRet0;
 $1254 = $1248 & -2097152;
 $1255 = $1249 & 2147483647;
 $1256 = (_i64Subtract(($1031|0),($1032|0),($1254|0),($1255|0))|0);
 $1257 = tempRet0;
 $1258 = (_i64Add(($1039|0),($1040|0),1048576,0)|0);
 $1259 = tempRet0;
 $1260 = (_bitshift64Lshr(($1258|0),($1259|0),21)|0);
 $1261 = tempRet0;
 $1262 = $1258 & -2097152;
 $1263 = $1259 & 2147483647;
 $1264 = (_i64Subtract(($1039|0),($1040|0),($1262|0),($1263|0))|0);
 $1265 = tempRet0;
 $1266 = (_i64Add(($1049|0),($1050|0),1048576,0)|0);
 $1267 = tempRet0;
 $1268 = (_bitshift64Lshr(($1266|0),($1267|0),21)|0);
 $1269 = tempRet0;
 $1270 = $1266 & -2097152;
 $1271 = (_i64Subtract(($1049|0),($1050|0),($1270|0),($1267|0))|0);
 $1272 = tempRet0;
 $1273 = (_i64Add(($1067|0),($1068|0),1048576,0)|0);
 $1274 = tempRet0;
 $1275 = (_bitshift64Ashr(($1273|0),($1274|0),21)|0);
 $1276 = tempRet0;
 $1277 = $1273 & -2097152;
 $1278 = (_i64Subtract(($1067|0),($1068|0),($1277|0),($1274|0))|0);
 $1279 = tempRet0;
 $1280 = (_i64Add(($1086|0),($1087|0),1048576,0)|0);
 $1281 = tempRet0;
 $1282 = (_bitshift64Ashr(($1280|0),($1281|0),21)|0);
 $1283 = tempRet0;
 $1284 = $1280 & -2097152;
 $1285 = (_i64Add(($1109|0),($1110|0),1048576,0)|0);
 $1286 = tempRet0;
 $1287 = (_bitshift64Ashr(($1285|0),($1286|0),21)|0);
 $1288 = tempRet0;
 $1289 = $1285 & -2097152;
 $1290 = (_i64Add(($1136|0),($1137|0),1048576,0)|0);
 $1291 = tempRet0;
 $1292 = (_bitshift64Ashr(($1290|0),($1291|0),21)|0);
 $1293 = tempRet0;
 $1294 = $1290 & -2097152;
 $1295 = (_i64Add(($1167|0),($1168|0),1048576,0)|0);
 $1296 = tempRet0;
 $1297 = (_bitshift64Ashr(($1295|0),($1296|0),21)|0);
 $1298 = tempRet0;
 $1299 = $1295 & -2097152;
 $1300 = (_i64Add(($1192|0),($1193|0),1048576,0)|0);
 $1301 = tempRet0;
 $1302 = (_bitshift64Ashr(($1300|0),($1301|0),21)|0);
 $1303 = tempRet0;
 $1304 = $1300 & -2097152;
 $1305 = (_i64Add(($1213|0),($1214|0),1048576,0)|0);
 $1306 = tempRet0;
 $1307 = (_bitshift64Ashr(($1305|0),($1306|0),21)|0);
 $1308 = tempRet0;
 $1309 = $1305 & -2097152;
 $1310 = (_i64Add(($1230|0),($1231|0),1048576,0)|0);
 $1311 = tempRet0;
 $1312 = (_bitshift64Ashr(($1310|0),($1311|0),21)|0);
 $1313 = tempRet0;
 $1314 = (_i64Add(($1312|0),($1313|0),($1246|0),($1247|0))|0);
 $1315 = tempRet0;
 $1316 = $1310 & -2097152;
 $1317 = (_i64Subtract(($1230|0),($1231|0),($1316|0),($1311|0))|0);
 $1318 = tempRet0;
 $1319 = (_i64Add(($1243|0),($1244|0),1048576,0)|0);
 $1320 = tempRet0;
 $1321 = (_bitshift64Ashr(($1319|0),($1320|0),21)|0);
 $1322 = tempRet0;
 $1323 = (_i64Add(($1321|0),($1322|0),($1256|0),($1257|0))|0);
 $1324 = tempRet0;
 $1325 = $1319 & -2097152;
 $1326 = (_i64Subtract(($1243|0),($1244|0),($1325|0),($1320|0))|0);
 $1327 = tempRet0;
 $1328 = (_i64Add(($1252|0),($1253|0),1048576,0)|0);
 $1329 = tempRet0;
 $1330 = (_bitshift64Lshr(($1328|0),($1329|0),21)|0);
 $1331 = tempRet0;
 $1332 = (_i64Add(($1330|0),($1331|0),($1264|0),($1265|0))|0);
 $1333 = tempRet0;
 $1334 = $1328 & -2097152;
 $1335 = $1329 & 2147483647;
 $1336 = (_i64Subtract(($1252|0),($1253|0),($1334|0),($1335|0))|0);
 $1337 = tempRet0;
 $1338 = (___muldi3(($1260|0),($1261|0),666643,0)|0);
 $1339 = tempRet0;
 $1340 = (___muldi3(($1260|0),($1261|0),470296,0)|0);
 $1341 = tempRet0;
 $1342 = (___muldi3(($1260|0),($1261|0),654183,0)|0);
 $1343 = tempRet0;
 $1344 = (___muldi3(($1260|0),($1261|0),-997805,-1)|0);
 $1345 = tempRet0;
 $1346 = (___muldi3(($1260|0),($1261|0),136657,0)|0);
 $1347 = tempRet0;
 $1348 = (___muldi3(($1260|0),($1261|0),-683901,-1)|0);
 $1349 = tempRet0;
 $1350 = (_i64Add(($983|0),($984|0),($1348|0),($1349|0))|0);
 $1351 = tempRet0;
 $1352 = (_i64Subtract(($1350|0),($1351|0),($1232|0),($1217|0))|0);
 $1353 = tempRet0;
 $1354 = (_i64Add(($1352|0),($1353|0),($1307|0),($1308|0))|0);
 $1355 = tempRet0;
 $1356 = (___muldi3(($1332|0),($1333|0),666643,0)|0);
 $1357 = tempRet0;
 $1358 = (___muldi3(($1332|0),($1333|0),470296,0)|0);
 $1359 = tempRet0;
 $1360 = (___muldi3(($1332|0),($1333|0),654183,0)|0);
 $1361 = tempRet0;
 $1362 = (___muldi3(($1332|0),($1333|0),-997805,-1)|0);
 $1363 = tempRet0;
 $1364 = (___muldi3(($1332|0),($1333|0),136657,0)|0);
 $1365 = tempRet0;
 $1366 = (___muldi3(($1332|0),($1333|0),-683901,-1)|0);
 $1367 = tempRet0;
 $1368 = (___muldi3(($1336|0),($1337|0),666643,0)|0);
 $1369 = tempRet0;
 $1370 = (___muldi3(($1336|0),($1337|0),470296,0)|0);
 $1371 = tempRet0;
 $1372 = (___muldi3(($1336|0),($1337|0),654183,0)|0);
 $1373 = tempRet0;
 $1374 = (___muldi3(($1336|0),($1337|0),-997805,-1)|0);
 $1375 = tempRet0;
 $1376 = (___muldi3(($1336|0),($1337|0),136657,0)|0);
 $1377 = tempRet0;
 $1378 = (___muldi3(($1336|0),($1337|0),-683901,-1)|0);
 $1379 = tempRet0;
 $1380 = (_i64Add(($941|0),($942|0),($1344|0),($1345|0))|0);
 $1381 = tempRet0;
 $1382 = (_i64Add(($1380|0),($1381|0),($1364|0),($1365|0))|0);
 $1383 = tempRet0;
 $1384 = (_i64Add(($1382|0),($1383|0),($1378|0),($1379|0))|0);
 $1385 = tempRet0;
 $1386 = (_i64Subtract(($1384|0),($1385|0),($1215|0),($1196|0))|0);
 $1387 = tempRet0;
 $1388 = (_i64Add(($1386|0),($1387|0),($1302|0),($1303|0))|0);
 $1389 = tempRet0;
 $1390 = (___muldi3(($1323|0),($1324|0),666643,0)|0);
 $1391 = tempRet0;
 $1392 = (___muldi3(($1323|0),($1324|0),470296,0)|0);
 $1393 = tempRet0;
 $1394 = (___muldi3(($1323|0),($1324|0),654183,0)|0);
 $1395 = tempRet0;
 $1396 = (___muldi3(($1323|0),($1324|0),-997805,-1)|0);
 $1397 = tempRet0;
 $1398 = (___muldi3(($1323|0),($1324|0),136657,0)|0);
 $1399 = tempRet0;
 $1400 = (___muldi3(($1323|0),($1324|0),-683901,-1)|0);
 $1401 = tempRet0;
 $1402 = (___muldi3(($1326|0),($1327|0),666643,0)|0);
 $1403 = tempRet0;
 $1404 = (___muldi3(($1326|0),($1327|0),470296,0)|0);
 $1405 = tempRet0;
 $1406 = (___muldi3(($1326|0),($1327|0),654183,0)|0);
 $1407 = tempRet0;
 $1408 = (___muldi3(($1326|0),($1327|0),-997805,-1)|0);
 $1409 = tempRet0;
 $1410 = (___muldi3(($1326|0),($1327|0),136657,0)|0);
 $1411 = tempRet0;
 $1412 = (___muldi3(($1326|0),($1327|0),-683901,-1)|0);
 $1413 = tempRet0;
 $1414 = (_i64Add(($1360|0),($1361|0),($1340|0),($1341|0))|0);
 $1415 = tempRet0;
 $1416 = (_i64Add(($1414|0),($1415|0),($1374|0),($1375|0))|0);
 $1417 = tempRet0;
 $1418 = (_i64Add(($1416|0),($1417|0),($887|0),($888|0))|0);
 $1419 = tempRet0;
 $1420 = (_i64Add(($1418|0),($1419|0),($1398|0),($1399|0))|0);
 $1421 = tempRet0;
 $1422 = (_i64Add(($1420|0),($1421|0),($1412|0),($1413|0))|0);
 $1423 = tempRet0;
 $1424 = (_i64Subtract(($1422|0),($1423|0),($1194|0),($1171|0))|0);
 $1425 = tempRet0;
 $1426 = (_i64Add(($1424|0),($1425|0),($1297|0),($1298|0))|0);
 $1427 = tempRet0;
 $1428 = (___muldi3(($1314|0),($1315|0),666643,0)|0);
 $1429 = tempRet0;
 $1430 = (_i64Add(($1282|0),($1283|0),($1428|0),($1429|0))|0);
 $1431 = tempRet0;
 $1432 = (_i64Add(($1430|0),($1431|0),($705|0),($706|0))|0);
 $1433 = tempRet0;
 $1434 = (_i64Subtract(($1432|0),($1433|0),($1111|0),($1090|0))|0);
 $1435 = tempRet0;
 $1436 = (___muldi3(($1314|0),($1315|0),470296,0)|0);
 $1437 = tempRet0;
 $1438 = (___muldi3(($1314|0),($1315|0),654183,0)|0);
 $1439 = tempRet0;
 $1440 = (_i64Add(($1404|0),($1405|0),($1390|0),($1391|0))|0);
 $1441 = tempRet0;
 $1442 = (_i64Add(($1440|0),($1441|0),($1438|0),($1439|0))|0);
 $1443 = tempRet0;
 $1444 = (_i64Add(($1442|0),($1443|0),($1287|0),($1288|0))|0);
 $1445 = tempRet0;
 $1446 = (_i64Add(($1444|0),($1445|0),($757|0),($758|0))|0);
 $1447 = tempRet0;
 $1448 = (_i64Subtract(($1446|0),($1447|0),($1138|0),($1113|0))|0);
 $1449 = tempRet0;
 $1450 = (___muldi3(($1314|0),($1315|0),-997805,-1)|0);
 $1451 = tempRet0;
 $1452 = (___muldi3(($1314|0),($1315|0),136657,0)|0);
 $1453 = tempRet0;
 $1454 = (_i64Add(($1370|0),($1371|0),($1356|0),($1357|0))|0);
 $1455 = tempRet0;
 $1456 = (_i64Add(($1454|0),($1455|0),($1394|0),($1395|0))|0);
 $1457 = tempRet0;
 $1458 = (_i64Add(($1456|0),($1457|0),($1408|0),($1409|0))|0);
 $1459 = tempRet0;
 $1460 = (_i64Add(($1458|0),($1459|0),($1452|0),($1453|0))|0);
 $1461 = tempRet0;
 $1462 = (_i64Add(($1460|0),($1461|0),($1292|0),($1293|0))|0);
 $1463 = tempRet0;
 $1464 = (_i64Add(($1462|0),($1463|0),($821|0),($822|0))|0);
 $1465 = tempRet0;
 $1466 = (_i64Subtract(($1464|0),($1465|0),($1169|0),($1140|0))|0);
 $1467 = tempRet0;
 $1468 = (___muldi3(($1314|0),($1315|0),-683901,-1)|0);
 $1469 = tempRet0;
 $1470 = (_i64Add(($1434|0),($1435|0),1048576,0)|0);
 $1471 = tempRet0;
 $1472 = (_bitshift64Ashr(($1470|0),($1471|0),21)|0);
 $1473 = tempRet0;
 $1474 = (_i64Add(($1436|0),($1437|0),($1402|0),($1403|0))|0);
 $1475 = tempRet0;
 $1476 = (_i64Add(($1474|0),($1475|0),($1109|0),($1110|0))|0);
 $1477 = tempRet0;
 $1478 = (_i64Subtract(($1476|0),($1477|0),($1289|0),($1286|0))|0);
 $1479 = tempRet0;
 $1480 = (_i64Add(($1478|0),($1479|0),($1472|0),($1473|0))|0);
 $1481 = tempRet0;
 $1482 = $1470 & -2097152;
 $1483 = (_i64Add(($1448|0),($1449|0),1048576,0)|0);
 $1484 = tempRet0;
 $1485 = (_bitshift64Ashr(($1483|0),($1484|0),21)|0);
 $1486 = tempRet0;
 $1487 = (_i64Add(($1392|0),($1393|0),($1368|0),($1369|0))|0);
 $1488 = tempRet0;
 $1489 = (_i64Add(($1487|0),($1488|0),($1406|0),($1407|0))|0);
 $1490 = tempRet0;
 $1491 = (_i64Add(($1489|0),($1490|0),($1450|0),($1451|0))|0);
 $1492 = tempRet0;
 $1493 = (_i64Add(($1491|0),($1492|0),($1136|0),($1137|0))|0);
 $1494 = tempRet0;
 $1495 = (_i64Subtract(($1493|0),($1494|0),($1294|0),($1291|0))|0);
 $1496 = tempRet0;
 $1497 = (_i64Add(($1495|0),($1496|0),($1485|0),($1486|0))|0);
 $1498 = tempRet0;
 $1499 = $1483 & -2097152;
 $1500 = (_i64Add(($1466|0),($1467|0),1048576,0)|0);
 $1501 = tempRet0;
 $1502 = (_bitshift64Ashr(($1500|0),($1501|0),21)|0);
 $1503 = tempRet0;
 $1504 = (_i64Add(($1358|0),($1359|0),($1338|0),($1339|0))|0);
 $1505 = tempRet0;
 $1506 = (_i64Add(($1504|0),($1505|0),($1372|0),($1373|0))|0);
 $1507 = tempRet0;
 $1508 = (_i64Add(($1506|0),($1507|0),($1396|0),($1397|0))|0);
 $1509 = tempRet0;
 $1510 = (_i64Add(($1508|0),($1509|0),($1410|0),($1411|0))|0);
 $1511 = tempRet0;
 $1512 = (_i64Add(($1510|0),($1511|0),($1468|0),($1469|0))|0);
 $1513 = tempRet0;
 $1514 = (_i64Add(($1512|0),($1513|0),($1167|0),($1168|0))|0);
 $1515 = tempRet0;
 $1516 = (_i64Subtract(($1514|0),($1515|0),($1299|0),($1296|0))|0);
 $1517 = tempRet0;
 $1518 = (_i64Add(($1516|0),($1517|0),($1502|0),($1503|0))|0);
 $1519 = tempRet0;
 $1520 = $1500 & -2097152;
 $1521 = (_i64Add(($1426|0),($1427|0),1048576,0)|0);
 $1522 = tempRet0;
 $1523 = (_bitshift64Ashr(($1521|0),($1522|0),21)|0);
 $1524 = tempRet0;
 $1525 = (_i64Add(($1362|0),($1363|0),($1342|0),($1343|0))|0);
 $1526 = tempRet0;
 $1527 = (_i64Add(($1525|0),($1526|0),($1376|0),($1377|0))|0);
 $1528 = tempRet0;
 $1529 = (_i64Add(($1527|0),($1528|0),($1400|0),($1401|0))|0);
 $1530 = tempRet0;
 $1531 = (_i64Add(($1529|0),($1530|0),($1192|0),($1193|0))|0);
 $1532 = tempRet0;
 $1533 = (_i64Subtract(($1531|0),($1532|0),($1304|0),($1301|0))|0);
 $1534 = tempRet0;
 $1535 = (_i64Add(($1533|0),($1534|0),($1523|0),($1524|0))|0);
 $1536 = tempRet0;
 $1537 = $1521 & -2097152;
 $1538 = (_i64Subtract(($1426|0),($1427|0),($1537|0),($1522|0))|0);
 $1539 = tempRet0;
 $1540 = (_i64Add(($1388|0),($1389|0),1048576,0)|0);
 $1541 = tempRet0;
 $1542 = (_bitshift64Ashr(($1540|0),($1541|0),21)|0);
 $1543 = tempRet0;
 $1544 = (_i64Add(($1366|0),($1367|0),($1346|0),($1347|0))|0);
 $1545 = tempRet0;
 $1546 = (_i64Add(($1544|0),($1545|0),($1213|0),($1214|0))|0);
 $1547 = tempRet0;
 $1548 = (_i64Subtract(($1546|0),($1547|0),($1309|0),($1306|0))|0);
 $1549 = tempRet0;
 $1550 = (_i64Add(($1548|0),($1549|0),($1542|0),($1543|0))|0);
 $1551 = tempRet0;
 $1552 = $1540 & -2097152;
 $1553 = (_i64Subtract(($1388|0),($1389|0),($1552|0),($1541|0))|0);
 $1554 = tempRet0;
 $1555 = (_i64Add(($1354|0),($1355|0),1048576,0)|0);
 $1556 = tempRet0;
 $1557 = (_bitshift64Ashr(($1555|0),($1556|0),21)|0);
 $1558 = tempRet0;
 $1559 = (_i64Add(($1557|0),($1558|0),($1317|0),($1318|0))|0);
 $1560 = tempRet0;
 $1561 = $1555 & -2097152;
 $1562 = (_i64Subtract(($1354|0),($1355|0),($1561|0),($1556|0))|0);
 $1563 = tempRet0;
 $1564 = (_i64Add(($1480|0),($1481|0),1048576,0)|0);
 $1565 = tempRet0;
 $1566 = (_bitshift64Ashr(($1564|0),($1565|0),21)|0);
 $1567 = tempRet0;
 $1568 = $1564 & -2097152;
 $1569 = (_i64Add(($1497|0),($1498|0),1048576,0)|0);
 $1570 = tempRet0;
 $1571 = (_bitshift64Ashr(($1569|0),($1570|0),21)|0);
 $1572 = tempRet0;
 $1573 = $1569 & -2097152;
 $1574 = (_i64Add(($1518|0),($1519|0),1048576,0)|0);
 $1575 = tempRet0;
 $1576 = (_bitshift64Ashr(($1574|0),($1575|0),21)|0);
 $1577 = tempRet0;
 $1578 = (_i64Add(($1576|0),($1577|0),($1538|0),($1539|0))|0);
 $1579 = tempRet0;
 $1580 = $1574 & -2097152;
 $1581 = (_i64Subtract(($1518|0),($1519|0),($1580|0),($1575|0))|0);
 $1582 = tempRet0;
 $1583 = (_i64Add(($1535|0),($1536|0),1048576,0)|0);
 $1584 = tempRet0;
 $1585 = (_bitshift64Ashr(($1583|0),($1584|0),21)|0);
 $1586 = tempRet0;
 $1587 = (_i64Add(($1585|0),($1586|0),($1553|0),($1554|0))|0);
 $1588 = tempRet0;
 $1589 = $1583 & -2097152;
 $1590 = (_i64Subtract(($1535|0),($1536|0),($1589|0),($1584|0))|0);
 $1591 = tempRet0;
 $1592 = (_i64Add(($1550|0),($1551|0),1048576,0)|0);
 $1593 = tempRet0;
 $1594 = (_bitshift64Ashr(($1592|0),($1593|0),21)|0);
 $1595 = tempRet0;
 $1596 = (_i64Add(($1594|0),($1595|0),($1562|0),($1563|0))|0);
 $1597 = tempRet0;
 $1598 = $1592 & -2097152;
 $1599 = (_i64Subtract(($1550|0),($1551|0),($1598|0),($1593|0))|0);
 $1600 = tempRet0;
 $1601 = (___muldi3(($1559|0),($1560|0),666643,0)|0);
 $1602 = tempRet0;
 $1603 = (___muldi3(($1559|0),($1560|0),470296,0)|0);
 $1604 = tempRet0;
 $1605 = (___muldi3(($1559|0),($1560|0),654183,0)|0);
 $1606 = tempRet0;
 $1607 = (___muldi3(($1559|0),($1560|0),-997805,-1)|0);
 $1608 = tempRet0;
 $1609 = (___muldi3(($1559|0),($1560|0),136657,0)|0);
 $1610 = tempRet0;
 $1611 = (___muldi3(($1559|0),($1560|0),-683901,-1)|0);
 $1612 = tempRet0;
 $1613 = (_i64Add(($1571|0),($1572|0),($1611|0),($1612|0))|0);
 $1614 = tempRet0;
 $1615 = (_i64Add(($1613|0),($1614|0),($1466|0),($1467|0))|0);
 $1616 = tempRet0;
 $1617 = (_i64Subtract(($1615|0),($1616|0),($1520|0),($1501|0))|0);
 $1618 = tempRet0;
 $1619 = (___muldi3(($1596|0),($1597|0),666643,0)|0);
 $1620 = tempRet0;
 $1621 = (___muldi3(($1596|0),($1597|0),470296,0)|0);
 $1622 = tempRet0;
 $1623 = (___muldi3(($1596|0),($1597|0),654183,0)|0);
 $1624 = tempRet0;
 $1625 = (___muldi3(($1596|0),($1597|0),-997805,-1)|0);
 $1626 = tempRet0;
 $1627 = (___muldi3(($1596|0),($1597|0),136657,0)|0);
 $1628 = tempRet0;
 $1629 = (___muldi3(($1596|0),($1597|0),-683901,-1)|0);
 $1630 = tempRet0;
 $1631 = (___muldi3(($1599|0),($1600|0),666643,0)|0);
 $1632 = tempRet0;
 $1633 = (_i64Add(($1278|0),($1279|0),($1631|0),($1632|0))|0);
 $1634 = tempRet0;
 $1635 = (___muldi3(($1599|0),($1600|0),470296,0)|0);
 $1636 = tempRet0;
 $1637 = (___muldi3(($1599|0),($1600|0),654183,0)|0);
 $1638 = tempRet0;
 $1639 = (___muldi3(($1599|0),($1600|0),-997805,-1)|0);
 $1640 = tempRet0;
 $1641 = (___muldi3(($1599|0),($1600|0),136657,0)|0);
 $1642 = tempRet0;
 $1643 = (___muldi3(($1599|0),($1600|0),-683901,-1)|0);
 $1644 = tempRet0;
 $1645 = (_i64Add(($1627|0),($1628|0),($1607|0),($1608|0))|0);
 $1646 = tempRet0;
 $1647 = (_i64Add(($1645|0),($1646|0),($1643|0),($1644|0))|0);
 $1648 = tempRet0;
 $1649 = (_i64Add(($1647|0),($1648|0),($1566|0),($1567|0))|0);
 $1650 = tempRet0;
 $1651 = (_i64Add(($1649|0),($1650|0),($1448|0),($1449|0))|0);
 $1652 = tempRet0;
 $1653 = (_i64Subtract(($1651|0),($1652|0),($1499|0),($1484|0))|0);
 $1654 = tempRet0;
 $1655 = (___muldi3(($1587|0),($1588|0),666643,0)|0);
 $1656 = tempRet0;
 $1657 = (___muldi3(($1587|0),($1588|0),470296,0)|0);
 $1658 = tempRet0;
 $1659 = (___muldi3(($1587|0),($1588|0),654183,0)|0);
 $1660 = tempRet0;
 $1661 = (___muldi3(($1587|0),($1588|0),-997805,-1)|0);
 $1662 = tempRet0;
 $1663 = (___muldi3(($1587|0),($1588|0),136657,0)|0);
 $1664 = tempRet0;
 $1665 = (___muldi3(($1587|0),($1588|0),-683901,-1)|0);
 $1666 = tempRet0;
 $1667 = (___muldi3(($1590|0),($1591|0),666643,0)|0);
 $1668 = tempRet0;
 $1669 = (___muldi3(($1590|0),($1591|0),470296,0)|0);
 $1670 = tempRet0;
 $1671 = (___muldi3(($1590|0),($1591|0),654183,0)|0);
 $1672 = tempRet0;
 $1673 = (___muldi3(($1590|0),($1591|0),-997805,-1)|0);
 $1674 = tempRet0;
 $1675 = (___muldi3(($1590|0),($1591|0),136657,0)|0);
 $1676 = tempRet0;
 $1677 = (___muldi3(($1590|0),($1591|0),-683901,-1)|0);
 $1678 = tempRet0;
 $1679 = (_i64Add(($1623|0),($1624|0),($1603|0),($1604|0))|0);
 $1680 = tempRet0;
 $1681 = (_i64Add(($1679|0),($1680|0),($1639|0),($1640|0))|0);
 $1682 = tempRet0;
 $1683 = (_i64Add(($1681|0),($1682|0),($1434|0),($1435|0))|0);
 $1684 = tempRet0;
 $1685 = (_i64Subtract(($1683|0),($1684|0),($1482|0),($1471|0))|0);
 $1686 = tempRet0;
 $1687 = (_i64Add(($1685|0),($1686|0),($1663|0),($1664|0))|0);
 $1688 = tempRet0;
 $1689 = (_i64Add(($1687|0),($1688|0),($1677|0),($1678|0))|0);
 $1690 = tempRet0;
 $1691 = (___muldi3(($1578|0),($1579|0),666643,0)|0);
 $1692 = tempRet0;
 $1693 = (_i64Add(($1691|0),($1692|0),($1053|0),($1054|0))|0);
 $1694 = tempRet0;
 $1695 = (___muldi3(($1578|0),($1579|0),470296,0)|0);
 $1696 = tempRet0;
 $1697 = (___muldi3(($1578|0),($1579|0),654183,0)|0);
 $1698 = tempRet0;
 $1699 = (_i64Add(($637|0),($638|0),($1268|0),($1269|0))|0);
 $1700 = tempRet0;
 $1701 = (_i64Subtract(($1699|0),($1700|0),($1069|0),($1056|0))|0);
 $1702 = tempRet0;
 $1703 = (_i64Add(($1701|0),($1702|0),($1697|0),($1698|0))|0);
 $1704 = tempRet0;
 $1705 = (_i64Add(($1703|0),($1704|0),($1655|0),($1656|0))|0);
 $1706 = tempRet0;
 $1707 = (_i64Add(($1705|0),($1706|0),($1669|0),($1670|0))|0);
 $1708 = tempRet0;
 $1709 = (___muldi3(($1578|0),($1579|0),-997805,-1)|0);
 $1710 = tempRet0;
 $1711 = (___muldi3(($1578|0),($1579|0),136657,0)|0);
 $1712 = tempRet0;
 $1713 = (_i64Add(($665|0),($666|0),($1275|0),($1276|0))|0);
 $1714 = tempRet0;
 $1715 = (_i64Subtract(($1713|0),($1714|0),($1088|0),($1071|0))|0);
 $1716 = tempRet0;
 $1717 = (_i64Add(($1715|0),($1716|0),($1619|0),($1620|0))|0);
 $1718 = tempRet0;
 $1719 = (_i64Add(($1717|0),($1718|0),($1635|0),($1636|0))|0);
 $1720 = tempRet0;
 $1721 = (_i64Add(($1719|0),($1720|0),($1711|0),($1712|0))|0);
 $1722 = tempRet0;
 $1723 = (_i64Add(($1721|0),($1722|0),($1659|0),($1660|0))|0);
 $1724 = tempRet0;
 $1725 = (_i64Add(($1723|0),($1724|0),($1673|0),($1674|0))|0);
 $1726 = tempRet0;
 $1727 = (___muldi3(($1578|0),($1579|0),-683901,-1)|0);
 $1728 = tempRet0;
 $1729 = (_i64Add(($1693|0),($1694|0),1048576,0)|0);
 $1730 = tempRet0;
 $1731 = (_bitshift64Ashr(($1729|0),($1730|0),21)|0);
 $1732 = tempRet0;
 $1733 = (_i64Add(($1271|0),($1272|0),($1695|0),($1696|0))|0);
 $1734 = tempRet0;
 $1735 = (_i64Add(($1733|0),($1734|0),($1667|0),($1668|0))|0);
 $1736 = tempRet0;
 $1737 = (_i64Add(($1735|0),($1736|0),($1731|0),($1732|0))|0);
 $1738 = tempRet0;
 $1739 = $1729 & -2097152;
 $1740 = (_i64Subtract(($1693|0),($1694|0),($1739|0),($1730|0))|0);
 $1741 = tempRet0;
 $1742 = (_i64Add(($1707|0),($1708|0),1048576,0)|0);
 $1743 = tempRet0;
 $1744 = (_bitshift64Ashr(($1742|0),($1743|0),21)|0);
 $1745 = tempRet0;
 $1746 = (_i64Add(($1633|0),($1634|0),($1709|0),($1710|0))|0);
 $1747 = tempRet0;
 $1748 = (_i64Add(($1746|0),($1747|0),($1657|0),($1658|0))|0);
 $1749 = tempRet0;
 $1750 = (_i64Add(($1748|0),($1749|0),($1671|0),($1672|0))|0);
 $1751 = tempRet0;
 $1752 = (_i64Add(($1750|0),($1751|0),($1744|0),($1745|0))|0);
 $1753 = tempRet0;
 $1754 = $1742 & -2097152;
 $1755 = (_i64Add(($1725|0),($1726|0),1048576,0)|0);
 $1756 = tempRet0;
 $1757 = (_bitshift64Ashr(($1755|0),($1756|0),21)|0);
 $1758 = tempRet0;
 $1759 = (_i64Add(($1621|0),($1622|0),($1601|0),($1602|0))|0);
 $1760 = tempRet0;
 $1761 = (_i64Add(($1759|0),($1760|0),($1637|0),($1638|0))|0);
 $1762 = tempRet0;
 $1763 = (_i64Add(($1761|0),($1762|0),($1086|0),($1087|0))|0);
 $1764 = tempRet0;
 $1765 = (_i64Subtract(($1763|0),($1764|0),($1284|0),($1281|0))|0);
 $1766 = tempRet0;
 $1767 = (_i64Add(($1765|0),($1766|0),($1727|0),($1728|0))|0);
 $1768 = tempRet0;
 $1769 = (_i64Add(($1767|0),($1768|0),($1661|0),($1662|0))|0);
 $1770 = tempRet0;
 $1771 = (_i64Add(($1769|0),($1770|0),($1675|0),($1676|0))|0);
 $1772 = tempRet0;
 $1773 = (_i64Add(($1771|0),($1772|0),($1757|0),($1758|0))|0);
 $1774 = tempRet0;
 $1775 = $1755 & -2097152;
 $1776 = (_i64Add(($1689|0),($1690|0),1048576,0)|0);
 $1777 = tempRet0;
 $1778 = (_bitshift64Ashr(($1776|0),($1777|0),21)|0);
 $1779 = tempRet0;
 $1780 = (_i64Add(($1625|0),($1626|0),($1605|0),($1606|0))|0);
 $1781 = tempRet0;
 $1782 = (_i64Add(($1780|0),($1781|0),($1641|0),($1642|0))|0);
 $1783 = tempRet0;
 $1784 = (_i64Add(($1782|0),($1783|0),($1480|0),($1481|0))|0);
 $1785 = tempRet0;
 $1786 = (_i64Subtract(($1784|0),($1785|0),($1568|0),($1565|0))|0);
 $1787 = tempRet0;
 $1788 = (_i64Add(($1786|0),($1787|0),($1665|0),($1666|0))|0);
 $1789 = tempRet0;
 $1790 = (_i64Add(($1788|0),($1789|0),($1778|0),($1779|0))|0);
 $1791 = tempRet0;
 $1792 = $1776 & -2097152;
 $1793 = (_i64Subtract(($1689|0),($1690|0),($1792|0),($1777|0))|0);
 $1794 = tempRet0;
 $1795 = (_i64Add(($1653|0),($1654|0),1048576,0)|0);
 $1796 = tempRet0;
 $1797 = (_bitshift64Ashr(($1795|0),($1796|0),21)|0);
 $1798 = tempRet0;
 $1799 = (_i64Add(($1629|0),($1630|0),($1609|0),($1610|0))|0);
 $1800 = tempRet0;
 $1801 = (_i64Add(($1799|0),($1800|0),($1497|0),($1498|0))|0);
 $1802 = tempRet0;
 $1803 = (_i64Add(($1801|0),($1802|0),($1797|0),($1798|0))|0);
 $1804 = tempRet0;
 $1805 = (_i64Subtract(($1803|0),($1804|0),($1573|0),($1570|0))|0);
 $1806 = tempRet0;
 $1807 = $1795 & -2097152;
 $1808 = (_i64Subtract(($1653|0),($1654|0),($1807|0),($1796|0))|0);
 $1809 = tempRet0;
 $1810 = (_i64Add(($1617|0),($1618|0),1048576,0)|0);
 $1811 = tempRet0;
 $1812 = (_bitshift64Ashr(($1810|0),($1811|0),21)|0);
 $1813 = tempRet0;
 $1814 = (_i64Add(($1581|0),($1582|0),($1812|0),($1813|0))|0);
 $1815 = tempRet0;
 $1816 = $1810 & -2097152;
 $1817 = (_i64Add(($1737|0),($1738|0),1048576,0)|0);
 $1818 = tempRet0;
 $1819 = (_bitshift64Ashr(($1817|0),($1818|0),21)|0);
 $1820 = tempRet0;
 $1821 = $1817 & -2097152;
 $1822 = (_i64Add(($1752|0),($1753|0),1048576,0)|0);
 $1823 = tempRet0;
 $1824 = (_bitshift64Ashr(($1822|0),($1823|0),21)|0);
 $1825 = tempRet0;
 $1826 = $1822 & -2097152;
 $1827 = (_i64Add(($1773|0),($1774|0),1048576,0)|0);
 $1828 = tempRet0;
 $1829 = (_bitshift64Ashr(($1827|0),($1828|0),21)|0);
 $1830 = tempRet0;
 $1831 = (_i64Add(($1793|0),($1794|0),($1829|0),($1830|0))|0);
 $1832 = tempRet0;
 $1833 = $1827 & -2097152;
 $1834 = (_i64Add(($1790|0),($1791|0),1048576,0)|0);
 $1835 = tempRet0;
 $1836 = (_bitshift64Ashr(($1834|0),($1835|0),21)|0);
 $1837 = tempRet0;
 $1838 = (_i64Add(($1808|0),($1809|0),($1836|0),($1837|0))|0);
 $1839 = tempRet0;
 $1840 = $1834 & -2097152;
 $1841 = (_i64Subtract(($1790|0),($1791|0),($1840|0),($1835|0))|0);
 $1842 = tempRet0;
 $1843 = (_i64Add(($1805|0),($1806|0),1048576,0)|0);
 $1844 = tempRet0;
 $1845 = (_bitshift64Ashr(($1843|0),($1844|0),21)|0);
 $1846 = tempRet0;
 $1847 = $1843 & -2097152;
 $1848 = (_i64Subtract(($1805|0),($1806|0),($1847|0),($1844|0))|0);
 $1849 = tempRet0;
 $1850 = (_i64Add(($1814|0),($1815|0),1048576,0)|0);
 $1851 = tempRet0;
 $1852 = (_bitshift64Ashr(($1850|0),($1851|0),21)|0);
 $1853 = tempRet0;
 $1854 = $1850 & -2097152;
 $1855 = (_i64Subtract(($1814|0),($1815|0),($1854|0),($1851|0))|0);
 $1856 = tempRet0;
 $1857 = (___muldi3(($1852|0),($1853|0),666643,0)|0);
 $1858 = tempRet0;
 $1859 = (_i64Add(($1740|0),($1741|0),($1857|0),($1858|0))|0);
 $1860 = tempRet0;
 $1861 = (___muldi3(($1852|0),($1853|0),470296,0)|0);
 $1862 = tempRet0;
 $1863 = (___muldi3(($1852|0),($1853|0),654183,0)|0);
 $1864 = tempRet0;
 $1865 = (___muldi3(($1852|0),($1853|0),-997805,-1)|0);
 $1866 = tempRet0;
 $1867 = (___muldi3(($1852|0),($1853|0),136657,0)|0);
 $1868 = tempRet0;
 $1869 = (___muldi3(($1852|0),($1853|0),-683901,-1)|0);
 $1870 = tempRet0;
 $1871 = (_bitshift64Ashr(($1859|0),($1860|0),21)|0);
 $1872 = tempRet0;
 $1873 = (_i64Add(($1737|0),($1738|0),($1861|0),($1862|0))|0);
 $1874 = tempRet0;
 $1875 = (_i64Subtract(($1873|0),($1874|0),($1821|0),($1818|0))|0);
 $1876 = tempRet0;
 $1877 = (_i64Add(($1875|0),($1876|0),($1871|0),($1872|0))|0);
 $1878 = tempRet0;
 $1879 = $1859 & 2097151;
 $1880 = (_bitshift64Ashr(($1877|0),($1878|0),21)|0);
 $1881 = tempRet0;
 $1882 = (_i64Add(($1707|0),($1708|0),($1863|0),($1864|0))|0);
 $1883 = tempRet0;
 $1884 = (_i64Subtract(($1882|0),($1883|0),($1754|0),($1743|0))|0);
 $1885 = tempRet0;
 $1886 = (_i64Add(($1884|0),($1885|0),($1819|0),($1820|0))|0);
 $1887 = tempRet0;
 $1888 = (_i64Add(($1886|0),($1887|0),($1880|0),($1881|0))|0);
 $1889 = tempRet0;
 $1890 = $1877 & 2097151;
 $1891 = (_bitshift64Ashr(($1888|0),($1889|0),21)|0);
 $1892 = tempRet0;
 $1893 = (_i64Add(($1752|0),($1753|0),($1865|0),($1866|0))|0);
 $1894 = tempRet0;
 $1895 = (_i64Subtract(($1893|0),($1894|0),($1826|0),($1823|0))|0);
 $1896 = tempRet0;
 $1897 = (_i64Add(($1895|0),($1896|0),($1891|0),($1892|0))|0);
 $1898 = tempRet0;
 $1899 = $1888 & 2097151;
 $1900 = (_bitshift64Ashr(($1897|0),($1898|0),21)|0);
 $1901 = tempRet0;
 $1902 = (_i64Add(($1725|0),($1726|0),($1867|0),($1868|0))|0);
 $1903 = tempRet0;
 $1904 = (_i64Subtract(($1902|0),($1903|0),($1775|0),($1756|0))|0);
 $1905 = tempRet0;
 $1906 = (_i64Add(($1904|0),($1905|0),($1824|0),($1825|0))|0);
 $1907 = tempRet0;
 $1908 = (_i64Add(($1906|0),($1907|0),($1900|0),($1901|0))|0);
 $1909 = tempRet0;
 $1910 = $1897 & 2097151;
 $1911 = (_bitshift64Ashr(($1908|0),($1909|0),21)|0);
 $1912 = tempRet0;
 $1913 = (_i64Add(($1773|0),($1774|0),($1869|0),($1870|0))|0);
 $1914 = tempRet0;
 $1915 = (_i64Subtract(($1913|0),($1914|0),($1833|0),($1828|0))|0);
 $1916 = tempRet0;
 $1917 = (_i64Add(($1915|0),($1916|0),($1911|0),($1912|0))|0);
 $1918 = tempRet0;
 $1919 = $1908 & 2097151;
 $1920 = (_bitshift64Ashr(($1917|0),($1918|0),21)|0);
 $1921 = tempRet0;
 $1922 = (_i64Add(($1831|0),($1832|0),($1920|0),($1921|0))|0);
 $1923 = tempRet0;
 $1924 = $1917 & 2097151;
 $1925 = (_bitshift64Ashr(($1922|0),($1923|0),21)|0);
 $1926 = tempRet0;
 $1927 = (_i64Add(($1925|0),($1926|0),($1841|0),($1842|0))|0);
 $1928 = tempRet0;
 $1929 = $1922 & 2097151;
 $1930 = (_bitshift64Ashr(($1927|0),($1928|0),21)|0);
 $1931 = tempRet0;
 $1932 = (_i64Add(($1838|0),($1839|0),($1930|0),($1931|0))|0);
 $1933 = tempRet0;
 $1934 = $1927 & 2097151;
 $1935 = (_bitshift64Ashr(($1932|0),($1933|0),21)|0);
 $1936 = tempRet0;
 $1937 = (_i64Add(($1935|0),($1936|0),($1848|0),($1849|0))|0);
 $1938 = tempRet0;
 $1939 = $1932 & 2097151;
 $1940 = (_bitshift64Ashr(($1937|0),($1938|0),21)|0);
 $1941 = tempRet0;
 $1942 = (_i64Add(($1617|0),($1618|0),($1845|0),($1846|0))|0);
 $1943 = tempRet0;
 $1944 = (_i64Subtract(($1942|0),($1943|0),($1816|0),($1811|0))|0);
 $1945 = tempRet0;
 $1946 = (_i64Add(($1944|0),($1945|0),($1940|0),($1941|0))|0);
 $1947 = tempRet0;
 $1948 = $1937 & 2097151;
 $1949 = (_bitshift64Ashr(($1946|0),($1947|0),21)|0);
 $1950 = tempRet0;
 $1951 = (_i64Add(($1949|0),($1950|0),($1855|0),($1856|0))|0);
 $1952 = tempRet0;
 $1953 = $1946 & 2097151;
 $1954 = (_bitshift64Ashr(($1951|0),($1952|0),21)|0);
 $1955 = tempRet0;
 $1956 = $1951 & 2097151;
 $1957 = (___muldi3(($1954|0),($1955|0),666643,0)|0);
 $1958 = tempRet0;
 $1959 = (_i64Add(($1957|0),($1958|0),($1879|0),0)|0);
 $1960 = tempRet0;
 $1961 = (___muldi3(($1954|0),($1955|0),470296,0)|0);
 $1962 = tempRet0;
 $1963 = (_i64Add(($1961|0),($1962|0),($1890|0),0)|0);
 $1964 = tempRet0;
 $1965 = (___muldi3(($1954|0),($1955|0),654183,0)|0);
 $1966 = tempRet0;
 $1967 = (_i64Add(($1965|0),($1966|0),($1899|0),0)|0);
 $1968 = tempRet0;
 $1969 = (___muldi3(($1954|0),($1955|0),-997805,-1)|0);
 $1970 = tempRet0;
 $1971 = (_i64Add(($1969|0),($1970|0),($1910|0),0)|0);
 $1972 = tempRet0;
 $1973 = (___muldi3(($1954|0),($1955|0),136657,0)|0);
 $1974 = tempRet0;
 $1975 = (_i64Add(($1973|0),($1974|0),($1919|0),0)|0);
 $1976 = tempRet0;
 $1977 = (___muldi3(($1954|0),($1955|0),-683901,-1)|0);
 $1978 = tempRet0;
 $1979 = (_i64Add(($1977|0),($1978|0),($1924|0),0)|0);
 $1980 = tempRet0;
 $1981 = (_bitshift64Ashr(($1959|0),($1960|0),21)|0);
 $1982 = tempRet0;
 $1983 = (_i64Add(($1963|0),($1964|0),($1981|0),($1982|0))|0);
 $1984 = tempRet0;
 $1985 = (_bitshift64Ashr(($1983|0),($1984|0),21)|0);
 $1986 = tempRet0;
 $1987 = (_i64Add(($1967|0),($1968|0),($1985|0),($1986|0))|0);
 $1988 = tempRet0;
 $1989 = $1983 & 2097151;
 $1990 = (_bitshift64Ashr(($1987|0),($1988|0),21)|0);
 $1991 = tempRet0;
 $1992 = (_i64Add(($1971|0),($1972|0),($1990|0),($1991|0))|0);
 $1993 = tempRet0;
 $1994 = $1987 & 2097151;
 $1995 = (_bitshift64Ashr(($1992|0),($1993|0),21)|0);
 $1996 = tempRet0;
 $1997 = (_i64Add(($1975|0),($1976|0),($1995|0),($1996|0))|0);
 $1998 = tempRet0;
 $1999 = $1992 & 2097151;
 $2000 = (_bitshift64Ashr(($1997|0),($1998|0),21)|0);
 $2001 = tempRet0;
 $2002 = (_i64Add(($1979|0),($1980|0),($2000|0),($2001|0))|0);
 $2003 = tempRet0;
 $2004 = $1997 & 2097151;
 $2005 = (_bitshift64Ashr(($2002|0),($2003|0),21)|0);
 $2006 = tempRet0;
 $2007 = (_i64Add(($2005|0),($2006|0),($1929|0),0)|0);
 $2008 = tempRet0;
 $2009 = $2002 & 2097151;
 $2010 = (_bitshift64Ashr(($2007|0),($2008|0),21)|0);
 $2011 = tempRet0;
 $2012 = (_i64Add(($2010|0),($2011|0),($1934|0),0)|0);
 $2013 = tempRet0;
 $2014 = $2007 & 2097151;
 $2015 = (_bitshift64Ashr(($2012|0),($2013|0),21)|0);
 $2016 = tempRet0;
 $2017 = (_i64Add(($2015|0),($2016|0),($1939|0),0)|0);
 $2018 = tempRet0;
 $2019 = (_bitshift64Ashr(($2017|0),($2018|0),21)|0);
 $2020 = tempRet0;
 $2021 = (_i64Add(($2019|0),($2020|0),($1948|0),0)|0);
 $2022 = tempRet0;
 $2023 = (_bitshift64Ashr(($2021|0),($2022|0),21)|0);
 $2024 = tempRet0;
 $2025 = (_i64Add(($2023|0),($2024|0),($1953|0),0)|0);
 $2026 = tempRet0;
 $2027 = $2021 & 2097151;
 $2028 = (_bitshift64Ashr(($2025|0),($2026|0),21)|0);
 $2029 = tempRet0;
 $2030 = (_i64Add(($2028|0),($2029|0),($1956|0),0)|0);
 $2031 = tempRet0;
 $2032 = $2025 & 2097151;
 $2033 = $1959&255;
 HEAP8[$0>>0] = $2033;
 $2034 = (_bitshift64Lshr(($1959|0),($1960|0),8)|0);
 $2035 = tempRet0;
 $2036 = $2034&255;
 $2037 = ((($0)) + 1|0);
 HEAP8[$2037>>0] = $2036;
 $2038 = (_bitshift64Lshr(($1959|0),($1960|0),16)|0);
 $2039 = tempRet0;
 $2040 = $2038 & 31;
 $2041 = (_bitshift64Shl(($1989|0),0,5)|0);
 $2042 = tempRet0;
 $2043 = $2041 | $2040;
 $2044 = $2043&255;
 $2045 = ((($0)) + 2|0);
 HEAP8[$2045>>0] = $2044;
 $2046 = (_bitshift64Lshr(($1983|0),($1984|0),3)|0);
 $2047 = tempRet0;
 $2048 = $2046&255;
 $2049 = ((($0)) + 3|0);
 HEAP8[$2049>>0] = $2048;
 $2050 = (_bitshift64Lshr(($1983|0),($1984|0),11)|0);
 $2051 = tempRet0;
 $2052 = $2050&255;
 $2053 = ((($0)) + 4|0);
 HEAP8[$2053>>0] = $2052;
 $2054 = (_bitshift64Lshr(($1989|0),0,19)|0);
 $2055 = tempRet0;
 $2056 = (_bitshift64Shl(($1994|0),0,2)|0);
 $2057 = tempRet0;
 $2058 = $2056 | $2054;
 $2057 | $2055;
 $2059 = $2058&255;
 $2060 = ((($0)) + 5|0);
 HEAP8[$2060>>0] = $2059;
 $2061 = (_bitshift64Lshr(($1987|0),($1988|0),6)|0);
 $2062 = tempRet0;
 $2063 = $2061&255;
 $2064 = ((($0)) + 6|0);
 HEAP8[$2064>>0] = $2063;
 $2065 = (_bitshift64Lshr(($1994|0),0,14)|0);
 $2066 = tempRet0;
 $2067 = (_bitshift64Shl(($1999|0),0,7)|0);
 $2068 = tempRet0;
 $2069 = $2067 | $2065;
 $2068 | $2066;
 $2070 = $2069&255;
 $2071 = ((($0)) + 7|0);
 HEAP8[$2071>>0] = $2070;
 $2072 = (_bitshift64Lshr(($1992|0),($1993|0),1)|0);
 $2073 = tempRet0;
 $2074 = $2072&255;
 $2075 = ((($0)) + 8|0);
 HEAP8[$2075>>0] = $2074;
 $2076 = (_bitshift64Lshr(($1992|0),($1993|0),9)|0);
 $2077 = tempRet0;
 $2078 = $2076&255;
 $2079 = ((($0)) + 9|0);
 HEAP8[$2079>>0] = $2078;
 $2080 = (_bitshift64Lshr(($1999|0),0,17)|0);
 $2081 = tempRet0;
 $2082 = (_bitshift64Shl(($2004|0),0,4)|0);
 $2083 = tempRet0;
 $2084 = $2082 | $2080;
 $2083 | $2081;
 $2085 = $2084&255;
 $2086 = ((($0)) + 10|0);
 HEAP8[$2086>>0] = $2085;
 $2087 = (_bitshift64Lshr(($1997|0),($1998|0),4)|0);
 $2088 = tempRet0;
 $2089 = $2087&255;
 $2090 = ((($0)) + 11|0);
 HEAP8[$2090>>0] = $2089;
 $2091 = (_bitshift64Lshr(($1997|0),($1998|0),12)|0);
 $2092 = tempRet0;
 $2093 = $2091&255;
 $2094 = ((($0)) + 12|0);
 HEAP8[$2094>>0] = $2093;
 $2095 = (_bitshift64Lshr(($2004|0),0,20)|0);
 $2096 = tempRet0;
 $2097 = (_bitshift64Shl(($2009|0),0,1)|0);
 $2098 = tempRet0;
 $2099 = $2097 | $2095;
 $2098 | $2096;
 $2100 = $2099&255;
 $2101 = ((($0)) + 13|0);
 HEAP8[$2101>>0] = $2100;
 $2102 = (_bitshift64Lshr(($2002|0),($2003|0),7)|0);
 $2103 = tempRet0;
 $2104 = $2102&255;
 $2105 = ((($0)) + 14|0);
 HEAP8[$2105>>0] = $2104;
 $2106 = (_bitshift64Lshr(($2009|0),0,15)|0);
 $2107 = tempRet0;
 $2108 = (_bitshift64Shl(($2014|0),0,6)|0);
 $2109 = tempRet0;
 $2110 = $2108 | $2106;
 $2109 | $2107;
 $2111 = $2110&255;
 $2112 = ((($0)) + 15|0);
 HEAP8[$2112>>0] = $2111;
 $2113 = (_bitshift64Lshr(($2007|0),($2008|0),2)|0);
 $2114 = tempRet0;
 $2115 = $2113&255;
 $2116 = ((($0)) + 16|0);
 HEAP8[$2116>>0] = $2115;
 $2117 = (_bitshift64Lshr(($2007|0),($2008|0),10)|0);
 $2118 = tempRet0;
 $2119 = $2117&255;
 $2120 = ((($0)) + 17|0);
 HEAP8[$2120>>0] = $2119;
 $2121 = (_bitshift64Lshr(($2014|0),0,18)|0);
 $2122 = tempRet0;
 $2123 = (_bitshift64Shl(($2012|0),($2013|0),3)|0);
 $2124 = tempRet0;
 $2125 = $2123 | $2121;
 $2124 | $2122;
 $2126 = $2125&255;
 $2127 = ((($0)) + 18|0);
 HEAP8[$2127>>0] = $2126;
 $2128 = (_bitshift64Lshr(($2012|0),($2013|0),5)|0);
 $2129 = tempRet0;
 $2130 = $2128&255;
 $2131 = ((($0)) + 19|0);
 HEAP8[$2131>>0] = $2130;
 $2132 = (_bitshift64Lshr(($2012|0),($2013|0),13)|0);
 $2133 = tempRet0;
 $2134 = $2132&255;
 $2135 = ((($0)) + 20|0);
 HEAP8[$2135>>0] = $2134;
 $2136 = $2017&255;
 $2137 = ((($0)) + 21|0);
 HEAP8[$2137>>0] = $2136;
 $2138 = (_bitshift64Lshr(($2017|0),($2018|0),8)|0);
 $2139 = tempRet0;
 $2140 = $2138&255;
 $2141 = ((($0)) + 22|0);
 HEAP8[$2141>>0] = $2140;
 $2142 = (_bitshift64Lshr(($2017|0),($2018|0),16)|0);
 $2143 = tempRet0;
 $2144 = $2142 & 31;
 $2145 = (_bitshift64Shl(($2027|0),0,5)|0);
 $2146 = tempRet0;
 $2147 = $2145 | $2144;
 $2148 = $2147&255;
 $2149 = ((($0)) + 23|0);
 HEAP8[$2149>>0] = $2148;
 $2150 = (_bitshift64Lshr(($2021|0),($2022|0),3)|0);
 $2151 = tempRet0;
 $2152 = $2150&255;
 $2153 = ((($0)) + 24|0);
 HEAP8[$2153>>0] = $2152;
 $2154 = (_bitshift64Lshr(($2021|0),($2022|0),11)|0);
 $2155 = tempRet0;
 $2156 = $2154&255;
 $2157 = ((($0)) + 25|0);
 HEAP8[$2157>>0] = $2156;
 $2158 = (_bitshift64Lshr(($2027|0),0,19)|0);
 $2159 = tempRet0;
 $2160 = (_bitshift64Shl(($2032|0),0,2)|0);
 $2161 = tempRet0;
 $2162 = $2160 | $2158;
 $2161 | $2159;
 $2163 = $2162&255;
 $2164 = ((($0)) + 26|0);
 HEAP8[$2164>>0] = $2163;
 $2165 = (_bitshift64Lshr(($2025|0),($2026|0),6)|0);
 $2166 = tempRet0;
 $2167 = $2165&255;
 $2168 = ((($0)) + 27|0);
 HEAP8[$2168>>0] = $2167;
 $2169 = (_bitshift64Lshr(($2032|0),0,14)|0);
 $2170 = tempRet0;
 $2171 = (_bitshift64Shl(($2030|0),($2031|0),7)|0);
 $2172 = tempRet0;
 $2173 = $2171 | $2169;
 $2172 | $2170;
 $2174 = $2173&255;
 $2175 = ((($0)) + 28|0);
 HEAP8[$2175>>0] = $2174;
 $2176 = (_bitshift64Lshr(($2030|0),($2031|0),1)|0);
 $2177 = tempRet0;
 $2178 = $2176&255;
 $2179 = ((($0)) + 29|0);
 HEAP8[$2179>>0] = $2178;
 $2180 = (_bitshift64Lshr(($2030|0),($2031|0),9)|0);
 $2181 = tempRet0;
 $2182 = $2180&255;
 $2183 = ((($0)) + 30|0);
 HEAP8[$2183>>0] = $2182;
 $2184 = (_bitshift64Ashr(($2030|0),($2031|0),17)|0);
 $2185 = tempRet0;
 $2186 = $2184&255;
 $2187 = ((($0)) + 31|0);
 HEAP8[$2187>>0] = $2186;
 return;
}
function _crypto_sign_ed25519_ref10_sc_reduce($0) {
 $0 = $0|0;
 var $$idx = 0, $$idx$val = 0, $$idx576 = 0, $$idx576$val = 0, $$idx578 = 0, $$idx578$val = 0, $$idx579 = 0, $$idx579$val = 0, $$idx581 = 0, $$idx581$val = 0, $$idx582 = 0, $$idx582$val = 0, $$idx584 = 0, $$idx584$val = 0, $$idx585 = 0, $$idx585$val = 0, $$idx587 = 0, $$idx587$val = 0, $$idx588 = 0, $$idx588$val = 0;
 var $$idx590 = 0, $$idx590$val = 0, $$idx591 = 0, $$idx591$val = 0, $$idx593 = 0, $$idx593$val = 0, $$idx594 = 0, $$idx594$val = 0, $$idx596 = 0, $$idx596$val = 0, $$idx597 = 0, $$idx597$val = 0, $$idx599 = 0, $$idx599$val = 0, $$idx600 = 0, $$idx600$val = 0, $$idx602 = 0, $$idx602$val = 0, $$idx603 = 0, $$idx603$val = 0;
 var $$idx605 = 0, $$idx605$val = 0, $$idx606 = 0, $$idx606$val = 0, $$val580 = 0, $$val592 = 0, $$val604 = 0, $1 = 0, $10 = 0, $100 = 0, $1000 = 0, $1001 = 0, $1002 = 0, $1003 = 0, $1004 = 0, $1005 = 0, $1006 = 0, $1007 = 0, $1008 = 0, $1009 = 0;
 var $101 = 0, $1010 = 0, $1011 = 0, $1012 = 0, $1013 = 0, $1014 = 0, $1015 = 0, $1016 = 0, $1017 = 0, $1018 = 0, $1019 = 0, $102 = 0, $1020 = 0, $1021 = 0, $1022 = 0, $1023 = 0, $1024 = 0, $1025 = 0, $1026 = 0, $1027 = 0;
 var $1028 = 0, $1029 = 0, $103 = 0, $1030 = 0, $1031 = 0, $1032 = 0, $1033 = 0, $1034 = 0, $1035 = 0, $1036 = 0, $1037 = 0, $1038 = 0, $1039 = 0, $104 = 0, $1040 = 0, $1041 = 0, $1042 = 0, $1043 = 0, $1044 = 0, $1045 = 0;
 var $1046 = 0, $1047 = 0, $1048 = 0, $1049 = 0, $105 = 0, $1050 = 0, $1051 = 0, $1052 = 0, $1053 = 0, $1054 = 0, $1055 = 0, $1056 = 0, $1057 = 0, $1058 = 0, $1059 = 0, $106 = 0, $1060 = 0, $1061 = 0, $1062 = 0, $1063 = 0;
 var $1064 = 0, $1065 = 0, $1066 = 0, $1067 = 0, $1068 = 0, $1069 = 0, $107 = 0, $1070 = 0, $1071 = 0, $1072 = 0, $1073 = 0, $1074 = 0, $1075 = 0, $1076 = 0, $1077 = 0, $1078 = 0, $1079 = 0, $108 = 0, $1080 = 0, $1081 = 0;
 var $1082 = 0, $1083 = 0, $1084 = 0, $1085 = 0, $1086 = 0, $1087 = 0, $1088 = 0, $1089 = 0, $109 = 0, $1090 = 0, $1091 = 0, $1092 = 0, $1093 = 0, $1094 = 0, $1095 = 0, $1096 = 0, $1097 = 0, $1098 = 0, $1099 = 0, $11 = 0;
 var $110 = 0, $1100 = 0, $1101 = 0, $1102 = 0, $1103 = 0, $1104 = 0, $1105 = 0, $1106 = 0, $1107 = 0, $1108 = 0, $1109 = 0, $111 = 0, $1110 = 0, $1111 = 0, $1112 = 0, $1113 = 0, $1114 = 0, $1115 = 0, $1116 = 0, $1117 = 0;
 var $1118 = 0, $1119 = 0, $112 = 0, $1120 = 0, $1121 = 0, $1122 = 0, $1123 = 0, $1124 = 0, $1125 = 0, $1126 = 0, $1127 = 0, $1128 = 0, $1129 = 0, $113 = 0, $1130 = 0, $1131 = 0, $1132 = 0, $1133 = 0, $1134 = 0, $1135 = 0;
 var $1136 = 0, $1137 = 0, $1138 = 0, $1139 = 0, $114 = 0, $1140 = 0, $1141 = 0, $1142 = 0, $1143 = 0, $1144 = 0, $1145 = 0, $1146 = 0, $1147 = 0, $1148 = 0, $1149 = 0, $115 = 0, $1150 = 0, $1151 = 0, $1152 = 0, $1153 = 0;
 var $1154 = 0, $1155 = 0, $1156 = 0, $1157 = 0, $1158 = 0, $1159 = 0, $116 = 0, $1160 = 0, $1161 = 0, $1162 = 0, $1163 = 0, $1164 = 0, $1165 = 0, $1166 = 0, $1167 = 0, $1168 = 0, $1169 = 0, $117 = 0, $1170 = 0, $1171 = 0;
 var $1172 = 0, $1173 = 0, $1174 = 0, $1175 = 0, $1176 = 0, $1177 = 0, $1178 = 0, $1179 = 0, $118 = 0, $1180 = 0, $1181 = 0, $1182 = 0, $1183 = 0, $1184 = 0, $1185 = 0, $1186 = 0, $1187 = 0, $1188 = 0, $1189 = 0, $119 = 0;
 var $1190 = 0, $1191 = 0, $1192 = 0, $1193 = 0, $1194 = 0, $1195 = 0, $1196 = 0, $1197 = 0, $1198 = 0, $1199 = 0, $12 = 0, $120 = 0, $1200 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0;
 var $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0;
 var $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0;
 var $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0;
 var $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0;
 var $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0;
 var $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0;
 var $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0;
 var $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0;
 var $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0;
 var $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0, $299 = 0, $3 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0;
 var $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0, $312 = 0, $313 = 0, $314 = 0, $315 = 0, $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0, $321 = 0, $322 = 0, $323 = 0, $324 = 0, $325 = 0;
 var $326 = 0, $327 = 0, $328 = 0, $329 = 0, $33 = 0, $330 = 0, $331 = 0, $332 = 0, $333 = 0, $334 = 0, $335 = 0, $336 = 0, $337 = 0, $338 = 0, $339 = 0, $34 = 0, $340 = 0, $341 = 0, $342 = 0, $343 = 0;
 var $344 = 0, $345 = 0, $346 = 0, $347 = 0, $348 = 0, $349 = 0, $35 = 0, $350 = 0, $351 = 0, $352 = 0, $353 = 0, $354 = 0, $355 = 0, $356 = 0, $357 = 0, $358 = 0, $359 = 0, $36 = 0, $360 = 0, $361 = 0;
 var $362 = 0, $363 = 0, $364 = 0, $365 = 0, $366 = 0, $367 = 0, $368 = 0, $369 = 0, $37 = 0, $370 = 0, $371 = 0, $372 = 0, $373 = 0, $374 = 0, $375 = 0, $376 = 0, $377 = 0, $378 = 0, $379 = 0, $38 = 0;
 var $380 = 0, $381 = 0, $382 = 0, $383 = 0, $384 = 0, $385 = 0, $386 = 0, $387 = 0, $388 = 0, $389 = 0, $39 = 0, $390 = 0, $391 = 0, $392 = 0, $393 = 0, $394 = 0, $395 = 0, $396 = 0, $397 = 0, $398 = 0;
 var $399 = 0, $4 = 0, $40 = 0, $400 = 0, $401 = 0, $402 = 0, $403 = 0, $404 = 0, $405 = 0, $406 = 0, $407 = 0, $408 = 0, $409 = 0, $41 = 0, $410 = 0, $411 = 0, $412 = 0, $413 = 0, $414 = 0, $415 = 0;
 var $416 = 0, $417 = 0, $418 = 0, $419 = 0, $42 = 0, $420 = 0, $421 = 0, $422 = 0, $423 = 0, $424 = 0, $425 = 0, $426 = 0, $427 = 0, $428 = 0, $429 = 0, $43 = 0, $430 = 0, $431 = 0, $432 = 0, $433 = 0;
 var $434 = 0, $435 = 0, $436 = 0, $437 = 0, $438 = 0, $439 = 0, $44 = 0, $440 = 0, $441 = 0, $442 = 0, $443 = 0, $444 = 0, $445 = 0, $446 = 0, $447 = 0, $448 = 0, $449 = 0, $45 = 0, $450 = 0, $451 = 0;
 var $452 = 0, $453 = 0, $454 = 0, $455 = 0, $456 = 0, $457 = 0, $458 = 0, $459 = 0, $46 = 0, $460 = 0, $461 = 0, $462 = 0, $463 = 0, $464 = 0, $465 = 0, $466 = 0, $467 = 0, $468 = 0, $469 = 0, $47 = 0;
 var $470 = 0, $471 = 0, $472 = 0, $473 = 0, $474 = 0, $475 = 0, $476 = 0, $477 = 0, $478 = 0, $479 = 0, $48 = 0, $480 = 0, $481 = 0, $482 = 0, $483 = 0, $484 = 0, $485 = 0, $486 = 0, $487 = 0, $488 = 0;
 var $489 = 0, $49 = 0, $490 = 0, $491 = 0, $492 = 0, $493 = 0, $494 = 0, $495 = 0, $496 = 0, $497 = 0, $498 = 0, $499 = 0, $5 = 0, $50 = 0, $500 = 0, $501 = 0, $502 = 0, $503 = 0, $504 = 0, $505 = 0;
 var $506 = 0, $507 = 0, $508 = 0, $509 = 0, $51 = 0, $510 = 0, $511 = 0, $512 = 0, $513 = 0, $514 = 0, $515 = 0, $516 = 0, $517 = 0, $518 = 0, $519 = 0, $52 = 0, $520 = 0, $521 = 0, $522 = 0, $523 = 0;
 var $524 = 0, $525 = 0, $526 = 0, $527 = 0, $528 = 0, $529 = 0, $53 = 0, $530 = 0, $531 = 0, $532 = 0, $533 = 0, $534 = 0, $535 = 0, $536 = 0, $537 = 0, $538 = 0, $539 = 0, $54 = 0, $540 = 0, $541 = 0;
 var $542 = 0, $543 = 0, $544 = 0, $545 = 0, $546 = 0, $547 = 0, $548 = 0, $549 = 0, $55 = 0, $550 = 0, $551 = 0, $552 = 0, $553 = 0, $554 = 0, $555 = 0, $556 = 0, $557 = 0, $558 = 0, $559 = 0, $56 = 0;
 var $560 = 0, $561 = 0, $562 = 0, $563 = 0, $564 = 0, $565 = 0, $566 = 0, $567 = 0, $568 = 0, $569 = 0, $57 = 0, $570 = 0, $571 = 0, $572 = 0, $573 = 0, $574 = 0, $575 = 0, $576 = 0, $577 = 0, $578 = 0;
 var $579 = 0, $58 = 0, $580 = 0, $581 = 0, $582 = 0, $583 = 0, $584 = 0, $585 = 0, $586 = 0, $587 = 0, $588 = 0, $589 = 0, $59 = 0, $590 = 0, $591 = 0, $592 = 0, $593 = 0, $594 = 0, $595 = 0, $596 = 0;
 var $597 = 0, $598 = 0, $599 = 0, $6 = 0, $60 = 0, $600 = 0, $601 = 0, $602 = 0, $603 = 0, $604 = 0, $605 = 0, $606 = 0, $607 = 0, $608 = 0, $609 = 0, $61 = 0, $610 = 0, $611 = 0, $612 = 0, $613 = 0;
 var $614 = 0, $615 = 0, $616 = 0, $617 = 0, $618 = 0, $619 = 0, $62 = 0, $620 = 0, $621 = 0, $622 = 0, $623 = 0, $624 = 0, $625 = 0, $626 = 0, $627 = 0, $628 = 0, $629 = 0, $63 = 0, $630 = 0, $631 = 0;
 var $632 = 0, $633 = 0, $634 = 0, $635 = 0, $636 = 0, $637 = 0, $638 = 0, $639 = 0, $64 = 0, $640 = 0, $641 = 0, $642 = 0, $643 = 0, $644 = 0, $645 = 0, $646 = 0, $647 = 0, $648 = 0, $649 = 0, $65 = 0;
 var $650 = 0, $651 = 0, $652 = 0, $653 = 0, $654 = 0, $655 = 0, $656 = 0, $657 = 0, $658 = 0, $659 = 0, $66 = 0, $660 = 0, $661 = 0, $662 = 0, $663 = 0, $664 = 0, $665 = 0, $666 = 0, $667 = 0, $668 = 0;
 var $669 = 0, $67 = 0, $670 = 0, $671 = 0, $672 = 0, $673 = 0, $674 = 0, $675 = 0, $676 = 0, $677 = 0, $678 = 0, $679 = 0, $68 = 0, $680 = 0, $681 = 0, $682 = 0, $683 = 0, $684 = 0, $685 = 0, $686 = 0;
 var $687 = 0, $688 = 0, $689 = 0, $69 = 0, $690 = 0, $691 = 0, $692 = 0, $693 = 0, $694 = 0, $695 = 0, $696 = 0, $697 = 0, $698 = 0, $699 = 0, $7 = 0, $70 = 0, $700 = 0, $701 = 0, $702 = 0, $703 = 0;
 var $704 = 0, $705 = 0, $706 = 0, $707 = 0, $708 = 0, $709 = 0, $71 = 0, $710 = 0, $711 = 0, $712 = 0, $713 = 0, $714 = 0, $715 = 0, $716 = 0, $717 = 0, $718 = 0, $719 = 0, $72 = 0, $720 = 0, $721 = 0;
 var $722 = 0, $723 = 0, $724 = 0, $725 = 0, $726 = 0, $727 = 0, $728 = 0, $729 = 0, $73 = 0, $730 = 0, $731 = 0, $732 = 0, $733 = 0, $734 = 0, $735 = 0, $736 = 0, $737 = 0, $738 = 0, $739 = 0, $74 = 0;
 var $740 = 0, $741 = 0, $742 = 0, $743 = 0, $744 = 0, $745 = 0, $746 = 0, $747 = 0, $748 = 0, $749 = 0, $75 = 0, $750 = 0, $751 = 0, $752 = 0, $753 = 0, $754 = 0, $755 = 0, $756 = 0, $757 = 0, $758 = 0;
 var $759 = 0, $76 = 0, $760 = 0, $761 = 0, $762 = 0, $763 = 0, $764 = 0, $765 = 0, $766 = 0, $767 = 0, $768 = 0, $769 = 0, $77 = 0, $770 = 0, $771 = 0, $772 = 0, $773 = 0, $774 = 0, $775 = 0, $776 = 0;
 var $777 = 0, $778 = 0, $779 = 0, $78 = 0, $780 = 0, $781 = 0, $782 = 0, $783 = 0, $784 = 0, $785 = 0, $786 = 0, $787 = 0, $788 = 0, $789 = 0, $79 = 0, $790 = 0, $791 = 0, $792 = 0, $793 = 0, $794 = 0;
 var $795 = 0, $796 = 0, $797 = 0, $798 = 0, $799 = 0, $8 = 0, $80 = 0, $800 = 0, $801 = 0, $802 = 0, $803 = 0, $804 = 0, $805 = 0, $806 = 0, $807 = 0, $808 = 0, $809 = 0, $81 = 0, $810 = 0, $811 = 0;
 var $812 = 0, $813 = 0, $814 = 0, $815 = 0, $816 = 0, $817 = 0, $818 = 0, $819 = 0, $82 = 0, $820 = 0, $821 = 0, $822 = 0, $823 = 0, $824 = 0, $825 = 0, $826 = 0, $827 = 0, $828 = 0, $829 = 0, $83 = 0;
 var $830 = 0, $831 = 0, $832 = 0, $833 = 0, $834 = 0, $835 = 0, $836 = 0, $837 = 0, $838 = 0, $839 = 0, $84 = 0, $840 = 0, $841 = 0, $842 = 0, $843 = 0, $844 = 0, $845 = 0, $846 = 0, $847 = 0, $848 = 0;
 var $849 = 0, $85 = 0, $850 = 0, $851 = 0, $852 = 0, $853 = 0, $854 = 0, $855 = 0, $856 = 0, $857 = 0, $858 = 0, $859 = 0, $86 = 0, $860 = 0, $861 = 0, $862 = 0, $863 = 0, $864 = 0, $865 = 0, $866 = 0;
 var $867 = 0, $868 = 0, $869 = 0, $87 = 0, $870 = 0, $871 = 0, $872 = 0, $873 = 0, $874 = 0, $875 = 0, $876 = 0, $877 = 0, $878 = 0, $879 = 0, $88 = 0, $880 = 0, $881 = 0, $882 = 0, $883 = 0, $884 = 0;
 var $885 = 0, $886 = 0, $887 = 0, $888 = 0, $889 = 0, $89 = 0, $890 = 0, $891 = 0, $892 = 0, $893 = 0, $894 = 0, $895 = 0, $896 = 0, $897 = 0, $898 = 0, $899 = 0, $9 = 0, $90 = 0, $900 = 0, $901 = 0;
 var $902 = 0, $903 = 0, $904 = 0, $905 = 0, $906 = 0, $907 = 0, $908 = 0, $909 = 0, $91 = 0, $910 = 0, $911 = 0, $912 = 0, $913 = 0, $914 = 0, $915 = 0, $916 = 0, $917 = 0, $918 = 0, $919 = 0, $92 = 0;
 var $920 = 0, $921 = 0, $922 = 0, $923 = 0, $924 = 0, $925 = 0, $926 = 0, $927 = 0, $928 = 0, $929 = 0, $93 = 0, $930 = 0, $931 = 0, $932 = 0, $933 = 0, $934 = 0, $935 = 0, $936 = 0, $937 = 0, $938 = 0;
 var $939 = 0, $94 = 0, $940 = 0, $941 = 0, $942 = 0, $943 = 0, $944 = 0, $945 = 0, $946 = 0, $947 = 0, $948 = 0, $949 = 0, $95 = 0, $950 = 0, $951 = 0, $952 = 0, $953 = 0, $954 = 0, $955 = 0, $956 = 0;
 var $957 = 0, $958 = 0, $959 = 0, $96 = 0, $960 = 0, $961 = 0, $962 = 0, $963 = 0, $964 = 0, $965 = 0, $966 = 0, $967 = 0, $968 = 0, $969 = 0, $97 = 0, $970 = 0, $971 = 0, $972 = 0, $973 = 0, $974 = 0;
 var $975 = 0, $976 = 0, $977 = 0, $978 = 0, $979 = 0, $98 = 0, $980 = 0, $981 = 0, $982 = 0, $983 = 0, $984 = 0, $985 = 0, $986 = 0, $987 = 0, $988 = 0, $989 = 0, $99 = 0, $990 = 0, $991 = 0, $992 = 0;
 var $993 = 0, $994 = 0, $995 = 0, $996 = 0, $997 = 0, $998 = 0, $999 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $$val604 = HEAP8[$0>>0]|0;
 $$idx605 = ((($0)) + 1|0);
 $$idx605$val = HEAP8[$$idx605>>0]|0;
 $$idx606 = ((($0)) + 2|0);
 $$idx606$val = HEAP8[$$idx606>>0]|0;
 $1 = $$val604&255;
 $2 = $$idx605$val&255;
 $3 = (_bitshift64Shl(($2|0),0,8)|0);
 $4 = tempRet0;
 $5 = $3 | $1;
 $6 = $$idx606$val&255;
 $7 = (_bitshift64Shl(($6|0),0,16)|0);
 $8 = tempRet0;
 $9 = $7 & 2031616;
 $10 = $5 | $9;
 $11 = ((($0)) + 3|0);
 $12 = HEAP8[$11>>0]|0;
 $13 = $12&255;
 $14 = (_bitshift64Shl(($13|0),0,8)|0);
 $15 = tempRet0;
 $16 = $14 | $6;
 $17 = ((($0)) + 4|0);
 $18 = HEAP8[$17>>0]|0;
 $19 = $18&255;
 $20 = (_bitshift64Shl(($19|0),0,16)|0);
 $21 = tempRet0;
 $22 = $16 | $20;
 $23 = $15 | $21;
 $24 = ((($0)) + 5|0);
 $25 = HEAP8[$24>>0]|0;
 $26 = $25&255;
 $27 = (_bitshift64Shl(($26|0),0,24)|0);
 $28 = tempRet0;
 $29 = $22 | $27;
 $30 = $23 | $28;
 $31 = (_bitshift64Lshr(($29|0),($30|0),5)|0);
 $32 = tempRet0;
 $33 = $31 & 2097151;
 $$idx602 = ((($0)) + 6|0);
 $$idx602$val = HEAP8[$$idx602>>0]|0;
 $$idx603 = ((($0)) + 7|0);
 $$idx603$val = HEAP8[$$idx603>>0]|0;
 $34 = $$idx602$val&255;
 $35 = (_bitshift64Shl(($34|0),0,8)|0);
 $36 = tempRet0;
 $37 = $35 | $26;
 $38 = $$idx603$val&255;
 $39 = (_bitshift64Shl(($38|0),0,16)|0);
 $40 = tempRet0;
 $41 = $37 | $39;
 $42 = $36 | $40;
 $43 = (_bitshift64Lshr(($41|0),($42|0),2)|0);
 $44 = tempRet0;
 $45 = $43 & 2097151;
 $46 = ((($0)) + 8|0);
 $47 = HEAP8[$46>>0]|0;
 $48 = $47&255;
 $49 = (_bitshift64Shl(($48|0),0,8)|0);
 $50 = tempRet0;
 $51 = $49 | $38;
 $52 = ((($0)) + 9|0);
 $53 = HEAP8[$52>>0]|0;
 $54 = $53&255;
 $55 = (_bitshift64Shl(($54|0),0,16)|0);
 $56 = tempRet0;
 $57 = $51 | $55;
 $58 = $50 | $56;
 $59 = ((($0)) + 10|0);
 $60 = HEAP8[$59>>0]|0;
 $61 = $60&255;
 $62 = (_bitshift64Shl(($61|0),0,24)|0);
 $63 = tempRet0;
 $64 = $57 | $62;
 $65 = $58 | $63;
 $66 = (_bitshift64Lshr(($64|0),($65|0),7)|0);
 $67 = tempRet0;
 $68 = $66 & 2097151;
 $69 = ((($0)) + 11|0);
 $70 = HEAP8[$69>>0]|0;
 $71 = $70&255;
 $72 = (_bitshift64Shl(($71|0),0,8)|0);
 $73 = tempRet0;
 $74 = $72 | $61;
 $75 = ((($0)) + 12|0);
 $76 = HEAP8[$75>>0]|0;
 $77 = $76&255;
 $78 = (_bitshift64Shl(($77|0),0,16)|0);
 $79 = tempRet0;
 $80 = $74 | $78;
 $81 = $73 | $79;
 $82 = ((($0)) + 13|0);
 $83 = HEAP8[$82>>0]|0;
 $84 = $83&255;
 $85 = (_bitshift64Shl(($84|0),0,24)|0);
 $86 = tempRet0;
 $87 = $80 | $85;
 $88 = $81 | $86;
 $89 = (_bitshift64Lshr(($87|0),($88|0),4)|0);
 $90 = tempRet0;
 $91 = $89 & 2097151;
 $$idx599 = ((($0)) + 14|0);
 $$idx599$val = HEAP8[$$idx599>>0]|0;
 $$idx600 = ((($0)) + 15|0);
 $$idx600$val = HEAP8[$$idx600>>0]|0;
 $92 = $$idx599$val&255;
 $93 = (_bitshift64Shl(($92|0),0,8)|0);
 $94 = tempRet0;
 $95 = $93 | $84;
 $96 = $$idx600$val&255;
 $97 = (_bitshift64Shl(($96|0),0,16)|0);
 $98 = tempRet0;
 $99 = $95 | $97;
 $100 = $94 | $98;
 $101 = (_bitshift64Lshr(($99|0),($100|0),1)|0);
 $102 = tempRet0;
 $103 = $101 & 2097151;
 $104 = ((($0)) + 16|0);
 $105 = HEAP8[$104>>0]|0;
 $106 = $105&255;
 $107 = (_bitshift64Shl(($106|0),0,8)|0);
 $108 = tempRet0;
 $109 = $107 | $96;
 $110 = ((($0)) + 17|0);
 $111 = HEAP8[$110>>0]|0;
 $112 = $111&255;
 $113 = (_bitshift64Shl(($112|0),0,16)|0);
 $114 = tempRet0;
 $115 = $109 | $113;
 $116 = $108 | $114;
 $117 = ((($0)) + 18|0);
 $118 = HEAP8[$117>>0]|0;
 $119 = $118&255;
 $120 = (_bitshift64Shl(($119|0),0,24)|0);
 $121 = tempRet0;
 $122 = $115 | $120;
 $123 = $116 | $121;
 $124 = (_bitshift64Lshr(($122|0),($123|0),6)|0);
 $125 = tempRet0;
 $126 = $124 & 2097151;
 $$idx596 = ((($0)) + 19|0);
 $$idx596$val = HEAP8[$$idx596>>0]|0;
 $$idx597 = ((($0)) + 20|0);
 $$idx597$val = HEAP8[$$idx597>>0]|0;
 $127 = $$idx596$val&255;
 $128 = (_bitshift64Shl(($127|0),0,8)|0);
 $129 = tempRet0;
 $130 = $128 | $119;
 $131 = $$idx597$val&255;
 $132 = (_bitshift64Shl(($131|0),0,16)|0);
 $133 = tempRet0;
 $134 = $130 | $132;
 $135 = $129 | $133;
 $136 = (_bitshift64Lshr(($134|0),($135|0),3)|0);
 $137 = tempRet0;
 $138 = ((($0)) + 21|0);
 $$val592 = HEAP8[$138>>0]|0;
 $$idx593 = ((($0)) + 22|0);
 $$idx593$val = HEAP8[$$idx593>>0]|0;
 $$idx594 = ((($0)) + 23|0);
 $$idx594$val = HEAP8[$$idx594>>0]|0;
 $139 = $$val592&255;
 $140 = $$idx593$val&255;
 $141 = (_bitshift64Shl(($140|0),0,8)|0);
 $142 = tempRet0;
 $143 = $141 | $139;
 $144 = $$idx594$val&255;
 $145 = (_bitshift64Shl(($144|0),0,16)|0);
 $146 = tempRet0;
 $147 = $145 & 2031616;
 $148 = $143 | $147;
 $149 = ((($0)) + 24|0);
 $150 = HEAP8[$149>>0]|0;
 $151 = $150&255;
 $152 = (_bitshift64Shl(($151|0),0,8)|0);
 $153 = tempRet0;
 $154 = $152 | $144;
 $155 = ((($0)) + 25|0);
 $156 = HEAP8[$155>>0]|0;
 $157 = $156&255;
 $158 = (_bitshift64Shl(($157|0),0,16)|0);
 $159 = tempRet0;
 $160 = $154 | $158;
 $161 = $153 | $159;
 $162 = ((($0)) + 26|0);
 $163 = HEAP8[$162>>0]|0;
 $164 = $163&255;
 $165 = (_bitshift64Shl(($164|0),0,24)|0);
 $166 = tempRet0;
 $167 = $160 | $165;
 $168 = $161 | $166;
 $169 = (_bitshift64Lshr(($167|0),($168|0),5)|0);
 $170 = tempRet0;
 $171 = $169 & 2097151;
 $$idx590 = ((($0)) + 27|0);
 $$idx590$val = HEAP8[$$idx590>>0]|0;
 $$idx591 = ((($0)) + 28|0);
 $$idx591$val = HEAP8[$$idx591>>0]|0;
 $172 = $$idx590$val&255;
 $173 = (_bitshift64Shl(($172|0),0,8)|0);
 $174 = tempRet0;
 $175 = $173 | $164;
 $176 = $$idx591$val&255;
 $177 = (_bitshift64Shl(($176|0),0,16)|0);
 $178 = tempRet0;
 $179 = $175 | $177;
 $180 = $174 | $178;
 $181 = (_bitshift64Lshr(($179|0),($180|0),2)|0);
 $182 = tempRet0;
 $183 = $181 & 2097151;
 $184 = ((($0)) + 29|0);
 $185 = HEAP8[$184>>0]|0;
 $186 = $185&255;
 $187 = (_bitshift64Shl(($186|0),0,8)|0);
 $188 = tempRet0;
 $189 = $187 | $176;
 $190 = ((($0)) + 30|0);
 $191 = HEAP8[$190>>0]|0;
 $192 = $191&255;
 $193 = (_bitshift64Shl(($192|0),0,16)|0);
 $194 = tempRet0;
 $195 = $189 | $193;
 $196 = $188 | $194;
 $197 = ((($0)) + 31|0);
 $198 = HEAP8[$197>>0]|0;
 $199 = $198&255;
 $200 = (_bitshift64Shl(($199|0),0,24)|0);
 $201 = tempRet0;
 $202 = $195 | $200;
 $203 = $196 | $201;
 $204 = (_bitshift64Lshr(($202|0),($203|0),7)|0);
 $205 = tempRet0;
 $206 = $204 & 2097151;
 $207 = ((($0)) + 32|0);
 $208 = HEAP8[$207>>0]|0;
 $209 = $208&255;
 $210 = (_bitshift64Shl(($209|0),0,8)|0);
 $211 = tempRet0;
 $212 = $210 | $199;
 $213 = ((($0)) + 33|0);
 $214 = HEAP8[$213>>0]|0;
 $215 = $214&255;
 $216 = (_bitshift64Shl(($215|0),0,16)|0);
 $217 = tempRet0;
 $218 = $212 | $216;
 $219 = $211 | $217;
 $220 = ((($0)) + 34|0);
 $221 = HEAP8[$220>>0]|0;
 $222 = $221&255;
 $223 = (_bitshift64Shl(($222|0),0,24)|0);
 $224 = tempRet0;
 $225 = $218 | $223;
 $226 = $219 | $224;
 $227 = (_bitshift64Lshr(($225|0),($226|0),4)|0);
 $228 = tempRet0;
 $229 = $227 & 2097151;
 $$idx587 = ((($0)) + 35|0);
 $$idx587$val = HEAP8[$$idx587>>0]|0;
 $$idx588 = ((($0)) + 36|0);
 $$idx588$val = HEAP8[$$idx588>>0]|0;
 $230 = $$idx587$val&255;
 $231 = (_bitshift64Shl(($230|0),0,8)|0);
 $232 = tempRet0;
 $233 = $231 | $222;
 $234 = $$idx588$val&255;
 $235 = (_bitshift64Shl(($234|0),0,16)|0);
 $236 = tempRet0;
 $237 = $233 | $235;
 $238 = $232 | $236;
 $239 = (_bitshift64Lshr(($237|0),($238|0),1)|0);
 $240 = tempRet0;
 $241 = $239 & 2097151;
 $242 = ((($0)) + 37|0);
 $243 = HEAP8[$242>>0]|0;
 $244 = $243&255;
 $245 = (_bitshift64Shl(($244|0),0,8)|0);
 $246 = tempRet0;
 $247 = $245 | $234;
 $248 = ((($0)) + 38|0);
 $249 = HEAP8[$248>>0]|0;
 $250 = $249&255;
 $251 = (_bitshift64Shl(($250|0),0,16)|0);
 $252 = tempRet0;
 $253 = $247 | $251;
 $254 = $246 | $252;
 $255 = ((($0)) + 39|0);
 $256 = HEAP8[$255>>0]|0;
 $257 = $256&255;
 $258 = (_bitshift64Shl(($257|0),0,24)|0);
 $259 = tempRet0;
 $260 = $253 | $258;
 $261 = $254 | $259;
 $262 = (_bitshift64Lshr(($260|0),($261|0),6)|0);
 $263 = tempRet0;
 $264 = $262 & 2097151;
 $$idx584 = ((($0)) + 40|0);
 $$idx584$val = HEAP8[$$idx584>>0]|0;
 $$idx585 = ((($0)) + 41|0);
 $$idx585$val = HEAP8[$$idx585>>0]|0;
 $265 = $$idx584$val&255;
 $266 = (_bitshift64Shl(($265|0),0,8)|0);
 $267 = tempRet0;
 $268 = $266 | $257;
 $269 = $$idx585$val&255;
 $270 = (_bitshift64Shl(($269|0),0,16)|0);
 $271 = tempRet0;
 $272 = $268 | $270;
 $273 = $267 | $271;
 $274 = (_bitshift64Lshr(($272|0),($273|0),3)|0);
 $275 = tempRet0;
 $276 = ((($0)) + 42|0);
 $$val580 = HEAP8[$276>>0]|0;
 $$idx581 = ((($0)) + 43|0);
 $$idx581$val = HEAP8[$$idx581>>0]|0;
 $$idx582 = ((($0)) + 44|0);
 $$idx582$val = HEAP8[$$idx582>>0]|0;
 $277 = $$val580&255;
 $278 = $$idx581$val&255;
 $279 = (_bitshift64Shl(($278|0),0,8)|0);
 $280 = tempRet0;
 $281 = $279 | $277;
 $282 = $$idx582$val&255;
 $283 = (_bitshift64Shl(($282|0),0,16)|0);
 $284 = tempRet0;
 $285 = $283 & 2031616;
 $286 = $281 | $285;
 $287 = ((($0)) + 45|0);
 $288 = HEAP8[$287>>0]|0;
 $289 = $288&255;
 $290 = (_bitshift64Shl(($289|0),0,8)|0);
 $291 = tempRet0;
 $292 = $290 | $282;
 $293 = ((($0)) + 46|0);
 $294 = HEAP8[$293>>0]|0;
 $295 = $294&255;
 $296 = (_bitshift64Shl(($295|0),0,16)|0);
 $297 = tempRet0;
 $298 = $292 | $296;
 $299 = $291 | $297;
 $300 = ((($0)) + 47|0);
 $301 = HEAP8[$300>>0]|0;
 $302 = $301&255;
 $303 = (_bitshift64Shl(($302|0),0,24)|0);
 $304 = tempRet0;
 $305 = $298 | $303;
 $306 = $299 | $304;
 $307 = (_bitshift64Lshr(($305|0),($306|0),5)|0);
 $308 = tempRet0;
 $309 = $307 & 2097151;
 $$idx578 = ((($0)) + 48|0);
 $$idx578$val = HEAP8[$$idx578>>0]|0;
 $$idx579 = ((($0)) + 49|0);
 $$idx579$val = HEAP8[$$idx579>>0]|0;
 $310 = $$idx578$val&255;
 $311 = (_bitshift64Shl(($310|0),0,8)|0);
 $312 = tempRet0;
 $313 = $311 | $302;
 $314 = $$idx579$val&255;
 $315 = (_bitshift64Shl(($314|0),0,16)|0);
 $316 = tempRet0;
 $317 = $313 | $315;
 $318 = $312 | $316;
 $319 = (_bitshift64Lshr(($317|0),($318|0),2)|0);
 $320 = tempRet0;
 $321 = $319 & 2097151;
 $322 = ((($0)) + 50|0);
 $323 = HEAP8[$322>>0]|0;
 $324 = $323&255;
 $325 = (_bitshift64Shl(($324|0),0,8)|0);
 $326 = tempRet0;
 $327 = $325 | $314;
 $328 = ((($0)) + 51|0);
 $329 = HEAP8[$328>>0]|0;
 $330 = $329&255;
 $331 = (_bitshift64Shl(($330|0),0,16)|0);
 $332 = tempRet0;
 $333 = $327 | $331;
 $334 = $326 | $332;
 $335 = ((($0)) + 52|0);
 $336 = HEAP8[$335>>0]|0;
 $337 = $336&255;
 $338 = (_bitshift64Shl(($337|0),0,24)|0);
 $339 = tempRet0;
 $340 = $333 | $338;
 $341 = $334 | $339;
 $342 = (_bitshift64Lshr(($340|0),($341|0),7)|0);
 $343 = tempRet0;
 $344 = $342 & 2097151;
 $345 = ((($0)) + 53|0);
 $346 = HEAP8[$345>>0]|0;
 $347 = $346&255;
 $348 = (_bitshift64Shl(($347|0),0,8)|0);
 $349 = tempRet0;
 $350 = $348 | $337;
 $351 = ((($0)) + 54|0);
 $352 = HEAP8[$351>>0]|0;
 $353 = $352&255;
 $354 = (_bitshift64Shl(($353|0),0,16)|0);
 $355 = tempRet0;
 $356 = $350 | $354;
 $357 = $349 | $355;
 $358 = ((($0)) + 55|0);
 $359 = HEAP8[$358>>0]|0;
 $360 = $359&255;
 $361 = (_bitshift64Shl(($360|0),0,24)|0);
 $362 = tempRet0;
 $363 = $356 | $361;
 $364 = $357 | $362;
 $365 = (_bitshift64Lshr(($363|0),($364|0),4)|0);
 $366 = tempRet0;
 $367 = $365 & 2097151;
 $$idx = ((($0)) + 56|0);
 $$idx$val = HEAP8[$$idx>>0]|0;
 $$idx576 = ((($0)) + 57|0);
 $$idx576$val = HEAP8[$$idx576>>0]|0;
 $368 = $$idx$val&255;
 $369 = (_bitshift64Shl(($368|0),0,8)|0);
 $370 = tempRet0;
 $371 = $369 | $360;
 $372 = $$idx576$val&255;
 $373 = (_bitshift64Shl(($372|0),0,16)|0);
 $374 = tempRet0;
 $375 = $371 | $373;
 $376 = $370 | $374;
 $377 = (_bitshift64Lshr(($375|0),($376|0),1)|0);
 $378 = tempRet0;
 $379 = $377 & 2097151;
 $380 = ((($0)) + 58|0);
 $381 = HEAP8[$380>>0]|0;
 $382 = $381&255;
 $383 = (_bitshift64Shl(($382|0),0,8)|0);
 $384 = tempRet0;
 $385 = $383 | $372;
 $386 = ((($0)) + 59|0);
 $387 = HEAP8[$386>>0]|0;
 $388 = $387&255;
 $389 = (_bitshift64Shl(($388|0),0,16)|0);
 $390 = tempRet0;
 $391 = $385 | $389;
 $392 = $384 | $390;
 $393 = ((($0)) + 60|0);
 $394 = HEAP8[$393>>0]|0;
 $395 = $394&255;
 $396 = (_bitshift64Shl(($395|0),0,24)|0);
 $397 = tempRet0;
 $398 = $391 | $396;
 $399 = $392 | $397;
 $400 = (_bitshift64Lshr(($398|0),($399|0),6)|0);
 $401 = tempRet0;
 $402 = $400 & 2097151;
 $403 = ((($0)) + 61|0);
 $404 = HEAP8[$403>>0]|0;
 $405 = $404&255;
 $406 = (_bitshift64Shl(($405|0),0,8)|0);
 $407 = tempRet0;
 $408 = $406 | $395;
 $409 = ((($0)) + 62|0);
 $410 = HEAP8[$409>>0]|0;
 $411 = $410&255;
 $412 = (_bitshift64Shl(($411|0),0,16)|0);
 $413 = tempRet0;
 $414 = $408 | $412;
 $415 = $407 | $413;
 $416 = ((($0)) + 63|0);
 $417 = HEAP8[$416>>0]|0;
 $418 = $417&255;
 $419 = (_bitshift64Shl(($418|0),0,24)|0);
 $420 = tempRet0;
 $421 = $414 | $419;
 $422 = $415 | $420;
 $423 = (_bitshift64Lshr(($421|0),($422|0),3)|0);
 $424 = tempRet0;
 $425 = (___muldi3(($423|0),($424|0),666643,0)|0);
 $426 = tempRet0;
 $427 = (___muldi3(($423|0),($424|0),470296,0)|0);
 $428 = tempRet0;
 $429 = (___muldi3(($423|0),($424|0),654183,0)|0);
 $430 = tempRet0;
 $431 = (___muldi3(($423|0),($424|0),-997805,-1)|0);
 $432 = tempRet0;
 $433 = (___muldi3(($423|0),($424|0),136657,0)|0);
 $434 = tempRet0;
 $435 = (___muldi3(($423|0),($424|0),-683901,-1)|0);
 $436 = tempRet0;
 $437 = (_i64Add(($435|0),($436|0),($286|0),($280|0))|0);
 $438 = tempRet0;
 $439 = (___muldi3(($402|0),0,666643,0)|0);
 $440 = tempRet0;
 $441 = (___muldi3(($402|0),0,470296,0)|0);
 $442 = tempRet0;
 $443 = (___muldi3(($402|0),0,654183,0)|0);
 $444 = tempRet0;
 $445 = (___muldi3(($402|0),0,-997805,-1)|0);
 $446 = tempRet0;
 $447 = (___muldi3(($402|0),0,136657,0)|0);
 $448 = tempRet0;
 $449 = (___muldi3(($402|0),0,-683901,-1)|0);
 $450 = tempRet0;
 $451 = (___muldi3(($379|0),0,666643,0)|0);
 $452 = tempRet0;
 $453 = (___muldi3(($379|0),0,470296,0)|0);
 $454 = tempRet0;
 $455 = (___muldi3(($379|0),0,654183,0)|0);
 $456 = tempRet0;
 $457 = (___muldi3(($379|0),0,-997805,-1)|0);
 $458 = tempRet0;
 $459 = (___muldi3(($379|0),0,136657,0)|0);
 $460 = tempRet0;
 $461 = (___muldi3(($379|0),0,-683901,-1)|0);
 $462 = tempRet0;
 $463 = (_i64Add(($461|0),($462|0),($264|0),0)|0);
 $464 = tempRet0;
 $465 = (_i64Add(($463|0),($464|0),($447|0),($448|0))|0);
 $466 = tempRet0;
 $467 = (_i64Add(($465|0),($466|0),($431|0),($432|0))|0);
 $468 = tempRet0;
 $469 = (___muldi3(($367|0),0,666643,0)|0);
 $470 = tempRet0;
 $471 = (___muldi3(($367|0),0,470296,0)|0);
 $472 = tempRet0;
 $473 = (___muldi3(($367|0),0,654183,0)|0);
 $474 = tempRet0;
 $475 = (___muldi3(($367|0),0,-997805,-1)|0);
 $476 = tempRet0;
 $477 = (___muldi3(($367|0),0,136657,0)|0);
 $478 = tempRet0;
 $479 = (___muldi3(($367|0),0,-683901,-1)|0);
 $480 = tempRet0;
 $481 = (___muldi3(($344|0),0,666643,0)|0);
 $482 = tempRet0;
 $483 = (___muldi3(($344|0),0,470296,0)|0);
 $484 = tempRet0;
 $485 = (___muldi3(($344|0),0,654183,0)|0);
 $486 = tempRet0;
 $487 = (___muldi3(($344|0),0,-997805,-1)|0);
 $488 = tempRet0;
 $489 = (___muldi3(($344|0),0,136657,0)|0);
 $490 = tempRet0;
 $491 = (___muldi3(($344|0),0,-683901,-1)|0);
 $492 = tempRet0;
 $493 = (_i64Add(($491|0),($492|0),($229|0),0)|0);
 $494 = tempRet0;
 $495 = (_i64Add(($493|0),($494|0),($477|0),($478|0))|0);
 $496 = tempRet0;
 $497 = (_i64Add(($495|0),($496|0),($457|0),($458|0))|0);
 $498 = tempRet0;
 $499 = (_i64Add(($497|0),($498|0),($443|0),($444|0))|0);
 $500 = tempRet0;
 $501 = (_i64Add(($499|0),($500|0),($427|0),($428|0))|0);
 $502 = tempRet0;
 $503 = (___muldi3(($321|0),0,666643,0)|0);
 $504 = tempRet0;
 $505 = (_i64Add(($503|0),($504|0),($126|0),0)|0);
 $506 = tempRet0;
 $507 = (___muldi3(($321|0),0,470296,0)|0);
 $508 = tempRet0;
 $509 = (___muldi3(($321|0),0,654183,0)|0);
 $510 = tempRet0;
 $511 = (_i64Add(($509|0),($510|0),($148|0),($142|0))|0);
 $512 = tempRet0;
 $513 = (_i64Add(($511|0),($512|0),($483|0),($484|0))|0);
 $514 = tempRet0;
 $515 = (_i64Add(($513|0),($514|0),($469|0),($470|0))|0);
 $516 = tempRet0;
 $517 = (___muldi3(($321|0),0,-997805,-1)|0);
 $518 = tempRet0;
 $519 = (___muldi3(($321|0),0,136657,0)|0);
 $520 = tempRet0;
 $521 = (_i64Add(($519|0),($520|0),($183|0),0)|0);
 $522 = tempRet0;
 $523 = (_i64Add(($521|0),($522|0),($487|0),($488|0))|0);
 $524 = tempRet0;
 $525 = (_i64Add(($523|0),($524|0),($473|0),($474|0))|0);
 $526 = tempRet0;
 $527 = (_i64Add(($525|0),($526|0),($453|0),($454|0))|0);
 $528 = tempRet0;
 $529 = (_i64Add(($527|0),($528|0),($439|0),($440|0))|0);
 $530 = tempRet0;
 $531 = (___muldi3(($321|0),0,-683901,-1)|0);
 $532 = tempRet0;
 $533 = (_i64Add(($505|0),($506|0),1048576,0)|0);
 $534 = tempRet0;
 $535 = (_bitshift64Lshr(($533|0),($534|0),21)|0);
 $536 = tempRet0;
 $537 = (_i64Add(($507|0),($508|0),($136|0),($137|0))|0);
 $538 = tempRet0;
 $539 = (_i64Add(($537|0),($538|0),($535|0),($536|0))|0);
 $540 = tempRet0;
 $541 = (_i64Add(($539|0),($540|0),($481|0),($482|0))|0);
 $542 = tempRet0;
 $543 = $533 & -2097152;
 $544 = $534 & 2047;
 $545 = (_i64Subtract(($505|0),($506|0),($543|0),($544|0))|0);
 $546 = tempRet0;
 $547 = (_i64Add(($515|0),($516|0),1048576,0)|0);
 $548 = tempRet0;
 $549 = (_bitshift64Lshr(($547|0),($548|0),21)|0);
 $550 = tempRet0;
 $551 = (_i64Add(($517|0),($518|0),($171|0),0)|0);
 $552 = tempRet0;
 $553 = (_i64Add(($551|0),($552|0),($485|0),($486|0))|0);
 $554 = tempRet0;
 $555 = (_i64Add(($553|0),($554|0),($471|0),($472|0))|0);
 $556 = tempRet0;
 $557 = (_i64Add(($555|0),($556|0),($451|0),($452|0))|0);
 $558 = tempRet0;
 $559 = (_i64Add(($557|0),($558|0),($549|0),($550|0))|0);
 $560 = tempRet0;
 $561 = $547 & -2097152;
 $562 = (_i64Add(($529|0),($530|0),1048576,0)|0);
 $563 = tempRet0;
 $564 = (_bitshift64Ashr(($562|0),($563|0),21)|0);
 $565 = tempRet0;
 $566 = (_i64Add(($531|0),($532|0),($206|0),0)|0);
 $567 = tempRet0;
 $568 = (_i64Add(($566|0),($567|0),($489|0),($490|0))|0);
 $569 = tempRet0;
 $570 = (_i64Add(($568|0),($569|0),($475|0),($476|0))|0);
 $571 = tempRet0;
 $572 = (_i64Add(($570|0),($571|0),($455|0),($456|0))|0);
 $573 = tempRet0;
 $574 = (_i64Add(($572|0),($573|0),($441|0),($442|0))|0);
 $575 = tempRet0;
 $576 = (_i64Add(($574|0),($575|0),($425|0),($426|0))|0);
 $577 = tempRet0;
 $578 = (_i64Add(($576|0),($577|0),($564|0),($565|0))|0);
 $579 = tempRet0;
 $580 = $562 & -2097152;
 $581 = (_i64Add(($501|0),($502|0),1048576,0)|0);
 $582 = tempRet0;
 $583 = (_bitshift64Ashr(($581|0),($582|0),21)|0);
 $584 = tempRet0;
 $585 = (_i64Add(($479|0),($480|0),($241|0),0)|0);
 $586 = tempRet0;
 $587 = (_i64Add(($585|0),($586|0),($459|0),($460|0))|0);
 $588 = tempRet0;
 $589 = (_i64Add(($587|0),($588|0),($445|0),($446|0))|0);
 $590 = tempRet0;
 $591 = (_i64Add(($589|0),($590|0),($429|0),($430|0))|0);
 $592 = tempRet0;
 $593 = (_i64Add(($591|0),($592|0),($583|0),($584|0))|0);
 $594 = tempRet0;
 $595 = $581 & -2097152;
 $596 = (_i64Subtract(($501|0),($502|0),($595|0),($582|0))|0);
 $597 = tempRet0;
 $598 = (_i64Add(($467|0),($468|0),1048576,0)|0);
 $599 = tempRet0;
 $600 = (_bitshift64Ashr(($598|0),($599|0),21)|0);
 $601 = tempRet0;
 $602 = (_i64Add(($449|0),($450|0),($274|0),($275|0))|0);
 $603 = tempRet0;
 $604 = (_i64Add(($602|0),($603|0),($433|0),($434|0))|0);
 $605 = tempRet0;
 $606 = (_i64Add(($604|0),($605|0),($600|0),($601|0))|0);
 $607 = tempRet0;
 $608 = $598 & -2097152;
 $609 = (_i64Subtract(($467|0),($468|0),($608|0),($599|0))|0);
 $610 = tempRet0;
 $611 = (_i64Add(($437|0),($438|0),1048576,0)|0);
 $612 = tempRet0;
 $613 = (_bitshift64Ashr(($611|0),($612|0),21)|0);
 $614 = tempRet0;
 $615 = (_i64Add(($613|0),($614|0),($309|0),0)|0);
 $616 = tempRet0;
 $617 = $611 & -2097152;
 $618 = (_i64Subtract(($437|0),($438|0),($617|0),($612|0))|0);
 $619 = tempRet0;
 $620 = (_i64Add(($541|0),($542|0),1048576,0)|0);
 $621 = tempRet0;
 $622 = (_bitshift64Lshr(($620|0),($621|0),21)|0);
 $623 = tempRet0;
 $624 = $620 & -2097152;
 $625 = (_i64Subtract(($541|0),($542|0),($624|0),($621|0))|0);
 $626 = tempRet0;
 $627 = (_i64Add(($559|0),($560|0),1048576,0)|0);
 $628 = tempRet0;
 $629 = (_bitshift64Ashr(($627|0),($628|0),21)|0);
 $630 = tempRet0;
 $631 = $627 & -2097152;
 $632 = (_i64Subtract(($559|0),($560|0),($631|0),($628|0))|0);
 $633 = tempRet0;
 $634 = (_i64Add(($578|0),($579|0),1048576,0)|0);
 $635 = tempRet0;
 $636 = (_bitshift64Ashr(($634|0),($635|0),21)|0);
 $637 = tempRet0;
 $638 = (_i64Add(($636|0),($637|0),($596|0),($597|0))|0);
 $639 = tempRet0;
 $640 = $634 & -2097152;
 $641 = (_i64Subtract(($578|0),($579|0),($640|0),($635|0))|0);
 $642 = tempRet0;
 $643 = (_i64Add(($593|0),($594|0),1048576,0)|0);
 $644 = tempRet0;
 $645 = (_bitshift64Ashr(($643|0),($644|0),21)|0);
 $646 = tempRet0;
 $647 = (_i64Add(($645|0),($646|0),($609|0),($610|0))|0);
 $648 = tempRet0;
 $649 = $643 & -2097152;
 $650 = (_i64Subtract(($593|0),($594|0),($649|0),($644|0))|0);
 $651 = tempRet0;
 $652 = (_i64Add(($606|0),($607|0),1048576,0)|0);
 $653 = tempRet0;
 $654 = (_bitshift64Ashr(($652|0),($653|0),21)|0);
 $655 = tempRet0;
 $656 = (_i64Add(($654|0),($655|0),($618|0),($619|0))|0);
 $657 = tempRet0;
 $658 = $652 & -2097152;
 $659 = (_i64Subtract(($606|0),($607|0),($658|0),($653|0))|0);
 $660 = tempRet0;
 $661 = (___muldi3(($615|0),($616|0),666643,0)|0);
 $662 = tempRet0;
 $663 = (_i64Add(($661|0),($662|0),($103|0),0)|0);
 $664 = tempRet0;
 $665 = (___muldi3(($615|0),($616|0),470296,0)|0);
 $666 = tempRet0;
 $667 = (_i64Add(($545|0),($546|0),($665|0),($666|0))|0);
 $668 = tempRet0;
 $669 = (___muldi3(($615|0),($616|0),654183,0)|0);
 $670 = tempRet0;
 $671 = (_i64Add(($625|0),($626|0),($669|0),($670|0))|0);
 $672 = tempRet0;
 $673 = (___muldi3(($615|0),($616|0),-997805,-1)|0);
 $674 = tempRet0;
 $675 = (___muldi3(($615|0),($616|0),136657,0)|0);
 $676 = tempRet0;
 $677 = (_i64Add(($632|0),($633|0),($675|0),($676|0))|0);
 $678 = tempRet0;
 $679 = (___muldi3(($615|0),($616|0),-683901,-1)|0);
 $680 = tempRet0;
 $681 = (_i64Add(($529|0),($530|0),($629|0),($630|0))|0);
 $682 = tempRet0;
 $683 = (_i64Subtract(($681|0),($682|0),($580|0),($563|0))|0);
 $684 = tempRet0;
 $685 = (_i64Add(($683|0),($684|0),($679|0),($680|0))|0);
 $686 = tempRet0;
 $687 = (___muldi3(($656|0),($657|0),666643,0)|0);
 $688 = tempRet0;
 $689 = (_i64Add(($687|0),($688|0),($91|0),0)|0);
 $690 = tempRet0;
 $691 = (___muldi3(($656|0),($657|0),470296,0)|0);
 $692 = tempRet0;
 $693 = (_i64Add(($663|0),($664|0),($691|0),($692|0))|0);
 $694 = tempRet0;
 $695 = (___muldi3(($656|0),($657|0),654183,0)|0);
 $696 = tempRet0;
 $697 = (_i64Add(($667|0),($668|0),($695|0),($696|0))|0);
 $698 = tempRet0;
 $699 = (___muldi3(($656|0),($657|0),-997805,-1)|0);
 $700 = tempRet0;
 $701 = (_i64Add(($671|0),($672|0),($699|0),($700|0))|0);
 $702 = tempRet0;
 $703 = (___muldi3(($656|0),($657|0),136657,0)|0);
 $704 = tempRet0;
 $705 = (___muldi3(($656|0),($657|0),-683901,-1)|0);
 $706 = tempRet0;
 $707 = (_i64Add(($677|0),($678|0),($705|0),($706|0))|0);
 $708 = tempRet0;
 $709 = (___muldi3(($659|0),($660|0),666643,0)|0);
 $710 = tempRet0;
 $711 = (_i64Add(($709|0),($710|0),($68|0),0)|0);
 $712 = tempRet0;
 $713 = (___muldi3(($659|0),($660|0),470296,0)|0);
 $714 = tempRet0;
 $715 = (_i64Add(($689|0),($690|0),($713|0),($714|0))|0);
 $716 = tempRet0;
 $717 = (___muldi3(($659|0),($660|0),654183,0)|0);
 $718 = tempRet0;
 $719 = (_i64Add(($693|0),($694|0),($717|0),($718|0))|0);
 $720 = tempRet0;
 $721 = (___muldi3(($659|0),($660|0),-997805,-1)|0);
 $722 = tempRet0;
 $723 = (_i64Add(($697|0),($698|0),($721|0),($722|0))|0);
 $724 = tempRet0;
 $725 = (___muldi3(($659|0),($660|0),136657,0)|0);
 $726 = tempRet0;
 $727 = (_i64Add(($701|0),($702|0),($725|0),($726|0))|0);
 $728 = tempRet0;
 $729 = (___muldi3(($659|0),($660|0),-683901,-1)|0);
 $730 = tempRet0;
 $731 = (_i64Add(($515|0),($516|0),($622|0),($623|0))|0);
 $732 = tempRet0;
 $733 = (_i64Subtract(($731|0),($732|0),($561|0),($548|0))|0);
 $734 = tempRet0;
 $735 = (_i64Add(($733|0),($734|0),($673|0),($674|0))|0);
 $736 = tempRet0;
 $737 = (_i64Add(($735|0),($736|0),($703|0),($704|0))|0);
 $738 = tempRet0;
 $739 = (_i64Add(($737|0),($738|0),($729|0),($730|0))|0);
 $740 = tempRet0;
 $741 = (___muldi3(($647|0),($648|0),666643,0)|0);
 $742 = tempRet0;
 $743 = (___muldi3(($647|0),($648|0),470296,0)|0);
 $744 = tempRet0;
 $745 = (___muldi3(($647|0),($648|0),654183,0)|0);
 $746 = tempRet0;
 $747 = (___muldi3(($647|0),($648|0),-997805,-1)|0);
 $748 = tempRet0;
 $749 = (___muldi3(($647|0),($648|0),136657,0)|0);
 $750 = tempRet0;
 $751 = (_i64Add(($723|0),($724|0),($749|0),($750|0))|0);
 $752 = tempRet0;
 $753 = (___muldi3(($647|0),($648|0),-683901,-1)|0);
 $754 = tempRet0;
 $755 = (_i64Add(($727|0),($728|0),($753|0),($754|0))|0);
 $756 = tempRet0;
 $757 = (___muldi3(($650|0),($651|0),666643,0)|0);
 $758 = tempRet0;
 $759 = (___muldi3(($650|0),($651|0),470296,0)|0);
 $760 = tempRet0;
 $761 = (___muldi3(($650|0),($651|0),654183,0)|0);
 $762 = tempRet0;
 $763 = (___muldi3(($650|0),($651|0),-997805,-1)|0);
 $764 = tempRet0;
 $765 = (___muldi3(($650|0),($651|0),136657,0)|0);
 $766 = tempRet0;
 $767 = (___muldi3(($650|0),($651|0),-683901,-1)|0);
 $768 = tempRet0;
 $769 = (_i64Add(($751|0),($752|0),($767|0),($768|0))|0);
 $770 = tempRet0;
 $771 = (___muldi3(($638|0),($639|0),666643,0)|0);
 $772 = tempRet0;
 $773 = (_i64Add(($771|0),($772|0),($10|0),($4|0))|0);
 $774 = tempRet0;
 $775 = (___muldi3(($638|0),($639|0),470296,0)|0);
 $776 = tempRet0;
 $777 = (___muldi3(($638|0),($639|0),654183,0)|0);
 $778 = tempRet0;
 $779 = (_i64Add(($777|0),($778|0),($45|0),0)|0);
 $780 = tempRet0;
 $781 = (_i64Add(($779|0),($780|0),($741|0),($742|0))|0);
 $782 = tempRet0;
 $783 = (_i64Add(($781|0),($782|0),($759|0),($760|0))|0);
 $784 = tempRet0;
 $785 = (___muldi3(($638|0),($639|0),-997805,-1)|0);
 $786 = tempRet0;
 $787 = (___muldi3(($638|0),($639|0),136657,0)|0);
 $788 = tempRet0;
 $789 = (_i64Add(($715|0),($716|0),($787|0),($788|0))|0);
 $790 = tempRet0;
 $791 = (_i64Add(($789|0),($790|0),($745|0),($746|0))|0);
 $792 = tempRet0;
 $793 = (_i64Add(($791|0),($792|0),($763|0),($764|0))|0);
 $794 = tempRet0;
 $795 = (___muldi3(($638|0),($639|0),-683901,-1)|0);
 $796 = tempRet0;
 $797 = (_i64Add(($773|0),($774|0),1048576,0)|0);
 $798 = tempRet0;
 $799 = (_bitshift64Ashr(($797|0),($798|0),21)|0);
 $800 = tempRet0;
 $801 = (_i64Add(($775|0),($776|0),($33|0),0)|0);
 $802 = tempRet0;
 $803 = (_i64Add(($801|0),($802|0),($757|0),($758|0))|0);
 $804 = tempRet0;
 $805 = (_i64Add(($803|0),($804|0),($799|0),($800|0))|0);
 $806 = tempRet0;
 $807 = $797 & -2097152;
 $808 = (_i64Subtract(($773|0),($774|0),($807|0),($798|0))|0);
 $809 = tempRet0;
 $810 = (_i64Add(($783|0),($784|0),1048576,0)|0);
 $811 = tempRet0;
 $812 = (_bitshift64Ashr(($810|0),($811|0),21)|0);
 $813 = tempRet0;
 $814 = (_i64Add(($711|0),($712|0),($785|0),($786|0))|0);
 $815 = tempRet0;
 $816 = (_i64Add(($814|0),($815|0),($743|0),($744|0))|0);
 $817 = tempRet0;
 $818 = (_i64Add(($816|0),($817|0),($761|0),($762|0))|0);
 $819 = tempRet0;
 $820 = (_i64Add(($818|0),($819|0),($812|0),($813|0))|0);
 $821 = tempRet0;
 $822 = $810 & -2097152;
 $823 = (_i64Add(($793|0),($794|0),1048576,0)|0);
 $824 = tempRet0;
 $825 = (_bitshift64Ashr(($823|0),($824|0),21)|0);
 $826 = tempRet0;
 $827 = (_i64Add(($719|0),($720|0),($795|0),($796|0))|0);
 $828 = tempRet0;
 $829 = (_i64Add(($827|0),($828|0),($747|0),($748|0))|0);
 $830 = tempRet0;
 $831 = (_i64Add(($829|0),($830|0),($765|0),($766|0))|0);
 $832 = tempRet0;
 $833 = (_i64Add(($831|0),($832|0),($825|0),($826|0))|0);
 $834 = tempRet0;
 $835 = $823 & -2097152;
 $836 = (_i64Add(($769|0),($770|0),1048576,0)|0);
 $837 = tempRet0;
 $838 = (_bitshift64Ashr(($836|0),($837|0),21)|0);
 $839 = tempRet0;
 $840 = (_i64Add(($755|0),($756|0),($838|0),($839|0))|0);
 $841 = tempRet0;
 $842 = $836 & -2097152;
 $843 = (_i64Subtract(($769|0),($770|0),($842|0),($837|0))|0);
 $844 = tempRet0;
 $845 = (_i64Add(($739|0),($740|0),1048576,0)|0);
 $846 = tempRet0;
 $847 = (_bitshift64Ashr(($845|0),($846|0),21)|0);
 $848 = tempRet0;
 $849 = (_i64Add(($707|0),($708|0),($847|0),($848|0))|0);
 $850 = tempRet0;
 $851 = $845 & -2097152;
 $852 = (_i64Subtract(($739|0),($740|0),($851|0),($846|0))|0);
 $853 = tempRet0;
 $854 = (_i64Add(($685|0),($686|0),1048576,0)|0);
 $855 = tempRet0;
 $856 = (_bitshift64Ashr(($854|0),($855|0),21)|0);
 $857 = tempRet0;
 $858 = (_i64Add(($641|0),($642|0),($856|0),($857|0))|0);
 $859 = tempRet0;
 $860 = $854 & -2097152;
 $861 = (_i64Subtract(($685|0),($686|0),($860|0),($855|0))|0);
 $862 = tempRet0;
 $863 = (_i64Add(($805|0),($806|0),1048576,0)|0);
 $864 = tempRet0;
 $865 = (_bitshift64Ashr(($863|0),($864|0),21)|0);
 $866 = tempRet0;
 $867 = $863 & -2097152;
 $868 = (_i64Add(($820|0),($821|0),1048576,0)|0);
 $869 = tempRet0;
 $870 = (_bitshift64Ashr(($868|0),($869|0),21)|0);
 $871 = tempRet0;
 $872 = $868 & -2097152;
 $873 = (_i64Add(($833|0),($834|0),1048576,0)|0);
 $874 = tempRet0;
 $875 = (_bitshift64Ashr(($873|0),($874|0),21)|0);
 $876 = tempRet0;
 $877 = (_i64Add(($843|0),($844|0),($875|0),($876|0))|0);
 $878 = tempRet0;
 $879 = $873 & -2097152;
 $880 = (_i64Add(($840|0),($841|0),1048576,0)|0);
 $881 = tempRet0;
 $882 = (_bitshift64Ashr(($880|0),($881|0),21)|0);
 $883 = tempRet0;
 $884 = (_i64Add(($852|0),($853|0),($882|0),($883|0))|0);
 $885 = tempRet0;
 $886 = $880 & -2097152;
 $887 = (_i64Subtract(($840|0),($841|0),($886|0),($881|0))|0);
 $888 = tempRet0;
 $889 = (_i64Add(($849|0),($850|0),1048576,0)|0);
 $890 = tempRet0;
 $891 = (_bitshift64Ashr(($889|0),($890|0),21)|0);
 $892 = tempRet0;
 $893 = (_i64Add(($861|0),($862|0),($891|0),($892|0))|0);
 $894 = tempRet0;
 $895 = $889 & -2097152;
 $896 = (_i64Subtract(($849|0),($850|0),($895|0),($890|0))|0);
 $897 = tempRet0;
 $898 = (_i64Add(($858|0),($859|0),1048576,0)|0);
 $899 = tempRet0;
 $900 = (_bitshift64Ashr(($898|0),($899|0),21)|0);
 $901 = tempRet0;
 $902 = $898 & -2097152;
 $903 = (_i64Subtract(($858|0),($859|0),($902|0),($899|0))|0);
 $904 = tempRet0;
 $905 = (___muldi3(($900|0),($901|0),666643,0)|0);
 $906 = tempRet0;
 $907 = (_i64Add(($808|0),($809|0),($905|0),($906|0))|0);
 $908 = tempRet0;
 $909 = (___muldi3(($900|0),($901|0),470296,0)|0);
 $910 = tempRet0;
 $911 = (___muldi3(($900|0),($901|0),654183,0)|0);
 $912 = tempRet0;
 $913 = (___muldi3(($900|0),($901|0),-997805,-1)|0);
 $914 = tempRet0;
 $915 = (___muldi3(($900|0),($901|0),136657,0)|0);
 $916 = tempRet0;
 $917 = (___muldi3(($900|0),($901|0),-683901,-1)|0);
 $918 = tempRet0;
 $919 = (_bitshift64Ashr(($907|0),($908|0),21)|0);
 $920 = tempRet0;
 $921 = (_i64Add(($805|0),($806|0),($909|0),($910|0))|0);
 $922 = tempRet0;
 $923 = (_i64Subtract(($921|0),($922|0),($867|0),($864|0))|0);
 $924 = tempRet0;
 $925 = (_i64Add(($923|0),($924|0),($919|0),($920|0))|0);
 $926 = tempRet0;
 $927 = $907 & 2097151;
 $928 = (_bitshift64Ashr(($925|0),($926|0),21)|0);
 $929 = tempRet0;
 $930 = (_i64Add(($783|0),($784|0),($911|0),($912|0))|0);
 $931 = tempRet0;
 $932 = (_i64Subtract(($930|0),($931|0),($822|0),($811|0))|0);
 $933 = tempRet0;
 $934 = (_i64Add(($932|0),($933|0),($865|0),($866|0))|0);
 $935 = tempRet0;
 $936 = (_i64Add(($934|0),($935|0),($928|0),($929|0))|0);
 $937 = tempRet0;
 $938 = $925 & 2097151;
 $939 = (_bitshift64Ashr(($936|0),($937|0),21)|0);
 $940 = tempRet0;
 $941 = (_i64Add(($820|0),($821|0),($913|0),($914|0))|0);
 $942 = tempRet0;
 $943 = (_i64Subtract(($941|0),($942|0),($872|0),($869|0))|0);
 $944 = tempRet0;
 $945 = (_i64Add(($943|0),($944|0),($939|0),($940|0))|0);
 $946 = tempRet0;
 $947 = $936 & 2097151;
 $948 = (_bitshift64Ashr(($945|0),($946|0),21)|0);
 $949 = tempRet0;
 $950 = (_i64Add(($793|0),($794|0),($915|0),($916|0))|0);
 $951 = tempRet0;
 $952 = (_i64Subtract(($950|0),($951|0),($835|0),($824|0))|0);
 $953 = tempRet0;
 $954 = (_i64Add(($952|0),($953|0),($870|0),($871|0))|0);
 $955 = tempRet0;
 $956 = (_i64Add(($954|0),($955|0),($948|0),($949|0))|0);
 $957 = tempRet0;
 $958 = $945 & 2097151;
 $959 = (_bitshift64Ashr(($956|0),($957|0),21)|0);
 $960 = tempRet0;
 $961 = (_i64Add(($833|0),($834|0),($917|0),($918|0))|0);
 $962 = tempRet0;
 $963 = (_i64Subtract(($961|0),($962|0),($879|0),($874|0))|0);
 $964 = tempRet0;
 $965 = (_i64Add(($963|0),($964|0),($959|0),($960|0))|0);
 $966 = tempRet0;
 $967 = $956 & 2097151;
 $968 = (_bitshift64Ashr(($965|0),($966|0),21)|0);
 $969 = tempRet0;
 $970 = (_i64Add(($877|0),($878|0),($968|0),($969|0))|0);
 $971 = tempRet0;
 $972 = $965 & 2097151;
 $973 = (_bitshift64Ashr(($970|0),($971|0),21)|0);
 $974 = tempRet0;
 $975 = (_i64Add(($973|0),($974|0),($887|0),($888|0))|0);
 $976 = tempRet0;
 $977 = $970 & 2097151;
 $978 = (_bitshift64Ashr(($975|0),($976|0),21)|0);
 $979 = tempRet0;
 $980 = (_i64Add(($884|0),($885|0),($978|0),($979|0))|0);
 $981 = tempRet0;
 $982 = $975 & 2097151;
 $983 = (_bitshift64Ashr(($980|0),($981|0),21)|0);
 $984 = tempRet0;
 $985 = (_i64Add(($983|0),($984|0),($896|0),($897|0))|0);
 $986 = tempRet0;
 $987 = $980 & 2097151;
 $988 = (_bitshift64Ashr(($985|0),($986|0),21)|0);
 $989 = tempRet0;
 $990 = (_i64Add(($893|0),($894|0),($988|0),($989|0))|0);
 $991 = tempRet0;
 $992 = $985 & 2097151;
 $993 = (_bitshift64Ashr(($990|0),($991|0),21)|0);
 $994 = tempRet0;
 $995 = (_i64Add(($993|0),($994|0),($903|0),($904|0))|0);
 $996 = tempRet0;
 $997 = $990 & 2097151;
 $998 = (_bitshift64Ashr(($995|0),($996|0),21)|0);
 $999 = tempRet0;
 $1000 = $995 & 2097151;
 $1001 = (___muldi3(($998|0),($999|0),666643,0)|0);
 $1002 = tempRet0;
 $1003 = (_i64Add(($1001|0),($1002|0),($927|0),0)|0);
 $1004 = tempRet0;
 $1005 = (___muldi3(($998|0),($999|0),470296,0)|0);
 $1006 = tempRet0;
 $1007 = (_i64Add(($1005|0),($1006|0),($938|0),0)|0);
 $1008 = tempRet0;
 $1009 = (___muldi3(($998|0),($999|0),654183,0)|0);
 $1010 = tempRet0;
 $1011 = (_i64Add(($1009|0),($1010|0),($947|0),0)|0);
 $1012 = tempRet0;
 $1013 = (___muldi3(($998|0),($999|0),-997805,-1)|0);
 $1014 = tempRet0;
 $1015 = (_i64Add(($1013|0),($1014|0),($958|0),0)|0);
 $1016 = tempRet0;
 $1017 = (___muldi3(($998|0),($999|0),136657,0)|0);
 $1018 = tempRet0;
 $1019 = (_i64Add(($1017|0),($1018|0),($967|0),0)|0);
 $1020 = tempRet0;
 $1021 = (___muldi3(($998|0),($999|0),-683901,-1)|0);
 $1022 = tempRet0;
 $1023 = (_i64Add(($1021|0),($1022|0),($972|0),0)|0);
 $1024 = tempRet0;
 $1025 = (_bitshift64Ashr(($1003|0),($1004|0),21)|0);
 $1026 = tempRet0;
 $1027 = (_i64Add(($1007|0),($1008|0),($1025|0),($1026|0))|0);
 $1028 = tempRet0;
 $1029 = (_bitshift64Ashr(($1027|0),($1028|0),21)|0);
 $1030 = tempRet0;
 $1031 = (_i64Add(($1011|0),($1012|0),($1029|0),($1030|0))|0);
 $1032 = tempRet0;
 $1033 = $1027 & 2097151;
 $1034 = (_bitshift64Ashr(($1031|0),($1032|0),21)|0);
 $1035 = tempRet0;
 $1036 = (_i64Add(($1015|0),($1016|0),($1034|0),($1035|0))|0);
 $1037 = tempRet0;
 $1038 = $1031 & 2097151;
 $1039 = (_bitshift64Ashr(($1036|0),($1037|0),21)|0);
 $1040 = tempRet0;
 $1041 = (_i64Add(($1019|0),($1020|0),($1039|0),($1040|0))|0);
 $1042 = tempRet0;
 $1043 = $1036 & 2097151;
 $1044 = (_bitshift64Ashr(($1041|0),($1042|0),21)|0);
 $1045 = tempRet0;
 $1046 = (_i64Add(($1023|0),($1024|0),($1044|0),($1045|0))|0);
 $1047 = tempRet0;
 $1048 = $1041 & 2097151;
 $1049 = (_bitshift64Ashr(($1046|0),($1047|0),21)|0);
 $1050 = tempRet0;
 $1051 = (_i64Add(($1049|0),($1050|0),($977|0),0)|0);
 $1052 = tempRet0;
 $1053 = $1046 & 2097151;
 $1054 = (_bitshift64Ashr(($1051|0),($1052|0),21)|0);
 $1055 = tempRet0;
 $1056 = (_i64Add(($1054|0),($1055|0),($982|0),0)|0);
 $1057 = tempRet0;
 $1058 = $1051 & 2097151;
 $1059 = (_bitshift64Ashr(($1056|0),($1057|0),21)|0);
 $1060 = tempRet0;
 $1061 = (_i64Add(($1059|0),($1060|0),($987|0),0)|0);
 $1062 = tempRet0;
 $1063 = (_bitshift64Ashr(($1061|0),($1062|0),21)|0);
 $1064 = tempRet0;
 $1065 = (_i64Add(($1063|0),($1064|0),($992|0),0)|0);
 $1066 = tempRet0;
 $1067 = (_bitshift64Ashr(($1065|0),($1066|0),21)|0);
 $1068 = tempRet0;
 $1069 = (_i64Add(($1067|0),($1068|0),($997|0),0)|0);
 $1070 = tempRet0;
 $1071 = $1065 & 2097151;
 $1072 = (_bitshift64Ashr(($1069|0),($1070|0),21)|0);
 $1073 = tempRet0;
 $1074 = (_i64Add(($1072|0),($1073|0),($1000|0),0)|0);
 $1075 = tempRet0;
 $1076 = $1069 & 2097151;
 $1077 = $1003&255;
 HEAP8[$0>>0] = $1077;
 $1078 = (_bitshift64Lshr(($1003|0),($1004|0),8)|0);
 $1079 = tempRet0;
 $1080 = $1078&255;
 HEAP8[$$idx605>>0] = $1080;
 $1081 = (_bitshift64Lshr(($1003|0),($1004|0),16)|0);
 $1082 = tempRet0;
 $1083 = $1081 & 31;
 $1084 = (_bitshift64Shl(($1033|0),0,5)|0);
 $1085 = tempRet0;
 $1086 = $1084 | $1083;
 $1087 = $1086&255;
 HEAP8[$$idx606>>0] = $1087;
 $1088 = (_bitshift64Lshr(($1027|0),($1028|0),3)|0);
 $1089 = tempRet0;
 $1090 = $1088&255;
 HEAP8[$11>>0] = $1090;
 $1091 = (_bitshift64Lshr(($1027|0),($1028|0),11)|0);
 $1092 = tempRet0;
 $1093 = $1091&255;
 HEAP8[$17>>0] = $1093;
 $1094 = (_bitshift64Lshr(($1033|0),0,19)|0);
 $1095 = tempRet0;
 $1096 = (_bitshift64Shl(($1038|0),0,2)|0);
 $1097 = tempRet0;
 $1098 = $1096 | $1094;
 $1097 | $1095;
 $1099 = $1098&255;
 HEAP8[$24>>0] = $1099;
 $1100 = (_bitshift64Lshr(($1031|0),($1032|0),6)|0);
 $1101 = tempRet0;
 $1102 = $1100&255;
 HEAP8[$$idx602>>0] = $1102;
 $1103 = (_bitshift64Lshr(($1038|0),0,14)|0);
 $1104 = tempRet0;
 $1105 = (_bitshift64Shl(($1043|0),0,7)|0);
 $1106 = tempRet0;
 $1107 = $1105 | $1103;
 $1106 | $1104;
 $1108 = $1107&255;
 HEAP8[$$idx603>>0] = $1108;
 $1109 = (_bitshift64Lshr(($1036|0),($1037|0),1)|0);
 $1110 = tempRet0;
 $1111 = $1109&255;
 HEAP8[$46>>0] = $1111;
 $1112 = (_bitshift64Lshr(($1036|0),($1037|0),9)|0);
 $1113 = tempRet0;
 $1114 = $1112&255;
 HEAP8[$52>>0] = $1114;
 $1115 = (_bitshift64Lshr(($1043|0),0,17)|0);
 $1116 = tempRet0;
 $1117 = (_bitshift64Shl(($1048|0),0,4)|0);
 $1118 = tempRet0;
 $1119 = $1117 | $1115;
 $1118 | $1116;
 $1120 = $1119&255;
 HEAP8[$59>>0] = $1120;
 $1121 = (_bitshift64Lshr(($1041|0),($1042|0),4)|0);
 $1122 = tempRet0;
 $1123 = $1121&255;
 HEAP8[$69>>0] = $1123;
 $1124 = (_bitshift64Lshr(($1041|0),($1042|0),12)|0);
 $1125 = tempRet0;
 $1126 = $1124&255;
 HEAP8[$75>>0] = $1126;
 $1127 = (_bitshift64Lshr(($1048|0),0,20)|0);
 $1128 = tempRet0;
 $1129 = (_bitshift64Shl(($1053|0),0,1)|0);
 $1130 = tempRet0;
 $1131 = $1129 | $1127;
 $1130 | $1128;
 $1132 = $1131&255;
 HEAP8[$82>>0] = $1132;
 $1133 = (_bitshift64Lshr(($1046|0),($1047|0),7)|0);
 $1134 = tempRet0;
 $1135 = $1133&255;
 HEAP8[$$idx599>>0] = $1135;
 $1136 = (_bitshift64Lshr(($1053|0),0,15)|0);
 $1137 = tempRet0;
 $1138 = (_bitshift64Shl(($1058|0),0,6)|0);
 $1139 = tempRet0;
 $1140 = $1138 | $1136;
 $1139 | $1137;
 $1141 = $1140&255;
 HEAP8[$$idx600>>0] = $1141;
 $1142 = (_bitshift64Lshr(($1051|0),($1052|0),2)|0);
 $1143 = tempRet0;
 $1144 = $1142&255;
 HEAP8[$104>>0] = $1144;
 $1145 = (_bitshift64Lshr(($1051|0),($1052|0),10)|0);
 $1146 = tempRet0;
 $1147 = $1145&255;
 HEAP8[$110>>0] = $1147;
 $1148 = (_bitshift64Lshr(($1058|0),0,18)|0);
 $1149 = tempRet0;
 $1150 = (_bitshift64Shl(($1056|0),($1057|0),3)|0);
 $1151 = tempRet0;
 $1152 = $1150 | $1148;
 $1151 | $1149;
 $1153 = $1152&255;
 HEAP8[$117>>0] = $1153;
 $1154 = (_bitshift64Lshr(($1056|0),($1057|0),5)|0);
 $1155 = tempRet0;
 $1156 = $1154&255;
 HEAP8[$$idx596>>0] = $1156;
 $1157 = (_bitshift64Lshr(($1056|0),($1057|0),13)|0);
 $1158 = tempRet0;
 $1159 = $1157&255;
 HEAP8[$$idx597>>0] = $1159;
 $1160 = $1061&255;
 HEAP8[$138>>0] = $1160;
 $1161 = (_bitshift64Lshr(($1061|0),($1062|0),8)|0);
 $1162 = tempRet0;
 $1163 = $1161&255;
 HEAP8[$$idx593>>0] = $1163;
 $1164 = (_bitshift64Lshr(($1061|0),($1062|0),16)|0);
 $1165 = tempRet0;
 $1166 = $1164 & 31;
 $1167 = (_bitshift64Shl(($1071|0),0,5)|0);
 $1168 = tempRet0;
 $1169 = $1167 | $1166;
 $1170 = $1169&255;
 HEAP8[$$idx594>>0] = $1170;
 $1171 = (_bitshift64Lshr(($1065|0),($1066|0),3)|0);
 $1172 = tempRet0;
 $1173 = $1171&255;
 HEAP8[$149>>0] = $1173;
 $1174 = (_bitshift64Lshr(($1065|0),($1066|0),11)|0);
 $1175 = tempRet0;
 $1176 = $1174&255;
 HEAP8[$155>>0] = $1176;
 $1177 = (_bitshift64Lshr(($1071|0),0,19)|0);
 $1178 = tempRet0;
 $1179 = (_bitshift64Shl(($1076|0),0,2)|0);
 $1180 = tempRet0;
 $1181 = $1179 | $1177;
 $1180 | $1178;
 $1182 = $1181&255;
 HEAP8[$162>>0] = $1182;
 $1183 = (_bitshift64Lshr(($1069|0),($1070|0),6)|0);
 $1184 = tempRet0;
 $1185 = $1183&255;
 HEAP8[$$idx590>>0] = $1185;
 $1186 = (_bitshift64Lshr(($1076|0),0,14)|0);
 $1187 = tempRet0;
 $1188 = (_bitshift64Shl(($1074|0),($1075|0),7)|0);
 $1189 = tempRet0;
 $1190 = $1188 | $1186;
 $1189 | $1187;
 $1191 = $1190&255;
 HEAP8[$$idx591>>0] = $1191;
 $1192 = (_bitshift64Lshr(($1074|0),($1075|0),1)|0);
 $1193 = tempRet0;
 $1194 = $1192&255;
 HEAP8[$184>>0] = $1194;
 $1195 = (_bitshift64Lshr(($1074|0),($1075|0),9)|0);
 $1196 = tempRet0;
 $1197 = $1195&255;
 HEAP8[$190>>0] = $1197;
 $1198 = (_bitshift64Ashr(($1074|0),($1075|0),17)|0);
 $1199 = tempRet0;
 $1200 = $1198&255;
 HEAP8[$197>>0] = $1200;
 return;
}
function _sha3_Init512($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 _memset(($0|0),0,224)|0;
 $1 = ((($0)) + 216|0);
 HEAP32[$1>>2] = 16;
 return;
}
function _sha3_Update($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$06369 = 0, $$06574 = 0, $$06671 = 0, $$06777 = 0, $$070 = 0, $$1 = 0, $$16478 = 0, $$2 = 0, $$3$lcssa = 0, $$375 = 0, $$472 = 0, $$pre86 = 0, $$pre87 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0;
 var $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0;
 var $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0;
 var $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0;
 var $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0;
 var $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0;
 var $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0;
 var $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0;
 var $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0;
 var $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $exitcond = 0, $scevgep = 0, $scevgep85 = 0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 $3 = ((($0)) + 208|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = (0 - ($4))|0;
 $6 = $5 & 7;
 $7 = ($6>>>0)>($2>>>0);
 if ($7) {
  $8 = ($2|0)==(0);
  if ($8) {
   return;
  }
  $9 = $0;
  $10 = $9;
  $11 = HEAP32[$10>>2]|0;
  $12 = (($9) + 4)|0;
  $13 = $12;
  $14 = HEAP32[$13>>2]|0;
  $$06369 = $1;$$070 = $2;$20 = $4;$25 = $11;$27 = $14;
  while(1) {
   $15 = (($$070) + -1)|0;
   $16 = ((($$06369)) + 1|0);
   $17 = HEAP8[$$06369>>0]|0;
   $18 = $17&255;
   $19 = (($20) + 1)|0;
   HEAP32[$3>>2] = $19;
   $21 = $20 << 3;
   $22 = (_bitshift64Shl(($18|0),0,($21|0))|0);
   $23 = tempRet0;
   $24 = $22 | $25;
   $26 = $23 | $27;
   $28 = $0;
   $29 = $28;
   HEAP32[$29>>2] = $24;
   $30 = (($28) + 4)|0;
   $31 = $30;
   HEAP32[$31>>2] = $26;
   $32 = ($15|0)==(0);
   if ($32) {
    break;
   } else {
    $$06369 = $16;$$070 = $15;$20 = $19;$25 = $24;$27 = $26;
   }
  }
  return;
 }
 $33 = ($6|0)==(0);
 if ($33) {
  $$1 = $2;$$2 = $1;
 } else {
  $34 = $0;
  $35 = $34;
  $36 = HEAP32[$35>>2]|0;
  $37 = (($34) + 4)|0;
  $38 = $37;
  $39 = HEAP32[$38>>2]|0;
  $$06777 = $6;$$16478 = $1;$45 = $4;$50 = $36;$52 = $39;
  while(1) {
   $40 = (($$06777) + -1)|0;
   $41 = ((($$16478)) + 1|0);
   $42 = HEAP8[$$16478>>0]|0;
   $43 = $42&255;
   $44 = (($45) + 1)|0;
   HEAP32[$3>>2] = $44;
   $46 = $45 << 3;
   $47 = (_bitshift64Shl(($43|0),0,($46|0))|0);
   $48 = tempRet0;
   $49 = $47 | $50;
   $51 = $48 | $52;
   $53 = $0;
   $54 = $53;
   HEAP32[$54>>2] = $49;
   $55 = (($53) + 4)|0;
   $56 = $55;
   HEAP32[$56>>2] = $51;
   $57 = ($40|0)==(0);
   if ($57) {
    break;
   } else {
    $$06777 = $40;$$16478 = $41;$45 = $44;$50 = $49;$52 = $51;
   }
  }
  $58 = (($2) - ($6))|0;
  $scevgep85 = (($1) + ($6)|0);
  $59 = ((($0)) + 8|0);
  $60 = ((($0)) + 212|0);
  $61 = HEAP32[$60>>2]|0;
  $62 = (($59) + ($61<<3)|0);
  $63 = $62;
  $64 = $63;
  $65 = HEAP32[$64>>2]|0;
  $66 = (($63) + 4)|0;
  $67 = $66;
  $68 = HEAP32[$67>>2]|0;
  $69 = $65 ^ $49;
  $70 = $68 ^ $51;
  $71 = $62;
  $72 = $71;
  HEAP32[$72>>2] = $69;
  $73 = (($71) + 4)|0;
  $74 = $73;
  HEAP32[$74>>2] = $70;
  HEAP32[$3>>2] = 0;
  $75 = $0;
  $76 = $75;
  HEAP32[$76>>2] = 0;
  $77 = (($75) + 4)|0;
  $78 = $77;
  HEAP32[$78>>2] = 0;
  $79 = HEAP32[$60>>2]|0;
  $80 = (($79) + 1)|0;
  HEAP32[$60>>2] = $80;
  $81 = ((($0)) + 216|0);
  $82 = HEAP32[$81>>2]|0;
  $83 = (25 - ($82))|0;
  $84 = ($80|0)==($83|0);
  if ($84) {
   _keccakf($59);
   HEAP32[$60>>2] = 0;
   $$1 = $58;$$2 = $scevgep85;
  } else {
   $$1 = $58;$$2 = $scevgep85;
  }
 }
 $85 = $$1 >>> 3;
 $86 = $$1 & 7;
 $87 = ($85|0)==(0);
 if ($87) {
  $$3$lcssa = $$2;
 } else {
  $88 = ((($0)) + 8|0);
  $89 = ((($0)) + 212|0);
  $90 = ((($0)) + 216|0);
  $91 = $$1 & -8;
  $$pre86 = HEAP32[$89>>2]|0;
  $$06574 = 0;$$375 = $$2;$140 = $$pre86;
  while(1) {
   $92 = HEAP8[$$375>>0]|0;
   $93 = $92&255;
   $94 = ((($$375)) + 1|0);
   $95 = HEAP8[$94>>0]|0;
   $96 = $95&255;
   $97 = (_bitshift64Shl(($96|0),0,8)|0);
   $98 = tempRet0;
   $99 = $97 | $93;
   $100 = ((($$375)) + 2|0);
   $101 = HEAP8[$100>>0]|0;
   $102 = $101&255;
   $103 = (_bitshift64Shl(($102|0),0,16)|0);
   $104 = tempRet0;
   $105 = $99 | $103;
   $106 = $98 | $104;
   $107 = ((($$375)) + 3|0);
   $108 = HEAP8[$107>>0]|0;
   $109 = $108&255;
   $110 = (_bitshift64Shl(($109|0),0,24)|0);
   $111 = tempRet0;
   $112 = $105 | $110;
   $113 = $106 | $111;
   $114 = ((($$375)) + 4|0);
   $115 = HEAP8[$114>>0]|0;
   $116 = $115&255;
   $117 = $113 | $116;
   $118 = ((($$375)) + 5|0);
   $119 = HEAP8[$118>>0]|0;
   $120 = $119&255;
   $121 = (_bitshift64Shl(($120|0),0,40)|0);
   $122 = tempRet0;
   $123 = $112 | $121;
   $124 = $117 | $122;
   $125 = ((($$375)) + 6|0);
   $126 = HEAP8[$125>>0]|0;
   $127 = $126&255;
   $128 = (_bitshift64Shl(($127|0),0,48)|0);
   $129 = tempRet0;
   $130 = $123 | $128;
   $131 = $124 | $129;
   $132 = ((($$375)) + 7|0);
   $133 = HEAP8[$132>>0]|0;
   $134 = $133&255;
   $135 = (_bitshift64Shl(($134|0),0,56)|0);
   $136 = tempRet0;
   $137 = $130 | $135;
   $138 = $131 | $136;
   $139 = (($88) + ($140<<3)|0);
   $141 = $139;
   $142 = $141;
   $143 = HEAP32[$142>>2]|0;
   $144 = (($141) + 4)|0;
   $145 = $144;
   $146 = HEAP32[$145>>2]|0;
   $147 = $137 ^ $143;
   $148 = $138 ^ $146;
   $149 = $139;
   $150 = $149;
   HEAP32[$150>>2] = $147;
   $151 = (($149) + 4)|0;
   $152 = $151;
   HEAP32[$152>>2] = $148;
   $153 = HEAP32[$89>>2]|0;
   $154 = (($153) + 1)|0;
   HEAP32[$89>>2] = $154;
   $155 = HEAP32[$90>>2]|0;
   $156 = (25 - ($155))|0;
   $157 = ($154|0)==($156|0);
   if ($157) {
    _keccakf($88);
    HEAP32[$89>>2] = 0;
    $185 = 0;
   } else {
    $185 = $154;
   }
   $158 = (($$06574) + 1)|0;
   $159 = ((($$375)) + 8|0);
   $exitcond = ($158|0)==($85|0);
   if ($exitcond) {
    break;
   } else {
    $$06574 = $158;$$375 = $159;$140 = $185;
   }
  }
  $scevgep = (($$2) + ($91)|0);
  $$3$lcssa = $scevgep;
 }
 $160 = ($86|0)==(0);
 if ($160) {
  return;
 }
 $$pre87 = HEAP32[$3>>2]|0;
 $161 = $0;
 $162 = $161;
 $163 = HEAP32[$162>>2]|0;
 $164 = (($161) + 4)|0;
 $165 = $164;
 $166 = HEAP32[$165>>2]|0;
 $$06671 = $86;$$472 = $$3$lcssa;$172 = $$pre87;$177 = $163;$179 = $166;
 while(1) {
  $167 = (($$06671) + -1)|0;
  $168 = ((($$472)) + 1|0);
  $169 = HEAP8[$$472>>0]|0;
  $170 = $169&255;
  $171 = (($172) + 1)|0;
  HEAP32[$3>>2] = $171;
  $173 = $172 << 3;
  $174 = (_bitshift64Shl(($170|0),0,($173|0))|0);
  $175 = tempRet0;
  $176 = $174 | $177;
  $178 = $175 | $179;
  $180 = $0;
  $181 = $180;
  HEAP32[$181>>2] = $176;
  $182 = (($180) + 4)|0;
  $183 = $182;
  HEAP32[$183>>2] = $178;
  $184 = ($167|0)==(0);
  if ($184) {
   break;
  } else {
   $$06671 = $167;$$472 = $168;$172 = $171;$177 = $176;$179 = $178;
  }
 }
 return;
}
function _keccakf($0) {
 $0 = $0|0;
 var $$06173 = 0, $$268 = 0, $$phi$trans$insert = 0, $$phi$trans$insert100 = 0, $$phi$trans$insert102 = 0, $$phi$trans$insert104 = 0, $$phi$trans$insert106 = 0, $$phi$trans$insert80 = 0, $$phi$trans$insert82 = 0, $$phi$trans$insert84 = 0, $$phi$trans$insert86 = 0, $$phi$trans$insert88 = 0, $$phi$trans$insert90 = 0, $$phi$trans$insert92 = 0, $$phi$trans$insert94 = 0, $$phi$trans$insert96 = 0, $$phi$trans$insert98 = 0, $1 = 0, $10 = 0, $100 = 0;
 var $1000 = 0, $1001 = 0, $1002 = 0, $1003 = 0, $1004 = 0, $1005 = 0, $1006 = 0, $1007 = 0, $1008 = 0, $1009 = 0, $101 = 0, $1010 = 0, $1011 = 0, $1012 = 0, $1013 = 0, $1014 = 0, $1015 = 0, $1016 = 0, $1017 = 0, $1018 = 0;
 var $1019 = 0, $102 = 0, $1020 = 0, $1021 = 0, $1022 = 0, $1023 = 0, $1024 = 0, $1025 = 0, $1026 = 0, $1027 = 0, $1028 = 0, $1029 = 0, $103 = 0, $1030 = 0, $1031 = 0, $1032 = 0, $1033 = 0, $1034 = 0, $1035 = 0, $1036 = 0;
 var $1037 = 0, $1038 = 0, $1039 = 0, $104 = 0, $1040 = 0, $1041 = 0, $1042 = 0, $1043 = 0, $1044 = 0, $1045 = 0, $1046 = 0, $1047 = 0, $1048 = 0, $1049 = 0, $105 = 0, $1050 = 0, $1051 = 0, $1052 = 0, $1053 = 0, $1054 = 0;
 var $1055 = 0, $1056 = 0, $1057 = 0, $1058 = 0, $1059 = 0, $106 = 0, $1060 = 0, $1061 = 0, $1062 = 0, $1063 = 0, $1064 = 0, $1065 = 0, $1066 = 0, $1067 = 0, $1068 = 0, $1069 = 0, $107 = 0, $1070 = 0, $1071 = 0, $1072 = 0;
 var $1073 = 0, $1074 = 0, $1075 = 0, $1076 = 0, $1077 = 0, $1078 = 0, $1079 = 0, $108 = 0, $1080 = 0, $1081 = 0, $1082 = 0, $1083 = 0, $1084 = 0, $1085 = 0, $1086 = 0, $1087 = 0, $1088 = 0, $1089 = 0, $109 = 0, $1090 = 0;
 var $1091 = 0, $1092 = 0, $1093 = 0, $1094 = 0, $1095 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0;
 var $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0;
 var $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0;
 var $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0;
 var $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0;
 var $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0;
 var $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0;
 var $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0;
 var $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0;
 var $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0;
 var $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0, $299 = 0, $3 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0;
 var $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0, $312 = 0, $313 = 0, $314 = 0, $315 = 0, $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0;
 var $321 = 0, $322 = 0, $323 = 0, $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0, $329 = 0, $33 = 0, $330 = 0, $331 = 0, $332 = 0, $333 = 0, $334 = 0, $335 = 0, $336 = 0, $337 = 0, $338 = 0, $339 = 0;
 var $34 = 0, $340 = 0, $341 = 0, $342 = 0, $343 = 0, $344 = 0, $345 = 0, $346 = 0, $347 = 0, $348 = 0, $349 = 0, $35 = 0, $350 = 0, $351 = 0, $352 = 0, $353 = 0, $354 = 0, $355 = 0, $356 = 0, $357 = 0;
 var $358 = 0, $359 = 0, $36 = 0, $360 = 0, $361 = 0, $362 = 0, $363 = 0, $364 = 0, $365 = 0, $366 = 0, $367 = 0, $368 = 0, $369 = 0, $37 = 0, $370 = 0, $371 = 0, $372 = 0, $373 = 0, $374 = 0, $375 = 0;
 var $376 = 0, $377 = 0, $378 = 0, $379 = 0, $38 = 0, $380 = 0, $381 = 0, $382 = 0, $383 = 0, $384 = 0, $385 = 0, $386 = 0, $387 = 0, $388 = 0, $389 = 0, $39 = 0, $390 = 0, $391 = 0, $392 = 0, $393 = 0;
 var $394 = 0, $395 = 0, $396 = 0, $397 = 0, $398 = 0, $399 = 0, $4 = 0, $40 = 0, $400 = 0, $401 = 0, $402 = 0, $403 = 0, $404 = 0, $405 = 0, $406 = 0, $407 = 0, $408 = 0, $409 = 0, $41 = 0, $410 = 0;
 var $411 = 0, $412 = 0, $413 = 0, $414 = 0, $415 = 0, $416 = 0, $417 = 0, $418 = 0, $419 = 0, $42 = 0, $420 = 0, $421 = 0, $422 = 0, $423 = 0, $424 = 0, $425 = 0, $426 = 0, $427 = 0, $428 = 0, $429 = 0;
 var $43 = 0, $430 = 0, $431 = 0, $432 = 0, $433 = 0, $434 = 0, $435 = 0, $436 = 0, $437 = 0, $438 = 0, $439 = 0, $44 = 0, $440 = 0, $441 = 0, $442 = 0, $443 = 0, $444 = 0, $445 = 0, $446 = 0, $447 = 0;
 var $448 = 0, $449 = 0, $45 = 0, $450 = 0, $451 = 0, $452 = 0, $453 = 0, $454 = 0, $455 = 0, $456 = 0, $457 = 0, $458 = 0, $459 = 0, $46 = 0, $460 = 0, $461 = 0, $462 = 0, $463 = 0, $464 = 0, $465 = 0;
 var $466 = 0, $467 = 0, $468 = 0, $469 = 0, $47 = 0, $470 = 0, $471 = 0, $472 = 0, $473 = 0, $474 = 0, $475 = 0, $476 = 0, $477 = 0, $478 = 0, $479 = 0, $48 = 0, $480 = 0, $481 = 0, $482 = 0, $483 = 0;
 var $484 = 0, $485 = 0, $486 = 0, $487 = 0, $488 = 0, $489 = 0, $49 = 0, $490 = 0, $491 = 0, $492 = 0, $493 = 0, $494 = 0, $495 = 0, $496 = 0, $497 = 0, $498 = 0, $499 = 0, $5 = 0, $50 = 0, $500 = 0;
 var $501 = 0, $502 = 0, $503 = 0, $504 = 0, $505 = 0, $506 = 0, $507 = 0, $508 = 0, $509 = 0, $51 = 0, $510 = 0, $511 = 0, $512 = 0, $513 = 0, $514 = 0, $515 = 0, $516 = 0, $517 = 0, $518 = 0, $519 = 0;
 var $52 = 0, $520 = 0, $521 = 0, $522 = 0, $523 = 0, $524 = 0, $525 = 0, $526 = 0, $527 = 0, $528 = 0, $529 = 0, $53 = 0, $530 = 0, $531 = 0, $532 = 0, $533 = 0, $534 = 0, $535 = 0, $536 = 0, $537 = 0;
 var $538 = 0, $539 = 0, $54 = 0, $540 = 0, $541 = 0, $542 = 0, $543 = 0, $544 = 0, $545 = 0, $546 = 0, $547 = 0, $548 = 0, $549 = 0, $55 = 0, $550 = 0, $551 = 0, $552 = 0, $553 = 0, $554 = 0, $555 = 0;
 var $556 = 0, $557 = 0, $558 = 0, $559 = 0, $56 = 0, $560 = 0, $561 = 0, $562 = 0, $563 = 0, $564 = 0, $565 = 0, $566 = 0, $567 = 0, $568 = 0, $569 = 0, $57 = 0, $570 = 0, $571 = 0, $572 = 0, $573 = 0;
 var $574 = 0, $575 = 0, $576 = 0, $577 = 0, $578 = 0, $579 = 0, $58 = 0, $580 = 0, $581 = 0, $582 = 0, $583 = 0, $584 = 0, $585 = 0, $586 = 0, $587 = 0, $588 = 0, $589 = 0, $59 = 0, $590 = 0, $591 = 0;
 var $592 = 0, $593 = 0, $594 = 0, $595 = 0, $596 = 0, $597 = 0, $598 = 0, $599 = 0, $6 = 0, $60 = 0, $600 = 0, $601 = 0, $602 = 0, $603 = 0, $604 = 0, $605 = 0, $606 = 0, $607 = 0, $608 = 0, $609 = 0;
 var $61 = 0, $610 = 0, $611 = 0, $612 = 0, $613 = 0, $614 = 0, $615 = 0, $616 = 0, $617 = 0, $618 = 0, $619 = 0, $62 = 0, $620 = 0, $621 = 0, $622 = 0, $623 = 0, $624 = 0, $625 = 0, $626 = 0, $627 = 0;
 var $628 = 0, $629 = 0, $63 = 0, $630 = 0, $631 = 0, $632 = 0, $633 = 0, $634 = 0, $635 = 0, $636 = 0, $637 = 0, $638 = 0, $639 = 0, $64 = 0, $640 = 0, $641 = 0, $642 = 0, $643 = 0, $644 = 0, $645 = 0;
 var $646 = 0, $647 = 0, $648 = 0, $649 = 0, $65 = 0, $650 = 0, $651 = 0, $652 = 0, $653 = 0, $654 = 0, $655 = 0, $656 = 0, $657 = 0, $658 = 0, $659 = 0, $66 = 0, $660 = 0, $661 = 0, $662 = 0, $663 = 0;
 var $664 = 0, $665 = 0, $666 = 0, $667 = 0, $668 = 0, $669 = 0, $67 = 0, $670 = 0, $671 = 0, $672 = 0, $673 = 0, $674 = 0, $675 = 0, $676 = 0, $677 = 0, $678 = 0, $679 = 0, $68 = 0, $680 = 0, $681 = 0;
 var $682 = 0, $683 = 0, $684 = 0, $685 = 0, $686 = 0, $687 = 0, $688 = 0, $689 = 0, $69 = 0, $690 = 0, $691 = 0, $692 = 0, $693 = 0, $694 = 0, $695 = 0, $696 = 0, $697 = 0, $698 = 0, $699 = 0, $7 = 0;
 var $70 = 0, $700 = 0, $701 = 0, $702 = 0, $703 = 0, $704 = 0, $705 = 0, $706 = 0, $707 = 0, $708 = 0, $709 = 0, $71 = 0, $710 = 0, $711 = 0, $712 = 0, $713 = 0, $714 = 0, $715 = 0, $716 = 0, $717 = 0;
 var $718 = 0, $719 = 0, $72 = 0, $720 = 0, $721 = 0, $722 = 0, $723 = 0, $724 = 0, $725 = 0, $726 = 0, $727 = 0, $728 = 0, $729 = 0, $73 = 0, $730 = 0, $731 = 0, $732 = 0, $733 = 0, $734 = 0, $735 = 0;
 var $736 = 0, $737 = 0, $738 = 0, $739 = 0, $74 = 0, $740 = 0, $741 = 0, $742 = 0, $743 = 0, $744 = 0, $745 = 0, $746 = 0, $747 = 0, $748 = 0, $749 = 0, $75 = 0, $750 = 0, $751 = 0, $752 = 0, $753 = 0;
 var $754 = 0, $755 = 0, $756 = 0, $757 = 0, $758 = 0, $759 = 0, $76 = 0, $760 = 0, $761 = 0, $762 = 0, $763 = 0, $764 = 0, $765 = 0, $766 = 0, $767 = 0, $768 = 0, $769 = 0, $77 = 0, $770 = 0, $771 = 0;
 var $772 = 0, $773 = 0, $774 = 0, $775 = 0, $776 = 0, $777 = 0, $778 = 0, $779 = 0, $78 = 0, $780 = 0, $781 = 0, $782 = 0, $783 = 0, $784 = 0, $785 = 0, $786 = 0, $787 = 0, $788 = 0, $789 = 0, $79 = 0;
 var $790 = 0, $791 = 0, $792 = 0, $793 = 0, $794 = 0, $795 = 0, $796 = 0, $797 = 0, $798 = 0, $799 = 0, $8 = 0, $80 = 0, $800 = 0, $801 = 0, $802 = 0, $803 = 0, $804 = 0, $805 = 0, $806 = 0, $807 = 0;
 var $808 = 0, $809 = 0, $81 = 0, $810 = 0, $811 = 0, $812 = 0, $813 = 0, $814 = 0, $815 = 0, $816 = 0, $817 = 0, $818 = 0, $819 = 0, $82 = 0, $820 = 0, $821 = 0, $822 = 0, $823 = 0, $824 = 0, $825 = 0;
 var $826 = 0, $827 = 0, $828 = 0, $829 = 0, $83 = 0, $830 = 0, $831 = 0, $832 = 0, $833 = 0, $834 = 0, $835 = 0, $836 = 0, $837 = 0, $838 = 0, $839 = 0, $84 = 0, $840 = 0, $841 = 0, $842 = 0, $843 = 0;
 var $844 = 0, $845 = 0, $846 = 0, $847 = 0, $848 = 0, $849 = 0, $85 = 0, $850 = 0, $851 = 0, $852 = 0, $853 = 0, $854 = 0, $855 = 0, $856 = 0, $857 = 0, $858 = 0, $859 = 0, $86 = 0, $860 = 0, $861 = 0;
 var $862 = 0, $863 = 0, $864 = 0, $865 = 0, $866 = 0, $867 = 0, $868 = 0, $869 = 0, $87 = 0, $870 = 0, $871 = 0, $872 = 0, $873 = 0, $874 = 0, $875 = 0, $876 = 0, $877 = 0, $878 = 0, $879 = 0, $88 = 0;
 var $880 = 0, $881 = 0, $882 = 0, $883 = 0, $884 = 0, $885 = 0, $886 = 0, $887 = 0, $888 = 0, $889 = 0, $89 = 0, $890 = 0, $891 = 0, $892 = 0, $893 = 0, $894 = 0, $895 = 0, $896 = 0, $897 = 0, $898 = 0;
 var $899 = 0, $9 = 0, $90 = 0, $900 = 0, $901 = 0, $902 = 0, $903 = 0, $904 = 0, $905 = 0, $906 = 0, $907 = 0, $908 = 0, $909 = 0, $91 = 0, $910 = 0, $911 = 0, $912 = 0, $913 = 0, $914 = 0, $915 = 0;
 var $916 = 0, $917 = 0, $918 = 0, $919 = 0, $92 = 0, $920 = 0, $921 = 0, $922 = 0, $923 = 0, $924 = 0, $925 = 0, $926 = 0, $927 = 0, $928 = 0, $929 = 0, $93 = 0, $930 = 0, $931 = 0, $932 = 0, $933 = 0;
 var $934 = 0, $935 = 0, $936 = 0, $937 = 0, $938 = 0, $939 = 0, $94 = 0, $940 = 0, $941 = 0, $942 = 0, $943 = 0, $944 = 0, $945 = 0, $946 = 0, $947 = 0, $948 = 0, $949 = 0, $95 = 0, $950 = 0, $951 = 0;
 var $952 = 0, $953 = 0, $954 = 0, $955 = 0, $956 = 0, $957 = 0, $958 = 0, $959 = 0, $96 = 0, $960 = 0, $961 = 0, $962 = 0, $963 = 0, $964 = 0, $965 = 0, $966 = 0, $967 = 0, $968 = 0, $969 = 0, $97 = 0;
 var $970 = 0, $971 = 0, $972 = 0, $973 = 0, $974 = 0, $975 = 0, $976 = 0, $977 = 0, $978 = 0, $979 = 0, $98 = 0, $980 = 0, $981 = 0, $982 = 0, $983 = 0, $984 = 0, $985 = 0, $986 = 0, $987 = 0, $988 = 0;
 var $989 = 0, $99 = 0, $990 = 0, $991 = 0, $992 = 0, $993 = 0, $994 = 0, $995 = 0, $996 = 0, $997 = 0, $998 = 0, $999 = 0, $exitcond = 0, $exitcond78 = 0, dest = 0, label = 0, sp = 0, src = 0, stop = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(48|0);
 $1 = sp;
 $2 = ((($0)) + 8|0);
 $3 = $0;
 $4 = $3;
 $5 = HEAP32[$4>>2]|0;
 $6 = (($3) + 4)|0;
 $7 = $6;
 $8 = HEAP32[$7>>2]|0;
 $$phi$trans$insert = ((($0)) + 160|0);
 $9 = $$phi$trans$insert;
 $10 = $9;
 $11 = HEAP32[$10>>2]|0;
 $12 = (($9) + 4)|0;
 $13 = $12;
 $14 = HEAP32[$13>>2]|0;
 $$phi$trans$insert80 = ((($0)) + 128|0);
 $15 = $$phi$trans$insert80;
 $16 = $15;
 $17 = HEAP32[$16>>2]|0;
 $18 = (($15) + 4)|0;
 $19 = $18;
 $20 = HEAP32[$19>>2]|0;
 $$phi$trans$insert82 = ((($0)) + 168|0);
 $21 = $$phi$trans$insert82;
 $22 = $21;
 $23 = HEAP32[$22>>2]|0;
 $24 = (($21) + 4)|0;
 $25 = $24;
 $26 = HEAP32[$25>>2]|0;
 $$phi$trans$insert84 = ((($0)) + 136|0);
 $27 = $$phi$trans$insert84;
 $28 = $27;
 $29 = HEAP32[$28>>2]|0;
 $30 = (($27) + 4)|0;
 $31 = $30;
 $32 = HEAP32[$31>>2]|0;
 $$phi$trans$insert86 = ((($0)) + 176|0);
 $33 = $$phi$trans$insert86;
 $34 = $33;
 $35 = HEAP32[$34>>2]|0;
 $36 = (($33) + 4)|0;
 $37 = $36;
 $38 = HEAP32[$37>>2]|0;
 $$phi$trans$insert88 = ((($0)) + 144|0);
 $39 = $$phi$trans$insert88;
 $40 = $39;
 $41 = HEAP32[$40>>2]|0;
 $42 = (($39) + 4)|0;
 $43 = $42;
 $44 = HEAP32[$43>>2]|0;
 $$phi$trans$insert90 = ((($0)) + 184|0);
 $45 = $$phi$trans$insert90;
 $46 = $45;
 $47 = HEAP32[$46>>2]|0;
 $48 = (($45) + 4)|0;
 $49 = $48;
 $50 = HEAP32[$49>>2]|0;
 $$phi$trans$insert92 = ((($0)) + 152|0);
 $51 = $$phi$trans$insert92;
 $52 = $51;
 $53 = HEAP32[$52>>2]|0;
 $54 = (($51) + 4)|0;
 $55 = $54;
 $56 = HEAP32[$55>>2]|0;
 $$phi$trans$insert94 = ((($0)) + 192|0);
 $57 = $$phi$trans$insert94;
 $58 = $57;
 $59 = HEAP32[$58>>2]|0;
 $60 = (($57) + 4)|0;
 $61 = $60;
 $62 = HEAP32[$61>>2]|0;
 $$phi$trans$insert96 = ((($0)) + 80|0);
 $63 = $$phi$trans$insert96;
 $64 = $63;
 $65 = HEAP32[$64>>2]|0;
 $66 = (($63) + 4)|0;
 $67 = $66;
 $68 = HEAP32[$67>>2]|0;
 $$phi$trans$insert98 = ((($0)) + 120|0);
 $69 = $$phi$trans$insert98;
 $70 = $69;
 $71 = HEAP32[$70>>2]|0;
 $72 = (($69) + 4)|0;
 $73 = $72;
 $74 = HEAP32[$73>>2]|0;
 $$phi$trans$insert100 = ((($0)) + 88|0);
 $75 = $$phi$trans$insert100;
 $76 = $75;
 $77 = HEAP32[$76>>2]|0;
 $78 = (($75) + 4)|0;
 $79 = $78;
 $80 = HEAP32[$79>>2]|0;
 $$phi$trans$insert102 = ((($0)) + 96|0);
 $81 = $$phi$trans$insert102;
 $82 = $81;
 $83 = HEAP32[$82>>2]|0;
 $84 = (($81) + 4)|0;
 $85 = $84;
 $86 = HEAP32[$85>>2]|0;
 $$phi$trans$insert104 = ((($0)) + 104|0);
 $87 = $$phi$trans$insert104;
 $88 = $87;
 $89 = HEAP32[$88>>2]|0;
 $90 = (($87) + 4)|0;
 $91 = $90;
 $92 = HEAP32[$91>>2]|0;
 $$phi$trans$insert106 = ((($0)) + 112|0);
 $93 = $$phi$trans$insert106;
 $94 = $93;
 $95 = HEAP32[$94>>2]|0;
 $96 = (($93) + 4)|0;
 $97 = $96;
 $98 = HEAP32[$97>>2]|0;
 $99 = ((($0)) + 40|0);
 $100 = ((($0)) + 48|0);
 $101 = ((($1)) + 8|0);
 $102 = ((($0)) + 16|0);
 $103 = ((($0)) + 56|0);
 $104 = ((($1)) + 16|0);
 $105 = ((($0)) + 24|0);
 $106 = ((($0)) + 64|0);
 $107 = ((($1)) + 24|0);
 $108 = ((($0)) + 32|0);
 $109 = ((($0)) + 72|0);
 $110 = ((($1)) + 32|0);
 $$06173 = 0;$118 = $5;$120 = $8;$122 = $65;$124 = $68;$126 = $71;$128 = $74;$130 = $11;$132 = $14;$152 = $77;$154 = $80;$156 = $17;$158 = $20;$160 = $23;$162 = $26;$182 = $83;$184 = $86;$186 = $29;$188 = $32;$190 = $35;$192 = $38;$212 = $89;$214 = $92;$216 = $41;$218 = $44;$220 = $47;$222 = $50;$242 = $95;$244 = $98;$246 = $53;$248 = $56;$250 = $59;$252 = $62;
 while(1) {
  $111 = $99;
  $112 = $111;
  $113 = HEAP32[$112>>2]|0;
  $114 = (($111) + 4)|0;
  $115 = $114;
  $116 = HEAP32[$115>>2]|0;
  $117 = $113 ^ $118;
  $119 = $116 ^ $120;
  $121 = $117 ^ $122;
  $123 = $119 ^ $124;
  $125 = $121 ^ $126;
  $127 = $123 ^ $128;
  $129 = $125 ^ $130;
  $131 = $127 ^ $132;
  $133 = $1;
  $134 = $133;
  HEAP32[$134>>2] = $129;
  $135 = (($133) + 4)|0;
  $136 = $135;
  HEAP32[$136>>2] = $131;
  $137 = $2;
  $138 = $137;
  $139 = HEAP32[$138>>2]|0;
  $140 = (($137) + 4)|0;
  $141 = $140;
  $142 = HEAP32[$141>>2]|0;
  $143 = $100;
  $144 = $143;
  $145 = HEAP32[$144>>2]|0;
  $146 = (($143) + 4)|0;
  $147 = $146;
  $148 = HEAP32[$147>>2]|0;
  $149 = $145 ^ $139;
  $150 = $148 ^ $142;
  $151 = $149 ^ $152;
  $153 = $150 ^ $154;
  $155 = $151 ^ $156;
  $157 = $153 ^ $158;
  $159 = $155 ^ $160;
  $161 = $157 ^ $162;
  $163 = $101;
  $164 = $163;
  HEAP32[$164>>2] = $159;
  $165 = (($163) + 4)|0;
  $166 = $165;
  HEAP32[$166>>2] = $161;
  $167 = $102;
  $168 = $167;
  $169 = HEAP32[$168>>2]|0;
  $170 = (($167) + 4)|0;
  $171 = $170;
  $172 = HEAP32[$171>>2]|0;
  $173 = $103;
  $174 = $173;
  $175 = HEAP32[$174>>2]|0;
  $176 = (($173) + 4)|0;
  $177 = $176;
  $178 = HEAP32[$177>>2]|0;
  $179 = $175 ^ $169;
  $180 = $178 ^ $172;
  $181 = $179 ^ $182;
  $183 = $180 ^ $184;
  $185 = $181 ^ $186;
  $187 = $183 ^ $188;
  $189 = $185 ^ $190;
  $191 = $187 ^ $192;
  $193 = $104;
  $194 = $193;
  HEAP32[$194>>2] = $189;
  $195 = (($193) + 4)|0;
  $196 = $195;
  HEAP32[$196>>2] = $191;
  $197 = $105;
  $198 = $197;
  $199 = HEAP32[$198>>2]|0;
  $200 = (($197) + 4)|0;
  $201 = $200;
  $202 = HEAP32[$201>>2]|0;
  $203 = $106;
  $204 = $203;
  $205 = HEAP32[$204>>2]|0;
  $206 = (($203) + 4)|0;
  $207 = $206;
  $208 = HEAP32[$207>>2]|0;
  $209 = $205 ^ $199;
  $210 = $208 ^ $202;
  $211 = $209 ^ $212;
  $213 = $210 ^ $214;
  $215 = $211 ^ $216;
  $217 = $213 ^ $218;
  $219 = $215 ^ $220;
  $221 = $217 ^ $222;
  $223 = $107;
  $224 = $223;
  HEAP32[$224>>2] = $219;
  $225 = (($223) + 4)|0;
  $226 = $225;
  HEAP32[$226>>2] = $221;
  $227 = $108;
  $228 = $227;
  $229 = HEAP32[$228>>2]|0;
  $230 = (($227) + 4)|0;
  $231 = $230;
  $232 = HEAP32[$231>>2]|0;
  $233 = $109;
  $234 = $233;
  $235 = HEAP32[$234>>2]|0;
  $236 = (($233) + 4)|0;
  $237 = $236;
  $238 = HEAP32[$237>>2]|0;
  $239 = $235 ^ $229;
  $240 = $238 ^ $232;
  $241 = $239 ^ $242;
  $243 = $240 ^ $244;
  $245 = $241 ^ $246;
  $247 = $243 ^ $248;
  $249 = $245 ^ $250;
  $251 = $247 ^ $252;
  $253 = $110;
  $254 = $253;
  HEAP32[$254>>2] = $249;
  $255 = (($253) + 4)|0;
  $256 = $255;
  HEAP32[$256>>2] = $251;
  $257 = (_bitshift64Shl(($159|0),($161|0),1)|0);
  $258 = tempRet0;
  $259 = (_bitshift64Lshr(($159|0),($161|0),63)|0);
  $260 = tempRet0;
  $261 = $257 | $259;
  $262 = $258 | $260;
  $263 = $261 ^ $249;
  $264 = $262 ^ $251;
  $265 = $263 ^ $118;
  $266 = $264 ^ $120;
  $267 = $0;
  $268 = $267;
  HEAP32[$268>>2] = $265;
  $269 = (($267) + 4)|0;
  $270 = $269;
  HEAP32[$270>>2] = $266;
  $271 = $263 ^ $113;
  $272 = $264 ^ $116;
  $273 = $99;
  $274 = $273;
  HEAP32[$274>>2] = $271;
  $275 = (($273) + 4)|0;
  $276 = $275;
  HEAP32[$276>>2] = $272;
  $277 = $263 ^ $122;
  $278 = $264 ^ $124;
  $279 = $$phi$trans$insert96;
  $280 = $279;
  HEAP32[$280>>2] = $277;
  $281 = (($279) + 4)|0;
  $282 = $281;
  HEAP32[$282>>2] = $278;
  $283 = $263 ^ $126;
  $284 = $264 ^ $128;
  $285 = $$phi$trans$insert98;
  $286 = $285;
  HEAP32[$286>>2] = $283;
  $287 = (($285) + 4)|0;
  $288 = $287;
  HEAP32[$288>>2] = $284;
  $289 = $263 ^ $130;
  $290 = $264 ^ $132;
  $291 = $$phi$trans$insert;
  $292 = $291;
  HEAP32[$292>>2] = $289;
  $293 = (($291) + 4)|0;
  $294 = $293;
  HEAP32[$294>>2] = $290;
  $295 = (_bitshift64Shl(($189|0),($191|0),1)|0);
  $296 = tempRet0;
  $297 = (_bitshift64Lshr(($189|0),($191|0),63)|0);
  $298 = tempRet0;
  $299 = $295 | $297;
  $300 = $296 | $298;
  $301 = $299 ^ $129;
  $302 = $300 ^ $131;
  $303 = $301 ^ $139;
  $304 = $302 ^ $142;
  $305 = $2;
  $306 = $305;
  HEAP32[$306>>2] = $303;
  $307 = (($305) + 4)|0;
  $308 = $307;
  HEAP32[$308>>2] = $304;
  $309 = $301 ^ $145;
  $310 = $302 ^ $148;
  $311 = $100;
  $312 = $311;
  HEAP32[$312>>2] = $309;
  $313 = (($311) + 4)|0;
  $314 = $313;
  HEAP32[$314>>2] = $310;
  $315 = $301 ^ $152;
  $316 = $302 ^ $154;
  $317 = $$phi$trans$insert100;
  $318 = $317;
  HEAP32[$318>>2] = $315;
  $319 = (($317) + 4)|0;
  $320 = $319;
  HEAP32[$320>>2] = $316;
  $321 = $$phi$trans$insert80;
  $322 = $321;
  $323 = HEAP32[$322>>2]|0;
  $324 = (($321) + 4)|0;
  $325 = $324;
  $326 = HEAP32[$325>>2]|0;
  $327 = $301 ^ $323;
  $328 = $302 ^ $326;
  $329 = $$phi$trans$insert80;
  $330 = $329;
  HEAP32[$330>>2] = $327;
  $331 = (($329) + 4)|0;
  $332 = $331;
  HEAP32[$332>>2] = $328;
  $333 = $$phi$trans$insert82;
  $334 = $333;
  $335 = HEAP32[$334>>2]|0;
  $336 = (($333) + 4)|0;
  $337 = $336;
  $338 = HEAP32[$337>>2]|0;
  $339 = $301 ^ $335;
  $340 = $302 ^ $338;
  $341 = $$phi$trans$insert82;
  $342 = $341;
  HEAP32[$342>>2] = $339;
  $343 = (($341) + 4)|0;
  $344 = $343;
  HEAP32[$344>>2] = $340;
  $345 = (_bitshift64Shl(($219|0),($221|0),1)|0);
  $346 = tempRet0;
  $347 = (_bitshift64Lshr(($219|0),($221|0),63)|0);
  $348 = tempRet0;
  $349 = $345 | $347;
  $350 = $346 | $348;
  $351 = $349 ^ $159;
  $352 = $350 ^ $161;
  $353 = $351 ^ $169;
  $354 = $352 ^ $172;
  $355 = $102;
  $356 = $355;
  HEAP32[$356>>2] = $353;
  $357 = (($355) + 4)|0;
  $358 = $357;
  HEAP32[$358>>2] = $354;
  $359 = $351 ^ $175;
  $360 = $352 ^ $178;
  $361 = $103;
  $362 = $361;
  HEAP32[$362>>2] = $359;
  $363 = (($361) + 4)|0;
  $364 = $363;
  HEAP32[$364>>2] = $360;
  $365 = $351 ^ $182;
  $366 = $352 ^ $184;
  $367 = $$phi$trans$insert102;
  $368 = $367;
  HEAP32[$368>>2] = $365;
  $369 = (($367) + 4)|0;
  $370 = $369;
  HEAP32[$370>>2] = $366;
  $371 = $$phi$trans$insert84;
  $372 = $371;
  $373 = HEAP32[$372>>2]|0;
  $374 = (($371) + 4)|0;
  $375 = $374;
  $376 = HEAP32[$375>>2]|0;
  $377 = $351 ^ $373;
  $378 = $352 ^ $376;
  $379 = $$phi$trans$insert84;
  $380 = $379;
  HEAP32[$380>>2] = $377;
  $381 = (($379) + 4)|0;
  $382 = $381;
  HEAP32[$382>>2] = $378;
  $383 = $$phi$trans$insert86;
  $384 = $383;
  $385 = HEAP32[$384>>2]|0;
  $386 = (($383) + 4)|0;
  $387 = $386;
  $388 = HEAP32[$387>>2]|0;
  $389 = $351 ^ $385;
  $390 = $352 ^ $388;
  $391 = $$phi$trans$insert86;
  $392 = $391;
  HEAP32[$392>>2] = $389;
  $393 = (($391) + 4)|0;
  $394 = $393;
  HEAP32[$394>>2] = $390;
  $395 = (_bitshift64Shl(($249|0),($251|0),1)|0);
  $396 = tempRet0;
  $397 = (_bitshift64Lshr(($249|0),($251|0),63)|0);
  $398 = tempRet0;
  $399 = $395 | $397;
  $400 = $396 | $398;
  $401 = $399 ^ $189;
  $402 = $400 ^ $191;
  $403 = $401 ^ $199;
  $404 = $402 ^ $202;
  $405 = $105;
  $406 = $405;
  HEAP32[$406>>2] = $403;
  $407 = (($405) + 4)|0;
  $408 = $407;
  HEAP32[$408>>2] = $404;
  $409 = $401 ^ $205;
  $410 = $402 ^ $208;
  $411 = $106;
  $412 = $411;
  HEAP32[$412>>2] = $409;
  $413 = (($411) + 4)|0;
  $414 = $413;
  HEAP32[$414>>2] = $410;
  $415 = $401 ^ $212;
  $416 = $402 ^ $214;
  $417 = $$phi$trans$insert104;
  $418 = $417;
  HEAP32[$418>>2] = $415;
  $419 = (($417) + 4)|0;
  $420 = $419;
  HEAP32[$420>>2] = $416;
  $421 = $$phi$trans$insert88;
  $422 = $421;
  $423 = HEAP32[$422>>2]|0;
  $424 = (($421) + 4)|0;
  $425 = $424;
  $426 = HEAP32[$425>>2]|0;
  $427 = $401 ^ $423;
  $428 = $402 ^ $426;
  $429 = $$phi$trans$insert88;
  $430 = $429;
  HEAP32[$430>>2] = $427;
  $431 = (($429) + 4)|0;
  $432 = $431;
  HEAP32[$432>>2] = $428;
  $433 = $$phi$trans$insert90;
  $434 = $433;
  $435 = HEAP32[$434>>2]|0;
  $436 = (($433) + 4)|0;
  $437 = $436;
  $438 = HEAP32[$437>>2]|0;
  $439 = $401 ^ $435;
  $440 = $402 ^ $438;
  $441 = $$phi$trans$insert90;
  $442 = $441;
  HEAP32[$442>>2] = $439;
  $443 = (($441) + 4)|0;
  $444 = $443;
  HEAP32[$444>>2] = $440;
  $445 = $1;
  $446 = $445;
  $447 = HEAP32[$446>>2]|0;
  $448 = (($445) + 4)|0;
  $449 = $448;
  $450 = HEAP32[$449>>2]|0;
  $451 = (_bitshift64Shl(($447|0),($450|0),1)|0);
  $452 = tempRet0;
  $453 = (_bitshift64Lshr(($447|0),($450|0),63)|0);
  $454 = tempRet0;
  $455 = $451 | $453;
  $456 = $452 | $454;
  $457 = $455 ^ $219;
  $458 = $456 ^ $221;
  $459 = $457 ^ $229;
  $460 = $458 ^ $232;
  $461 = $108;
  $462 = $461;
  HEAP32[$462>>2] = $459;
  $463 = (($461) + 4)|0;
  $464 = $463;
  HEAP32[$464>>2] = $460;
  $465 = $457 ^ $235;
  $466 = $458 ^ $238;
  $467 = $109;
  $468 = $467;
  HEAP32[$468>>2] = $465;
  $469 = (($467) + 4)|0;
  $470 = $469;
  HEAP32[$470>>2] = $466;
  $471 = $457 ^ $242;
  $472 = $458 ^ $244;
  $473 = $$phi$trans$insert106;
  $474 = $473;
  HEAP32[$474>>2] = $471;
  $475 = (($473) + 4)|0;
  $476 = $475;
  HEAP32[$476>>2] = $472;
  $477 = $$phi$trans$insert92;
  $478 = $477;
  $479 = HEAP32[$478>>2]|0;
  $480 = (($477) + 4)|0;
  $481 = $480;
  $482 = HEAP32[$481>>2]|0;
  $483 = $457 ^ $479;
  $484 = $458 ^ $482;
  $485 = $$phi$trans$insert92;
  $486 = $485;
  HEAP32[$486>>2] = $483;
  $487 = (($485) + 4)|0;
  $488 = $487;
  HEAP32[$488>>2] = $484;
  $489 = $$phi$trans$insert94;
  $490 = $489;
  $491 = HEAP32[$490>>2]|0;
  $492 = (($489) + 4)|0;
  $493 = $492;
  $494 = HEAP32[$493>>2]|0;
  $495 = $457 ^ $491;
  $496 = $458 ^ $494;
  $497 = $$phi$trans$insert94;
  $498 = $497;
  HEAP32[$498>>2] = $495;
  $499 = (($497) + 4)|0;
  $500 = $499;
  HEAP32[$500>>2] = $496;
  $$268 = 0;$512 = $303;$513 = $304;
  while(1) {
   $501 = (32004 + ($$268<<2)|0);
   $502 = HEAP32[$501>>2]|0;
   $503 = (($0) + ($502<<3)|0);
   $504 = $503;
   $505 = $504;
   $506 = HEAP32[$505>>2]|0;
   $507 = (($504) + 4)|0;
   $508 = $507;
   $509 = HEAP32[$508>>2]|0;
   $510 = (32100 + ($$268<<2)|0);
   $511 = HEAP32[$510>>2]|0;
   $514 = (_bitshift64Shl(($512|0),($513|0),($511|0))|0);
   $515 = tempRet0;
   $516 = (64 - ($511))|0;
   $517 = (_bitshift64Lshr(($512|0),($513|0),($516|0))|0);
   $518 = tempRet0;
   $519 = $517 | $514;
   $520 = $518 | $515;
   $521 = $503;
   $522 = $521;
   HEAP32[$522>>2] = $519;
   $523 = (($521) + 4)|0;
   $524 = $523;
   HEAP32[$524>>2] = $520;
   $525 = (($$268) + 1)|0;
   $exitcond = ($525|0)==(24);
   if ($exitcond) {
    break;
   } else {
    $$268 = $525;$512 = $506;$513 = $509;
   }
  }
  dest=$1; src=$0; stop=dest+40|0; do { HEAP32[dest>>2]=HEAP32[src>>2]|0; dest=dest+4|0; src=src+4|0; } while ((dest|0) < (stop|0));
  $526 = $101;
  $527 = $526;
  $528 = HEAP32[$527>>2]|0;
  $529 = (($526) + 4)|0;
  $530 = $529;
  $531 = HEAP32[$530>>2]|0;
  $532 = $528 ^ -1;
  $533 = $531 ^ -1;
  $534 = $104;
  $535 = $534;
  $536 = HEAP32[$535>>2]|0;
  $537 = (($534) + 4)|0;
  $538 = $537;
  $539 = HEAP32[$538>>2]|0;
  $540 = $536 & $532;
  $541 = $539 & $533;
  $542 = $0;
  $543 = $542;
  $544 = HEAP32[$543>>2]|0;
  $545 = (($542) + 4)|0;
  $546 = $545;
  $547 = HEAP32[$546>>2]|0;
  $548 = $544 ^ $540;
  $549 = $547 ^ $541;
  $550 = $0;
  $551 = $550;
  HEAP32[$551>>2] = $548;
  $552 = (($550) + 4)|0;
  $553 = $552;
  HEAP32[$553>>2] = $549;
  $554 = $536 ^ -1;
  $555 = $539 ^ -1;
  $556 = $107;
  $557 = $556;
  $558 = HEAP32[$557>>2]|0;
  $559 = (($556) + 4)|0;
  $560 = $559;
  $561 = HEAP32[$560>>2]|0;
  $562 = $558 & $554;
  $563 = $561 & $555;
  $564 = $2;
  $565 = $564;
  $566 = HEAP32[$565>>2]|0;
  $567 = (($564) + 4)|0;
  $568 = $567;
  $569 = HEAP32[$568>>2]|0;
  $570 = $566 ^ $562;
  $571 = $569 ^ $563;
  $572 = $2;
  $573 = $572;
  HEAP32[$573>>2] = $570;
  $574 = (($572) + 4)|0;
  $575 = $574;
  HEAP32[$575>>2] = $571;
  $576 = $558 ^ -1;
  $577 = $561 ^ -1;
  $578 = $110;
  $579 = $578;
  $580 = HEAP32[$579>>2]|0;
  $581 = (($578) + 4)|0;
  $582 = $581;
  $583 = HEAP32[$582>>2]|0;
  $584 = $580 & $576;
  $585 = $583 & $577;
  $586 = $102;
  $587 = $586;
  $588 = HEAP32[$587>>2]|0;
  $589 = (($586) + 4)|0;
  $590 = $589;
  $591 = HEAP32[$590>>2]|0;
  $592 = $588 ^ $584;
  $593 = $591 ^ $585;
  $594 = $102;
  $595 = $594;
  HEAP32[$595>>2] = $592;
  $596 = (($594) + 4)|0;
  $597 = $596;
  HEAP32[$597>>2] = $593;
  $598 = $580 ^ -1;
  $599 = $583 ^ -1;
  $600 = $1;
  $601 = $600;
  $602 = HEAP32[$601>>2]|0;
  $603 = (($600) + 4)|0;
  $604 = $603;
  $605 = HEAP32[$604>>2]|0;
  $606 = $602 & $598;
  $607 = $605 & $599;
  $608 = $105;
  $609 = $608;
  $610 = HEAP32[$609>>2]|0;
  $611 = (($608) + 4)|0;
  $612 = $611;
  $613 = HEAP32[$612>>2]|0;
  $614 = $610 ^ $606;
  $615 = $613 ^ $607;
  $616 = $105;
  $617 = $616;
  HEAP32[$617>>2] = $614;
  $618 = (($616) + 4)|0;
  $619 = $618;
  HEAP32[$619>>2] = $615;
  $620 = $602 ^ -1;
  $621 = $605 ^ -1;
  $622 = $528 & $620;
  $623 = $531 & $621;
  $624 = $108;
  $625 = $624;
  $626 = HEAP32[$625>>2]|0;
  $627 = (($624) + 4)|0;
  $628 = $627;
  $629 = HEAP32[$628>>2]|0;
  $630 = $626 ^ $622;
  $631 = $629 ^ $623;
  $632 = $108;
  $633 = $632;
  HEAP32[$633>>2] = $630;
  $634 = (($632) + 4)|0;
  $635 = $634;
  HEAP32[$635>>2] = $631;
  dest=$1; src=$99; stop=dest+40|0; do { HEAP32[dest>>2]=HEAP32[src>>2]|0; dest=dest+4|0; src=src+4|0; } while ((dest|0) < (stop|0));
  $636 = $101;
  $637 = $636;
  $638 = HEAP32[$637>>2]|0;
  $639 = (($636) + 4)|0;
  $640 = $639;
  $641 = HEAP32[$640>>2]|0;
  $642 = $638 ^ -1;
  $643 = $641 ^ -1;
  $644 = $104;
  $645 = $644;
  $646 = HEAP32[$645>>2]|0;
  $647 = (($644) + 4)|0;
  $648 = $647;
  $649 = HEAP32[$648>>2]|0;
  $650 = $646 & $642;
  $651 = $649 & $643;
  $652 = $99;
  $653 = $652;
  $654 = HEAP32[$653>>2]|0;
  $655 = (($652) + 4)|0;
  $656 = $655;
  $657 = HEAP32[$656>>2]|0;
  $658 = $654 ^ $650;
  $659 = $657 ^ $651;
  $660 = $99;
  $661 = $660;
  HEAP32[$661>>2] = $658;
  $662 = (($660) + 4)|0;
  $663 = $662;
  HEAP32[$663>>2] = $659;
  $664 = $646 ^ -1;
  $665 = $649 ^ -1;
  $666 = $107;
  $667 = $666;
  $668 = HEAP32[$667>>2]|0;
  $669 = (($666) + 4)|0;
  $670 = $669;
  $671 = HEAP32[$670>>2]|0;
  $672 = $668 & $664;
  $673 = $671 & $665;
  $674 = $100;
  $675 = $674;
  $676 = HEAP32[$675>>2]|0;
  $677 = (($674) + 4)|0;
  $678 = $677;
  $679 = HEAP32[$678>>2]|0;
  $680 = $676 ^ $672;
  $681 = $679 ^ $673;
  $682 = $100;
  $683 = $682;
  HEAP32[$683>>2] = $680;
  $684 = (($682) + 4)|0;
  $685 = $684;
  HEAP32[$685>>2] = $681;
  $686 = $668 ^ -1;
  $687 = $671 ^ -1;
  $688 = $110;
  $689 = $688;
  $690 = HEAP32[$689>>2]|0;
  $691 = (($688) + 4)|0;
  $692 = $691;
  $693 = HEAP32[$692>>2]|0;
  $694 = $690 & $686;
  $695 = $693 & $687;
  $696 = $103;
  $697 = $696;
  $698 = HEAP32[$697>>2]|0;
  $699 = (($696) + 4)|0;
  $700 = $699;
  $701 = HEAP32[$700>>2]|0;
  $702 = $698 ^ $694;
  $703 = $701 ^ $695;
  $704 = $103;
  $705 = $704;
  HEAP32[$705>>2] = $702;
  $706 = (($704) + 4)|0;
  $707 = $706;
  HEAP32[$707>>2] = $703;
  $708 = $690 ^ -1;
  $709 = $693 ^ -1;
  $710 = $1;
  $711 = $710;
  $712 = HEAP32[$711>>2]|0;
  $713 = (($710) + 4)|0;
  $714 = $713;
  $715 = HEAP32[$714>>2]|0;
  $716 = $712 & $708;
  $717 = $715 & $709;
  $718 = $106;
  $719 = $718;
  $720 = HEAP32[$719>>2]|0;
  $721 = (($718) + 4)|0;
  $722 = $721;
  $723 = HEAP32[$722>>2]|0;
  $724 = $720 ^ $716;
  $725 = $723 ^ $717;
  $726 = $106;
  $727 = $726;
  HEAP32[$727>>2] = $724;
  $728 = (($726) + 4)|0;
  $729 = $728;
  HEAP32[$729>>2] = $725;
  $730 = $712 ^ -1;
  $731 = $715 ^ -1;
  $732 = $638 & $730;
  $733 = $641 & $731;
  $734 = $109;
  $735 = $734;
  $736 = HEAP32[$735>>2]|0;
  $737 = (($734) + 4)|0;
  $738 = $737;
  $739 = HEAP32[$738>>2]|0;
  $740 = $736 ^ $732;
  $741 = $739 ^ $733;
  $742 = $109;
  $743 = $742;
  HEAP32[$743>>2] = $740;
  $744 = (($742) + 4)|0;
  $745 = $744;
  HEAP32[$745>>2] = $741;
  dest=$1; src=$$phi$trans$insert96; stop=dest+40|0; do { HEAP32[dest>>2]=HEAP32[src>>2]|0; dest=dest+4|0; src=src+4|0; } while ((dest|0) < (stop|0));
  $746 = $101;
  $747 = $746;
  $748 = HEAP32[$747>>2]|0;
  $749 = (($746) + 4)|0;
  $750 = $749;
  $751 = HEAP32[$750>>2]|0;
  $752 = $748 ^ -1;
  $753 = $751 ^ -1;
  $754 = $104;
  $755 = $754;
  $756 = HEAP32[$755>>2]|0;
  $757 = (($754) + 4)|0;
  $758 = $757;
  $759 = HEAP32[$758>>2]|0;
  $760 = $756 & $752;
  $761 = $759 & $753;
  $762 = $$phi$trans$insert96;
  $763 = $762;
  $764 = HEAP32[$763>>2]|0;
  $765 = (($762) + 4)|0;
  $766 = $765;
  $767 = HEAP32[$766>>2]|0;
  $768 = $764 ^ $760;
  $769 = $767 ^ $761;
  $770 = $$phi$trans$insert96;
  $771 = $770;
  HEAP32[$771>>2] = $768;
  $772 = (($770) + 4)|0;
  $773 = $772;
  HEAP32[$773>>2] = $769;
  $774 = $756 ^ -1;
  $775 = $759 ^ -1;
  $776 = $107;
  $777 = $776;
  $778 = HEAP32[$777>>2]|0;
  $779 = (($776) + 4)|0;
  $780 = $779;
  $781 = HEAP32[$780>>2]|0;
  $782 = $778 & $774;
  $783 = $781 & $775;
  $784 = $$phi$trans$insert100;
  $785 = $784;
  $786 = HEAP32[$785>>2]|0;
  $787 = (($784) + 4)|0;
  $788 = $787;
  $789 = HEAP32[$788>>2]|0;
  $790 = $786 ^ $782;
  $791 = $789 ^ $783;
  $792 = $$phi$trans$insert100;
  $793 = $792;
  HEAP32[$793>>2] = $790;
  $794 = (($792) + 4)|0;
  $795 = $794;
  HEAP32[$795>>2] = $791;
  $796 = $778 ^ -1;
  $797 = $781 ^ -1;
  $798 = $110;
  $799 = $798;
  $800 = HEAP32[$799>>2]|0;
  $801 = (($798) + 4)|0;
  $802 = $801;
  $803 = HEAP32[$802>>2]|0;
  $804 = $800 & $796;
  $805 = $803 & $797;
  $806 = $$phi$trans$insert102;
  $807 = $806;
  $808 = HEAP32[$807>>2]|0;
  $809 = (($806) + 4)|0;
  $810 = $809;
  $811 = HEAP32[$810>>2]|0;
  $812 = $808 ^ $804;
  $813 = $811 ^ $805;
  $814 = $$phi$trans$insert102;
  $815 = $814;
  HEAP32[$815>>2] = $812;
  $816 = (($814) + 4)|0;
  $817 = $816;
  HEAP32[$817>>2] = $813;
  $818 = $800 ^ -1;
  $819 = $803 ^ -1;
  $820 = $1;
  $821 = $820;
  $822 = HEAP32[$821>>2]|0;
  $823 = (($820) + 4)|0;
  $824 = $823;
  $825 = HEAP32[$824>>2]|0;
  $826 = $822 & $818;
  $827 = $825 & $819;
  $828 = $$phi$trans$insert104;
  $829 = $828;
  $830 = HEAP32[$829>>2]|0;
  $831 = (($828) + 4)|0;
  $832 = $831;
  $833 = HEAP32[$832>>2]|0;
  $834 = $830 ^ $826;
  $835 = $833 ^ $827;
  $836 = $$phi$trans$insert104;
  $837 = $836;
  HEAP32[$837>>2] = $834;
  $838 = (($836) + 4)|0;
  $839 = $838;
  HEAP32[$839>>2] = $835;
  $840 = $822 ^ -1;
  $841 = $825 ^ -1;
  $842 = $748 & $840;
  $843 = $751 & $841;
  $844 = $$phi$trans$insert106;
  $845 = $844;
  $846 = HEAP32[$845>>2]|0;
  $847 = (($844) + 4)|0;
  $848 = $847;
  $849 = HEAP32[$848>>2]|0;
  $850 = $846 ^ $842;
  $851 = $849 ^ $843;
  $852 = $$phi$trans$insert106;
  $853 = $852;
  HEAP32[$853>>2] = $850;
  $854 = (($852) + 4)|0;
  $855 = $854;
  HEAP32[$855>>2] = $851;
  dest=$1; src=$$phi$trans$insert98; stop=dest+40|0; do { HEAP32[dest>>2]=HEAP32[src>>2]|0; dest=dest+4|0; src=src+4|0; } while ((dest|0) < (stop|0));
  $856 = $101;
  $857 = $856;
  $858 = HEAP32[$857>>2]|0;
  $859 = (($856) + 4)|0;
  $860 = $859;
  $861 = HEAP32[$860>>2]|0;
  $862 = $858 ^ -1;
  $863 = $861 ^ -1;
  $864 = $104;
  $865 = $864;
  $866 = HEAP32[$865>>2]|0;
  $867 = (($864) + 4)|0;
  $868 = $867;
  $869 = HEAP32[$868>>2]|0;
  $870 = $866 & $862;
  $871 = $869 & $863;
  $872 = $$phi$trans$insert98;
  $873 = $872;
  $874 = HEAP32[$873>>2]|0;
  $875 = (($872) + 4)|0;
  $876 = $875;
  $877 = HEAP32[$876>>2]|0;
  $878 = $874 ^ $870;
  $879 = $877 ^ $871;
  $880 = $$phi$trans$insert98;
  $881 = $880;
  HEAP32[$881>>2] = $878;
  $882 = (($880) + 4)|0;
  $883 = $882;
  HEAP32[$883>>2] = $879;
  $884 = $866 ^ -1;
  $885 = $869 ^ -1;
  $886 = $107;
  $887 = $886;
  $888 = HEAP32[$887>>2]|0;
  $889 = (($886) + 4)|0;
  $890 = $889;
  $891 = HEAP32[$890>>2]|0;
  $892 = $888 & $884;
  $893 = $891 & $885;
  $894 = $$phi$trans$insert80;
  $895 = $894;
  $896 = HEAP32[$895>>2]|0;
  $897 = (($894) + 4)|0;
  $898 = $897;
  $899 = HEAP32[$898>>2]|0;
  $900 = $896 ^ $892;
  $901 = $899 ^ $893;
  $902 = $$phi$trans$insert80;
  $903 = $902;
  HEAP32[$903>>2] = $900;
  $904 = (($902) + 4)|0;
  $905 = $904;
  HEAP32[$905>>2] = $901;
  $906 = $888 ^ -1;
  $907 = $891 ^ -1;
  $908 = $110;
  $909 = $908;
  $910 = HEAP32[$909>>2]|0;
  $911 = (($908) + 4)|0;
  $912 = $911;
  $913 = HEAP32[$912>>2]|0;
  $914 = $910 & $906;
  $915 = $913 & $907;
  $916 = $$phi$trans$insert84;
  $917 = $916;
  $918 = HEAP32[$917>>2]|0;
  $919 = (($916) + 4)|0;
  $920 = $919;
  $921 = HEAP32[$920>>2]|0;
  $922 = $918 ^ $914;
  $923 = $921 ^ $915;
  $924 = $$phi$trans$insert84;
  $925 = $924;
  HEAP32[$925>>2] = $922;
  $926 = (($924) + 4)|0;
  $927 = $926;
  HEAP32[$927>>2] = $923;
  $928 = $910 ^ -1;
  $929 = $913 ^ -1;
  $930 = $1;
  $931 = $930;
  $932 = HEAP32[$931>>2]|0;
  $933 = (($930) + 4)|0;
  $934 = $933;
  $935 = HEAP32[$934>>2]|0;
  $936 = $932 & $928;
  $937 = $935 & $929;
  $938 = $$phi$trans$insert88;
  $939 = $938;
  $940 = HEAP32[$939>>2]|0;
  $941 = (($938) + 4)|0;
  $942 = $941;
  $943 = HEAP32[$942>>2]|0;
  $944 = $940 ^ $936;
  $945 = $943 ^ $937;
  $946 = $$phi$trans$insert88;
  $947 = $946;
  HEAP32[$947>>2] = $944;
  $948 = (($946) + 4)|0;
  $949 = $948;
  HEAP32[$949>>2] = $945;
  $950 = $932 ^ -1;
  $951 = $935 ^ -1;
  $952 = $858 & $950;
  $953 = $861 & $951;
  $954 = $$phi$trans$insert92;
  $955 = $954;
  $956 = HEAP32[$955>>2]|0;
  $957 = (($954) + 4)|0;
  $958 = $957;
  $959 = HEAP32[$958>>2]|0;
  $960 = $956 ^ $952;
  $961 = $959 ^ $953;
  $962 = $$phi$trans$insert92;
  $963 = $962;
  HEAP32[$963>>2] = $960;
  $964 = (($962) + 4)|0;
  $965 = $964;
  HEAP32[$965>>2] = $961;
  dest=$1; src=$$phi$trans$insert; stop=dest+40|0; do { HEAP32[dest>>2]=HEAP32[src>>2]|0; dest=dest+4|0; src=src+4|0; } while ((dest|0) < (stop|0));
  $966 = $101;
  $967 = $966;
  $968 = HEAP32[$967>>2]|0;
  $969 = (($966) + 4)|0;
  $970 = $969;
  $971 = HEAP32[$970>>2]|0;
  $972 = $968 ^ -1;
  $973 = $971 ^ -1;
  $974 = $104;
  $975 = $974;
  $976 = HEAP32[$975>>2]|0;
  $977 = (($974) + 4)|0;
  $978 = $977;
  $979 = HEAP32[$978>>2]|0;
  $980 = $976 & $972;
  $981 = $979 & $973;
  $982 = $$phi$trans$insert;
  $983 = $982;
  $984 = HEAP32[$983>>2]|0;
  $985 = (($982) + 4)|0;
  $986 = $985;
  $987 = HEAP32[$986>>2]|0;
  $988 = $984 ^ $980;
  $989 = $987 ^ $981;
  $990 = $$phi$trans$insert;
  $991 = $990;
  HEAP32[$991>>2] = $988;
  $992 = (($990) + 4)|0;
  $993 = $992;
  HEAP32[$993>>2] = $989;
  $994 = $976 ^ -1;
  $995 = $979 ^ -1;
  $996 = $107;
  $997 = $996;
  $998 = HEAP32[$997>>2]|0;
  $999 = (($996) + 4)|0;
  $1000 = $999;
  $1001 = HEAP32[$1000>>2]|0;
  $1002 = $998 & $994;
  $1003 = $1001 & $995;
  $1004 = $$phi$trans$insert82;
  $1005 = $1004;
  $1006 = HEAP32[$1005>>2]|0;
  $1007 = (($1004) + 4)|0;
  $1008 = $1007;
  $1009 = HEAP32[$1008>>2]|0;
  $1010 = $1006 ^ $1002;
  $1011 = $1009 ^ $1003;
  $1012 = $$phi$trans$insert82;
  $1013 = $1012;
  HEAP32[$1013>>2] = $1010;
  $1014 = (($1012) + 4)|0;
  $1015 = $1014;
  HEAP32[$1015>>2] = $1011;
  $1016 = $998 ^ -1;
  $1017 = $1001 ^ -1;
  $1018 = $110;
  $1019 = $1018;
  $1020 = HEAP32[$1019>>2]|0;
  $1021 = (($1018) + 4)|0;
  $1022 = $1021;
  $1023 = HEAP32[$1022>>2]|0;
  $1024 = $1020 & $1016;
  $1025 = $1023 & $1017;
  $1026 = $$phi$trans$insert86;
  $1027 = $1026;
  $1028 = HEAP32[$1027>>2]|0;
  $1029 = (($1026) + 4)|0;
  $1030 = $1029;
  $1031 = HEAP32[$1030>>2]|0;
  $1032 = $1028 ^ $1024;
  $1033 = $1031 ^ $1025;
  $1034 = $$phi$trans$insert86;
  $1035 = $1034;
  HEAP32[$1035>>2] = $1032;
  $1036 = (($1034) + 4)|0;
  $1037 = $1036;
  HEAP32[$1037>>2] = $1033;
  $1038 = $1020 ^ -1;
  $1039 = $1023 ^ -1;
  $1040 = $1;
  $1041 = $1040;
  $1042 = HEAP32[$1041>>2]|0;
  $1043 = (($1040) + 4)|0;
  $1044 = $1043;
  $1045 = HEAP32[$1044>>2]|0;
  $1046 = $1042 & $1038;
  $1047 = $1045 & $1039;
  $1048 = $$phi$trans$insert90;
  $1049 = $1048;
  $1050 = HEAP32[$1049>>2]|0;
  $1051 = (($1048) + 4)|0;
  $1052 = $1051;
  $1053 = HEAP32[$1052>>2]|0;
  $1054 = $1050 ^ $1046;
  $1055 = $1053 ^ $1047;
  $1056 = $$phi$trans$insert90;
  $1057 = $1056;
  HEAP32[$1057>>2] = $1054;
  $1058 = (($1056) + 4)|0;
  $1059 = $1058;
  HEAP32[$1059>>2] = $1055;
  $1060 = $1042 ^ -1;
  $1061 = $1045 ^ -1;
  $1062 = $968 & $1060;
  $1063 = $971 & $1061;
  $1064 = $$phi$trans$insert94;
  $1065 = $1064;
  $1066 = HEAP32[$1065>>2]|0;
  $1067 = (($1064) + 4)|0;
  $1068 = $1067;
  $1069 = HEAP32[$1068>>2]|0;
  $1070 = $1066 ^ $1062;
  $1071 = $1069 ^ $1063;
  $1072 = $$phi$trans$insert94;
  $1073 = $1072;
  HEAP32[$1073>>2] = $1070;
  $1074 = (($1072) + 4)|0;
  $1075 = $1074;
  HEAP32[$1075>>2] = $1071;
  $1076 = (8 + ($$06173<<3)|0);
  $1077 = $1076;
  $1078 = $1077;
  $1079 = HEAP32[$1078>>2]|0;
  $1080 = (($1077) + 4)|0;
  $1081 = $1080;
  $1082 = HEAP32[$1081>>2]|0;
  $1083 = $0;
  $1084 = $1083;
  $1085 = HEAP32[$1084>>2]|0;
  $1086 = (($1083) + 4)|0;
  $1087 = $1086;
  $1088 = HEAP32[$1087>>2]|0;
  $1089 = $1085 ^ $1079;
  $1090 = $1088 ^ $1082;
  $1091 = $0;
  $1092 = $1091;
  HEAP32[$1092>>2] = $1089;
  $1093 = (($1091) + 4)|0;
  $1094 = $1093;
  HEAP32[$1094>>2] = $1090;
  $1095 = (($$06173) + 1)|0;
  $exitcond78 = ($1095|0)==(24);
  if ($exitcond78) {
   break;
  } else {
   $$06173 = $1095;$118 = $1089;$120 = $1090;$122 = $768;$124 = $769;$126 = $878;$128 = $879;$130 = $988;$132 = $989;$152 = $790;$154 = $791;$156 = $900;$158 = $901;$160 = $1010;$162 = $1011;$182 = $812;$184 = $813;$186 = $922;$188 = $923;$190 = $1032;$192 = $1033;$212 = $834;$214 = $835;$216 = $944;$218 = $945;$220 = $1054;$222 = $1055;$242 = $850;$244 = $851;$246 = $960;$248 = $961;$250 = $1070;$252 = $1071;
  }
 }
 STACKTOP = sp;return;
}
function _sha3_Finalize($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$047 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0;
 var $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0;
 var $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0;
 var $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0;
 var $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $9 = 0, $exitcond = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = $0;
 $3 = $2;
 $4 = HEAP32[$3>>2]|0;
 $5 = (($2) + 4)|0;
 $6 = $5;
 $7 = HEAP32[$6>>2]|0;
 $8 = ((($0)) + 208|0);
 $9 = HEAP32[$8>>2]|0;
 $10 = $9 << 3;
 $11 = (_bitshift64Shl(6,0,($10|0))|0);
 $12 = tempRet0;
 $13 = ((($0)) + 8|0);
 $14 = ((($0)) + 212|0);
 $15 = HEAP32[$14>>2]|0;
 $16 = (($13) + ($15<<3)|0);
 $17 = $16;
 $18 = $17;
 $19 = HEAP32[$18>>2]|0;
 $20 = (($17) + 4)|0;
 $21 = $20;
 $22 = HEAP32[$21>>2]|0;
 $23 = $19 ^ $4;
 $24 = $22 ^ $7;
 $25 = $23 ^ $11;
 $26 = $24 ^ $12;
 $27 = $16;
 $28 = $27;
 HEAP32[$28>>2] = $25;
 $29 = (($27) + 4)|0;
 $30 = $29;
 HEAP32[$30>>2] = $26;
 $31 = ((($0)) + 216|0);
 $32 = HEAP32[$31>>2]|0;
 $33 = (24 - ($32))|0;
 $34 = (($13) + ($33<<3)|0);
 $35 = $34;
 $36 = $35;
 $37 = HEAP32[$36>>2]|0;
 $38 = (($35) + 4)|0;
 $39 = $38;
 $40 = HEAP32[$39>>2]|0;
 $41 = $40 ^ -2147483648;
 $42 = $34;
 $43 = $42;
 HEAP32[$43>>2] = $37;
 $44 = (($42) + 4)|0;
 $45 = $44;
 HEAP32[$45>>2] = $41;
 _keccakf($13);
 $$047 = 0;
 while(1) {
  $46 = (($13) + ($$047<<3)|0);
  $47 = $46;
  $48 = $47;
  $49 = HEAP32[$48>>2]|0;
  $50 = (($47) + 4)|0;
  $51 = $50;
  $52 = HEAP32[$51>>2]|0;
  $53 = $49&255;
  $54 = $$047 << 3;
  $55 = (($13) + ($54)|0);
  HEAP8[$55>>0] = $53;
  $56 = $49 >>> 8;
  $57 = $56&255;
  $58 = $54 | 1;
  $59 = (($13) + ($58)|0);
  HEAP8[$59>>0] = $57;
  $60 = $49 >>> 16;
  $61 = $60&255;
  $62 = $54 | 2;
  $63 = (($13) + ($62)|0);
  HEAP8[$63>>0] = $61;
  $64 = $49 >>> 24;
  $65 = $64&255;
  $66 = $54 | 3;
  $67 = (($13) + ($66)|0);
  HEAP8[$67>>0] = $65;
  $68 = $52&255;
  $69 = $54 | 4;
  $70 = (($13) + ($69)|0);
  HEAP8[$70>>0] = $68;
  $71 = (_bitshift64Lshr(($49|0),($52|0),40)|0);
  $72 = tempRet0;
  $73 = $71&255;
  $74 = $54 | 5;
  $75 = (($13) + ($74)|0);
  HEAP8[$75>>0] = $73;
  $76 = (_bitshift64Lshr(($49|0),($52|0),48)|0);
  $77 = tempRet0;
  $78 = $76&255;
  $79 = $54 | 6;
  $80 = (($13) + ($79)|0);
  HEAP8[$80>>0] = $78;
  $81 = (_bitshift64Lshr(($49|0),($52|0),56)|0);
  $82 = tempRet0;
  $83 = $81&255;
  $84 = $54 | 7;
  $85 = (($13) + ($84)|0);
  HEAP8[$85>>0] = $83;
  $86 = (($$047) + 1)|0;
  $exitcond = ($86|0)==(25);
  if ($exitcond) {
   break;
  } else {
   $$047 = $86;
  }
 }
 $87 = HEAP32[$31>>2]|0;
 $88 = $87 << 2;
 _memcpy(($1|0),($13|0),($88|0))|0;
 return;
}
function _sha512_init($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 _sha3_Init512($0);
 return 1;
}
function _sha512_update($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 _sha3_Update($0,$1,$2);
 return 1;
}
function _sha512_final($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 _sha3_Finalize($0,$1);
 return 1;
}
function _sha512($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $$alloca_mul = 0, $4 = 0, $5 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $4 = HEAP32[8000]|0;
 $$alloca_mul = $4;
 $5 = STACKTOP; STACKTOP = STACKTOP + ((((1*$$alloca_mul)|0)+15)&-16)|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(((((1*$$alloca_mul)|0)+15)&-16)|0);;
 _sha3_Init512($5);
 _sha3_Update($5,$1,$2);
 _sha3_Finalize($5,$0);
 STACKTOP = sp;return 1;
}
function _randombytes($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$1 = 0, $$lobit = 0, $$lobit$not = 0, $2 = 0, $3 = 0, $4 = 0, $vararg_buffer = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $vararg_buffer = sp;
 $2 = (_open(32324,0,$vararg_buffer)|0);
 $3 = ($2|0)<(0);
 if ($3) {
  $$1 = 0;
  STACKTOP = sp;return ($$1|0);
 }
 $4 = (_read($2,$0,$1)|0);
 (_close($2)|0);
 $$lobit = $4 >>> 31;
 $$lobit$not = $$lobit ^ 1;
 $$1 = $$lobit$not;
 STACKTOP = sp;return ($$1|0);
}
function _malloc($0) {
 $0 = $0|0;
 var $$0 = 0, $$0$i = 0, $$0$i$i = 0, $$0$i$i$i = 0, $$0$i20$i = 0, $$0169$i = 0, $$0170$i = 0, $$0171$i = 0, $$0192 = 0, $$0194 = 0, $$02014$i$i = 0, $$0202$lcssa$i$i = 0, $$02023$i$i = 0, $$0206$i$i = 0, $$0207$i$i = 0, $$024372$i = 0, $$0259$i$i = 0, $$02604$i$i = 0, $$0261$lcssa$i$i = 0, $$02613$i$i = 0;
 var $$0267$i$i = 0, $$0268$i$i = 0, $$0318$i = 0, $$032012$i = 0, $$0321$lcssa$i = 0, $$032111$i = 0, $$0323$i = 0, $$0329$i = 0, $$0335$i = 0, $$0336$i = 0, $$0338$i = 0, $$0339$i = 0, $$0344$i = 0, $$1174$i = 0, $$1174$i$be = 0, $$1174$i$ph = 0, $$1176$i = 0, $$1176$i$be = 0, $$1176$i$ph = 0, $$124471$i = 0;
 var $$1263$i$i = 0, $$1263$i$i$be = 0, $$1263$i$i$ph = 0, $$1265$i$i = 0, $$1265$i$i$be = 0, $$1265$i$i$ph = 0, $$1319$i = 0, $$1324$i = 0, $$1340$i = 0, $$1346$i = 0, $$1346$i$be = 0, $$1346$i$ph = 0, $$1350$i = 0, $$1350$i$be = 0, $$1350$i$ph = 0, $$2234243136$i = 0, $$2247$ph$i = 0, $$2253$ph$i = 0, $$2331$i = 0, $$3$i = 0;
 var $$3$i$i = 0, $$3$i198 = 0, $$3$i198211 = 0, $$3326$i = 0, $$3348$i = 0, $$4$lcssa$i = 0, $$415$i = 0, $$415$i$ph = 0, $$4236$i = 0, $$4327$lcssa$i = 0, $$432714$i = 0, $$432714$i$ph = 0, $$4333$i = 0, $$533413$i = 0, $$533413$i$ph = 0, $$723947$i = 0, $$748$i = 0, $$pre = 0, $$pre$i = 0, $$pre$i$i = 0;
 var $$pre$i16$i = 0, $$pre$i195 = 0, $$pre$i204 = 0, $$pre$phi$i$iZ2D = 0, $$pre$phi$i17$iZ2D = 0, $$pre$phi$i205Z2D = 0, $$pre$phi$iZ2D = 0, $$pre$phiZ2D = 0, $$sink = 0, $$sink320 = 0, $$sink321 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0;
 var $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0;
 var $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0;
 var $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0;
 var $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0;
 var $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0;
 var $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0;
 var $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0;
 var $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0;
 var $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0;
 var $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0;
 var $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0, $299 = 0, $3 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0;
 var $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0, $312 = 0, $313 = 0, $314 = 0, $315 = 0, $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0, $321 = 0, $322 = 0;
 var $323 = 0, $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0, $329 = 0, $33 = 0, $330 = 0, $331 = 0, $332 = 0, $333 = 0, $334 = 0, $335 = 0, $336 = 0, $337 = 0, $338 = 0, $339 = 0, $34 = 0, $340 = 0;
 var $341 = 0, $342 = 0, $343 = 0, $344 = 0, $345 = 0, $346 = 0, $347 = 0, $348 = 0, $349 = 0, $35 = 0, $350 = 0, $351 = 0, $352 = 0, $353 = 0, $354 = 0, $355 = 0, $356 = 0, $357 = 0, $358 = 0, $359 = 0;
 var $36 = 0, $360 = 0, $361 = 0, $362 = 0, $363 = 0, $364 = 0, $365 = 0, $366 = 0, $367 = 0, $368 = 0, $369 = 0, $37 = 0, $370 = 0, $371 = 0, $372 = 0, $373 = 0, $374 = 0, $375 = 0, $376 = 0, $377 = 0;
 var $378 = 0, $379 = 0, $38 = 0, $380 = 0, $381 = 0, $382 = 0, $383 = 0, $384 = 0, $385 = 0, $386 = 0, $387 = 0, $388 = 0, $389 = 0, $39 = 0, $390 = 0, $391 = 0, $392 = 0, $393 = 0, $394 = 0, $395 = 0;
 var $396 = 0, $397 = 0, $398 = 0, $399 = 0, $4 = 0, $40 = 0, $400 = 0, $401 = 0, $402 = 0, $403 = 0, $404 = 0, $405 = 0, $406 = 0, $407 = 0, $408 = 0, $409 = 0, $41 = 0, $410 = 0, $411 = 0, $412 = 0;
 var $413 = 0, $414 = 0, $415 = 0, $416 = 0, $417 = 0, $418 = 0, $419 = 0, $42 = 0, $420 = 0, $421 = 0, $422 = 0, $423 = 0, $424 = 0, $425 = 0, $426 = 0, $427 = 0, $428 = 0, $429 = 0, $43 = 0, $430 = 0;
 var $431 = 0, $432 = 0, $433 = 0, $434 = 0, $435 = 0, $436 = 0, $437 = 0, $438 = 0, $439 = 0, $44 = 0, $440 = 0, $441 = 0, $442 = 0, $443 = 0, $444 = 0, $445 = 0, $446 = 0, $447 = 0, $448 = 0, $449 = 0;
 var $45 = 0, $450 = 0, $451 = 0, $452 = 0, $453 = 0, $454 = 0, $455 = 0, $456 = 0, $457 = 0, $458 = 0, $459 = 0, $46 = 0, $460 = 0, $461 = 0, $462 = 0, $463 = 0, $464 = 0, $465 = 0, $466 = 0, $467 = 0;
 var $468 = 0, $469 = 0, $47 = 0, $470 = 0, $471 = 0, $472 = 0, $473 = 0, $474 = 0, $475 = 0, $476 = 0, $477 = 0, $478 = 0, $479 = 0, $48 = 0, $480 = 0, $481 = 0, $482 = 0, $483 = 0, $484 = 0, $485 = 0;
 var $486 = 0, $487 = 0, $488 = 0, $489 = 0, $49 = 0, $490 = 0, $491 = 0, $492 = 0, $493 = 0, $494 = 0, $495 = 0, $496 = 0, $497 = 0, $498 = 0, $499 = 0, $5 = 0, $50 = 0, $500 = 0, $501 = 0, $502 = 0;
 var $503 = 0, $504 = 0, $505 = 0, $506 = 0, $507 = 0, $508 = 0, $509 = 0, $51 = 0, $510 = 0, $511 = 0, $512 = 0, $513 = 0, $514 = 0, $515 = 0, $516 = 0, $517 = 0, $518 = 0, $519 = 0, $52 = 0, $520 = 0;
 var $521 = 0, $522 = 0, $523 = 0, $524 = 0, $525 = 0, $526 = 0, $527 = 0, $528 = 0, $529 = 0, $53 = 0, $530 = 0, $531 = 0, $532 = 0, $533 = 0, $534 = 0, $535 = 0, $536 = 0, $537 = 0, $538 = 0, $539 = 0;
 var $54 = 0, $540 = 0, $541 = 0, $542 = 0, $543 = 0, $544 = 0, $545 = 0, $546 = 0, $547 = 0, $548 = 0, $549 = 0, $55 = 0, $550 = 0, $551 = 0, $552 = 0, $553 = 0, $554 = 0, $555 = 0, $556 = 0, $557 = 0;
 var $558 = 0, $559 = 0, $56 = 0, $560 = 0, $561 = 0, $562 = 0, $563 = 0, $564 = 0, $565 = 0, $566 = 0, $567 = 0, $568 = 0, $569 = 0, $57 = 0, $570 = 0, $571 = 0, $572 = 0, $573 = 0, $574 = 0, $575 = 0;
 var $576 = 0, $577 = 0, $578 = 0, $579 = 0, $58 = 0, $580 = 0, $581 = 0, $582 = 0, $583 = 0, $584 = 0, $585 = 0, $586 = 0, $587 = 0, $588 = 0, $589 = 0, $59 = 0, $590 = 0, $591 = 0, $592 = 0, $593 = 0;
 var $594 = 0, $595 = 0, $596 = 0, $597 = 0, $598 = 0, $599 = 0, $6 = 0, $60 = 0, $600 = 0, $601 = 0, $602 = 0, $603 = 0, $604 = 0, $605 = 0, $606 = 0, $607 = 0, $608 = 0, $609 = 0, $61 = 0, $610 = 0;
 var $611 = 0, $612 = 0, $613 = 0, $614 = 0, $615 = 0, $616 = 0, $617 = 0, $618 = 0, $619 = 0, $62 = 0, $620 = 0, $621 = 0, $622 = 0, $623 = 0, $624 = 0, $625 = 0, $626 = 0, $627 = 0, $628 = 0, $629 = 0;
 var $63 = 0, $630 = 0, $631 = 0, $632 = 0, $633 = 0, $634 = 0, $635 = 0, $636 = 0, $637 = 0, $638 = 0, $639 = 0, $64 = 0, $640 = 0, $641 = 0, $642 = 0, $643 = 0, $644 = 0, $645 = 0, $646 = 0, $647 = 0;
 var $648 = 0, $649 = 0, $65 = 0, $650 = 0, $651 = 0, $652 = 0, $653 = 0, $654 = 0, $655 = 0, $656 = 0, $657 = 0, $658 = 0, $659 = 0, $66 = 0, $660 = 0, $661 = 0, $662 = 0, $663 = 0, $664 = 0, $665 = 0;
 var $666 = 0, $667 = 0, $668 = 0, $669 = 0, $67 = 0, $670 = 0, $671 = 0, $672 = 0, $673 = 0, $674 = 0, $675 = 0, $676 = 0, $677 = 0, $678 = 0, $679 = 0, $68 = 0, $680 = 0, $681 = 0, $682 = 0, $683 = 0;
 var $684 = 0, $685 = 0, $686 = 0, $687 = 0, $688 = 0, $689 = 0, $69 = 0, $690 = 0, $691 = 0, $692 = 0, $693 = 0, $694 = 0, $695 = 0, $696 = 0, $697 = 0, $698 = 0, $699 = 0, $7 = 0, $70 = 0, $700 = 0;
 var $701 = 0, $702 = 0, $703 = 0, $704 = 0, $705 = 0, $706 = 0, $707 = 0, $708 = 0, $709 = 0, $71 = 0, $710 = 0, $711 = 0, $712 = 0, $713 = 0, $714 = 0, $715 = 0, $716 = 0, $717 = 0, $718 = 0, $719 = 0;
 var $72 = 0, $720 = 0, $721 = 0, $722 = 0, $723 = 0, $724 = 0, $725 = 0, $726 = 0, $727 = 0, $728 = 0, $729 = 0, $73 = 0, $730 = 0, $731 = 0, $732 = 0, $733 = 0, $734 = 0, $735 = 0, $736 = 0, $737 = 0;
 var $738 = 0, $739 = 0, $74 = 0, $740 = 0, $741 = 0, $742 = 0, $743 = 0, $744 = 0, $745 = 0, $746 = 0, $747 = 0, $748 = 0, $749 = 0, $75 = 0, $750 = 0, $751 = 0, $752 = 0, $753 = 0, $754 = 0, $755 = 0;
 var $756 = 0, $757 = 0, $758 = 0, $759 = 0, $76 = 0, $760 = 0, $761 = 0, $762 = 0, $763 = 0, $764 = 0, $765 = 0, $766 = 0, $767 = 0, $768 = 0, $769 = 0, $77 = 0, $770 = 0, $771 = 0, $772 = 0, $773 = 0;
 var $774 = 0, $775 = 0, $776 = 0, $777 = 0, $778 = 0, $779 = 0, $78 = 0, $780 = 0, $781 = 0, $782 = 0, $783 = 0, $784 = 0, $785 = 0, $786 = 0, $787 = 0, $788 = 0, $789 = 0, $79 = 0, $790 = 0, $791 = 0;
 var $792 = 0, $793 = 0, $794 = 0, $795 = 0, $796 = 0, $797 = 0, $798 = 0, $799 = 0, $8 = 0, $80 = 0, $800 = 0, $801 = 0, $802 = 0, $803 = 0, $804 = 0, $805 = 0, $806 = 0, $807 = 0, $808 = 0, $809 = 0;
 var $81 = 0, $810 = 0, $811 = 0, $812 = 0, $813 = 0, $814 = 0, $815 = 0, $816 = 0, $817 = 0, $818 = 0, $819 = 0, $82 = 0, $820 = 0, $821 = 0, $822 = 0, $823 = 0, $824 = 0, $825 = 0, $826 = 0, $827 = 0;
 var $828 = 0, $829 = 0, $83 = 0, $830 = 0, $831 = 0, $832 = 0, $833 = 0, $834 = 0, $835 = 0, $836 = 0, $837 = 0, $838 = 0, $839 = 0, $84 = 0, $840 = 0, $841 = 0, $842 = 0, $843 = 0, $844 = 0, $845 = 0;
 var $846 = 0, $847 = 0, $848 = 0, $849 = 0, $85 = 0, $850 = 0, $851 = 0, $852 = 0, $853 = 0, $854 = 0, $855 = 0, $856 = 0, $857 = 0, $858 = 0, $859 = 0, $86 = 0, $860 = 0, $861 = 0, $862 = 0, $863 = 0;
 var $864 = 0, $865 = 0, $866 = 0, $867 = 0, $868 = 0, $869 = 0, $87 = 0, $870 = 0, $871 = 0, $872 = 0, $873 = 0, $874 = 0, $875 = 0, $876 = 0, $877 = 0, $878 = 0, $879 = 0, $88 = 0, $880 = 0, $881 = 0;
 var $882 = 0, $883 = 0, $884 = 0, $885 = 0, $886 = 0, $887 = 0, $888 = 0, $889 = 0, $89 = 0, $890 = 0, $891 = 0, $892 = 0, $893 = 0, $894 = 0, $895 = 0, $896 = 0, $897 = 0, $898 = 0, $899 = 0, $9 = 0;
 var $90 = 0, $900 = 0, $901 = 0, $902 = 0, $903 = 0, $904 = 0, $905 = 0, $906 = 0, $907 = 0, $908 = 0, $909 = 0, $91 = 0, $910 = 0, $911 = 0, $912 = 0, $913 = 0, $914 = 0, $915 = 0, $916 = 0, $917 = 0;
 var $918 = 0, $919 = 0, $92 = 0, $920 = 0, $921 = 0, $922 = 0, $923 = 0, $924 = 0, $925 = 0, $926 = 0, $927 = 0, $928 = 0, $929 = 0, $93 = 0, $930 = 0, $931 = 0, $932 = 0, $933 = 0, $934 = 0, $935 = 0;
 var $936 = 0, $937 = 0, $938 = 0, $939 = 0, $94 = 0, $940 = 0, $941 = 0, $942 = 0, $943 = 0, $944 = 0, $945 = 0, $946 = 0, $947 = 0, $948 = 0, $949 = 0, $95 = 0, $950 = 0, $951 = 0, $952 = 0, $953 = 0;
 var $954 = 0, $955 = 0, $956 = 0, $957 = 0, $958 = 0, $959 = 0, $96 = 0, $960 = 0, $961 = 0, $962 = 0, $963 = 0, $964 = 0, $965 = 0, $966 = 0, $967 = 0, $968 = 0, $969 = 0, $97 = 0, $970 = 0, $971 = 0;
 var $972 = 0, $973 = 0, $974 = 0, $975 = 0, $976 = 0, $977 = 0, $978 = 0, $979 = 0, $98 = 0, $99 = 0, $cond$i = 0, $cond$i$i = 0, $cond$i203 = 0, $not$$i = 0, $or$cond$i = 0, $or$cond$i199 = 0, $or$cond1$i = 0, $or$cond1$i197 = 0, $or$cond11$i = 0, $or$cond2$i = 0;
 var $or$cond5$i = 0, $or$cond50$i = 0, $or$cond51$i = 0, $or$cond6$i = 0, $or$cond7$i = 0, $or$cond8$i = 0, $or$cond8$not$i = 0, $spec$select$i = 0, $spec$select$i201 = 0, $spec$select1$i = 0, $spec$select2$i = 0, $spec$select4$i = 0, $spec$select49$i = 0, $spec$select9$i = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = sp;
 $2 = ($0>>>0)<(245);
 do {
  if ($2) {
   $3 = ($0>>>0)<(11);
   $4 = (($0) + 11)|0;
   $5 = $4 & -8;
   $6 = $3 ? 16 : $5;
   $7 = $6 >>> 3;
   $8 = HEAP32[8086]|0;
   $9 = $8 >>> $7;
   $10 = $9 & 3;
   $11 = ($10|0)==(0);
   if (!($11)) {
    $12 = $9 & 1;
    $13 = $12 ^ 1;
    $14 = (($13) + ($7))|0;
    $15 = $14 << 1;
    $16 = (32384 + ($15<<2)|0);
    $17 = ((($16)) + 8|0);
    $18 = HEAP32[$17>>2]|0;
    $19 = ((($18)) + 8|0);
    $20 = HEAP32[$19>>2]|0;
    $21 = ($20|0)==($16|0);
    if ($21) {
     $22 = 1 << $14;
     $23 = $22 ^ -1;
     $24 = $8 & $23;
     HEAP32[8086] = $24;
    } else {
     $25 = ((($20)) + 12|0);
     HEAP32[$25>>2] = $16;
     HEAP32[$17>>2] = $20;
    }
    $26 = $14 << 3;
    $27 = $26 | 3;
    $28 = ((($18)) + 4|0);
    HEAP32[$28>>2] = $27;
    $29 = (($18) + ($26)|0);
    $30 = ((($29)) + 4|0);
    $31 = HEAP32[$30>>2]|0;
    $32 = $31 | 1;
    HEAP32[$30>>2] = $32;
    $$0 = $19;
    STACKTOP = sp;return ($$0|0);
   }
   $33 = HEAP32[(32352)>>2]|0;
   $34 = ($6>>>0)>($33>>>0);
   if ($34) {
    $35 = ($9|0)==(0);
    if (!($35)) {
     $36 = $9 << $7;
     $37 = 2 << $7;
     $38 = (0 - ($37))|0;
     $39 = $37 | $38;
     $40 = $36 & $39;
     $41 = (0 - ($40))|0;
     $42 = $40 & $41;
     $43 = (($42) + -1)|0;
     $44 = $43 >>> 12;
     $45 = $44 & 16;
     $46 = $43 >>> $45;
     $47 = $46 >>> 5;
     $48 = $47 & 8;
     $49 = $48 | $45;
     $50 = $46 >>> $48;
     $51 = $50 >>> 2;
     $52 = $51 & 4;
     $53 = $49 | $52;
     $54 = $50 >>> $52;
     $55 = $54 >>> 1;
     $56 = $55 & 2;
     $57 = $53 | $56;
     $58 = $54 >>> $56;
     $59 = $58 >>> 1;
     $60 = $59 & 1;
     $61 = $57 | $60;
     $62 = $58 >>> $60;
     $63 = (($61) + ($62))|0;
     $64 = $63 << 1;
     $65 = (32384 + ($64<<2)|0);
     $66 = ((($65)) + 8|0);
     $67 = HEAP32[$66>>2]|0;
     $68 = ((($67)) + 8|0);
     $69 = HEAP32[$68>>2]|0;
     $70 = ($69|0)==($65|0);
     if ($70) {
      $71 = 1 << $63;
      $72 = $71 ^ -1;
      $73 = $8 & $72;
      HEAP32[8086] = $73;
      $90 = $73;
     } else {
      $74 = ((($69)) + 12|0);
      HEAP32[$74>>2] = $65;
      HEAP32[$66>>2] = $69;
      $90 = $8;
     }
     $75 = $63 << 3;
     $76 = (($75) - ($6))|0;
     $77 = $6 | 3;
     $78 = ((($67)) + 4|0);
     HEAP32[$78>>2] = $77;
     $79 = (($67) + ($6)|0);
     $80 = $76 | 1;
     $81 = ((($79)) + 4|0);
     HEAP32[$81>>2] = $80;
     $82 = (($67) + ($75)|0);
     HEAP32[$82>>2] = $76;
     $83 = ($33|0)==(0);
     if (!($83)) {
      $84 = HEAP32[(32364)>>2]|0;
      $85 = $33 >>> 3;
      $86 = $85 << 1;
      $87 = (32384 + ($86<<2)|0);
      $88 = 1 << $85;
      $89 = $90 & $88;
      $91 = ($89|0)==(0);
      if ($91) {
       $92 = $90 | $88;
       HEAP32[8086] = $92;
       $$pre = ((($87)) + 8|0);
       $$0194 = $87;$$pre$phiZ2D = $$pre;
      } else {
       $93 = ((($87)) + 8|0);
       $94 = HEAP32[$93>>2]|0;
       $$0194 = $94;$$pre$phiZ2D = $93;
      }
      HEAP32[$$pre$phiZ2D>>2] = $84;
      $95 = ((($$0194)) + 12|0);
      HEAP32[$95>>2] = $84;
      $96 = ((($84)) + 8|0);
      HEAP32[$96>>2] = $$0194;
      $97 = ((($84)) + 12|0);
      HEAP32[$97>>2] = $87;
     }
     HEAP32[(32352)>>2] = $76;
     HEAP32[(32364)>>2] = $79;
     $$0 = $68;
     STACKTOP = sp;return ($$0|0);
    }
    $98 = HEAP32[(32348)>>2]|0;
    $99 = ($98|0)==(0);
    if ($99) {
     $$0192 = $6;
    } else {
     $100 = (0 - ($98))|0;
     $101 = $98 & $100;
     $102 = (($101) + -1)|0;
     $103 = $102 >>> 12;
     $104 = $103 & 16;
     $105 = $102 >>> $104;
     $106 = $105 >>> 5;
     $107 = $106 & 8;
     $108 = $107 | $104;
     $109 = $105 >>> $107;
     $110 = $109 >>> 2;
     $111 = $110 & 4;
     $112 = $108 | $111;
     $113 = $109 >>> $111;
     $114 = $113 >>> 1;
     $115 = $114 & 2;
     $116 = $112 | $115;
     $117 = $113 >>> $115;
     $118 = $117 >>> 1;
     $119 = $118 & 1;
     $120 = $116 | $119;
     $121 = $117 >>> $119;
     $122 = (($120) + ($121))|0;
     $123 = (32648 + ($122<<2)|0);
     $124 = HEAP32[$123>>2]|0;
     $125 = ((($124)) + 4|0);
     $126 = HEAP32[$125>>2]|0;
     $127 = $126 & -8;
     $128 = (($127) - ($6))|0;
     $$0169$i = $124;$$0170$i = $124;$$0171$i = $128;
     while(1) {
      $129 = ((($$0169$i)) + 16|0);
      $130 = HEAP32[$129>>2]|0;
      $131 = ($130|0)==(0|0);
      if ($131) {
       $132 = ((($$0169$i)) + 20|0);
       $133 = HEAP32[$132>>2]|0;
       $134 = ($133|0)==(0|0);
       if ($134) {
        break;
       } else {
        $136 = $133;
       }
      } else {
       $136 = $130;
      }
      $135 = ((($136)) + 4|0);
      $137 = HEAP32[$135>>2]|0;
      $138 = $137 & -8;
      $139 = (($138) - ($6))|0;
      $140 = ($139>>>0)<($$0171$i>>>0);
      $spec$select$i = $140 ? $139 : $$0171$i;
      $spec$select1$i = $140 ? $136 : $$0170$i;
      $$0169$i = $136;$$0170$i = $spec$select1$i;$$0171$i = $spec$select$i;
     }
     $141 = (($$0170$i) + ($6)|0);
     $142 = ($141>>>0)>($$0170$i>>>0);
     if ($142) {
      $143 = ((($$0170$i)) + 24|0);
      $144 = HEAP32[$143>>2]|0;
      $145 = ((($$0170$i)) + 12|0);
      $146 = HEAP32[$145>>2]|0;
      $147 = ($146|0)==($$0170$i|0);
      do {
       if ($147) {
        $152 = ((($$0170$i)) + 20|0);
        $153 = HEAP32[$152>>2]|0;
        $154 = ($153|0)==(0|0);
        if ($154) {
         $155 = ((($$0170$i)) + 16|0);
         $156 = HEAP32[$155>>2]|0;
         $157 = ($156|0)==(0|0);
         if ($157) {
          $$3$i = 0;
          break;
         } else {
          $$1174$i$ph = $156;$$1176$i$ph = $155;
         }
        } else {
         $$1174$i$ph = $153;$$1176$i$ph = $152;
        }
        $$1174$i = $$1174$i$ph;$$1176$i = $$1176$i$ph;
        while(1) {
         $158 = ((($$1174$i)) + 20|0);
         $159 = HEAP32[$158>>2]|0;
         $160 = ($159|0)==(0|0);
         if ($160) {
          $161 = ((($$1174$i)) + 16|0);
          $162 = HEAP32[$161>>2]|0;
          $163 = ($162|0)==(0|0);
          if ($163) {
           break;
          } else {
           $$1174$i$be = $162;$$1176$i$be = $161;
          }
         } else {
          $$1174$i$be = $159;$$1176$i$be = $158;
         }
         $$1174$i = $$1174$i$be;$$1176$i = $$1176$i$be;
        }
        HEAP32[$$1176$i>>2] = 0;
        $$3$i = $$1174$i;
       } else {
        $148 = ((($$0170$i)) + 8|0);
        $149 = HEAP32[$148>>2]|0;
        $150 = ((($149)) + 12|0);
        HEAP32[$150>>2] = $146;
        $151 = ((($146)) + 8|0);
        HEAP32[$151>>2] = $149;
        $$3$i = $146;
       }
      } while(0);
      $164 = ($144|0)==(0|0);
      do {
       if (!($164)) {
        $165 = ((($$0170$i)) + 28|0);
        $166 = HEAP32[$165>>2]|0;
        $167 = (32648 + ($166<<2)|0);
        $168 = HEAP32[$167>>2]|0;
        $169 = ($$0170$i|0)==($168|0);
        if ($169) {
         HEAP32[$167>>2] = $$3$i;
         $cond$i = ($$3$i|0)==(0|0);
         if ($cond$i) {
          $170 = 1 << $166;
          $171 = $170 ^ -1;
          $172 = $98 & $171;
          HEAP32[(32348)>>2] = $172;
          break;
         }
        } else {
         $173 = ((($144)) + 16|0);
         $174 = HEAP32[$173>>2]|0;
         $175 = ($174|0)==($$0170$i|0);
         $176 = ((($144)) + 20|0);
         $$sink = $175 ? $173 : $176;
         HEAP32[$$sink>>2] = $$3$i;
         $177 = ($$3$i|0)==(0|0);
         if ($177) {
          break;
         }
        }
        $178 = ((($$3$i)) + 24|0);
        HEAP32[$178>>2] = $144;
        $179 = ((($$0170$i)) + 16|0);
        $180 = HEAP32[$179>>2]|0;
        $181 = ($180|0)==(0|0);
        if (!($181)) {
         $182 = ((($$3$i)) + 16|0);
         HEAP32[$182>>2] = $180;
         $183 = ((($180)) + 24|0);
         HEAP32[$183>>2] = $$3$i;
        }
        $184 = ((($$0170$i)) + 20|0);
        $185 = HEAP32[$184>>2]|0;
        $186 = ($185|0)==(0|0);
        if (!($186)) {
         $187 = ((($$3$i)) + 20|0);
         HEAP32[$187>>2] = $185;
         $188 = ((($185)) + 24|0);
         HEAP32[$188>>2] = $$3$i;
        }
       }
      } while(0);
      $189 = ($$0171$i>>>0)<(16);
      if ($189) {
       $190 = (($$0171$i) + ($6))|0;
       $191 = $190 | 3;
       $192 = ((($$0170$i)) + 4|0);
       HEAP32[$192>>2] = $191;
       $193 = (($$0170$i) + ($190)|0);
       $194 = ((($193)) + 4|0);
       $195 = HEAP32[$194>>2]|0;
       $196 = $195 | 1;
       HEAP32[$194>>2] = $196;
      } else {
       $197 = $6 | 3;
       $198 = ((($$0170$i)) + 4|0);
       HEAP32[$198>>2] = $197;
       $199 = $$0171$i | 1;
       $200 = ((($141)) + 4|0);
       HEAP32[$200>>2] = $199;
       $201 = (($141) + ($$0171$i)|0);
       HEAP32[$201>>2] = $$0171$i;
       $202 = ($33|0)==(0);
       if (!($202)) {
        $203 = HEAP32[(32364)>>2]|0;
        $204 = $33 >>> 3;
        $205 = $204 << 1;
        $206 = (32384 + ($205<<2)|0);
        $207 = 1 << $204;
        $208 = $207 & $8;
        $209 = ($208|0)==(0);
        if ($209) {
         $210 = $207 | $8;
         HEAP32[8086] = $210;
         $$pre$i = ((($206)) + 8|0);
         $$0$i = $206;$$pre$phi$iZ2D = $$pre$i;
        } else {
         $211 = ((($206)) + 8|0);
         $212 = HEAP32[$211>>2]|0;
         $$0$i = $212;$$pre$phi$iZ2D = $211;
        }
        HEAP32[$$pre$phi$iZ2D>>2] = $203;
        $213 = ((($$0$i)) + 12|0);
        HEAP32[$213>>2] = $203;
        $214 = ((($203)) + 8|0);
        HEAP32[$214>>2] = $$0$i;
        $215 = ((($203)) + 12|0);
        HEAP32[$215>>2] = $206;
       }
       HEAP32[(32352)>>2] = $$0171$i;
       HEAP32[(32364)>>2] = $141;
      }
      $216 = ((($$0170$i)) + 8|0);
      $$0 = $216;
      STACKTOP = sp;return ($$0|0);
     } else {
      $$0192 = $6;
     }
    }
   } else {
    $$0192 = $6;
   }
  } else {
   $217 = ($0>>>0)>(4294967231);
   if ($217) {
    $$0192 = -1;
   } else {
    $218 = (($0) + 11)|0;
    $219 = $218 & -8;
    $220 = HEAP32[(32348)>>2]|0;
    $221 = ($220|0)==(0);
    if ($221) {
     $$0192 = $219;
    } else {
     $222 = (0 - ($219))|0;
     $223 = $218 >>> 8;
     $224 = ($223|0)==(0);
     if ($224) {
      $$0335$i = 0;
     } else {
      $225 = ($219>>>0)>(16777215);
      if ($225) {
       $$0335$i = 31;
      } else {
       $226 = (($223) + 1048320)|0;
       $227 = $226 >>> 16;
       $228 = $227 & 8;
       $229 = $223 << $228;
       $230 = (($229) + 520192)|0;
       $231 = $230 >>> 16;
       $232 = $231 & 4;
       $233 = $232 | $228;
       $234 = $229 << $232;
       $235 = (($234) + 245760)|0;
       $236 = $235 >>> 16;
       $237 = $236 & 2;
       $238 = $233 | $237;
       $239 = (14 - ($238))|0;
       $240 = $234 << $237;
       $241 = $240 >>> 15;
       $242 = (($239) + ($241))|0;
       $243 = $242 << 1;
       $244 = (($242) + 7)|0;
       $245 = $219 >>> $244;
       $246 = $245 & 1;
       $247 = $246 | $243;
       $$0335$i = $247;
      }
     }
     $248 = (32648 + ($$0335$i<<2)|0);
     $249 = HEAP32[$248>>2]|0;
     $250 = ($249|0)==(0|0);
     L79: do {
      if ($250) {
       $$2331$i = 0;$$3$i198 = 0;$$3326$i = $222;
       label = 61;
      } else {
       $251 = ($$0335$i|0)==(31);
       $252 = $$0335$i >>> 1;
       $253 = (25 - ($252))|0;
       $254 = $251 ? 0 : $253;
       $255 = $219 << $254;
       $$0318$i = 0;$$0323$i = $222;$$0329$i = $249;$$0336$i = $255;$$0339$i = 0;
       while(1) {
        $256 = ((($$0329$i)) + 4|0);
        $257 = HEAP32[$256>>2]|0;
        $258 = $257 & -8;
        $259 = (($258) - ($219))|0;
        $260 = ($259>>>0)<($$0323$i>>>0);
        if ($260) {
         $261 = ($259|0)==(0);
         if ($261) {
          $$415$i$ph = $$0329$i;$$432714$i$ph = 0;$$533413$i$ph = $$0329$i;
          label = 65;
          break L79;
         } else {
          $$1319$i = $$0329$i;$$1324$i = $259;
         }
        } else {
         $$1319$i = $$0318$i;$$1324$i = $$0323$i;
        }
        $262 = ((($$0329$i)) + 20|0);
        $263 = HEAP32[$262>>2]|0;
        $264 = $$0336$i >>> 31;
        $265 = (((($$0329$i)) + 16|0) + ($264<<2)|0);
        $266 = HEAP32[$265>>2]|0;
        $267 = ($263|0)==(0|0);
        $268 = ($263|0)==($266|0);
        $or$cond1$i197 = $267 | $268;
        $$1340$i = $or$cond1$i197 ? $$0339$i : $263;
        $269 = ($266|0)==(0|0);
        $spec$select4$i = $$0336$i << 1;
        if ($269) {
         $$2331$i = $$1340$i;$$3$i198 = $$1319$i;$$3326$i = $$1324$i;
         label = 61;
         break;
        } else {
         $$0318$i = $$1319$i;$$0323$i = $$1324$i;$$0329$i = $266;$$0336$i = $spec$select4$i;$$0339$i = $$1340$i;
        }
       }
      }
     } while(0);
     if ((label|0) == 61) {
      $270 = ($$2331$i|0)==(0|0);
      $271 = ($$3$i198|0)==(0|0);
      $or$cond$i199 = $270 & $271;
      if ($or$cond$i199) {
       $272 = 2 << $$0335$i;
       $273 = (0 - ($272))|0;
       $274 = $272 | $273;
       $275 = $274 & $220;
       $276 = ($275|0)==(0);
       if ($276) {
        $$0192 = $219;
        break;
       }
       $277 = (0 - ($275))|0;
       $278 = $275 & $277;
       $279 = (($278) + -1)|0;
       $280 = $279 >>> 12;
       $281 = $280 & 16;
       $282 = $279 >>> $281;
       $283 = $282 >>> 5;
       $284 = $283 & 8;
       $285 = $284 | $281;
       $286 = $282 >>> $284;
       $287 = $286 >>> 2;
       $288 = $287 & 4;
       $289 = $285 | $288;
       $290 = $286 >>> $288;
       $291 = $290 >>> 1;
       $292 = $291 & 2;
       $293 = $289 | $292;
       $294 = $290 >>> $292;
       $295 = $294 >>> 1;
       $296 = $295 & 1;
       $297 = $293 | $296;
       $298 = $294 >>> $296;
       $299 = (($297) + ($298))|0;
       $300 = (32648 + ($299<<2)|0);
       $301 = HEAP32[$300>>2]|0;
       $$3$i198211 = 0;$$4333$i = $301;
      } else {
       $$3$i198211 = $$3$i198;$$4333$i = $$2331$i;
      }
      $302 = ($$4333$i|0)==(0|0);
      if ($302) {
       $$4$lcssa$i = $$3$i198211;$$4327$lcssa$i = $$3326$i;
      } else {
       $$415$i$ph = $$3$i198211;$$432714$i$ph = $$3326$i;$$533413$i$ph = $$4333$i;
       label = 65;
      }
     }
     if ((label|0) == 65) {
      $$415$i = $$415$i$ph;$$432714$i = $$432714$i$ph;$$533413$i = $$533413$i$ph;
      while(1) {
       $303 = ((($$533413$i)) + 4|0);
       $304 = HEAP32[$303>>2]|0;
       $305 = $304 & -8;
       $306 = (($305) - ($219))|0;
       $307 = ($306>>>0)<($$432714$i>>>0);
       $spec$select$i201 = $307 ? $306 : $$432714$i;
       $spec$select2$i = $307 ? $$533413$i : $$415$i;
       $308 = ((($$533413$i)) + 16|0);
       $309 = HEAP32[$308>>2]|0;
       $310 = ($309|0)==(0|0);
       if ($310) {
        $311 = ((($$533413$i)) + 20|0);
        $312 = HEAP32[$311>>2]|0;
        $313 = $312;
       } else {
        $313 = $309;
       }
       $314 = ($313|0)==(0|0);
       if ($314) {
        $$4$lcssa$i = $spec$select2$i;$$4327$lcssa$i = $spec$select$i201;
        break;
       } else {
        $$415$i = $spec$select2$i;$$432714$i = $spec$select$i201;$$533413$i = $313;
       }
      }
     }
     $315 = ($$4$lcssa$i|0)==(0|0);
     if ($315) {
      $$0192 = $219;
     } else {
      $316 = HEAP32[(32352)>>2]|0;
      $317 = (($316) - ($219))|0;
      $318 = ($$4327$lcssa$i>>>0)<($317>>>0);
      if ($318) {
       $319 = (($$4$lcssa$i) + ($219)|0);
       $320 = ($319>>>0)>($$4$lcssa$i>>>0);
       if ($320) {
        $321 = ((($$4$lcssa$i)) + 24|0);
        $322 = HEAP32[$321>>2]|0;
        $323 = ((($$4$lcssa$i)) + 12|0);
        $324 = HEAP32[$323>>2]|0;
        $325 = ($324|0)==($$4$lcssa$i|0);
        do {
         if ($325) {
          $330 = ((($$4$lcssa$i)) + 20|0);
          $331 = HEAP32[$330>>2]|0;
          $332 = ($331|0)==(0|0);
          if ($332) {
           $333 = ((($$4$lcssa$i)) + 16|0);
           $334 = HEAP32[$333>>2]|0;
           $335 = ($334|0)==(0|0);
           if ($335) {
            $$3348$i = 0;
            break;
           } else {
            $$1346$i$ph = $334;$$1350$i$ph = $333;
           }
          } else {
           $$1346$i$ph = $331;$$1350$i$ph = $330;
          }
          $$1346$i = $$1346$i$ph;$$1350$i = $$1350$i$ph;
          while(1) {
           $336 = ((($$1346$i)) + 20|0);
           $337 = HEAP32[$336>>2]|0;
           $338 = ($337|0)==(0|0);
           if ($338) {
            $339 = ((($$1346$i)) + 16|0);
            $340 = HEAP32[$339>>2]|0;
            $341 = ($340|0)==(0|0);
            if ($341) {
             break;
            } else {
             $$1346$i$be = $340;$$1350$i$be = $339;
            }
           } else {
            $$1346$i$be = $337;$$1350$i$be = $336;
           }
           $$1346$i = $$1346$i$be;$$1350$i = $$1350$i$be;
          }
          HEAP32[$$1350$i>>2] = 0;
          $$3348$i = $$1346$i;
         } else {
          $326 = ((($$4$lcssa$i)) + 8|0);
          $327 = HEAP32[$326>>2]|0;
          $328 = ((($327)) + 12|0);
          HEAP32[$328>>2] = $324;
          $329 = ((($324)) + 8|0);
          HEAP32[$329>>2] = $327;
          $$3348$i = $324;
         }
        } while(0);
        $342 = ($322|0)==(0|0);
        do {
         if ($342) {
          $425 = $220;
         } else {
          $343 = ((($$4$lcssa$i)) + 28|0);
          $344 = HEAP32[$343>>2]|0;
          $345 = (32648 + ($344<<2)|0);
          $346 = HEAP32[$345>>2]|0;
          $347 = ($$4$lcssa$i|0)==($346|0);
          if ($347) {
           HEAP32[$345>>2] = $$3348$i;
           $cond$i203 = ($$3348$i|0)==(0|0);
           if ($cond$i203) {
            $348 = 1 << $344;
            $349 = $348 ^ -1;
            $350 = $220 & $349;
            HEAP32[(32348)>>2] = $350;
            $425 = $350;
            break;
           }
          } else {
           $351 = ((($322)) + 16|0);
           $352 = HEAP32[$351>>2]|0;
           $353 = ($352|0)==($$4$lcssa$i|0);
           $354 = ((($322)) + 20|0);
           $$sink320 = $353 ? $351 : $354;
           HEAP32[$$sink320>>2] = $$3348$i;
           $355 = ($$3348$i|0)==(0|0);
           if ($355) {
            $425 = $220;
            break;
           }
          }
          $356 = ((($$3348$i)) + 24|0);
          HEAP32[$356>>2] = $322;
          $357 = ((($$4$lcssa$i)) + 16|0);
          $358 = HEAP32[$357>>2]|0;
          $359 = ($358|0)==(0|0);
          if (!($359)) {
           $360 = ((($$3348$i)) + 16|0);
           HEAP32[$360>>2] = $358;
           $361 = ((($358)) + 24|0);
           HEAP32[$361>>2] = $$3348$i;
          }
          $362 = ((($$4$lcssa$i)) + 20|0);
          $363 = HEAP32[$362>>2]|0;
          $364 = ($363|0)==(0|0);
          if ($364) {
           $425 = $220;
          } else {
           $365 = ((($$3348$i)) + 20|0);
           HEAP32[$365>>2] = $363;
           $366 = ((($363)) + 24|0);
           HEAP32[$366>>2] = $$3348$i;
           $425 = $220;
          }
         }
        } while(0);
        $367 = ($$4327$lcssa$i>>>0)<(16);
        L128: do {
         if ($367) {
          $368 = (($$4327$lcssa$i) + ($219))|0;
          $369 = $368 | 3;
          $370 = ((($$4$lcssa$i)) + 4|0);
          HEAP32[$370>>2] = $369;
          $371 = (($$4$lcssa$i) + ($368)|0);
          $372 = ((($371)) + 4|0);
          $373 = HEAP32[$372>>2]|0;
          $374 = $373 | 1;
          HEAP32[$372>>2] = $374;
         } else {
          $375 = $219 | 3;
          $376 = ((($$4$lcssa$i)) + 4|0);
          HEAP32[$376>>2] = $375;
          $377 = $$4327$lcssa$i | 1;
          $378 = ((($319)) + 4|0);
          HEAP32[$378>>2] = $377;
          $379 = (($319) + ($$4327$lcssa$i)|0);
          HEAP32[$379>>2] = $$4327$lcssa$i;
          $380 = $$4327$lcssa$i >>> 3;
          $381 = ($$4327$lcssa$i>>>0)<(256);
          if ($381) {
           $382 = $380 << 1;
           $383 = (32384 + ($382<<2)|0);
           $384 = HEAP32[8086]|0;
           $385 = 1 << $380;
           $386 = $384 & $385;
           $387 = ($386|0)==(0);
           if ($387) {
            $388 = $384 | $385;
            HEAP32[8086] = $388;
            $$pre$i204 = ((($383)) + 8|0);
            $$0344$i = $383;$$pre$phi$i205Z2D = $$pre$i204;
           } else {
            $389 = ((($383)) + 8|0);
            $390 = HEAP32[$389>>2]|0;
            $$0344$i = $390;$$pre$phi$i205Z2D = $389;
           }
           HEAP32[$$pre$phi$i205Z2D>>2] = $319;
           $391 = ((($$0344$i)) + 12|0);
           HEAP32[$391>>2] = $319;
           $392 = ((($319)) + 8|0);
           HEAP32[$392>>2] = $$0344$i;
           $393 = ((($319)) + 12|0);
           HEAP32[$393>>2] = $383;
           break;
          }
          $394 = $$4327$lcssa$i >>> 8;
          $395 = ($394|0)==(0);
          if ($395) {
           $$0338$i = 0;
          } else {
           $396 = ($$4327$lcssa$i>>>0)>(16777215);
           if ($396) {
            $$0338$i = 31;
           } else {
            $397 = (($394) + 1048320)|0;
            $398 = $397 >>> 16;
            $399 = $398 & 8;
            $400 = $394 << $399;
            $401 = (($400) + 520192)|0;
            $402 = $401 >>> 16;
            $403 = $402 & 4;
            $404 = $403 | $399;
            $405 = $400 << $403;
            $406 = (($405) + 245760)|0;
            $407 = $406 >>> 16;
            $408 = $407 & 2;
            $409 = $404 | $408;
            $410 = (14 - ($409))|0;
            $411 = $405 << $408;
            $412 = $411 >>> 15;
            $413 = (($410) + ($412))|0;
            $414 = $413 << 1;
            $415 = (($413) + 7)|0;
            $416 = $$4327$lcssa$i >>> $415;
            $417 = $416 & 1;
            $418 = $417 | $414;
            $$0338$i = $418;
           }
          }
          $419 = (32648 + ($$0338$i<<2)|0);
          $420 = ((($319)) + 28|0);
          HEAP32[$420>>2] = $$0338$i;
          $421 = ((($319)) + 16|0);
          $422 = ((($421)) + 4|0);
          HEAP32[$422>>2] = 0;
          HEAP32[$421>>2] = 0;
          $423 = 1 << $$0338$i;
          $424 = $425 & $423;
          $426 = ($424|0)==(0);
          if ($426) {
           $427 = $425 | $423;
           HEAP32[(32348)>>2] = $427;
           HEAP32[$419>>2] = $319;
           $428 = ((($319)) + 24|0);
           HEAP32[$428>>2] = $419;
           $429 = ((($319)) + 12|0);
           HEAP32[$429>>2] = $319;
           $430 = ((($319)) + 8|0);
           HEAP32[$430>>2] = $319;
           break;
          }
          $431 = HEAP32[$419>>2]|0;
          $432 = ((($431)) + 4|0);
          $433 = HEAP32[$432>>2]|0;
          $434 = $433 & -8;
          $435 = ($434|0)==($$4327$lcssa$i|0);
          L145: do {
           if ($435) {
            $$0321$lcssa$i = $431;
           } else {
            $436 = ($$0338$i|0)==(31);
            $437 = $$0338$i >>> 1;
            $438 = (25 - ($437))|0;
            $439 = $436 ? 0 : $438;
            $440 = $$4327$lcssa$i << $439;
            $$032012$i = $440;$$032111$i = $431;
            while(1) {
             $447 = $$032012$i >>> 31;
             $448 = (((($$032111$i)) + 16|0) + ($447<<2)|0);
             $443 = HEAP32[$448>>2]|0;
             $449 = ($443|0)==(0|0);
             if ($449) {
              break;
             }
             $441 = $$032012$i << 1;
             $442 = ((($443)) + 4|0);
             $444 = HEAP32[$442>>2]|0;
             $445 = $444 & -8;
             $446 = ($445|0)==($$4327$lcssa$i|0);
             if ($446) {
              $$0321$lcssa$i = $443;
              break L145;
             } else {
              $$032012$i = $441;$$032111$i = $443;
             }
            }
            HEAP32[$448>>2] = $319;
            $450 = ((($319)) + 24|0);
            HEAP32[$450>>2] = $$032111$i;
            $451 = ((($319)) + 12|0);
            HEAP32[$451>>2] = $319;
            $452 = ((($319)) + 8|0);
            HEAP32[$452>>2] = $319;
            break L128;
           }
          } while(0);
          $453 = ((($$0321$lcssa$i)) + 8|0);
          $454 = HEAP32[$453>>2]|0;
          $455 = ((($454)) + 12|0);
          HEAP32[$455>>2] = $319;
          HEAP32[$453>>2] = $319;
          $456 = ((($319)) + 8|0);
          HEAP32[$456>>2] = $454;
          $457 = ((($319)) + 12|0);
          HEAP32[$457>>2] = $$0321$lcssa$i;
          $458 = ((($319)) + 24|0);
          HEAP32[$458>>2] = 0;
         }
        } while(0);
        $459 = ((($$4$lcssa$i)) + 8|0);
        $$0 = $459;
        STACKTOP = sp;return ($$0|0);
       } else {
        $$0192 = $219;
       }
      } else {
       $$0192 = $219;
      }
     }
    }
   }
  }
 } while(0);
 $460 = HEAP32[(32352)>>2]|0;
 $461 = ($460>>>0)<($$0192>>>0);
 if (!($461)) {
  $462 = (($460) - ($$0192))|0;
  $463 = HEAP32[(32364)>>2]|0;
  $464 = ($462>>>0)>(15);
  if ($464) {
   $465 = (($463) + ($$0192)|0);
   HEAP32[(32364)>>2] = $465;
   HEAP32[(32352)>>2] = $462;
   $466 = $462 | 1;
   $467 = ((($465)) + 4|0);
   HEAP32[$467>>2] = $466;
   $468 = (($463) + ($460)|0);
   HEAP32[$468>>2] = $462;
   $469 = $$0192 | 3;
   $470 = ((($463)) + 4|0);
   HEAP32[$470>>2] = $469;
  } else {
   HEAP32[(32352)>>2] = 0;
   HEAP32[(32364)>>2] = 0;
   $471 = $460 | 3;
   $472 = ((($463)) + 4|0);
   HEAP32[$472>>2] = $471;
   $473 = (($463) + ($460)|0);
   $474 = ((($473)) + 4|0);
   $475 = HEAP32[$474>>2]|0;
   $476 = $475 | 1;
   HEAP32[$474>>2] = $476;
  }
  $477 = ((($463)) + 8|0);
  $$0 = $477;
  STACKTOP = sp;return ($$0|0);
 }
 $478 = HEAP32[(32356)>>2]|0;
 $479 = ($478>>>0)>($$0192>>>0);
 if ($479) {
  $480 = (($478) - ($$0192))|0;
  HEAP32[(32356)>>2] = $480;
  $481 = HEAP32[(32368)>>2]|0;
  $482 = (($481) + ($$0192)|0);
  HEAP32[(32368)>>2] = $482;
  $483 = $480 | 1;
  $484 = ((($482)) + 4|0);
  HEAP32[$484>>2] = $483;
  $485 = $$0192 | 3;
  $486 = ((($481)) + 4|0);
  HEAP32[$486>>2] = $485;
  $487 = ((($481)) + 8|0);
  $$0 = $487;
  STACKTOP = sp;return ($$0|0);
 }
 $488 = HEAP32[8204]|0;
 $489 = ($488|0)==(0);
 if ($489) {
  HEAP32[(32824)>>2] = 4096;
  HEAP32[(32820)>>2] = 4096;
  HEAP32[(32828)>>2] = -1;
  HEAP32[(32832)>>2] = -1;
  HEAP32[(32836)>>2] = 0;
  HEAP32[(32788)>>2] = 0;
  $490 = $1;
  $491 = $490 & -16;
  $492 = $491 ^ 1431655768;
  HEAP32[8204] = $492;
  $496 = 4096;
 } else {
  $$pre$i195 = HEAP32[(32824)>>2]|0;
  $496 = $$pre$i195;
 }
 $493 = (($$0192) + 48)|0;
 $494 = (($$0192) + 47)|0;
 $495 = (($496) + ($494))|0;
 $497 = (0 - ($496))|0;
 $498 = $495 & $497;
 $499 = ($498>>>0)>($$0192>>>0);
 if (!($499)) {
  $$0 = 0;
  STACKTOP = sp;return ($$0|0);
 }
 $500 = HEAP32[(32784)>>2]|0;
 $501 = ($500|0)==(0);
 if (!($501)) {
  $502 = HEAP32[(32776)>>2]|0;
  $503 = (($502) + ($498))|0;
  $504 = ($503>>>0)<=($502>>>0);
  $505 = ($503>>>0)>($500>>>0);
  $or$cond1$i = $504 | $505;
  if ($or$cond1$i) {
   $$0 = 0;
   STACKTOP = sp;return ($$0|0);
  }
 }
 $506 = HEAP32[(32788)>>2]|0;
 $507 = $506 & 4;
 $508 = ($507|0)==(0);
 L178: do {
  if ($508) {
   $509 = HEAP32[(32368)>>2]|0;
   $510 = ($509|0)==(0|0);
   L180: do {
    if ($510) {
     label = 128;
    } else {
     $$0$i20$i = (32792);
     while(1) {
      $511 = HEAP32[$$0$i20$i>>2]|0;
      $512 = ($511>>>0)>($509>>>0);
      if (!($512)) {
       $513 = ((($$0$i20$i)) + 4|0);
       $514 = HEAP32[$513>>2]|0;
       $515 = (($511) + ($514)|0);
       $516 = ($515>>>0)>($509>>>0);
       if ($516) {
        break;
       }
      }
      $517 = ((($$0$i20$i)) + 8|0);
      $518 = HEAP32[$517>>2]|0;
      $519 = ($518|0)==(0|0);
      if ($519) {
       label = 128;
       break L180;
      } else {
       $$0$i20$i = $518;
      }
     }
     $542 = (($495) - ($478))|0;
     $543 = $542 & $497;
     $544 = ($543>>>0)<(2147483647);
     if ($544) {
      $545 = ((($$0$i20$i)) + 4|0);
      $546 = (_sbrk(($543|0))|0);
      $547 = HEAP32[$$0$i20$i>>2]|0;
      $548 = HEAP32[$545>>2]|0;
      $549 = (($547) + ($548)|0);
      $550 = ($546|0)==($549|0);
      if ($550) {
       $551 = ($546|0)==((-1)|0);
       if ($551) {
        $$2234243136$i = $543;
       } else {
        $$723947$i = $543;$$748$i = $546;
        label = 145;
        break L178;
       }
      } else {
       $$2247$ph$i = $546;$$2253$ph$i = $543;
       label = 136;
      }
     } else {
      $$2234243136$i = 0;
     }
    }
   } while(0);
   do {
    if ((label|0) == 128) {
     $520 = (_sbrk(0)|0);
     $521 = ($520|0)==((-1)|0);
     if ($521) {
      $$2234243136$i = 0;
     } else {
      $522 = $520;
      $523 = HEAP32[(32820)>>2]|0;
      $524 = (($523) + -1)|0;
      $525 = $524 & $522;
      $526 = ($525|0)==(0);
      $527 = (($524) + ($522))|0;
      $528 = (0 - ($523))|0;
      $529 = $527 & $528;
      $530 = (($529) - ($522))|0;
      $531 = $526 ? 0 : $530;
      $spec$select49$i = (($531) + ($498))|0;
      $532 = HEAP32[(32776)>>2]|0;
      $533 = (($spec$select49$i) + ($532))|0;
      $534 = ($spec$select49$i>>>0)>($$0192>>>0);
      $535 = ($spec$select49$i>>>0)<(2147483647);
      $or$cond$i = $534 & $535;
      if ($or$cond$i) {
       $536 = HEAP32[(32784)>>2]|0;
       $537 = ($536|0)==(0);
       if (!($537)) {
        $538 = ($533>>>0)<=($532>>>0);
        $539 = ($533>>>0)>($536>>>0);
        $or$cond2$i = $538 | $539;
        if ($or$cond2$i) {
         $$2234243136$i = 0;
         break;
        }
       }
       $540 = (_sbrk(($spec$select49$i|0))|0);
       $541 = ($540|0)==($520|0);
       if ($541) {
        $$723947$i = $spec$select49$i;$$748$i = $520;
        label = 145;
        break L178;
       } else {
        $$2247$ph$i = $540;$$2253$ph$i = $spec$select49$i;
        label = 136;
       }
      } else {
       $$2234243136$i = 0;
      }
     }
    }
   } while(0);
   do {
    if ((label|0) == 136) {
     $552 = (0 - ($$2253$ph$i))|0;
     $553 = ($$2247$ph$i|0)!=((-1)|0);
     $554 = ($$2253$ph$i>>>0)<(2147483647);
     $or$cond7$i = $554 & $553;
     $555 = ($493>>>0)>($$2253$ph$i>>>0);
     $or$cond6$i = $555 & $or$cond7$i;
     if (!($or$cond6$i)) {
      $565 = ($$2247$ph$i|0)==((-1)|0);
      if ($565) {
       $$2234243136$i = 0;
       break;
      } else {
       $$723947$i = $$2253$ph$i;$$748$i = $$2247$ph$i;
       label = 145;
       break L178;
      }
     }
     $556 = HEAP32[(32824)>>2]|0;
     $557 = (($494) - ($$2253$ph$i))|0;
     $558 = (($557) + ($556))|0;
     $559 = (0 - ($556))|0;
     $560 = $558 & $559;
     $561 = ($560>>>0)<(2147483647);
     if (!($561)) {
      $$723947$i = $$2253$ph$i;$$748$i = $$2247$ph$i;
      label = 145;
      break L178;
     }
     $562 = (_sbrk(($560|0))|0);
     $563 = ($562|0)==((-1)|0);
     if ($563) {
      (_sbrk(($552|0))|0);
      $$2234243136$i = 0;
      break;
     } else {
      $564 = (($560) + ($$2253$ph$i))|0;
      $$723947$i = $564;$$748$i = $$2247$ph$i;
      label = 145;
      break L178;
     }
    }
   } while(0);
   $566 = HEAP32[(32788)>>2]|0;
   $567 = $566 | 4;
   HEAP32[(32788)>>2] = $567;
   $$4236$i = $$2234243136$i;
   label = 143;
  } else {
   $$4236$i = 0;
   label = 143;
  }
 } while(0);
 if ((label|0) == 143) {
  $568 = ($498>>>0)<(2147483647);
  if ($568) {
   $569 = (_sbrk(($498|0))|0);
   $570 = (_sbrk(0)|0);
   $571 = ($569|0)!=((-1)|0);
   $572 = ($570|0)!=((-1)|0);
   $or$cond5$i = $571 & $572;
   $573 = ($569>>>0)<($570>>>0);
   $or$cond8$i = $573 & $or$cond5$i;
   $574 = $570;
   $575 = $569;
   $576 = (($574) - ($575))|0;
   $577 = (($$0192) + 40)|0;
   $578 = ($576>>>0)>($577>>>0);
   $spec$select9$i = $578 ? $576 : $$4236$i;
   $or$cond8$not$i = $or$cond8$i ^ 1;
   $579 = ($569|0)==((-1)|0);
   $not$$i = $578 ^ 1;
   $580 = $579 | $not$$i;
   $or$cond50$i = $580 | $or$cond8$not$i;
   if (!($or$cond50$i)) {
    $$723947$i = $spec$select9$i;$$748$i = $569;
    label = 145;
   }
  }
 }
 if ((label|0) == 145) {
  $581 = HEAP32[(32776)>>2]|0;
  $582 = (($581) + ($$723947$i))|0;
  HEAP32[(32776)>>2] = $582;
  $583 = HEAP32[(32780)>>2]|0;
  $584 = ($582>>>0)>($583>>>0);
  if ($584) {
   HEAP32[(32780)>>2] = $582;
  }
  $585 = HEAP32[(32368)>>2]|0;
  $586 = ($585|0)==(0|0);
  L215: do {
   if ($586) {
    $587 = HEAP32[(32360)>>2]|0;
    $588 = ($587|0)==(0|0);
    $589 = ($$748$i>>>0)<($587>>>0);
    $or$cond11$i = $588 | $589;
    if ($or$cond11$i) {
     HEAP32[(32360)>>2] = $$748$i;
    }
    HEAP32[(32792)>>2] = $$748$i;
    HEAP32[(32796)>>2] = $$723947$i;
    HEAP32[(32804)>>2] = 0;
    $590 = HEAP32[8204]|0;
    HEAP32[(32380)>>2] = $590;
    HEAP32[(32376)>>2] = -1;
    HEAP32[(32396)>>2] = (32384);
    HEAP32[(32392)>>2] = (32384);
    HEAP32[(32404)>>2] = (32392);
    HEAP32[(32400)>>2] = (32392);
    HEAP32[(32412)>>2] = (32400);
    HEAP32[(32408)>>2] = (32400);
    HEAP32[(32420)>>2] = (32408);
    HEAP32[(32416)>>2] = (32408);
    HEAP32[(32428)>>2] = (32416);
    HEAP32[(32424)>>2] = (32416);
    HEAP32[(32436)>>2] = (32424);
    HEAP32[(32432)>>2] = (32424);
    HEAP32[(32444)>>2] = (32432);
    HEAP32[(32440)>>2] = (32432);
    HEAP32[(32452)>>2] = (32440);
    HEAP32[(32448)>>2] = (32440);
    HEAP32[(32460)>>2] = (32448);
    HEAP32[(32456)>>2] = (32448);
    HEAP32[(32468)>>2] = (32456);
    HEAP32[(32464)>>2] = (32456);
    HEAP32[(32476)>>2] = (32464);
    HEAP32[(32472)>>2] = (32464);
    HEAP32[(32484)>>2] = (32472);
    HEAP32[(32480)>>2] = (32472);
    HEAP32[(32492)>>2] = (32480);
    HEAP32[(32488)>>2] = (32480);
    HEAP32[(32500)>>2] = (32488);
    HEAP32[(32496)>>2] = (32488);
    HEAP32[(32508)>>2] = (32496);
    HEAP32[(32504)>>2] = (32496);
    HEAP32[(32516)>>2] = (32504);
    HEAP32[(32512)>>2] = (32504);
    HEAP32[(32524)>>2] = (32512);
    HEAP32[(32520)>>2] = (32512);
    HEAP32[(32532)>>2] = (32520);
    HEAP32[(32528)>>2] = (32520);
    HEAP32[(32540)>>2] = (32528);
    HEAP32[(32536)>>2] = (32528);
    HEAP32[(32548)>>2] = (32536);
    HEAP32[(32544)>>2] = (32536);
    HEAP32[(32556)>>2] = (32544);
    HEAP32[(32552)>>2] = (32544);
    HEAP32[(32564)>>2] = (32552);
    HEAP32[(32560)>>2] = (32552);
    HEAP32[(32572)>>2] = (32560);
    HEAP32[(32568)>>2] = (32560);
    HEAP32[(32580)>>2] = (32568);
    HEAP32[(32576)>>2] = (32568);
    HEAP32[(32588)>>2] = (32576);
    HEAP32[(32584)>>2] = (32576);
    HEAP32[(32596)>>2] = (32584);
    HEAP32[(32592)>>2] = (32584);
    HEAP32[(32604)>>2] = (32592);
    HEAP32[(32600)>>2] = (32592);
    HEAP32[(32612)>>2] = (32600);
    HEAP32[(32608)>>2] = (32600);
    HEAP32[(32620)>>2] = (32608);
    HEAP32[(32616)>>2] = (32608);
    HEAP32[(32628)>>2] = (32616);
    HEAP32[(32624)>>2] = (32616);
    HEAP32[(32636)>>2] = (32624);
    HEAP32[(32632)>>2] = (32624);
    HEAP32[(32644)>>2] = (32632);
    HEAP32[(32640)>>2] = (32632);
    $591 = (($$723947$i) + -40)|0;
    $592 = ((($$748$i)) + 8|0);
    $593 = $592;
    $594 = $593 & 7;
    $595 = ($594|0)==(0);
    $596 = (0 - ($593))|0;
    $597 = $596 & 7;
    $598 = $595 ? 0 : $597;
    $599 = (($$748$i) + ($598)|0);
    $600 = (($591) - ($598))|0;
    HEAP32[(32368)>>2] = $599;
    HEAP32[(32356)>>2] = $600;
    $601 = $600 | 1;
    $602 = ((($599)) + 4|0);
    HEAP32[$602>>2] = $601;
    $603 = (($$748$i) + ($591)|0);
    $604 = ((($603)) + 4|0);
    HEAP32[$604>>2] = 40;
    $605 = HEAP32[(32832)>>2]|0;
    HEAP32[(32372)>>2] = $605;
   } else {
    $$024372$i = (32792);
    while(1) {
     $606 = HEAP32[$$024372$i>>2]|0;
     $607 = ((($$024372$i)) + 4|0);
     $608 = HEAP32[$607>>2]|0;
     $609 = (($606) + ($608)|0);
     $610 = ($$748$i|0)==($609|0);
     if ($610) {
      label = 154;
      break;
     }
     $611 = ((($$024372$i)) + 8|0);
     $612 = HEAP32[$611>>2]|0;
     $613 = ($612|0)==(0|0);
     if ($613) {
      break;
     } else {
      $$024372$i = $612;
     }
    }
    if ((label|0) == 154) {
     $614 = ((($$024372$i)) + 4|0);
     $615 = ((($$024372$i)) + 12|0);
     $616 = HEAP32[$615>>2]|0;
     $617 = $616 & 8;
     $618 = ($617|0)==(0);
     if ($618) {
      $619 = ($606>>>0)<=($585>>>0);
      $620 = ($$748$i>>>0)>($585>>>0);
      $or$cond51$i = $620 & $619;
      if ($or$cond51$i) {
       $621 = (($608) + ($$723947$i))|0;
       HEAP32[$614>>2] = $621;
       $622 = HEAP32[(32356)>>2]|0;
       $623 = (($622) + ($$723947$i))|0;
       $624 = ((($585)) + 8|0);
       $625 = $624;
       $626 = $625 & 7;
       $627 = ($626|0)==(0);
       $628 = (0 - ($625))|0;
       $629 = $628 & 7;
       $630 = $627 ? 0 : $629;
       $631 = (($585) + ($630)|0);
       $632 = (($623) - ($630))|0;
       HEAP32[(32368)>>2] = $631;
       HEAP32[(32356)>>2] = $632;
       $633 = $632 | 1;
       $634 = ((($631)) + 4|0);
       HEAP32[$634>>2] = $633;
       $635 = (($585) + ($623)|0);
       $636 = ((($635)) + 4|0);
       HEAP32[$636>>2] = 40;
       $637 = HEAP32[(32832)>>2]|0;
       HEAP32[(32372)>>2] = $637;
       break;
      }
     }
    }
    $638 = HEAP32[(32360)>>2]|0;
    $639 = ($$748$i>>>0)<($638>>>0);
    if ($639) {
     HEAP32[(32360)>>2] = $$748$i;
    }
    $640 = (($$748$i) + ($$723947$i)|0);
    $$124471$i = (32792);
    while(1) {
     $641 = HEAP32[$$124471$i>>2]|0;
     $642 = ($641|0)==($640|0);
     if ($642) {
      label = 162;
      break;
     }
     $643 = ((($$124471$i)) + 8|0);
     $644 = HEAP32[$643>>2]|0;
     $645 = ($644|0)==(0|0);
     if ($645) {
      break;
     } else {
      $$124471$i = $644;
     }
    }
    if ((label|0) == 162) {
     $646 = ((($$124471$i)) + 12|0);
     $647 = HEAP32[$646>>2]|0;
     $648 = $647 & 8;
     $649 = ($648|0)==(0);
     if ($649) {
      HEAP32[$$124471$i>>2] = $$748$i;
      $650 = ((($$124471$i)) + 4|0);
      $651 = HEAP32[$650>>2]|0;
      $652 = (($651) + ($$723947$i))|0;
      HEAP32[$650>>2] = $652;
      $653 = ((($$748$i)) + 8|0);
      $654 = $653;
      $655 = $654 & 7;
      $656 = ($655|0)==(0);
      $657 = (0 - ($654))|0;
      $658 = $657 & 7;
      $659 = $656 ? 0 : $658;
      $660 = (($$748$i) + ($659)|0);
      $661 = ((($640)) + 8|0);
      $662 = $661;
      $663 = $662 & 7;
      $664 = ($663|0)==(0);
      $665 = (0 - ($662))|0;
      $666 = $665 & 7;
      $667 = $664 ? 0 : $666;
      $668 = (($640) + ($667)|0);
      $669 = $668;
      $670 = $660;
      $671 = (($669) - ($670))|0;
      $672 = (($660) + ($$0192)|0);
      $673 = (($671) - ($$0192))|0;
      $674 = $$0192 | 3;
      $675 = ((($660)) + 4|0);
      HEAP32[$675>>2] = $674;
      $676 = ($585|0)==($668|0);
      L238: do {
       if ($676) {
        $677 = HEAP32[(32356)>>2]|0;
        $678 = (($677) + ($673))|0;
        HEAP32[(32356)>>2] = $678;
        HEAP32[(32368)>>2] = $672;
        $679 = $678 | 1;
        $680 = ((($672)) + 4|0);
        HEAP32[$680>>2] = $679;
       } else {
        $681 = HEAP32[(32364)>>2]|0;
        $682 = ($681|0)==($668|0);
        if ($682) {
         $683 = HEAP32[(32352)>>2]|0;
         $684 = (($683) + ($673))|0;
         HEAP32[(32352)>>2] = $684;
         HEAP32[(32364)>>2] = $672;
         $685 = $684 | 1;
         $686 = ((($672)) + 4|0);
         HEAP32[$686>>2] = $685;
         $687 = (($672) + ($684)|0);
         HEAP32[$687>>2] = $684;
         break;
        }
        $688 = ((($668)) + 4|0);
        $689 = HEAP32[$688>>2]|0;
        $690 = $689 & 3;
        $691 = ($690|0)==(1);
        if ($691) {
         $692 = $689 & -8;
         $693 = $689 >>> 3;
         $694 = ($689>>>0)<(256);
         L246: do {
          if ($694) {
           $695 = ((($668)) + 8|0);
           $696 = HEAP32[$695>>2]|0;
           $697 = ((($668)) + 12|0);
           $698 = HEAP32[$697>>2]|0;
           $699 = ($698|0)==($696|0);
           if ($699) {
            $700 = 1 << $693;
            $701 = $700 ^ -1;
            $702 = HEAP32[8086]|0;
            $703 = $702 & $701;
            HEAP32[8086] = $703;
            break;
           } else {
            $704 = ((($696)) + 12|0);
            HEAP32[$704>>2] = $698;
            $705 = ((($698)) + 8|0);
            HEAP32[$705>>2] = $696;
            break;
           }
          } else {
           $706 = ((($668)) + 24|0);
           $707 = HEAP32[$706>>2]|0;
           $708 = ((($668)) + 12|0);
           $709 = HEAP32[$708>>2]|0;
           $710 = ($709|0)==($668|0);
           do {
            if ($710) {
             $715 = ((($668)) + 16|0);
             $716 = ((($715)) + 4|0);
             $717 = HEAP32[$716>>2]|0;
             $718 = ($717|0)==(0|0);
             if ($718) {
              $719 = HEAP32[$715>>2]|0;
              $720 = ($719|0)==(0|0);
              if ($720) {
               $$3$i$i = 0;
               break;
              } else {
               $$1263$i$i$ph = $719;$$1265$i$i$ph = $715;
              }
             } else {
              $$1263$i$i$ph = $717;$$1265$i$i$ph = $716;
             }
             $$1263$i$i = $$1263$i$i$ph;$$1265$i$i = $$1265$i$i$ph;
             while(1) {
              $721 = ((($$1263$i$i)) + 20|0);
              $722 = HEAP32[$721>>2]|0;
              $723 = ($722|0)==(0|0);
              if ($723) {
               $724 = ((($$1263$i$i)) + 16|0);
               $725 = HEAP32[$724>>2]|0;
               $726 = ($725|0)==(0|0);
               if ($726) {
                break;
               } else {
                $$1263$i$i$be = $725;$$1265$i$i$be = $724;
               }
              } else {
               $$1263$i$i$be = $722;$$1265$i$i$be = $721;
              }
              $$1263$i$i = $$1263$i$i$be;$$1265$i$i = $$1265$i$i$be;
             }
             HEAP32[$$1265$i$i>>2] = 0;
             $$3$i$i = $$1263$i$i;
            } else {
             $711 = ((($668)) + 8|0);
             $712 = HEAP32[$711>>2]|0;
             $713 = ((($712)) + 12|0);
             HEAP32[$713>>2] = $709;
             $714 = ((($709)) + 8|0);
             HEAP32[$714>>2] = $712;
             $$3$i$i = $709;
            }
           } while(0);
           $727 = ($707|0)==(0|0);
           if ($727) {
            break;
           }
           $728 = ((($668)) + 28|0);
           $729 = HEAP32[$728>>2]|0;
           $730 = (32648 + ($729<<2)|0);
           $731 = HEAP32[$730>>2]|0;
           $732 = ($731|0)==($668|0);
           do {
            if ($732) {
             HEAP32[$730>>2] = $$3$i$i;
             $cond$i$i = ($$3$i$i|0)==(0|0);
             if (!($cond$i$i)) {
              break;
             }
             $733 = 1 << $729;
             $734 = $733 ^ -1;
             $735 = HEAP32[(32348)>>2]|0;
             $736 = $735 & $734;
             HEAP32[(32348)>>2] = $736;
             break L246;
            } else {
             $737 = ((($707)) + 16|0);
             $738 = HEAP32[$737>>2]|0;
             $739 = ($738|0)==($668|0);
             $740 = ((($707)) + 20|0);
             $$sink321 = $739 ? $737 : $740;
             HEAP32[$$sink321>>2] = $$3$i$i;
             $741 = ($$3$i$i|0)==(0|0);
             if ($741) {
              break L246;
             }
            }
           } while(0);
           $742 = ((($$3$i$i)) + 24|0);
           HEAP32[$742>>2] = $707;
           $743 = ((($668)) + 16|0);
           $744 = HEAP32[$743>>2]|0;
           $745 = ($744|0)==(0|0);
           if (!($745)) {
            $746 = ((($$3$i$i)) + 16|0);
            HEAP32[$746>>2] = $744;
            $747 = ((($744)) + 24|0);
            HEAP32[$747>>2] = $$3$i$i;
           }
           $748 = ((($743)) + 4|0);
           $749 = HEAP32[$748>>2]|0;
           $750 = ($749|0)==(0|0);
           if ($750) {
            break;
           }
           $751 = ((($$3$i$i)) + 20|0);
           HEAP32[$751>>2] = $749;
           $752 = ((($749)) + 24|0);
           HEAP32[$752>>2] = $$3$i$i;
          }
         } while(0);
         $753 = (($668) + ($692)|0);
         $754 = (($692) + ($673))|0;
         $$0$i$i = $753;$$0259$i$i = $754;
        } else {
         $$0$i$i = $668;$$0259$i$i = $673;
        }
        $755 = ((($$0$i$i)) + 4|0);
        $756 = HEAP32[$755>>2]|0;
        $757 = $756 & -2;
        HEAP32[$755>>2] = $757;
        $758 = $$0259$i$i | 1;
        $759 = ((($672)) + 4|0);
        HEAP32[$759>>2] = $758;
        $760 = (($672) + ($$0259$i$i)|0);
        HEAP32[$760>>2] = $$0259$i$i;
        $761 = $$0259$i$i >>> 3;
        $762 = ($$0259$i$i>>>0)<(256);
        if ($762) {
         $763 = $761 << 1;
         $764 = (32384 + ($763<<2)|0);
         $765 = HEAP32[8086]|0;
         $766 = 1 << $761;
         $767 = $765 & $766;
         $768 = ($767|0)==(0);
         if ($768) {
          $769 = $765 | $766;
          HEAP32[8086] = $769;
          $$pre$i16$i = ((($764)) + 8|0);
          $$0267$i$i = $764;$$pre$phi$i17$iZ2D = $$pre$i16$i;
         } else {
          $770 = ((($764)) + 8|0);
          $771 = HEAP32[$770>>2]|0;
          $$0267$i$i = $771;$$pre$phi$i17$iZ2D = $770;
         }
         HEAP32[$$pre$phi$i17$iZ2D>>2] = $672;
         $772 = ((($$0267$i$i)) + 12|0);
         HEAP32[$772>>2] = $672;
         $773 = ((($672)) + 8|0);
         HEAP32[$773>>2] = $$0267$i$i;
         $774 = ((($672)) + 12|0);
         HEAP32[$774>>2] = $764;
         break;
        }
        $775 = $$0259$i$i >>> 8;
        $776 = ($775|0)==(0);
        do {
         if ($776) {
          $$0268$i$i = 0;
         } else {
          $777 = ($$0259$i$i>>>0)>(16777215);
          if ($777) {
           $$0268$i$i = 31;
           break;
          }
          $778 = (($775) + 1048320)|0;
          $779 = $778 >>> 16;
          $780 = $779 & 8;
          $781 = $775 << $780;
          $782 = (($781) + 520192)|0;
          $783 = $782 >>> 16;
          $784 = $783 & 4;
          $785 = $784 | $780;
          $786 = $781 << $784;
          $787 = (($786) + 245760)|0;
          $788 = $787 >>> 16;
          $789 = $788 & 2;
          $790 = $785 | $789;
          $791 = (14 - ($790))|0;
          $792 = $786 << $789;
          $793 = $792 >>> 15;
          $794 = (($791) + ($793))|0;
          $795 = $794 << 1;
          $796 = (($794) + 7)|0;
          $797 = $$0259$i$i >>> $796;
          $798 = $797 & 1;
          $799 = $798 | $795;
          $$0268$i$i = $799;
         }
        } while(0);
        $800 = (32648 + ($$0268$i$i<<2)|0);
        $801 = ((($672)) + 28|0);
        HEAP32[$801>>2] = $$0268$i$i;
        $802 = ((($672)) + 16|0);
        $803 = ((($802)) + 4|0);
        HEAP32[$803>>2] = 0;
        HEAP32[$802>>2] = 0;
        $804 = HEAP32[(32348)>>2]|0;
        $805 = 1 << $$0268$i$i;
        $806 = $804 & $805;
        $807 = ($806|0)==(0);
        if ($807) {
         $808 = $804 | $805;
         HEAP32[(32348)>>2] = $808;
         HEAP32[$800>>2] = $672;
         $809 = ((($672)) + 24|0);
         HEAP32[$809>>2] = $800;
         $810 = ((($672)) + 12|0);
         HEAP32[$810>>2] = $672;
         $811 = ((($672)) + 8|0);
         HEAP32[$811>>2] = $672;
         break;
        }
        $812 = HEAP32[$800>>2]|0;
        $813 = ((($812)) + 4|0);
        $814 = HEAP32[$813>>2]|0;
        $815 = $814 & -8;
        $816 = ($815|0)==($$0259$i$i|0);
        L291: do {
         if ($816) {
          $$0261$lcssa$i$i = $812;
         } else {
          $817 = ($$0268$i$i|0)==(31);
          $818 = $$0268$i$i >>> 1;
          $819 = (25 - ($818))|0;
          $820 = $817 ? 0 : $819;
          $821 = $$0259$i$i << $820;
          $$02604$i$i = $821;$$02613$i$i = $812;
          while(1) {
           $828 = $$02604$i$i >>> 31;
           $829 = (((($$02613$i$i)) + 16|0) + ($828<<2)|0);
           $824 = HEAP32[$829>>2]|0;
           $830 = ($824|0)==(0|0);
           if ($830) {
            break;
           }
           $822 = $$02604$i$i << 1;
           $823 = ((($824)) + 4|0);
           $825 = HEAP32[$823>>2]|0;
           $826 = $825 & -8;
           $827 = ($826|0)==($$0259$i$i|0);
           if ($827) {
            $$0261$lcssa$i$i = $824;
            break L291;
           } else {
            $$02604$i$i = $822;$$02613$i$i = $824;
           }
          }
          HEAP32[$829>>2] = $672;
          $831 = ((($672)) + 24|0);
          HEAP32[$831>>2] = $$02613$i$i;
          $832 = ((($672)) + 12|0);
          HEAP32[$832>>2] = $672;
          $833 = ((($672)) + 8|0);
          HEAP32[$833>>2] = $672;
          break L238;
         }
        } while(0);
        $834 = ((($$0261$lcssa$i$i)) + 8|0);
        $835 = HEAP32[$834>>2]|0;
        $836 = ((($835)) + 12|0);
        HEAP32[$836>>2] = $672;
        HEAP32[$834>>2] = $672;
        $837 = ((($672)) + 8|0);
        HEAP32[$837>>2] = $835;
        $838 = ((($672)) + 12|0);
        HEAP32[$838>>2] = $$0261$lcssa$i$i;
        $839 = ((($672)) + 24|0);
        HEAP32[$839>>2] = 0;
       }
      } while(0);
      $968 = ((($660)) + 8|0);
      $$0 = $968;
      STACKTOP = sp;return ($$0|0);
     }
    }
    $$0$i$i$i = (32792);
    while(1) {
     $840 = HEAP32[$$0$i$i$i>>2]|0;
     $841 = ($840>>>0)>($585>>>0);
     if (!($841)) {
      $842 = ((($$0$i$i$i)) + 4|0);
      $843 = HEAP32[$842>>2]|0;
      $844 = (($840) + ($843)|0);
      $845 = ($844>>>0)>($585>>>0);
      if ($845) {
       break;
      }
     }
     $846 = ((($$0$i$i$i)) + 8|0);
     $847 = HEAP32[$846>>2]|0;
     $$0$i$i$i = $847;
    }
    $848 = ((($844)) + -47|0);
    $849 = ((($848)) + 8|0);
    $850 = $849;
    $851 = $850 & 7;
    $852 = ($851|0)==(0);
    $853 = (0 - ($850))|0;
    $854 = $853 & 7;
    $855 = $852 ? 0 : $854;
    $856 = (($848) + ($855)|0);
    $857 = ((($585)) + 16|0);
    $858 = ($856>>>0)<($857>>>0);
    $859 = $858 ? $585 : $856;
    $860 = ((($859)) + 8|0);
    $861 = ((($859)) + 24|0);
    $862 = (($$723947$i) + -40)|0;
    $863 = ((($$748$i)) + 8|0);
    $864 = $863;
    $865 = $864 & 7;
    $866 = ($865|0)==(0);
    $867 = (0 - ($864))|0;
    $868 = $867 & 7;
    $869 = $866 ? 0 : $868;
    $870 = (($$748$i) + ($869)|0);
    $871 = (($862) - ($869))|0;
    HEAP32[(32368)>>2] = $870;
    HEAP32[(32356)>>2] = $871;
    $872 = $871 | 1;
    $873 = ((($870)) + 4|0);
    HEAP32[$873>>2] = $872;
    $874 = (($$748$i) + ($862)|0);
    $875 = ((($874)) + 4|0);
    HEAP32[$875>>2] = 40;
    $876 = HEAP32[(32832)>>2]|0;
    HEAP32[(32372)>>2] = $876;
    $877 = ((($859)) + 4|0);
    HEAP32[$877>>2] = 27;
    ;HEAP32[$860>>2]=HEAP32[(32792)>>2]|0;HEAP32[$860+4>>2]=HEAP32[(32792)+4>>2]|0;HEAP32[$860+8>>2]=HEAP32[(32792)+8>>2]|0;HEAP32[$860+12>>2]=HEAP32[(32792)+12>>2]|0;
    HEAP32[(32792)>>2] = $$748$i;
    HEAP32[(32796)>>2] = $$723947$i;
    HEAP32[(32804)>>2] = 0;
    HEAP32[(32800)>>2] = $860;
    $879 = $861;
    while(1) {
     $878 = ((($879)) + 4|0);
     HEAP32[$878>>2] = 7;
     $880 = ((($879)) + 8|0);
     $881 = ($880>>>0)<($844>>>0);
     if ($881) {
      $879 = $878;
     } else {
      break;
     }
    }
    $882 = ($859|0)==($585|0);
    if (!($882)) {
     $883 = $859;
     $884 = $585;
     $885 = (($883) - ($884))|0;
     $886 = HEAP32[$877>>2]|0;
     $887 = $886 & -2;
     HEAP32[$877>>2] = $887;
     $888 = $885 | 1;
     $889 = ((($585)) + 4|0);
     HEAP32[$889>>2] = $888;
     HEAP32[$859>>2] = $885;
     $890 = $885 >>> 3;
     $891 = ($885>>>0)<(256);
     if ($891) {
      $892 = $890 << 1;
      $893 = (32384 + ($892<<2)|0);
      $894 = HEAP32[8086]|0;
      $895 = 1 << $890;
      $896 = $894 & $895;
      $897 = ($896|0)==(0);
      if ($897) {
       $898 = $894 | $895;
       HEAP32[8086] = $898;
       $$pre$i$i = ((($893)) + 8|0);
       $$0206$i$i = $893;$$pre$phi$i$iZ2D = $$pre$i$i;
      } else {
       $899 = ((($893)) + 8|0);
       $900 = HEAP32[$899>>2]|0;
       $$0206$i$i = $900;$$pre$phi$i$iZ2D = $899;
      }
      HEAP32[$$pre$phi$i$iZ2D>>2] = $585;
      $901 = ((($$0206$i$i)) + 12|0);
      HEAP32[$901>>2] = $585;
      $902 = ((($585)) + 8|0);
      HEAP32[$902>>2] = $$0206$i$i;
      $903 = ((($585)) + 12|0);
      HEAP32[$903>>2] = $893;
      break;
     }
     $904 = $885 >>> 8;
     $905 = ($904|0)==(0);
     if ($905) {
      $$0207$i$i = 0;
     } else {
      $906 = ($885>>>0)>(16777215);
      if ($906) {
       $$0207$i$i = 31;
      } else {
       $907 = (($904) + 1048320)|0;
       $908 = $907 >>> 16;
       $909 = $908 & 8;
       $910 = $904 << $909;
       $911 = (($910) + 520192)|0;
       $912 = $911 >>> 16;
       $913 = $912 & 4;
       $914 = $913 | $909;
       $915 = $910 << $913;
       $916 = (($915) + 245760)|0;
       $917 = $916 >>> 16;
       $918 = $917 & 2;
       $919 = $914 | $918;
       $920 = (14 - ($919))|0;
       $921 = $915 << $918;
       $922 = $921 >>> 15;
       $923 = (($920) + ($922))|0;
       $924 = $923 << 1;
       $925 = (($923) + 7)|0;
       $926 = $885 >>> $925;
       $927 = $926 & 1;
       $928 = $927 | $924;
       $$0207$i$i = $928;
      }
     }
     $929 = (32648 + ($$0207$i$i<<2)|0);
     $930 = ((($585)) + 28|0);
     HEAP32[$930>>2] = $$0207$i$i;
     $931 = ((($585)) + 20|0);
     HEAP32[$931>>2] = 0;
     HEAP32[$857>>2] = 0;
     $932 = HEAP32[(32348)>>2]|0;
     $933 = 1 << $$0207$i$i;
     $934 = $932 & $933;
     $935 = ($934|0)==(0);
     if ($935) {
      $936 = $932 | $933;
      HEAP32[(32348)>>2] = $936;
      HEAP32[$929>>2] = $585;
      $937 = ((($585)) + 24|0);
      HEAP32[$937>>2] = $929;
      $938 = ((($585)) + 12|0);
      HEAP32[$938>>2] = $585;
      $939 = ((($585)) + 8|0);
      HEAP32[$939>>2] = $585;
      break;
     }
     $940 = HEAP32[$929>>2]|0;
     $941 = ((($940)) + 4|0);
     $942 = HEAP32[$941>>2]|0;
     $943 = $942 & -8;
     $944 = ($943|0)==($885|0);
     L325: do {
      if ($944) {
       $$0202$lcssa$i$i = $940;
      } else {
       $945 = ($$0207$i$i|0)==(31);
       $946 = $$0207$i$i >>> 1;
       $947 = (25 - ($946))|0;
       $948 = $945 ? 0 : $947;
       $949 = $885 << $948;
       $$02014$i$i = $949;$$02023$i$i = $940;
       while(1) {
        $956 = $$02014$i$i >>> 31;
        $957 = (((($$02023$i$i)) + 16|0) + ($956<<2)|0);
        $952 = HEAP32[$957>>2]|0;
        $958 = ($952|0)==(0|0);
        if ($958) {
         break;
        }
        $950 = $$02014$i$i << 1;
        $951 = ((($952)) + 4|0);
        $953 = HEAP32[$951>>2]|0;
        $954 = $953 & -8;
        $955 = ($954|0)==($885|0);
        if ($955) {
         $$0202$lcssa$i$i = $952;
         break L325;
        } else {
         $$02014$i$i = $950;$$02023$i$i = $952;
        }
       }
       HEAP32[$957>>2] = $585;
       $959 = ((($585)) + 24|0);
       HEAP32[$959>>2] = $$02023$i$i;
       $960 = ((($585)) + 12|0);
       HEAP32[$960>>2] = $585;
       $961 = ((($585)) + 8|0);
       HEAP32[$961>>2] = $585;
       break L215;
      }
     } while(0);
     $962 = ((($$0202$lcssa$i$i)) + 8|0);
     $963 = HEAP32[$962>>2]|0;
     $964 = ((($963)) + 12|0);
     HEAP32[$964>>2] = $585;
     HEAP32[$962>>2] = $585;
     $965 = ((($585)) + 8|0);
     HEAP32[$965>>2] = $963;
     $966 = ((($585)) + 12|0);
     HEAP32[$966>>2] = $$0202$lcssa$i$i;
     $967 = ((($585)) + 24|0);
     HEAP32[$967>>2] = 0;
    }
   }
  } while(0);
  $969 = HEAP32[(32356)>>2]|0;
  $970 = ($969>>>0)>($$0192>>>0);
  if ($970) {
   $971 = (($969) - ($$0192))|0;
   HEAP32[(32356)>>2] = $971;
   $972 = HEAP32[(32368)>>2]|0;
   $973 = (($972) + ($$0192)|0);
   HEAP32[(32368)>>2] = $973;
   $974 = $971 | 1;
   $975 = ((($973)) + 4|0);
   HEAP32[$975>>2] = $974;
   $976 = $$0192 | 3;
   $977 = ((($972)) + 4|0);
   HEAP32[$977>>2] = $976;
   $978 = ((($972)) + 8|0);
   $$0 = $978;
   STACKTOP = sp;return ($$0|0);
  }
 }
 $979 = (___errno_location()|0);
 HEAP32[$979>>2] = 12;
 $$0 = 0;
 STACKTOP = sp;return ($$0|0);
}
function _free($0) {
 $0 = $0|0;
 var $$0194$i = 0, $$0194$in$i = 0, $$0346381 = 0, $$0347$lcssa = 0, $$0347380 = 0, $$0359 = 0, $$0366 = 0, $$1 = 0, $$1345 = 0, $$1350 = 0, $$1350$be = 0, $$1350$ph = 0, $$1353 = 0, $$1353$be = 0, $$1353$ph = 0, $$1361 = 0, $$1361$be = 0, $$1361$ph = 0, $$1365 = 0, $$1365$be = 0;
 var $$1365$ph = 0, $$2 = 0, $$3 = 0, $$3363 = 0, $$pre = 0, $$pre$phiZ2D = 0, $$sink = 0, $$sink395 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0;
 var $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0;
 var $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0;
 var $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0;
 var $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0;
 var $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0;
 var $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0;
 var $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0;
 var $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0;
 var $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0;
 var $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0;
 var $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0;
 var $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0;
 var $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $cond371 = 0, $cond372 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ($0|0)==(0|0);
 if ($1) {
  return;
 }
 $2 = ((($0)) + -8|0);
 $3 = HEAP32[(32360)>>2]|0;
 $4 = ((($0)) + -4|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = $5 & -8;
 $7 = (($2) + ($6)|0);
 $8 = $5 & 1;
 $9 = ($8|0)==(0);
 do {
  if ($9) {
   $10 = HEAP32[$2>>2]|0;
   $11 = $5 & 3;
   $12 = ($11|0)==(0);
   if ($12) {
    return;
   }
   $13 = (0 - ($10))|0;
   $14 = (($2) + ($13)|0);
   $15 = (($10) + ($6))|0;
   $16 = ($14>>>0)<($3>>>0);
   if ($16) {
    return;
   }
   $17 = HEAP32[(32364)>>2]|0;
   $18 = ($17|0)==($14|0);
   if ($18) {
    $79 = ((($7)) + 4|0);
    $80 = HEAP32[$79>>2]|0;
    $81 = $80 & 3;
    $82 = ($81|0)==(3);
    if (!($82)) {
     $$1 = $14;$$1345 = $15;$87 = $14;
     break;
    }
    $83 = (($14) + ($15)|0);
    $84 = ((($14)) + 4|0);
    $85 = $15 | 1;
    $86 = $80 & -2;
    HEAP32[(32352)>>2] = $15;
    HEAP32[$79>>2] = $86;
    HEAP32[$84>>2] = $85;
    HEAP32[$83>>2] = $15;
    return;
   }
   $19 = $10 >>> 3;
   $20 = ($10>>>0)<(256);
   if ($20) {
    $21 = ((($14)) + 8|0);
    $22 = HEAP32[$21>>2]|0;
    $23 = ((($14)) + 12|0);
    $24 = HEAP32[$23>>2]|0;
    $25 = ($24|0)==($22|0);
    if ($25) {
     $26 = 1 << $19;
     $27 = $26 ^ -1;
     $28 = HEAP32[8086]|0;
     $29 = $28 & $27;
     HEAP32[8086] = $29;
     $$1 = $14;$$1345 = $15;$87 = $14;
     break;
    } else {
     $30 = ((($22)) + 12|0);
     HEAP32[$30>>2] = $24;
     $31 = ((($24)) + 8|0);
     HEAP32[$31>>2] = $22;
     $$1 = $14;$$1345 = $15;$87 = $14;
     break;
    }
   }
   $32 = ((($14)) + 24|0);
   $33 = HEAP32[$32>>2]|0;
   $34 = ((($14)) + 12|0);
   $35 = HEAP32[$34>>2]|0;
   $36 = ($35|0)==($14|0);
   do {
    if ($36) {
     $41 = ((($14)) + 16|0);
     $42 = ((($41)) + 4|0);
     $43 = HEAP32[$42>>2]|0;
     $44 = ($43|0)==(0|0);
     if ($44) {
      $45 = HEAP32[$41>>2]|0;
      $46 = ($45|0)==(0|0);
      if ($46) {
       $$3 = 0;
       break;
      } else {
       $$1350$ph = $45;$$1353$ph = $41;
      }
     } else {
      $$1350$ph = $43;$$1353$ph = $42;
     }
     $$1350 = $$1350$ph;$$1353 = $$1353$ph;
     while(1) {
      $47 = ((($$1350)) + 20|0);
      $48 = HEAP32[$47>>2]|0;
      $49 = ($48|0)==(0|0);
      if ($49) {
       $50 = ((($$1350)) + 16|0);
       $51 = HEAP32[$50>>2]|0;
       $52 = ($51|0)==(0|0);
       if ($52) {
        break;
       } else {
        $$1350$be = $51;$$1353$be = $50;
       }
      } else {
       $$1350$be = $48;$$1353$be = $47;
      }
      $$1350 = $$1350$be;$$1353 = $$1353$be;
     }
     HEAP32[$$1353>>2] = 0;
     $$3 = $$1350;
    } else {
     $37 = ((($14)) + 8|0);
     $38 = HEAP32[$37>>2]|0;
     $39 = ((($38)) + 12|0);
     HEAP32[$39>>2] = $35;
     $40 = ((($35)) + 8|0);
     HEAP32[$40>>2] = $38;
     $$3 = $35;
    }
   } while(0);
   $53 = ($33|0)==(0|0);
   if ($53) {
    $$1 = $14;$$1345 = $15;$87 = $14;
   } else {
    $54 = ((($14)) + 28|0);
    $55 = HEAP32[$54>>2]|0;
    $56 = (32648 + ($55<<2)|0);
    $57 = HEAP32[$56>>2]|0;
    $58 = ($57|0)==($14|0);
    if ($58) {
     HEAP32[$56>>2] = $$3;
     $cond371 = ($$3|0)==(0|0);
     if ($cond371) {
      $59 = 1 << $55;
      $60 = $59 ^ -1;
      $61 = HEAP32[(32348)>>2]|0;
      $62 = $61 & $60;
      HEAP32[(32348)>>2] = $62;
      $$1 = $14;$$1345 = $15;$87 = $14;
      break;
     }
    } else {
     $63 = ((($33)) + 16|0);
     $64 = HEAP32[$63>>2]|0;
     $65 = ($64|0)==($14|0);
     $66 = ((($33)) + 20|0);
     $$sink = $65 ? $63 : $66;
     HEAP32[$$sink>>2] = $$3;
     $67 = ($$3|0)==(0|0);
     if ($67) {
      $$1 = $14;$$1345 = $15;$87 = $14;
      break;
     }
    }
    $68 = ((($$3)) + 24|0);
    HEAP32[$68>>2] = $33;
    $69 = ((($14)) + 16|0);
    $70 = HEAP32[$69>>2]|0;
    $71 = ($70|0)==(0|0);
    if (!($71)) {
     $72 = ((($$3)) + 16|0);
     HEAP32[$72>>2] = $70;
     $73 = ((($70)) + 24|0);
     HEAP32[$73>>2] = $$3;
    }
    $74 = ((($69)) + 4|0);
    $75 = HEAP32[$74>>2]|0;
    $76 = ($75|0)==(0|0);
    if ($76) {
     $$1 = $14;$$1345 = $15;$87 = $14;
    } else {
     $77 = ((($$3)) + 20|0);
     HEAP32[$77>>2] = $75;
     $78 = ((($75)) + 24|0);
     HEAP32[$78>>2] = $$3;
     $$1 = $14;$$1345 = $15;$87 = $14;
    }
   }
  } else {
   $$1 = $2;$$1345 = $6;$87 = $2;
  }
 } while(0);
 $88 = ($87>>>0)<($7>>>0);
 if (!($88)) {
  return;
 }
 $89 = ((($7)) + 4|0);
 $90 = HEAP32[$89>>2]|0;
 $91 = $90 & 1;
 $92 = ($91|0)==(0);
 if ($92) {
  return;
 }
 $93 = $90 & 2;
 $94 = ($93|0)==(0);
 if ($94) {
  $95 = HEAP32[(32368)>>2]|0;
  $96 = ($95|0)==($7|0);
  if ($96) {
   $97 = HEAP32[(32356)>>2]|0;
   $98 = (($97) + ($$1345))|0;
   HEAP32[(32356)>>2] = $98;
   HEAP32[(32368)>>2] = $$1;
   $99 = $98 | 1;
   $100 = ((($$1)) + 4|0);
   HEAP32[$100>>2] = $99;
   $101 = HEAP32[(32364)>>2]|0;
   $102 = ($$1|0)==($101|0);
   if (!($102)) {
    return;
   }
   HEAP32[(32364)>>2] = 0;
   HEAP32[(32352)>>2] = 0;
   return;
  }
  $103 = HEAP32[(32364)>>2]|0;
  $104 = ($103|0)==($7|0);
  if ($104) {
   $105 = HEAP32[(32352)>>2]|0;
   $106 = (($105) + ($$1345))|0;
   HEAP32[(32352)>>2] = $106;
   HEAP32[(32364)>>2] = $87;
   $107 = $106 | 1;
   $108 = ((($$1)) + 4|0);
   HEAP32[$108>>2] = $107;
   $109 = (($87) + ($106)|0);
   HEAP32[$109>>2] = $106;
   return;
  }
  $110 = $90 & -8;
  $111 = (($110) + ($$1345))|0;
  $112 = $90 >>> 3;
  $113 = ($90>>>0)<(256);
  do {
   if ($113) {
    $114 = ((($7)) + 8|0);
    $115 = HEAP32[$114>>2]|0;
    $116 = ((($7)) + 12|0);
    $117 = HEAP32[$116>>2]|0;
    $118 = ($117|0)==($115|0);
    if ($118) {
     $119 = 1 << $112;
     $120 = $119 ^ -1;
     $121 = HEAP32[8086]|0;
     $122 = $121 & $120;
     HEAP32[8086] = $122;
     break;
    } else {
     $123 = ((($115)) + 12|0);
     HEAP32[$123>>2] = $117;
     $124 = ((($117)) + 8|0);
     HEAP32[$124>>2] = $115;
     break;
    }
   } else {
    $125 = ((($7)) + 24|0);
    $126 = HEAP32[$125>>2]|0;
    $127 = ((($7)) + 12|0);
    $128 = HEAP32[$127>>2]|0;
    $129 = ($128|0)==($7|0);
    do {
     if ($129) {
      $134 = ((($7)) + 16|0);
      $135 = ((($134)) + 4|0);
      $136 = HEAP32[$135>>2]|0;
      $137 = ($136|0)==(0|0);
      if ($137) {
       $138 = HEAP32[$134>>2]|0;
       $139 = ($138|0)==(0|0);
       if ($139) {
        $$3363 = 0;
        break;
       } else {
        $$1361$ph = $138;$$1365$ph = $134;
       }
      } else {
       $$1361$ph = $136;$$1365$ph = $135;
      }
      $$1361 = $$1361$ph;$$1365 = $$1365$ph;
      while(1) {
       $140 = ((($$1361)) + 20|0);
       $141 = HEAP32[$140>>2]|0;
       $142 = ($141|0)==(0|0);
       if ($142) {
        $143 = ((($$1361)) + 16|0);
        $144 = HEAP32[$143>>2]|0;
        $145 = ($144|0)==(0|0);
        if ($145) {
         break;
        } else {
         $$1361$be = $144;$$1365$be = $143;
        }
       } else {
        $$1361$be = $141;$$1365$be = $140;
       }
       $$1361 = $$1361$be;$$1365 = $$1365$be;
      }
      HEAP32[$$1365>>2] = 0;
      $$3363 = $$1361;
     } else {
      $130 = ((($7)) + 8|0);
      $131 = HEAP32[$130>>2]|0;
      $132 = ((($131)) + 12|0);
      HEAP32[$132>>2] = $128;
      $133 = ((($128)) + 8|0);
      HEAP32[$133>>2] = $131;
      $$3363 = $128;
     }
    } while(0);
    $146 = ($126|0)==(0|0);
    if (!($146)) {
     $147 = ((($7)) + 28|0);
     $148 = HEAP32[$147>>2]|0;
     $149 = (32648 + ($148<<2)|0);
     $150 = HEAP32[$149>>2]|0;
     $151 = ($150|0)==($7|0);
     if ($151) {
      HEAP32[$149>>2] = $$3363;
      $cond372 = ($$3363|0)==(0|0);
      if ($cond372) {
       $152 = 1 << $148;
       $153 = $152 ^ -1;
       $154 = HEAP32[(32348)>>2]|0;
       $155 = $154 & $153;
       HEAP32[(32348)>>2] = $155;
       break;
      }
     } else {
      $156 = ((($126)) + 16|0);
      $157 = HEAP32[$156>>2]|0;
      $158 = ($157|0)==($7|0);
      $159 = ((($126)) + 20|0);
      $$sink395 = $158 ? $156 : $159;
      HEAP32[$$sink395>>2] = $$3363;
      $160 = ($$3363|0)==(0|0);
      if ($160) {
       break;
      }
     }
     $161 = ((($$3363)) + 24|0);
     HEAP32[$161>>2] = $126;
     $162 = ((($7)) + 16|0);
     $163 = HEAP32[$162>>2]|0;
     $164 = ($163|0)==(0|0);
     if (!($164)) {
      $165 = ((($$3363)) + 16|0);
      HEAP32[$165>>2] = $163;
      $166 = ((($163)) + 24|0);
      HEAP32[$166>>2] = $$3363;
     }
     $167 = ((($162)) + 4|0);
     $168 = HEAP32[$167>>2]|0;
     $169 = ($168|0)==(0|0);
     if (!($169)) {
      $170 = ((($$3363)) + 20|0);
      HEAP32[$170>>2] = $168;
      $171 = ((($168)) + 24|0);
      HEAP32[$171>>2] = $$3363;
     }
    }
   }
  } while(0);
  $172 = $111 | 1;
  $173 = ((($$1)) + 4|0);
  HEAP32[$173>>2] = $172;
  $174 = (($87) + ($111)|0);
  HEAP32[$174>>2] = $111;
  $175 = HEAP32[(32364)>>2]|0;
  $176 = ($$1|0)==($175|0);
  if ($176) {
   HEAP32[(32352)>>2] = $111;
   return;
  } else {
   $$2 = $111;
  }
 } else {
  $177 = $90 & -2;
  HEAP32[$89>>2] = $177;
  $178 = $$1345 | 1;
  $179 = ((($$1)) + 4|0);
  HEAP32[$179>>2] = $178;
  $180 = (($87) + ($$1345)|0);
  HEAP32[$180>>2] = $$1345;
  $$2 = $$1345;
 }
 $181 = $$2 >>> 3;
 $182 = ($$2>>>0)<(256);
 if ($182) {
  $183 = $181 << 1;
  $184 = (32384 + ($183<<2)|0);
  $185 = HEAP32[8086]|0;
  $186 = 1 << $181;
  $187 = $185 & $186;
  $188 = ($187|0)==(0);
  if ($188) {
   $189 = $185 | $186;
   HEAP32[8086] = $189;
   $$pre = ((($184)) + 8|0);
   $$0366 = $184;$$pre$phiZ2D = $$pre;
  } else {
   $190 = ((($184)) + 8|0);
   $191 = HEAP32[$190>>2]|0;
   $$0366 = $191;$$pre$phiZ2D = $190;
  }
  HEAP32[$$pre$phiZ2D>>2] = $$1;
  $192 = ((($$0366)) + 12|0);
  HEAP32[$192>>2] = $$1;
  $193 = ((($$1)) + 8|0);
  HEAP32[$193>>2] = $$0366;
  $194 = ((($$1)) + 12|0);
  HEAP32[$194>>2] = $184;
  return;
 }
 $195 = $$2 >>> 8;
 $196 = ($195|0)==(0);
 if ($196) {
  $$0359 = 0;
 } else {
  $197 = ($$2>>>0)>(16777215);
  if ($197) {
   $$0359 = 31;
  } else {
   $198 = (($195) + 1048320)|0;
   $199 = $198 >>> 16;
   $200 = $199 & 8;
   $201 = $195 << $200;
   $202 = (($201) + 520192)|0;
   $203 = $202 >>> 16;
   $204 = $203 & 4;
   $205 = $204 | $200;
   $206 = $201 << $204;
   $207 = (($206) + 245760)|0;
   $208 = $207 >>> 16;
   $209 = $208 & 2;
   $210 = $205 | $209;
   $211 = (14 - ($210))|0;
   $212 = $206 << $209;
   $213 = $212 >>> 15;
   $214 = (($211) + ($213))|0;
   $215 = $214 << 1;
   $216 = (($214) + 7)|0;
   $217 = $$2 >>> $216;
   $218 = $217 & 1;
   $219 = $218 | $215;
   $$0359 = $219;
  }
 }
 $220 = (32648 + ($$0359<<2)|0);
 $221 = ((($$1)) + 28|0);
 HEAP32[$221>>2] = $$0359;
 $222 = ((($$1)) + 16|0);
 $223 = ((($$1)) + 20|0);
 HEAP32[$223>>2] = 0;
 HEAP32[$222>>2] = 0;
 $224 = HEAP32[(32348)>>2]|0;
 $225 = 1 << $$0359;
 $226 = $224 & $225;
 $227 = ($226|0)==(0);
 L112: do {
  if ($227) {
   $228 = $224 | $225;
   HEAP32[(32348)>>2] = $228;
   HEAP32[$220>>2] = $$1;
   $229 = ((($$1)) + 24|0);
   HEAP32[$229>>2] = $220;
   $230 = ((($$1)) + 12|0);
   HEAP32[$230>>2] = $$1;
   $231 = ((($$1)) + 8|0);
   HEAP32[$231>>2] = $$1;
  } else {
   $232 = HEAP32[$220>>2]|0;
   $233 = ((($232)) + 4|0);
   $234 = HEAP32[$233>>2]|0;
   $235 = $234 & -8;
   $236 = ($235|0)==($$2|0);
   L115: do {
    if ($236) {
     $$0347$lcssa = $232;
    } else {
     $237 = ($$0359|0)==(31);
     $238 = $$0359 >>> 1;
     $239 = (25 - ($238))|0;
     $240 = $237 ? 0 : $239;
     $241 = $$2 << $240;
     $$0346381 = $241;$$0347380 = $232;
     while(1) {
      $248 = $$0346381 >>> 31;
      $249 = (((($$0347380)) + 16|0) + ($248<<2)|0);
      $244 = HEAP32[$249>>2]|0;
      $250 = ($244|0)==(0|0);
      if ($250) {
       break;
      }
      $242 = $$0346381 << 1;
      $243 = ((($244)) + 4|0);
      $245 = HEAP32[$243>>2]|0;
      $246 = $245 & -8;
      $247 = ($246|0)==($$2|0);
      if ($247) {
       $$0347$lcssa = $244;
       break L115;
      } else {
       $$0346381 = $242;$$0347380 = $244;
      }
     }
     HEAP32[$249>>2] = $$1;
     $251 = ((($$1)) + 24|0);
     HEAP32[$251>>2] = $$0347380;
     $252 = ((($$1)) + 12|0);
     HEAP32[$252>>2] = $$1;
     $253 = ((($$1)) + 8|0);
     HEAP32[$253>>2] = $$1;
     break L112;
    }
   } while(0);
   $254 = ((($$0347$lcssa)) + 8|0);
   $255 = HEAP32[$254>>2]|0;
   $256 = ((($255)) + 12|0);
   HEAP32[$256>>2] = $$1;
   HEAP32[$254>>2] = $$1;
   $257 = ((($$1)) + 8|0);
   HEAP32[$257>>2] = $255;
   $258 = ((($$1)) + 12|0);
   HEAP32[$258>>2] = $$0347$lcssa;
   $259 = ((($$1)) + 24|0);
   HEAP32[$259>>2] = 0;
  }
 } while(0);
 $260 = HEAP32[(32376)>>2]|0;
 $261 = (($260) + -1)|0;
 HEAP32[(32376)>>2] = $261;
 $262 = ($261|0)==(0);
 if (!($262)) {
  return;
 }
 $$0194$in$i = (32800);
 while(1) {
  $$0194$i = HEAP32[$$0194$in$i>>2]|0;
  $263 = ($$0194$i|0)==(0|0);
  $264 = ((($$0194$i)) + 8|0);
  if ($263) {
   break;
  } else {
   $$0194$in$i = $264;
  }
 }
 HEAP32[(32376)>>2] = -1;
 return;
}
function ___stdio_close($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $vararg_buffer = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $vararg_buffer = sp;
 $1 = ((($0)) + 60|0);
 $2 = HEAP32[$1>>2]|0;
 $3 = (_dummy_569($2)|0);
 HEAP32[$vararg_buffer>>2] = $3;
 $4 = (___syscall6(6,($vararg_buffer|0))|0);
 $5 = (___syscall_ret($4)|0);
 STACKTOP = sp;return ($5|0);
}
function ___stdio_write($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$0 = 0, $$04756 = 0, $$04855 = 0, $$04954 = 0, $$051 = 0, $$1 = 0, $$150 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0;
 var $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0;
 var $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_buffer3 = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0;
 var $vararg_ptr6 = 0, $vararg_ptr7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(48|0);
 $vararg_buffer3 = sp + 16|0;
 $vararg_buffer = sp;
 $3 = sp + 32|0;
 $4 = ((($0)) + 28|0);
 $5 = HEAP32[$4>>2]|0;
 HEAP32[$3>>2] = $5;
 $6 = ((($3)) + 4|0);
 $7 = ((($0)) + 20|0);
 $8 = HEAP32[$7>>2]|0;
 $9 = (($8) - ($5))|0;
 HEAP32[$6>>2] = $9;
 $10 = ((($3)) + 8|0);
 HEAP32[$10>>2] = $1;
 $11 = ((($3)) + 12|0);
 HEAP32[$11>>2] = $2;
 $12 = (($9) + ($2))|0;
 $13 = ((($0)) + 60|0);
 $14 = HEAP32[$13>>2]|0;
 $15 = $3;
 HEAP32[$vararg_buffer>>2] = $14;
 $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
 HEAP32[$vararg_ptr1>>2] = $15;
 $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
 HEAP32[$vararg_ptr2>>2] = 2;
 $16 = (___syscall146(146,($vararg_buffer|0))|0);
 $17 = (___syscall_ret($16)|0);
 $18 = ($12|0)==($17|0);
 L1: do {
  if ($18) {
   label = 3;
  } else {
   $$04756 = 2;$$04855 = $12;$$04954 = $3;$26 = $17;
   while(1) {
    $27 = ($26|0)<(0);
    if ($27) {
     break;
    }
    $35 = (($$04855) - ($26))|0;
    $36 = ((($$04954)) + 4|0);
    $37 = HEAP32[$36>>2]|0;
    $38 = ($26>>>0)>($37>>>0);
    $39 = ((($$04954)) + 8|0);
    $$150 = $38 ? $39 : $$04954;
    $40 = $38 << 31 >> 31;
    $$1 = (($$04756) + ($40))|0;
    $41 = $38 ? $37 : 0;
    $$0 = (($26) - ($41))|0;
    $42 = HEAP32[$$150>>2]|0;
    $43 = (($42) + ($$0)|0);
    HEAP32[$$150>>2] = $43;
    $44 = ((($$150)) + 4|0);
    $45 = HEAP32[$44>>2]|0;
    $46 = (($45) - ($$0))|0;
    HEAP32[$44>>2] = $46;
    $47 = HEAP32[$13>>2]|0;
    $48 = $$150;
    HEAP32[$vararg_buffer3>>2] = $47;
    $vararg_ptr6 = ((($vararg_buffer3)) + 4|0);
    HEAP32[$vararg_ptr6>>2] = $48;
    $vararg_ptr7 = ((($vararg_buffer3)) + 8|0);
    HEAP32[$vararg_ptr7>>2] = $$1;
    $49 = (___syscall146(146,($vararg_buffer3|0))|0);
    $50 = (___syscall_ret($49)|0);
    $51 = ($35|0)==($50|0);
    if ($51) {
     label = 3;
     break L1;
    } else {
     $$04756 = $$1;$$04855 = $35;$$04954 = $$150;$26 = $50;
    }
   }
   $28 = ((($0)) + 16|0);
   HEAP32[$28>>2] = 0;
   HEAP32[$4>>2] = 0;
   HEAP32[$7>>2] = 0;
   $29 = HEAP32[$0>>2]|0;
   $30 = $29 | 32;
   HEAP32[$0>>2] = $30;
   $31 = ($$04756|0)==(2);
   if ($31) {
    $$051 = 0;
   } else {
    $32 = ((($$04954)) + 4|0);
    $33 = HEAP32[$32>>2]|0;
    $34 = (($2) - ($33))|0;
    $$051 = $34;
   }
  }
 } while(0);
 if ((label|0) == 3) {
  $19 = ((($0)) + 44|0);
  $20 = HEAP32[$19>>2]|0;
  $21 = ((($0)) + 48|0);
  $22 = HEAP32[$21>>2]|0;
  $23 = (($20) + ($22)|0);
  $24 = ((($0)) + 16|0);
  HEAP32[$24>>2] = $23;
  $25 = $20;
  HEAP32[$4>>2] = $25;
  HEAP32[$7>>2] = $25;
  $$051 = $2;
 }
 STACKTOP = sp;return ($$051|0);
}
function ___stdio_seek($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$pre = 0, $10 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, $vararg_ptr3 = 0, $vararg_ptr4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(32|0);
 $vararg_buffer = sp;
 $3 = sp + 20|0;
 $4 = ((($0)) + 60|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = $3;
 HEAP32[$vararg_buffer>>2] = $5;
 $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
 HEAP32[$vararg_ptr1>>2] = 0;
 $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
 HEAP32[$vararg_ptr2>>2] = $1;
 $vararg_ptr3 = ((($vararg_buffer)) + 12|0);
 HEAP32[$vararg_ptr3>>2] = $6;
 $vararg_ptr4 = ((($vararg_buffer)) + 16|0);
 HEAP32[$vararg_ptr4>>2] = $2;
 $7 = (___syscall140(140,($vararg_buffer|0))|0);
 $8 = (___syscall_ret($7)|0);
 $9 = ($8|0)<(0);
 if ($9) {
  HEAP32[$3>>2] = -1;
  $10 = -1;
 } else {
  $$pre = HEAP32[$3>>2]|0;
  $10 = $$pre;
 }
 STACKTOP = sp;return ($10|0);
}
function ___syscall_ret($0) {
 $0 = $0|0;
 var $$0 = 0, $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ($0>>>0)>(4294963200);
 if ($1) {
  $2 = (0 - ($0))|0;
  $3 = (___errno_location()|0);
  HEAP32[$3>>2] = $2;
  $$0 = -1;
 } else {
  $$0 = $0;
 }
 return ($$0|0);
}
function ___errno_location() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (32840|0);
}
function _dummy_569($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return ($0|0);
}
function ___stdout_write($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(32|0);
 $vararg_buffer = sp;
 $3 = sp + 16|0;
 $4 = ((($0)) + 36|0);
 HEAP32[$4>>2] = 4;
 $5 = HEAP32[$0>>2]|0;
 $6 = $5 & 64;
 $7 = ($6|0)==(0);
 if ($7) {
  $8 = ((($0)) + 60|0);
  $9 = HEAP32[$8>>2]|0;
  $10 = $3;
  HEAP32[$vararg_buffer>>2] = $9;
  $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
  HEAP32[$vararg_ptr1>>2] = 21523;
  $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
  HEAP32[$vararg_ptr2>>2] = $10;
  $11 = (___syscall54(54,($vararg_buffer|0))|0);
  $12 = ($11|0)==(0);
  if (!($12)) {
   $13 = ((($0)) + 75|0);
   HEAP8[$13>>0] = -1;
  }
 }
 $14 = (___stdio_write($0,$1,$2)|0);
 STACKTOP = sp;return ($14|0);
}
function ___lockfile($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 0;
}
function ___unlockfile($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return;
}
function _close($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $spec$store$select = 0, $vararg_buffer = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $vararg_buffer = sp;
 $1 = (_dummy_569($0)|0);
 HEAP32[$vararg_buffer>>2] = $1;
 $2 = (___syscall6(6,($vararg_buffer|0))|0);
 $3 = ($2|0)==(-4);
 $spec$store$select = $3 ? 0 : $2;
 $4 = (___syscall_ret($spec$store$select)|0);
 STACKTOP = sp;return ($4|0);
}
function _open($0,$1,$varargs) {
 $0 = $0|0;
 $1 = $1|0;
 $varargs = $varargs|0;
 var $$0 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $arglist_current = 0, $arglist_next = 0;
 var $expanded = 0, $expanded2 = 0, $expanded4 = 0, $expanded5 = 0, $expanded6 = 0, $or$cond14 = 0, $vararg_buffer = 0, $vararg_buffer3 = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, $vararg_ptr6 = 0, $vararg_ptr7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(48|0);
 $vararg_buffer3 = sp + 16|0;
 $vararg_buffer = sp;
 $2 = sp + 32|0;
 $3 = $1 & 4194368;
 $4 = ($3|0)==(0);
 if ($4) {
  $$0 = 0;
 } else {
  HEAP32[$2>>2] = $varargs;
  $arglist_current = HEAP32[$2>>2]|0;
  $5 = $arglist_current;
  $6 = ((0) + 4|0);
  $expanded2 = $6;
  $expanded = (($expanded2) - 1)|0;
  $7 = (($5) + ($expanded))|0;
  $8 = ((0) + 4|0);
  $expanded6 = $8;
  $expanded5 = (($expanded6) - 1)|0;
  $expanded4 = $expanded5 ^ -1;
  $9 = $7 & $expanded4;
  $10 = $9;
  $11 = HEAP32[$10>>2]|0;
  $arglist_next = ((($10)) + 4|0);
  HEAP32[$2>>2] = $arglist_next;
  $$0 = $11;
 }
 $12 = $0;
 $13 = $1 | 32768;
 HEAP32[$vararg_buffer>>2] = $12;
 $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
 HEAP32[$vararg_ptr1>>2] = $13;
 $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
 HEAP32[$vararg_ptr2>>2] = $$0;
 $14 = (___syscall5(5,($vararg_buffer|0))|0);
 $15 = ($14|0)<(0);
 $16 = $1 & 524288;
 $17 = ($16|0)==(0);
 $or$cond14 = $17 | $15;
 if (!($or$cond14)) {
  HEAP32[$vararg_buffer3>>2] = $14;
  $vararg_ptr6 = ((($vararg_buffer3)) + 4|0);
  HEAP32[$vararg_ptr6>>2] = 2;
  $vararg_ptr7 = ((($vararg_buffer3)) + 8|0);
  HEAP32[$vararg_ptr7>>2] = 1;
  (___syscall221(221,($vararg_buffer3|0))|0);
 }
 $18 = (___syscall_ret($14)|0);
 STACKTOP = sp;return ($18|0);
}
function _read($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $3 = 0, $4 = 0, $5 = 0, $vararg_buffer = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $vararg_buffer = sp;
 $3 = $1;
 HEAP32[$vararg_buffer>>2] = $0;
 $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
 HEAP32[$vararg_ptr1>>2] = $3;
 $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
 HEAP32[$vararg_ptr2>>2] = $2;
 $4 = (___syscall3(3,($vararg_buffer|0))|0);
 $5 = (___syscall_ret($4)|0);
 STACKTOP = sp;return ($5|0);
}
function ___ofl_lock() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 ___lock((32844|0));
 return (32852|0);
}
function ___ofl_unlock() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 ___unlock((32844|0));
 return;
}
function _fflush($0) {
 $0 = $0|0;
 var $$0 = 0, $$023 = 0, $$02325 = 0, $$02327 = 0, $$024$lcssa = 0, $$02426 = 0, $$1 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0;
 var $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $phitmp = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ($0|0)==(0|0);
 do {
  if ($1) {
   $8 = HEAP32[8080]|0;
   $9 = ($8|0)==(0|0);
   if ($9) {
    $29 = 0;
   } else {
    $10 = HEAP32[8080]|0;
    $11 = (_fflush($10)|0);
    $29 = $11;
   }
   $12 = (___ofl_lock()|0);
   $$02325 = HEAP32[$12>>2]|0;
   $13 = ($$02325|0)==(0|0);
   if ($13) {
    $$024$lcssa = $29;
   } else {
    $$02327 = $$02325;$$02426 = $29;
    while(1) {
     $14 = ((($$02327)) + 76|0);
     $15 = HEAP32[$14>>2]|0;
     $16 = ($15|0)>(-1);
     if ($16) {
      $17 = (___lockfile($$02327)|0);
      $25 = $17;
     } else {
      $25 = 0;
     }
     $18 = ((($$02327)) + 20|0);
     $19 = HEAP32[$18>>2]|0;
     $20 = ((($$02327)) + 28|0);
     $21 = HEAP32[$20>>2]|0;
     $22 = ($19>>>0)>($21>>>0);
     if ($22) {
      $23 = (___fflush_unlocked($$02327)|0);
      $24 = $23 | $$02426;
      $$1 = $24;
     } else {
      $$1 = $$02426;
     }
     $26 = ($25|0)==(0);
     if (!($26)) {
      ___unlockfile($$02327);
     }
     $27 = ((($$02327)) + 56|0);
     $$023 = HEAP32[$27>>2]|0;
     $28 = ($$023|0)==(0|0);
     if ($28) {
      $$024$lcssa = $$1;
      break;
     } else {
      $$02327 = $$023;$$02426 = $$1;
     }
    }
   }
   ___ofl_unlock();
   $$0 = $$024$lcssa;
  } else {
   $2 = ((($0)) + 76|0);
   $3 = HEAP32[$2>>2]|0;
   $4 = ($3|0)>(-1);
   if (!($4)) {
    $5 = (___fflush_unlocked($0)|0);
    $$0 = $5;
    break;
   }
   $6 = (___lockfile($0)|0);
   $phitmp = ($6|0)==(0);
   $7 = (___fflush_unlocked($0)|0);
   if ($phitmp) {
    $$0 = $7;
   } else {
    ___unlockfile($0);
    $$0 = $7;
   }
  }
 } while(0);
 return ($$0|0);
}
function ___fflush_unlocked($0) {
 $0 = $0|0;
 var $$0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0;
 var $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ((($0)) + 20|0);
 $2 = HEAP32[$1>>2]|0;
 $3 = ((($0)) + 28|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = ($2>>>0)>($4>>>0);
 if ($5) {
  $6 = ((($0)) + 36|0);
  $7 = HEAP32[$6>>2]|0;
  (FUNCTION_TABLE_iiii[$7 & 7]($0,0,0)|0);
  $8 = HEAP32[$1>>2]|0;
  $9 = ($8|0)==(0|0);
  if ($9) {
   $$0 = -1;
  } else {
   label = 3;
  }
 } else {
  label = 3;
 }
 if ((label|0) == 3) {
  $10 = ((($0)) + 4|0);
  $11 = HEAP32[$10>>2]|0;
  $12 = ((($0)) + 8|0);
  $13 = HEAP32[$12>>2]|0;
  $14 = ($11>>>0)<($13>>>0);
  if ($14) {
   $15 = $11;
   $16 = $13;
   $17 = (($15) - ($16))|0;
   $18 = ((($0)) + 40|0);
   $19 = HEAP32[$18>>2]|0;
   (FUNCTION_TABLE_iiii[$19 & 7]($0,$17,1)|0);
  }
  $20 = ((($0)) + 16|0);
  HEAP32[$20>>2] = 0;
  HEAP32[$3>>2] = 0;
  HEAP32[$1>>2] = 0;
  HEAP32[$12>>2] = 0;
  HEAP32[$10>>2] = 0;
  $$0 = 0;
 }
 return ($$0|0);
}
function runPostSets() {
}
function ___muldsi3($a, $b) {
    $a = $a | 0;
    $b = $b | 0;
    var $1 = 0, $2 = 0, $3 = 0, $6 = 0, $8 = 0, $11 = 0, $12 = 0;
    $1 = $a & 65535;
    $2 = $b & 65535;
    $3 = Math_imul($2, $1) | 0;
    $6 = $a >>> 16;
    $8 = ($3 >>> 16) + (Math_imul($2, $6) | 0) | 0;
    $11 = $b >>> 16;
    $12 = Math_imul($11, $1) | 0;
    return (tempRet0 = (($8 >>> 16) + (Math_imul($11, $6) | 0) | 0) + ((($8 & 65535) + $12 | 0) >>> 16) | 0, 0 | ($8 + $12 << 16 | $3 & 65535)) | 0;
}
function ___muldi3($a$0, $a$1, $b$0, $b$1) {
    $a$0 = $a$0 | 0;
    $a$1 = $a$1 | 0;
    $b$0 = $b$0 | 0;
    $b$1 = $b$1 | 0;
    var $x_sroa_0_0_extract_trunc = 0, $y_sroa_0_0_extract_trunc = 0, $1$0 = 0, $1$1 = 0, $2 = 0;
    $x_sroa_0_0_extract_trunc = $a$0;
    $y_sroa_0_0_extract_trunc = $b$0;
    $1$0 = ___muldsi3($x_sroa_0_0_extract_trunc, $y_sroa_0_0_extract_trunc) | 0;
    $1$1 = tempRet0;
    $2 = Math_imul($a$1, $y_sroa_0_0_extract_trunc) | 0;
    return (tempRet0 = ((Math_imul($b$1, $x_sroa_0_0_extract_trunc) | 0) + $2 | 0) + $1$1 | $1$1 & 0, 0 | $1$0 & -1) | 0;
}
function _bitshift64Ashr(low, high, bits) {
    low = low|0; high = high|0; bits = bits|0;
    var ander = 0;
    if ((bits|0) < 32) {
      ander = ((1 << bits) - 1)|0;
      tempRet0 = high >> bits;
      return (low >>> bits) | ((high&ander) << (32 - bits));
    }
    tempRet0 = (high|0) < 0 ? -1 : 0;
    return (high >> (bits - 32))|0;
}
function _bitshift64Lshr(low, high, bits) {
    low = low|0; high = high|0; bits = bits|0;
    var ander = 0;
    if ((bits|0) < 32) {
      ander = ((1 << bits) - 1)|0;
      tempRet0 = high >>> bits;
      return (low >>> bits) | ((high&ander) << (32 - bits));
    }
    tempRet0 = 0;
    return (high >>> (bits - 32))|0;
}
function _bitshift64Shl(low, high, bits) {
    low = low|0; high = high|0; bits = bits|0;
    var ander = 0;
    if ((bits|0) < 32) {
      ander = ((1 << bits) - 1)|0;
      tempRet0 = (high << bits) | ((low&(ander << (32 - bits))) >>> (32 - bits));
      return low << bits;
    }
    tempRet0 = low << (bits - 32);
    return 0;
}
function _i64Add(a, b, c, d) {
    /*
      x = a + b*2^32
      y = c + d*2^32
      result = l + h*2^32
    */
    a = a|0; b = b|0; c = c|0; d = d|0;
    var l = 0, h = 0;
    l = (a + c)>>>0;
    h = (b + d + (((l>>>0) < (a>>>0))|0))>>>0; // Add carry from low word to high word on overflow.
    return ((tempRet0 = h,l|0)|0);
}
function _i64Subtract(a, b, c, d) {
    a = a|0; b = b|0; c = c|0; d = d|0;
    var l = 0, h = 0;
    l = (a - c)>>>0;
    h = (b - d)>>>0;
    h = (b - d - (((c>>>0) > (a>>>0))|0))>>>0; // Borrow one from high word to low word on underflow.
    return ((tempRet0 = h,l|0)|0);
}
function _memcpy(dest, src, num) {
    dest = dest|0; src = src|0; num = num|0;
    var ret = 0;
    var aligned_dest_end = 0;
    var block_aligned_dest_end = 0;
    var dest_end = 0;
    // Test against a benchmarked cutoff limit for when HEAPU8.set() becomes faster to use.
    if ((num|0) >=
      8192
    ) {
      return _emscripten_memcpy_big(dest|0, src|0, num|0)|0;
    }

    ret = dest|0;
    dest_end = (dest + num)|0;
    if ((dest&3) == (src&3)) {
      // The initial unaligned < 4-byte front.
      while (dest & 3) {
        if ((num|0) == 0) return ret|0;
        HEAP8[((dest)>>0)]=((HEAP8[((src)>>0)])|0);
        dest = (dest+1)|0;
        src = (src+1)|0;
        num = (num-1)|0;
      }
      aligned_dest_end = (dest_end & -4)|0;
      block_aligned_dest_end = (aligned_dest_end - 64)|0;
      while ((dest|0) <= (block_aligned_dest_end|0) ) {
        HEAP32[((dest)>>2)]=((HEAP32[((src)>>2)])|0);
        HEAP32[(((dest)+(4))>>2)]=((HEAP32[(((src)+(4))>>2)])|0);
        HEAP32[(((dest)+(8))>>2)]=((HEAP32[(((src)+(8))>>2)])|0);
        HEAP32[(((dest)+(12))>>2)]=((HEAP32[(((src)+(12))>>2)])|0);
        HEAP32[(((dest)+(16))>>2)]=((HEAP32[(((src)+(16))>>2)])|0);
        HEAP32[(((dest)+(20))>>2)]=((HEAP32[(((src)+(20))>>2)])|0);
        HEAP32[(((dest)+(24))>>2)]=((HEAP32[(((src)+(24))>>2)])|0);
        HEAP32[(((dest)+(28))>>2)]=((HEAP32[(((src)+(28))>>2)])|0);
        HEAP32[(((dest)+(32))>>2)]=((HEAP32[(((src)+(32))>>2)])|0);
        HEAP32[(((dest)+(36))>>2)]=((HEAP32[(((src)+(36))>>2)])|0);
        HEAP32[(((dest)+(40))>>2)]=((HEAP32[(((src)+(40))>>2)])|0);
        HEAP32[(((dest)+(44))>>2)]=((HEAP32[(((src)+(44))>>2)])|0);
        HEAP32[(((dest)+(48))>>2)]=((HEAP32[(((src)+(48))>>2)])|0);
        HEAP32[(((dest)+(52))>>2)]=((HEAP32[(((src)+(52))>>2)])|0);
        HEAP32[(((dest)+(56))>>2)]=((HEAP32[(((src)+(56))>>2)])|0);
        HEAP32[(((dest)+(60))>>2)]=((HEAP32[(((src)+(60))>>2)])|0);
        dest = (dest+64)|0;
        src = (src+64)|0;
      }
      while ((dest|0) < (aligned_dest_end|0) ) {
        HEAP32[((dest)>>2)]=((HEAP32[((src)>>2)])|0);
        dest = (dest+4)|0;
        src = (src+4)|0;
      }
    } else {
      // In the unaligned copy case, unroll a bit as well.
      aligned_dest_end = (dest_end - 4)|0;
      while ((dest|0) < (aligned_dest_end|0) ) {
        HEAP8[((dest)>>0)]=((HEAP8[((src)>>0)])|0);
        HEAP8[(((dest)+(1))>>0)]=((HEAP8[(((src)+(1))>>0)])|0);
        HEAP8[(((dest)+(2))>>0)]=((HEAP8[(((src)+(2))>>0)])|0);
        HEAP8[(((dest)+(3))>>0)]=((HEAP8[(((src)+(3))>>0)])|0);
        dest = (dest+4)|0;
        src = (src+4)|0;
      }
    }
    // The remaining unaligned < 4 byte tail.
    while ((dest|0) < (dest_end|0)) {
      HEAP8[((dest)>>0)]=((HEAP8[((src)>>0)])|0);
      dest = (dest+1)|0;
      src = (src+1)|0;
    }
    return ret|0;
}
function _memset(ptr, value, num) {
    ptr = ptr|0; value = value|0; num = num|0;
    var end = 0, aligned_end = 0, block_aligned_end = 0, value4 = 0;
    end = (ptr + num)|0;

    value = value & 0xff;
    if ((num|0) >= 67 /* 64 bytes for an unrolled loop + 3 bytes for unaligned head*/) {
      while ((ptr&3) != 0) {
        HEAP8[((ptr)>>0)]=value;
        ptr = (ptr+1)|0;
      }

      aligned_end = (end & -4)|0;
      block_aligned_end = (aligned_end - 64)|0;
      value4 = value | (value << 8) | (value << 16) | (value << 24);

      while((ptr|0) <= (block_aligned_end|0)) {
        HEAP32[((ptr)>>2)]=value4;
        HEAP32[(((ptr)+(4))>>2)]=value4;
        HEAP32[(((ptr)+(8))>>2)]=value4;
        HEAP32[(((ptr)+(12))>>2)]=value4;
        HEAP32[(((ptr)+(16))>>2)]=value4;
        HEAP32[(((ptr)+(20))>>2)]=value4;
        HEAP32[(((ptr)+(24))>>2)]=value4;
        HEAP32[(((ptr)+(28))>>2)]=value4;
        HEAP32[(((ptr)+(32))>>2)]=value4;
        HEAP32[(((ptr)+(36))>>2)]=value4;
        HEAP32[(((ptr)+(40))>>2)]=value4;
        HEAP32[(((ptr)+(44))>>2)]=value4;
        HEAP32[(((ptr)+(48))>>2)]=value4;
        HEAP32[(((ptr)+(52))>>2)]=value4;
        HEAP32[(((ptr)+(56))>>2)]=value4;
        HEAP32[(((ptr)+(60))>>2)]=value4;
        ptr = (ptr + 64)|0;
      }

      while ((ptr|0) < (aligned_end|0) ) {
        HEAP32[((ptr)>>2)]=value4;
        ptr = (ptr+4)|0;
      }
    }
    // The remaining bytes.
    while ((ptr|0) < (end|0)) {
      HEAP8[((ptr)>>0)]=value;
      ptr = (ptr+1)|0;
    }
    return (end-num)|0;
}
function _sbrk(increment) {
    increment = increment|0;
    var oldDynamicTop = 0;
    var oldDynamicTopOnChange = 0;
    var newDynamicTop = 0;
    var totalMemory = 0;
    oldDynamicTop = HEAP32[DYNAMICTOP_PTR>>2]|0;
    newDynamicTop = oldDynamicTop + increment | 0;

    if (((increment|0) > 0 & (newDynamicTop|0) < (oldDynamicTop|0)) // Detect and fail if we would wrap around signed 32-bit int.
      | (newDynamicTop|0) < 0) { // Also underflow, sbrk() should be able to be used to subtract.
      abortOnCannotGrowMemory()|0;
      ___setErrNo(12);
      return -1;
    }

    HEAP32[DYNAMICTOP_PTR>>2] = newDynamicTop;
    totalMemory = getTotalMemory()|0;
    if ((newDynamicTop|0) > (totalMemory|0)) {
      if ((enlargeMemory()|0) == 0) {
        HEAP32[DYNAMICTOP_PTR>>2] = oldDynamicTop;
        ___setErrNo(12);
        return -1;
      }
    }
    return oldDynamicTop|0;
}

  
function dynCall_ii(index,a1) {
  index = index|0;
  a1=a1|0;
  return FUNCTION_TABLE_ii[index&1](a1|0)|0;
}


function dynCall_iiii(index,a1,a2,a3) {
  index = index|0;
  a1=a1|0; a2=a2|0; a3=a3|0;
  return FUNCTION_TABLE_iiii[index&7](a1|0,a2|0,a3|0)|0;
}

function b0(p0) {
 p0 = p0|0; nullFunc_ii(0);return 0;
}
function b1(p0,p1,p2) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0; nullFunc_iiii(1);return 0;
}

// EMSCRIPTEN_END_FUNCS
var FUNCTION_TABLE_ii = [b0,___stdio_close];
var FUNCTION_TABLE_iiii = [b1,b1,___stdout_write,___stdio_seek,___stdio_write,b1,b1,b1];

  return { ___errno_location: ___errno_location, ___muldi3: ___muldi3, _bitshift64Ashr: _bitshift64Ashr, _bitshift64Lshr: _bitshift64Lshr, _bitshift64Shl: _bitshift64Shl, _ed25519_create_keypair: _ed25519_create_keypair, _ed25519_derive_public_key: _ed25519_derive_public_key, _ed25519_sign: _ed25519_sign, _ed25519_verify: _ed25519_verify, _fflush: _fflush, _free: _free, _i64Add: _i64Add, _i64Subtract: _i64Subtract, _malloc: _malloc, _memcpy: _memcpy, _memset: _memset, _sbrk: _sbrk, dynCall_ii: dynCall_ii, dynCall_iiii: dynCall_iiii, establishStackSpace: establishStackSpace, getTempRet0: getTempRet0, runPostSets: runPostSets, setTempRet0: setTempRet0, setThrew: setThrew, stackAlloc: stackAlloc, stackRestore: stackRestore, stackSave: stackSave };
})
// EMSCRIPTEN_END_ASM
(Module.asmGlobalArg, Module.asmLibraryArg, buffer);

var real____errno_location = asm["___errno_location"]; asm["___errno_location"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real____errno_location.apply(null, arguments);
};

var real____muldi3 = asm["___muldi3"]; asm["___muldi3"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real____muldi3.apply(null, arguments);
};

var real__bitshift64Ashr = asm["_bitshift64Ashr"]; asm["_bitshift64Ashr"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__bitshift64Ashr.apply(null, arguments);
};

var real__bitshift64Lshr = asm["_bitshift64Lshr"]; asm["_bitshift64Lshr"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__bitshift64Lshr.apply(null, arguments);
};

var real__bitshift64Shl = asm["_bitshift64Shl"]; asm["_bitshift64Shl"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__bitshift64Shl.apply(null, arguments);
};

var real__ed25519_create_keypair = asm["_ed25519_create_keypair"]; asm["_ed25519_create_keypair"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__ed25519_create_keypair.apply(null, arguments);
};

var real__ed25519_derive_public_key = asm["_ed25519_derive_public_key"]; asm["_ed25519_derive_public_key"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__ed25519_derive_public_key.apply(null, arguments);
};

var real__ed25519_sign = asm["_ed25519_sign"]; asm["_ed25519_sign"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__ed25519_sign.apply(null, arguments);
};

var real__ed25519_verify = asm["_ed25519_verify"]; asm["_ed25519_verify"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__ed25519_verify.apply(null, arguments);
};

var real__fflush = asm["_fflush"]; asm["_fflush"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__fflush.apply(null, arguments);
};

var real__free = asm["_free"]; asm["_free"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__free.apply(null, arguments);
};

var real__i64Add = asm["_i64Add"]; asm["_i64Add"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__i64Add.apply(null, arguments);
};

var real__i64Subtract = asm["_i64Subtract"]; asm["_i64Subtract"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__i64Subtract.apply(null, arguments);
};

var real__malloc = asm["_malloc"]; asm["_malloc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__malloc.apply(null, arguments);
};

var real__sbrk = asm["_sbrk"]; asm["_sbrk"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sbrk.apply(null, arguments);
};

var real_establishStackSpace = asm["establishStackSpace"]; asm["establishStackSpace"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_establishStackSpace.apply(null, arguments);
};

var real_getTempRet0 = asm["getTempRet0"]; asm["getTempRet0"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_getTempRet0.apply(null, arguments);
};

var real_setTempRet0 = asm["setTempRet0"]; asm["setTempRet0"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_setTempRet0.apply(null, arguments);
};

var real_setThrew = asm["setThrew"]; asm["setThrew"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_setThrew.apply(null, arguments);
};

var real_stackAlloc = asm["stackAlloc"]; asm["stackAlloc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_stackAlloc.apply(null, arguments);
};

var real_stackRestore = asm["stackRestore"]; asm["stackRestore"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_stackRestore.apply(null, arguments);
};

var real_stackSave = asm["stackSave"]; asm["stackSave"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_stackSave.apply(null, arguments);
};
var ___errno_location = Module["___errno_location"] = asm["___errno_location"];
var ___muldi3 = Module["___muldi3"] = asm["___muldi3"];
var _bitshift64Ashr = Module["_bitshift64Ashr"] = asm["_bitshift64Ashr"];
var _bitshift64Lshr = Module["_bitshift64Lshr"] = asm["_bitshift64Lshr"];
var _bitshift64Shl = Module["_bitshift64Shl"] = asm["_bitshift64Shl"];
var _ed25519_create_keypair = Module["_ed25519_create_keypair"] = asm["_ed25519_create_keypair"];
var _ed25519_derive_public_key = Module["_ed25519_derive_public_key"] = asm["_ed25519_derive_public_key"];
var _ed25519_sign = Module["_ed25519_sign"] = asm["_ed25519_sign"];
var _ed25519_verify = Module["_ed25519_verify"] = asm["_ed25519_verify"];
var _fflush = Module["_fflush"] = asm["_fflush"];
var _free = Module["_free"] = asm["_free"];
var _i64Add = Module["_i64Add"] = asm["_i64Add"];
var _i64Subtract = Module["_i64Subtract"] = asm["_i64Subtract"];
var _malloc = Module["_malloc"] = asm["_malloc"];
var _memcpy = Module["_memcpy"] = asm["_memcpy"];
var _memset = Module["_memset"] = asm["_memset"];
var _sbrk = Module["_sbrk"] = asm["_sbrk"];
var establishStackSpace = Module["establishStackSpace"] = asm["establishStackSpace"];
var getTempRet0 = Module["getTempRet0"] = asm["getTempRet0"];
var runPostSets = Module["runPostSets"] = asm["runPostSets"];
var setTempRet0 = Module["setTempRet0"] = asm["setTempRet0"];
var setThrew = Module["setThrew"] = asm["setThrew"];
var stackAlloc = Module["stackAlloc"] = asm["stackAlloc"];
var stackRestore = Module["stackRestore"] = asm["stackRestore"];
var stackSave = Module["stackSave"] = asm["stackSave"];
var dynCall_ii = Module["dynCall_ii"] = asm["dynCall_ii"];
var dynCall_iiii = Module["dynCall_iiii"] = asm["dynCall_iiii"];
;



// === Auto-generated postamble setup entry stuff ===

Module['asm'] = asm;

if (!Module["intArrayFromString"]) Module["intArrayFromString"] = function() { abort("'intArrayFromString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["intArrayToString"]) Module["intArrayToString"] = function() { abort("'intArrayToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
Module["ccall"] = ccall;
Module["cwrap"] = cwrap;
if (!Module["setValue"]) Module["setValue"] = function() { abort("'setValue' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["getValue"]) Module["getValue"] = function() { abort("'getValue' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["allocate"]) Module["allocate"] = function() { abort("'allocate' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["getMemory"]) Module["getMemory"] = function() { abort("'getMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["Pointer_stringify"]) Module["Pointer_stringify"] = function() { abort("'Pointer_stringify' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["AsciiToString"]) Module["AsciiToString"] = function() { abort("'AsciiToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stringToAscii"]) Module["stringToAscii"] = function() { abort("'stringToAscii' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["UTF8ArrayToString"]) Module["UTF8ArrayToString"] = function() { abort("'UTF8ArrayToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["UTF8ToString"]) Module["UTF8ToString"] = function() { abort("'UTF8ToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stringToUTF8Array"]) Module["stringToUTF8Array"] = function() { abort("'stringToUTF8Array' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stringToUTF8"]) Module["stringToUTF8"] = function() { abort("'stringToUTF8' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["lengthBytesUTF8"]) Module["lengthBytesUTF8"] = function() { abort("'lengthBytesUTF8' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["UTF16ToString"]) Module["UTF16ToString"] = function() { abort("'UTF16ToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stringToUTF16"]) Module["stringToUTF16"] = function() { abort("'stringToUTF16' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["lengthBytesUTF16"]) Module["lengthBytesUTF16"] = function() { abort("'lengthBytesUTF16' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["UTF32ToString"]) Module["UTF32ToString"] = function() { abort("'UTF32ToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stringToUTF32"]) Module["stringToUTF32"] = function() { abort("'stringToUTF32' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["lengthBytesUTF32"]) Module["lengthBytesUTF32"] = function() { abort("'lengthBytesUTF32' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["allocateUTF8"]) Module["allocateUTF8"] = function() { abort("'allocateUTF8' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stackTrace"]) Module["stackTrace"] = function() { abort("'stackTrace' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["addOnPreRun"]) Module["addOnPreRun"] = function() { abort("'addOnPreRun' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["addOnInit"]) Module["addOnInit"] = function() { abort("'addOnInit' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["addOnPreMain"]) Module["addOnPreMain"] = function() { abort("'addOnPreMain' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["addOnExit"]) Module["addOnExit"] = function() { abort("'addOnExit' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["addOnPostRun"]) Module["addOnPostRun"] = function() { abort("'addOnPostRun' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["writeStringToMemory"]) Module["writeStringToMemory"] = function() { abort("'writeStringToMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["writeArrayToMemory"]) Module["writeArrayToMemory"] = function() { abort("'writeArrayToMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["writeAsciiToMemory"]) Module["writeAsciiToMemory"] = function() { abort("'writeAsciiToMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["addRunDependency"]) Module["addRunDependency"] = function() { abort("'addRunDependency' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["removeRunDependency"]) Module["removeRunDependency"] = function() { abort("'removeRunDependency' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS"]) Module["FS"] = function() { abort("'FS' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["FS_createFolder"]) Module["FS_createFolder"] = function() { abort("'FS_createFolder' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_createPath"]) Module["FS_createPath"] = function() { abort("'FS_createPath' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_createDataFile"]) Module["FS_createDataFile"] = function() { abort("'FS_createDataFile' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_createPreloadedFile"]) Module["FS_createPreloadedFile"] = function() { abort("'FS_createPreloadedFile' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_createLazyFile"]) Module["FS_createLazyFile"] = function() { abort("'FS_createLazyFile' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_createLink"]) Module["FS_createLink"] = function() { abort("'FS_createLink' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_createDevice"]) Module["FS_createDevice"] = function() { abort("'FS_createDevice' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_unlink"]) Module["FS_unlink"] = function() { abort("'FS_unlink' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["GL"]) Module["GL"] = function() { abort("'GL' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["staticAlloc"]) Module["staticAlloc"] = function() { abort("'staticAlloc' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["dynamicAlloc"]) Module["dynamicAlloc"] = function() { abort("'dynamicAlloc' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["warnOnce"]) Module["warnOnce"] = function() { abort("'warnOnce' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["loadDynamicLibrary"]) Module["loadDynamicLibrary"] = function() { abort("'loadDynamicLibrary' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["loadWebAssemblyModule"]) Module["loadWebAssemblyModule"] = function() { abort("'loadWebAssemblyModule' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["getLEB"]) Module["getLEB"] = function() { abort("'getLEB' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["getFunctionTables"]) Module["getFunctionTables"] = function() { abort("'getFunctionTables' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["alignFunctionTables"]) Module["alignFunctionTables"] = function() { abort("'alignFunctionTables' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["registerFunctions"]) Module["registerFunctions"] = function() { abort("'registerFunctions' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["addFunction"]) Module["addFunction"] = function() { abort("'addFunction' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["removeFunction"]) Module["removeFunction"] = function() { abort("'removeFunction' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["getFuncWrapper"]) Module["getFuncWrapper"] = function() { abort("'getFuncWrapper' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["prettyPrint"]) Module["prettyPrint"] = function() { abort("'prettyPrint' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["makeBigInt"]) Module["makeBigInt"] = function() { abort("'makeBigInt' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["dynCall"]) Module["dynCall"] = function() { abort("'dynCall' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["getCompilerSetting"]) Module["getCompilerSetting"] = function() { abort("'getCompilerSetting' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stackSave"]) Module["stackSave"] = function() { abort("'stackSave' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stackRestore"]) Module["stackRestore"] = function() { abort("'stackRestore' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stackAlloc"]) Module["stackAlloc"] = function() { abort("'stackAlloc' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["establishStackSpace"]) Module["establishStackSpace"] = function() { abort("'establishStackSpace' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["print"]) Module["print"] = function() { abort("'print' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["printErr"]) Module["printErr"] = function() { abort("'printErr' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["intArrayFromBase64"]) Module["intArrayFromBase64"] = function() { abort("'intArrayFromBase64' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["tryParseAsDataURI"]) Module["tryParseAsDataURI"] = function() { abort("'tryParseAsDataURI' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };if (!Module["ALLOC_NORMAL"]) Object.defineProperty(Module, "ALLOC_NORMAL", { get: function() { abort("'ALLOC_NORMAL' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") } });
if (!Module["ALLOC_STACK"]) Object.defineProperty(Module, "ALLOC_STACK", { get: function() { abort("'ALLOC_STACK' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") } });
if (!Module["ALLOC_STATIC"]) Object.defineProperty(Module, "ALLOC_STATIC", { get: function() { abort("'ALLOC_STATIC' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") } });
if (!Module["ALLOC_DYNAMIC"]) Object.defineProperty(Module, "ALLOC_DYNAMIC", { get: function() { abort("'ALLOC_DYNAMIC' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") } });
if (!Module["ALLOC_NONE"]) Object.defineProperty(Module, "ALLOC_NONE", { get: function() { abort("'ALLOC_NONE' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") } });

if (memoryInitializer) {
  if (!isDataURI(memoryInitializer)) {
    if (typeof Module['locateFile'] === 'function') {
      memoryInitializer = Module['locateFile'](memoryInitializer);
    } else if (Module['memoryInitializerPrefixURL']) {
      memoryInitializer = Module['memoryInitializerPrefixURL'] + memoryInitializer;
    }
  }
  if (ENVIRONMENT_IS_NODE || ENVIRONMENT_IS_SHELL) {
    var data = Module['readBinary'](memoryInitializer);
    HEAPU8.set(data, GLOBAL_BASE);
  } else {
    addRunDependency('memory initializer');
    var applyMemoryInitializer = function(data) {
      if (data.byteLength) data = new Uint8Array(data);
      for (var i = 0; i < data.length; i++) {
        assert(HEAPU8[GLOBAL_BASE + i] === 0, "area for memory initializer should not have been touched before it's loaded");
      }
      HEAPU8.set(data, GLOBAL_BASE);
      // Delete the typed array that contains the large blob of the memory initializer request response so that
      // we won't keep unnecessary memory lying around. However, keep the XHR object itself alive so that e.g.
      // its .status field can still be accessed later.
      if (Module['memoryInitializerRequest']) delete Module['memoryInitializerRequest'].response;
      removeRunDependency('memory initializer');
    }
    function doBrowserLoad() {
      Module['readAsync'](memoryInitializer, applyMemoryInitializer, function() {
        throw 'could not load memory initializer ' + memoryInitializer;
      });
    }
    var memoryInitializerBytes = tryParseAsDataURI(memoryInitializer);
    if (memoryInitializerBytes) {
      applyMemoryInitializer(memoryInitializerBytes.buffer);
    } else
    if (Module['memoryInitializerRequest']) {
      // a network request has already been created, just use that
      function useRequest() {
        var request = Module['memoryInitializerRequest'];
        var response = request.response;
        if (request.status !== 200 && request.status !== 0) {
          var data = tryParseAsDataURI(Module['memoryInitializerRequestURL']);
          if (data) {
            response = data.buffer;
          } else {
            // If you see this warning, the issue may be that you are using locateFile or memoryInitializerPrefixURL, and defining them in JS. That
            // means that the HTML file doesn't know about them, and when it tries to create the mem init request early, does it to the wrong place.
            // Look in your browser's devtools network console to see what's going on.
            console.warn('a problem seems to have happened with Module.memoryInitializerRequest, status: ' + request.status + ', retrying ' + memoryInitializer);
            doBrowserLoad();
            return;
          }
        }
        applyMemoryInitializer(response);
      }
      if (Module['memoryInitializerRequest'].response) {
        setTimeout(useRequest, 0); // it's already here; but, apply it asynchronously
      } else {
        Module['memoryInitializerRequest'].addEventListener('load', useRequest); // wait for it
      }
    } else {
      // fetch it from the network ourselves
      doBrowserLoad();
    }
  }
}



/**
 * @constructor
 * @extends {Error}
 * @this {ExitStatus}
 */
function ExitStatus(status) {
  this.name = "ExitStatus";
  this.message = "Program terminated with exit(" + status + ")";
  this.status = status;
};
ExitStatus.prototype = new Error();
ExitStatus.prototype.constructor = ExitStatus;

var initialStackTop;
var calledMain = false;

dependenciesFulfilled = function runCaller() {
  // If run has never been called, and we should call run (INVOKE_RUN is true, and Module.noInitialRun is not false)
  if (!Module['calledRun']) run();
  if (!Module['calledRun']) dependenciesFulfilled = runCaller; // try this again later, after new deps are fulfilled
}





/** @type {function(Array=)} */
function run(args) {
  args = args || Module['arguments'];

  if (runDependencies > 0) {
    return;
  }

  writeStackCookie();

  preRun();

  if (runDependencies > 0) return; // a preRun added a dependency, run will be called later
  if (Module['calledRun']) return; // run may have just been called through dependencies being fulfilled just in this very frame

  function doRun() {
    if (Module['calledRun']) return; // run may have just been called while the async setStatus time below was happening
    Module['calledRun'] = true;

    if (ABORT) return;

    ensureInitRuntime();

    preMain();

    if (Module['onRuntimeInitialized']) Module['onRuntimeInitialized']();

    assert(!Module['_main'], 'compiled without a main, but one is present. if you added it from JS, use Module["onRuntimeInitialized"]');

    postRun();
  }

  if (Module['setStatus']) {
    Module['setStatus']('Running...');
    setTimeout(function() {
      setTimeout(function() {
        Module['setStatus']('');
      }, 1);
      doRun();
    }, 1);
  } else {
    doRun();
  }
  checkStackCookie();
}
Module['run'] = run;

function checkUnflushedContent() {
  // Compiler settings do not allow exiting the runtime, so flushing
  // the streams is not possible. but in ASSERTIONS mode we check
  // if there was something to flush, and if so tell the user they
  // should request that the runtime be exitable.
  // Normally we would not even include flush() at all, but in ASSERTIONS
  // builds we do so just for this check, and here we see if there is any
  // content to flush, that is, we check if there would have been
  // something a non-ASSERTIONS build would have not seen.
  // How we flush the streams depends on whether we are in NO_FILESYSTEM
  // mode (which has its own special function for this; otherwise, all
  // the code is inside libc)
  var print = out;
  var printErr = err;
  var has = false;
  out = err = function(x) {
    has = true;
  }
  try { // it doesn't matter if it fails
    var flush = Module['_fflush'];
    if (flush) flush(0);
    // also flush in the JS FS layer
    var hasFS = true;
    if (hasFS) {
      ['stdout', 'stderr'].forEach(function(name) {
        var info = FS.analyzePath('/dev/' + name);
        if (!info) return;
        var stream = info.object;
        var rdev = stream.rdev;
        var tty = TTY.ttys[rdev];
        if (tty && tty.output && tty.output.length) {
          has = true;
        }
      });
    }
  } catch(e) {}
  out = print;
  err = printErr;
  if (has) {
    warnOnce('stdio streams had content in them that was not flushed. you should set NO_EXIT_RUNTIME to 0 (see the FAQ), or make sure to emit a newline when you printf etc.');
  }
}

function exit(status, implicit) {
  checkUnflushedContent();

  // if this is just main exit-ing implicitly, and the status is 0, then we
  // don't need to do anything here and can just leave. if the status is
  // non-zero, though, then we need to report it.
  // (we may have warned about this earlier, if a situation justifies doing so)
  if (implicit && Module['noExitRuntime'] && status === 0) {
    return;
  }

  if (Module['noExitRuntime']) {
    // if exit() was called, we may warn the user if the runtime isn't actually being shut down
    if (!implicit) {
      err('exit(' + status + ') called, but NO_EXIT_RUNTIME is set, so halting execution but not exiting the runtime or preventing further async execution (build with NO_EXIT_RUNTIME=0, if you want a true shutdown)');
    }
  } else {

    ABORT = true;
    EXITSTATUS = status;
    STACKTOP = initialStackTop;

    exitRuntime();

    if (Module['onExit']) Module['onExit'](status);
  }

  Module['quit'](status, new ExitStatus(status));
}

var abortDecorators = [];

function abort(what) {
  if (Module['onAbort']) {
    Module['onAbort'](what);
  }

  if (what !== undefined) {
    out(what);
    err(what);
    what = JSON.stringify(what)
  } else {
    what = '';
  }

  ABORT = true;
  EXITSTATUS = 1;

  var extra = '';
  var output = 'abort(' + what + ') at ' + stackTrace() + extra;
  if (abortDecorators) {
    abortDecorators.forEach(function(decorator) {
      output = decorator(output, what);
    });
  }
  throw output;
}
Module['abort'] = abort;

// {{PRE_RUN_ADDITIONS}}

if (Module['preInit']) {
  if (typeof Module['preInit'] == 'function') Module['preInit'] = [Module['preInit']];
  while (Module['preInit'].length > 0) {
    Module['preInit'].pop()();
  }
}


Module["noExitRuntime"] = true;

run();

// {{POST_RUN_ADDITIONS}}





// {{MODULE_ADDITIONS}}



