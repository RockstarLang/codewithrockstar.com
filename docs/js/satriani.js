(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.Satriani = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
module.exports = {
    Environment: Environment,
    eq: eq
}

const MYSTERIOUS = '__MYSTERIOUS__';

function Environment(parent) {
    this.vars = Object.create(parent ? parent.vars : null);
    this.parent = parent;
    this.output = (parent && parent.output ? parent.output : console.log);
    // Because nodeJS is based on asynchronous IO, there is no built-in console.readline or similar
    // so by default, any input will yield an empty string.
    this.input = (parent && parent.input ? parent.input : () => "")
}

Environment.prototype = {
    extend: function () { return new Environment(this) },

    exists: function (name) {
        return (name in this.vars);
    },

    lookup: function (name, index) {
        if (name in this.vars == false) {
            throw new Error("Undefined variable " + name);
        }
        let variable = this.vars[name];
        if (Array.isArray(variable)) {
            if (typeof (index) == 'undefined' || index == null) {
                return variable;
            }
            return variable[index];
        }
        if (typeof (variable) == 'string' && typeof (index) == 'number') {
            return (variable[index]);
        }
        return variable;
    },

    assign: function (name, value, index, local) {
        let container = (!local && typeof (value) != "function" && this.parent && name in this.parent.vars) ? this.parent.vars : this.vars;
        if (typeof (index) == 'undefined' || index == null) return container[name] = value;
        if (name in container) {
            if (!Array.isArray(container[name])) throw new Error(`Can't assign ${name} at ${index} - ${name} is not an indexed variable.`);
        } else {
            container[name] = new Array();
        }
        return container[name][index] = value;
    },

    run: function (program) {
        let result = evaluate(program, this);
        return (result ? result.value : undefined);
    },

    dealias: function (expr) {
        if (expr.variable.pronoun) return this.pronoun_alias;
        return (expr.variable);
    },

    pronoun_alias: null,
}

function toScalar(value) {
    if (Array.isArray(value)) {
        return value.length;
    }
    return value;
}

function evaluate(tree, env) {
    if (tree == MYSTERIOUS || typeof (tree) == 'undefined') return undefined;
    if (tree == null) return null;
    let list = Object.entries(tree)
    for (let i = 0; i < list.length; i++) {
        let node = list[i];
        let type = node[0];
        let expr = node[1];
        switch (type) {
            case "action": return (tree);
            case "list":
                let result = null;
                for (let i = 0; i < expr.length; i++) {
                    let next = expr[i];
                    result = evaluate(next, env);
                    if (result && result.action) return (result);
                }
                return result;
            case "conditional":
                if (toScalar(evaluate(expr.condition, env))) {
                    return evaluate(expr.consequent, env);
                } else if (expr.alternate) {
                    return evaluate(expr.alternate, env);
                }
                return;
            case 'break':
                return { 'action': 'break' };
            case 'continue':
                return { 'action': 'continue' };
            case "return":
                return { 'action': 'return', 'value': evaluate(expr.expression, env) };
            case "number":
            case "string":
            case "constant":
                return (expr);
            case "output":
                let printable = toScalar(evaluate(expr, env));
                if (typeof (printable) == 'undefined') printable = "mysterious";
                env.output(printable);
                return;
            case "listen":
                return env.input();
            case "binary":
                return binary(expr, env);
            case "lookup":
                return lookup(expr, env);
            case "assign":
                return assign(expr, env);
            case "pronoun":
                return env.lookup(env.pronoun_alias);
            case "blank":
                return;
            case "rounding":
                return rounding(expr, env);
            case "mutation":
                return mutation(expr, env);
            case "increment":
                let increment_name = env.dealias(expr);
                let old_increment_value = env.lookup(increment_name);
                switch (typeof (old_increment_value)) {
                    case "boolean":
                        if (expr.multiple % 2 != 0) env.assign(increment_name, !old_increment_value);
                        return;
                    default:
                        env.assign(increment_name, (old_increment_value + expr.multiple));
                        return;
                }
            case "decrement":
                let decrement_name = env.dealias(expr);
                let old_decrement_value = env.lookup(decrement_name);
                switch (typeof (old_decrement_value)) {
                    case "boolean":
                        if (expr.multiple % 2 != 0) env.assign(decrement_name, !old_decrement_value);
                        return;
                    default:
                        env.assign(decrement_name, (old_decrement_value - expr.multiple));
                        return;
                }
            case "while_loop":
                while_outer: while (toScalar(evaluate(expr.condition, env))) {
                    let result = evaluate(expr.consequent, env);
                    if (result) switch (result.action) {
                        case 'continue':
                            continue while_outer;
                        case 'break':
                            break while_outer;
                        case 'return':
                            return (result);
                    }
                }
                return;
            case "until_loop":
                until_outer: while (!toScalar(evaluate(expr.condition, env))) {
                    let result = evaluate(expr.consequent, env);
                    if (result) switch (result.action) {
                        case 'continue':
                            continue until_outer;
                        case 'break':
                            break until_outer;
                        case 'return':
                            return (result);
                    }
                }
                return;
            case "comparison":
                let lhs = evaluate(expr.lhs, env);
                let rhs = evaluate(expr.rhs, env);
                switch (expr.comparator) {
                    case "eq":
                        return eq(lhs, rhs);
                    case "ne":
                        return !eq(lhs, rhs);
                    case "lt":
                        return (toScalar(lhs) < toScalar(rhs));
                    case "le":
                        return (toScalar(lhs) <= toScalar(rhs));
                    case "ge":
                        return (toScalar(lhs) >= toScalar(rhs));
                    case "gt":
                        return (toScalar(lhs) > toScalar(rhs));
                    default:
                        throw new Error(`Unknown comparison operator ${expr.comparator}`);
                }
            case "not":
                return (!toScalar(evaluate(expr.expression, env)));
            case "function":
                env.assign(expr.name, make_lambda(expr, env));
                return;
            case "call":
                let func = env.lookup(expr.name);
                let func_result = func.apply(null, expr.args.map(arg => {
                    let value =  evaluate(arg, env);
                    // If the arg is an array, we shallow-copy it when passing it to a function call
                    return (value && value.map ? value.map(e => e) : value);                
                }));
                return (func_result ? func_result.value : undefined);
            case "enlist":
                return enlist(expr, env);
            case "delist":
                return delist(expr, env);
            default:
                if (Array.isArray(tree) && tree.length == 1) return (evaluate(tree[0], env));
                throw new Error("Sorry - I don't know how to evaluate this: " + JSON.stringify(tree))
        }
    }
}

function mutation(expr, env) {
    let source = evaluate(expr.source, env);
    let modifier = evaluate(expr.modifier, env);
    switch (expr.type) {
        case "split":
            return source.toString().split(modifier || "");
        case "cast":
            if (typeof (source) == 'string') return parseInt(source, modifier);
            if (typeof (source) == 'number') return String.fromCharCode(source);
            if (Array.isArray(source)) return String.fromCharCode(toScalar(source));
            throw new Error(`I don't know how to cast ${source}`);
        case "join":
            if (Array.isArray(source)) {
                let joiner = (typeof (modifier) == 'undefined' || modifier == null) ? '' : modifier;
                return source.join(joiner);
            }
            throw new Error("I don't know how to join that.");
    }
}

function lookup(expr, env) {
    let lookup_name = env.dealias(expr);
    let index = evaluate(expr.index, env);
    return env.lookup(lookup_name, index);
}

function assign(expr, env) {
    let target = expr.target;
    let index = evaluate(target.index, env);
    let alias = (target.variable.pronoun ? env.pronoun_alias : target.variable);
    let value = evaluate(expr.expression, env);
    env.assign(alias, value, index);
    if (!target.variable.pronoun) env.pronoun_alias = alias;
    return value;
}

function enlist(expr, env) {

    let array_value;
    let array_name = env.dealias(expr);

    if (env.exists(array_name)) {
        array_value = env.lookup(array_name, null, true);
        if (!Array.isArray(array_value)) array_value = [array_value];
    } else {
        array_value = [];
    }
    if (expr.expression) {
        let elements_to_enlist = (expr.expression.map ? expr.expression : [expr.expression]);
        array_value = array_value.concat(elements_to_enlist.map(e => evaluate(e, env)));
    }
    env.assign(array_name, array_value);
    return array_value;

    // let alias = "";
    // let target = expr.target;
    // let index = evaluate(target.index, env);
    // if (target.variable.pronoun) {
    //     alias = env.pronoun_alias;
    // } else {
    //     alias = target.variable;
    //     env.pronoun_alias = alias;
    // }

    // let value;
    // if (env.exists(alias)) {
    //     value = env.lookup(alias);
    //     if (!Array.isArray(value)) value = [value];
    // } else {
    //     value = [];
    // }
    // if (expr.expression) {
    //     let values = (expr.expression.map ? expr.expression : [expr.expression]);
    //     value = value.concat(values.map(e => evaluate(e, env)));
    // }
    // env.assign(alias, value, index);
    // return value;
}

function delist(expr, env) {
    let name = env.dealias(expr);
    let source = env.lookup(name, null)
    let result = (source.shift && source.shift());
    return result;
}

function rounding(expr, env) {
    let variable_name = env.dealias(expr);
    let variable_value = env.lookup(variable_name);
    switch (expr.direction) {
        case "up":
            return env.assign(variable_name, Math.ceil(variable_value));
        case "down":
            return env.assign(variable_name, Math.floor(variable_value));
        default:
            return env.assign(variable_name, Math.round(variable_value));
    }
}

function demystify(expr, env) {
    let result = evaluate(expr, env);
    if (typeof (result) == 'undefined') return ('mysterious');
    return (result);
}

function eq(lhs, rhs) {
    if (Array.isArray(lhs)) return (eq_array(lhs, rhs));
    if (Array.isArray(rhs)) return (eq_array(rhs, lhs));

    if (is_nothing(lhs) && is_nothing(rhs)) return (true);
    // if (typeof (lhs) == 'undefined') return (typeof (rhs) == 'undefined');
    // if (typeof (rhs) == 'undefined') return (typeof (lhs) == 'undefined');

    if (typeof (lhs) == 'boolean') return (eq_boolean(lhs, rhs));
    if (typeof (rhs) == 'boolean') return (eq_boolean(rhs, lhs));

    if (typeof (lhs) == 'number') return (eq_number(lhs, rhs));
    if (typeof (rhs) == 'number') return (eq_number(rhs, lhs));

    if (typeof (lhs) == 'string') return (eq_string(lhs, rhs));
    if (typeof (rhs) == 'string') return (eq_string(rhs, lhs));

    return lhs == rhs;
}

function is_nothing(thing) {
    return (
        typeof (thing) == 'undefined'
        ||
        thing === null
        ||
        thing === ""
        ||
        thing == 0
        ||
        thing == false
    );
}

function eq_array(array, other) {
    if (Array.isArray(other)) return ((array.length == other.length) && array.every((el, ix) => eq(el, other[ix])));
    if (other == null || other == 0 || other == "") return (array.length == 0);
    return (false);
}

function eq_string(string, other) {
    if (other == null || typeof (other) == 'undefined') return (string === "");
    return (other == string);
}

function eq_number(number, other) {
    if (other == null || typeof (other) == 'undefined') return (number === 0);
    return (other == number);
}

function eq_boolean(bool, other) {
    // false equals null in Rockstar
    if (other == null) other = false;
    // false equals zero in Rockstar
    if (typeof (other) == 'number') other = (other !== 0);
    if (typeof (other) == 'string') other = (other !== "");
    return (bool == other);
}

function make_lambda(expr, env) {
    function lambda() {
        let names = expr.args;
        if (names.length != arguments.length) throw ('Wrong number of arguments supplied to function ' + expr.name + ' (' + expr.args + ')');
        let scope = env.extend();
        for (let i = 0; i < names.length; ++i) scope.assign(names[i], arguments[i], null, 1)
        return evaluate(expr.body, scope);
    }

    return lambda;
}

function binary(b, env) {
    switch (b.op) {
        case "and": return (toScalar(evaluate(b.lhs, env)) && toScalar(evaluate(b.rhs, env)));
        case "nor": return (!toScalar(evaluate(b.lhs, env)) && !toScalar(evaluate(b.rhs, env)));
        case "or": return (toScalar(evaluate(b.lhs, env)) || toScalar(evaluate(b.rhs, env)));
        case '+': return add(b.lhs, b.rhs, env);
        case '-': return subtract(b.lhs, b.rhs, env);
        case '/': return divide(b.lhs, b.rhs, env);
        case '*': return multiply(b.lhs, b.rhs, env);
    }
}

function add(lhs, rhs, env) {
    return (rhs.reduce ? rhs : [rhs]).reduce((acc, val) => acc += toScalar(demystify(val, env)), toScalar(demystify(lhs, env)));
}

function subtract(lhs, rhs, env) {
    return (rhs.reduce ? rhs : [rhs]).reduce((acc, val) => acc -= toScalar(evaluate(val, env)), toScalar(evaluate(lhs, env)));
}

function divide(lhs, rhs, env) {
    return (rhs.reduce ? rhs : [rhs]).reduce((acc, val) => acc /= toScalar(evaluate(val, env)), toScalar(evaluate(lhs, env)));
}

function multiply(lhs, rhs, env) {
    return (rhs.reduce ? rhs : [rhs])
        .map(expr => toScalar(evaluate(expr, env)))
        .reduce(multiply_reduce, toScalar(evaluate(lhs, env)));
}

function multiply_reduce(acc, val, idx, src) {
    // Null, nothing, noone, nowhere, etc. are all zero for multiplication purposes.
    if (acc == null) acc = 0;
    if (val == null) val = 0;
    // Mu ltiplying numbers just works.
    if (typeof (acc) == 'number' && typeof (val) == 'number') return (acc * val);
    // Multiplying strings by numbers does repeated concatenation
    if (typeof (acc) == 'string' && typeof (val) == 'number') return multiply_string(acc, val);
    if (typeof (acc) == 'number' && typeof (val) == 'string') return multiply_string(val, acc);
}

function multiply_string(s, n) {
    let result = Array();
    while (--n >= 0) result.push(s);
    return (result.join(''));
}

},{}],2:[function(require,module,exports){
const parser = require('./satriani.parser.js');
const interpreter = require('./satriani.interpreter.js');

module.exports = {
    Interpreter : function() {
        this.run = function(program, input, output) {
            if (typeof(program) == 'string') program = this.parse(program);
            let env = new interpreter.Environment();
            env.output = output || console.log;
            env.input = input || (() => "");
            return env.run(program);
        }

        this.parse = function(program) {
            return parser.parse(program);
        }
    }
};

},{"./satriani.interpreter.js":1,"./satriani.parser.js":3}],3:[function(require,module,exports){
/*
 * Generated by PEG.js 0.10.0.
 *
 * http://pegjs.org/
 */

"use strict";

function peg$subclass(child, parent) {
  function ctor() { this.constructor = child; }
  ctor.prototype = parent.prototype;
  child.prototype = new ctor();
}

function peg$SyntaxError(message, expected, found, location) {
  this.message  = message;
  this.expected = expected;
  this.found    = found;
  this.location = location;
  this.name     = "SyntaxError";

  if (typeof Error.captureStackTrace === "function") {
    Error.captureStackTrace(this, peg$SyntaxError);
  }
}

peg$subclass(peg$SyntaxError, Error);

peg$SyntaxError.buildMessage = function(expected, found) {
  var DESCRIBE_EXPECTATION_FNS = {
        literal: function(expectation) {
          return "\"" + literalEscape(expectation.text) + "\"";
        },

        "class": function(expectation) {
          var escapedParts = "",
              i;

          for (i = 0; i < expectation.parts.length; i++) {
            escapedParts += expectation.parts[i] instanceof Array
              ? classEscape(expectation.parts[i][0]) + "-" + classEscape(expectation.parts[i][1])
              : classEscape(expectation.parts[i]);
          }

          return "[" + (expectation.inverted ? "^" : "") + escapedParts + "]";
        },

        any: function(expectation) {
          return "any character";
        },

        end: function(expectation) {
          return "end of input";
        },

        other: function(expectation) {
          return expectation.description;
        }
      };

  function hex(ch) {
    return ch.charCodeAt(0).toString(16).toUpperCase();
  }

  function literalEscape(s) {
    return s
      .replace(/\\/g, '\\\\')
      .replace(/"/g,  '\\"')
      .replace(/\0/g, '\\0')
      .replace(/\t/g, '\\t')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/[\x00-\x0F]/g,          function(ch) { return '\\x0' + hex(ch); })
      .replace(/[\x10-\x1F\x7F-\x9F]/g, function(ch) { return '\\x'  + hex(ch); });
  }

  function classEscape(s) {
    return s
      .replace(/\\/g, '\\\\')
      .replace(/\]/g, '\\]')
      .replace(/\^/g, '\\^')
      .replace(/-/g,  '\\-')
      .replace(/\0/g, '\\0')
      .replace(/\t/g, '\\t')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/[\x00-\x0F]/g,          function(ch) { return '\\x0' + hex(ch); })
      .replace(/[\x10-\x1F\x7F-\x9F]/g, function(ch) { return '\\x'  + hex(ch); });
  }

  function describeExpectation(expectation) {
    return DESCRIBE_EXPECTATION_FNS[expectation.type](expectation);
  }

  function describeExpected(expected) {
    var descriptions = new Array(expected.length),
        i, j;

    for (i = 0; i < expected.length; i++) {
      descriptions[i] = describeExpectation(expected[i]);
    }

    descriptions.sort();

    if (descriptions.length > 0) {
      for (i = 1, j = 1; i < descriptions.length; i++) {
        if (descriptions[i - 1] !== descriptions[i]) {
          descriptions[j] = descriptions[i];
          j++;
        }
      }
      descriptions.length = j;
    }

    switch (descriptions.length) {
      case 1:
        return descriptions[0];

      case 2:
        return descriptions[0] + " or " + descriptions[1];

      default:
        return descriptions.slice(0, -1).join(", ")
          + ", or "
          + descriptions[descriptions.length - 1];
    }
  }

  function describeFound(found) {
    return found ? "\"" + literalEscape(found) + "\"" : "end of input";
  }

  return "Expected " + describeExpected(expected) + " but " + describeFound(found) + " found.";
};

function peg$parse(input, options) {
  options = options !== void 0 ? options : {};

  var peg$FAILED = {},

      peg$startRuleFunctions = { program: peg$parseprogram },
      peg$startRuleFunction  = peg$parseprogram,

      peg$c0 = function(p) { return { list: p.filter(item => item) } },
      peg$c1 = function(s) { return s },
      peg$c2 = function() { return null },
      peg$c3 = /^[ \t]/,
      peg$c4 = peg$classExpectation([" ", "\t"], false, false),
      peg$c5 = "(",
      peg$c6 = peg$literalExpectation("(", false),
      peg$c7 = /^[^)]/,
      peg$c8 = peg$classExpectation([")"], true, false),
      peg$c9 = ")",
      peg$c10 = peg$literalExpectation(")", false),
      peg$c11 = /^[;,?!&.]/,
      peg$c12 = peg$classExpectation([";", ",", "?", "!", "&", "."], false, false),
      peg$c13 = "\r",
      peg$c14 = peg$literalExpectation("\r", false),
      peg$c15 = "\n",
      peg$c16 = peg$literalExpectation("\n", false),
      peg$c17 = peg$anyExpectation(),
      peg$c18 = /^[^\n]/,
      peg$c19 = peg$classExpectation(["\n"], true, false),
      peg$c20 = "break",
      peg$c21 = peg$literalExpectation("break", true),
      peg$c22 = function() {
      	return { 'break' : {} }
      },
      peg$c23 = "continue",
      peg$c24 = peg$literalExpectation("continue", true),
      peg$c25 = "take it to the top",
      peg$c26 = peg$literalExpectation("take it to the top", true),
      peg$c27 = function() {
      	return { 'continue' : {} }
      },
      peg$c28 = "takes",
      peg$c29 = peg$literalExpectation("takes", true),
      peg$c30 = "wants",
      peg$c31 = peg$literalExpectation("wants", true),
      peg$c32 = function(name, args, body) { return { 'function': {
          	name: name,
              args: args.map(arg => arg),
              body: body
          } } },
      peg$c33 = ", and",
      peg$c34 = peg$literalExpectation(", and", false),
      peg$c35 = "&",
      peg$c36 = peg$literalExpectation("&", false),
      peg$c37 = ",",
      peg$c38 = peg$literalExpectation(",", false),
      peg$c39 = "'n'",
      peg$c40 = peg$literalExpectation("'n'", false),
      peg$c41 = "and",
      peg$c42 = peg$literalExpectation("and", false),
      peg$c43 = function(head, tail) { return [head].concat(tail) },
      peg$c44 = function(arg) { return [arg] },
      peg$c45 = "taking",
      peg$c46 = peg$literalExpectation("taking", true),
      peg$c47 = function(name, args) { return { 'call': { name: name, args: Array.isArray(args) ? args : [args] } } },
      peg$c48 = "return",
      peg$c49 = peg$literalExpectation("return", true),
      peg$c50 = "give back",
      peg$c51 = peg$literalExpectation("give back", true),
      peg$c52 = "send",
      peg$c53 = peg$literalExpectation("send", true),
      peg$c54 = "give",
      peg$c55 = peg$literalExpectation("give", true),
      peg$c56 = "back",
      peg$c57 = peg$literalExpectation("back", true),
      peg$c58 = function(e) { return { 'return': { 'expression' : e } } },
      peg$c59 = "listen to",
      peg$c60 = peg$literalExpectation("listen to", true),
      peg$c61 = function(target) { return { assign: { expression: { listen : ''}, target: target } } },
      peg$c62 = "listen",
      peg$c63 = peg$literalExpectation("listen", true),
      peg$c64 = function() { return { 'listen' : ''} },
      peg$c65 = function(head, tail) {
                return { list : [head].concat(tail) }
              },
      peg$c66 = "else",
      peg$c67 = peg$literalExpectation("else", true),
      peg$c68 = function(a) { return a },
      peg$c69 = "if",
      peg$c70 = peg$literalExpectation("if", true),
      peg$c71 = function(e, c, a) {
                return {
                    'conditional': {
                        'condition' : e,
                          'consequent' : c,
                          'alternate' : a
                      }
                  };
              },
      peg$c72 = "while",
      peg$c73 = peg$literalExpectation("while", true),
      peg$c74 = function(e, c) { return { 'while_loop': {
                  'condition': e,
                  'consequent': c
               } }; },
      peg$c75 = "until",
      peg$c76 = peg$literalExpectation("until", true),
      peg$c77 = function(e, c) { return { 'until_loop': {
                  'condition': e,
                  'consequent': c
               } }; },
      peg$c78 = "say",
      peg$c79 = peg$literalExpectation("say", true),
      peg$c80 = "shout",
      peg$c81 = peg$literalExpectation("shout", true),
      peg$c82 = "whisper",
      peg$c83 = peg$literalExpectation("whisper", true),
      peg$c84 = "scream",
      peg$c85 = peg$literalExpectation("scream", true),
      peg$c86 = function(e) {return {'output': e}},
      peg$c87 = "true",
      peg$c88 = peg$literalExpectation("true", true),
      peg$c89 = "ok",
      peg$c90 = peg$literalExpectation("ok", true),
      peg$c91 = "right",
      peg$c92 = peg$literalExpectation("right", true),
      peg$c93 = "yes",
      peg$c94 = peg$literalExpectation("yes", true),
      peg$c95 = function() { return { constant: true } },
      peg$c96 = "false",
      peg$c97 = peg$literalExpectation("false", true),
      peg$c98 = "lies",
      peg$c99 = peg$literalExpectation("lies", true),
      peg$c100 = "wrong",
      peg$c101 = peg$literalExpectation("wrong", true),
      peg$c102 = "no",
      peg$c103 = peg$literalExpectation("no", true),
      peg$c104 = function() { return { constant: false } },
      peg$c105 = "null",
      peg$c106 = peg$literalExpectation("null", true),
      peg$c107 = "nothing",
      peg$c108 = peg$literalExpectation("nothing", true),
      peg$c109 = "nowhere",
      peg$c110 = peg$literalExpectation("nowhere", true),
      peg$c111 = "nobody",
      peg$c112 = peg$literalExpectation("nobody", true),
      peg$c113 = "gone",
      peg$c114 = peg$literalExpectation("gone", true),
      peg$c115 = function() { return { constant: null } },
      peg$c116 = "empty",
      peg$c117 = peg$literalExpectation("empty", true),
      peg$c118 = "silent",
      peg$c119 = peg$literalExpectation("silent", true),
      peg$c120 = "silence",
      peg$c121 = peg$literalExpectation("silence", true),
      peg$c122 = function() { return { constant: "" } },
      peg$c123 = "mysterious",
      peg$c124 = peg$literalExpectation("mysterious", false),
      peg$c125 = function() { return '__MYSTERIOUS__' },
      peg$c126 = "-",
      peg$c127 = peg$literalExpectation("-", false),
      peg$c128 = /^[0-9]/,
      peg$c129 = peg$classExpectation([["0", "9"]], false, false),
      peg$c130 = ".",
      peg$c131 = peg$literalExpectation(".", false),
      peg$c132 = function(n) { return {number: parseFloat(n)} },
      peg$c133 = function(n) { return {number: parseFloat(n) } },
      peg$c134 = "\"",
      peg$c135 = peg$literalExpectation("\"", false),
      peg$c136 = /^[^"]/,
      peg$c137 = peg$classExpectation(["\""], true, false),
      peg$c138 = function(s) { return {string: s}},
      peg$c139 = "nor",
      peg$c140 = peg$literalExpectation("nor", false),
      peg$c141 = function(lhs, rhs) {
      	return { 'binary' : { op: 'nor', lhs: lhs, rhs: rhs } } },
      peg$c142 = "or",
      peg$c143 = peg$literalExpectation("or", false),
      peg$c144 = function(lhs, rhs) {
      	return { 'binary': {
              op: 'or',
              lhs: lhs,
              rhs: rhs
          } }
       },
      peg$c145 = function(lhs, rhs) {
      	return { 'binary': {
              op: 'and',
              lhs: lhs,
              rhs: rhs
          } }
       },
      peg$c146 = function() { return 'ne' },
      peg$c147 = function() { return 'eq' },
      peg$c148 = function(lhs, c, rhs) {
            return {
                comparison: {
                    comparator: c,
                      lhs: lhs,
                      rhs: rhs
                  }
              };
          },
      peg$c149 = "not",
      peg$c150 = peg$literalExpectation("not", false),
      peg$c151 = function(e) { return { 'not': { expression: e} } },
      peg$c152 = "higher",
      peg$c153 = peg$literalExpectation("higher", true),
      peg$c154 = "greater",
      peg$c155 = peg$literalExpectation("greater", true),
      peg$c156 = "bigger",
      peg$c157 = peg$literalExpectation("bigger", true),
      peg$c158 = "stronger",
      peg$c159 = peg$literalExpectation("stronger", true),
      peg$c160 = "lower",
      peg$c161 = peg$literalExpectation("lower", true),
      peg$c162 = "less",
      peg$c163 = peg$literalExpectation("less", true),
      peg$c164 = "smaller",
      peg$c165 = peg$literalExpectation("smaller", true),
      peg$c166 = "weaker",
      peg$c167 = peg$literalExpectation("weaker", true),
      peg$c168 = "high",
      peg$c169 = peg$literalExpectation("high", true),
      peg$c170 = "great",
      peg$c171 = peg$literalExpectation("great", true),
      peg$c172 = "big",
      peg$c173 = peg$literalExpectation("big", true),
      peg$c174 = "strong",
      peg$c175 = peg$literalExpectation("strong", true),
      peg$c176 = "low",
      peg$c177 = peg$literalExpectation("low", true),
      peg$c178 = "little",
      peg$c179 = peg$literalExpectation("little", true),
      peg$c180 = "small",
      peg$c181 = peg$literalExpectation("small", true),
      peg$c182 = "weak",
      peg$c183 = peg$literalExpectation("weak", true),
      peg$c184 = "than",
      peg$c185 = peg$literalExpectation("than", true),
      peg$c186 = function() { return 'gt' },
      peg$c187 = function() { return 'lt' },
      peg$c188 = "as",
      peg$c189 = peg$literalExpectation("as", true),
      peg$c190 = function() { return 'ge' },
      peg$c191 = function() { return 'le' },
      peg$c192 = function(first, rest) { return rest.reduce(function(memo, curr) {
                            return { binary: { op: curr[0], lhs: memo, rhs: curr[1]} };
                      }, first); },
      peg$c193 = function(first, rest) { return rest.reduce(function(memo, curr) {
                          return { binary: { op: curr[0], lhs: memo, rhs: curr[1]} };
                      }, first); },
      peg$c194 = "+",
      peg$c195 = peg$literalExpectation("+", false),
      peg$c196 = "plus ",
      peg$c197 = peg$literalExpectation("plus ", false),
      peg$c198 = "with ",
      peg$c199 = peg$literalExpectation("with ", false),
      peg$c200 = function() { return '+' },
      peg$c201 = "minus ",
      peg$c202 = peg$literalExpectation("minus ", false),
      peg$c203 = "without ",
      peg$c204 = peg$literalExpectation("without ", false),
      peg$c205 = function() { return '-' },
      peg$c206 = "*",
      peg$c207 = peg$literalExpectation("*", false),
      peg$c208 = "times ",
      peg$c209 = peg$literalExpectation("times ", false),
      peg$c210 = "of ",
      peg$c211 = peg$literalExpectation("of ", false),
      peg$c212 = function() { return '*' },
      peg$c213 = "/",
      peg$c214 = peg$literalExpectation("/", false),
      peg$c215 = "over ",
      peg$c216 = peg$literalExpectation("over ", false),
      peg$c217 = "between ",
      peg$c218 = peg$literalExpectation("between ", false),
      peg$c219 = function() { return '/' },
      peg$c220 = "they",
      peg$c221 = peg$literalExpectation("they", true),
      peg$c222 = "them",
      peg$c223 = peg$literalExpectation("them", true),
      peg$c224 = "she",
      peg$c225 = peg$literalExpectation("she", true),
      peg$c226 = "him",
      peg$c227 = peg$literalExpectation("him", true),
      peg$c228 = "her",
      peg$c229 = peg$literalExpectation("her", true),
      peg$c230 = "hir",
      peg$c231 = peg$literalExpectation("hir", true),
      peg$c232 = "zie",
      peg$c233 = peg$literalExpectation("zie", true),
      peg$c234 = "zir",
      peg$c235 = peg$literalExpectation("zir", true),
      peg$c236 = "xem",
      peg$c237 = peg$literalExpectation("xem", true),
      peg$c238 = "ver",
      peg$c239 = peg$literalExpectation("ver", true),
      peg$c240 = "ze",
      peg$c241 = peg$literalExpectation("ze", true),
      peg$c242 = "ve",
      peg$c243 = peg$literalExpectation("ve", true),
      peg$c244 = "xe",
      peg$c245 = peg$literalExpectation("xe", true),
      peg$c246 = "it",
      peg$c247 = peg$literalExpectation("it", true),
      peg$c248 = "he",
      peg$c249 = peg$literalExpectation("he", true),
      peg$c250 = function(pronoun) { return { pronoun: pronoun.toLowerCase() } },
      peg$c251 = "an",
      peg$c252 = peg$literalExpectation("an", true),
      peg$c253 = "a",
      peg$c254 = peg$literalExpectation("a", true),
      peg$c255 = "the",
      peg$c256 = peg$literalExpectation("the", true),
      peg$c257 = "my",
      peg$c258 = peg$literalExpectation("my", true),
      peg$c259 = "your",
      peg$c260 = peg$literalExpectation("your", true),
      peg$c261 = /^[A-Z\xC0\xC1\xC2\xC3\xC4\xC5\xC6\xC7\xC8\xC9\xCA\xCB\xCC\xCD\xCE\xCF\xD0\xD1\xD2\xD3\xD4\xD5\xD6\xD8\xD9\xDA\xDB\xDC\xDD\xDE\u0100\u0102\u0104\u0106\u0108\u010A\u010C\u010E\u0110\u0112\u0114\u0116\u0118\u011A\u011C\u011E\u0120\u0122\u0124\u0126\u0128\u012A\u012C\u012E\u0130\u0132\u0134\u0136\u0138\u0139\u013B\u013D\u013F\u0141\u0143\u0145\u0147\u014A\u014C\u014E\u0150\u0152\u0154\u0156\u0158\u015A\u015C\u015E\u0160\u0162\u0164\u0166\u0168\u016A\u016C\u016E\u0170\u0172\u0174\u0176\u0178\u0179\u017B\u017D]/,
      peg$c262 = peg$classExpectation([["A", "Z"], "\xC0", "\xC1", "\xC2", "\xC3", "\xC4", "\xC5", "\xC6", "\xC7", "\xC8", "\xC9", "\xCA", "\xCB", "\xCC", "\xCD", "\xCE", "\xCF", "\xD0", "\xD1", "\xD2", "\xD3", "\xD4", "\xD5", "\xD6", "\xD8", "\xD9", "\xDA", "\xDB", "\xDC", "\xDD", "\xDE", "\u0100", "\u0102", "\u0104", "\u0106", "\u0108", "\u010A", "\u010C", "\u010E", "\u0110", "\u0112", "\u0114", "\u0116", "\u0118", "\u011A", "\u011C", "\u011E", "\u0120", "\u0122", "\u0124", "\u0126", "\u0128", "\u012A", "\u012C", "\u012E", "\u0130", "\u0132", "\u0134", "\u0136", "\u0138", "\u0139", "\u013B", "\u013D", "\u013F", "\u0141", "\u0143", "\u0145", "\u0147", "\u014A", "\u014C", "\u014E", "\u0150", "\u0152", "\u0154", "\u0156", "\u0158", "\u015A", "\u015C", "\u015E", "\u0160", "\u0162", "\u0164", "\u0166", "\u0168", "\u016A", "\u016C", "\u016E", "\u0170", "\u0172", "\u0174", "\u0176", "\u0178", "\u0179", "\u017B", "\u017D"], false, false),
      peg$c263 = /^[a-z\xE0\xE1\xE2\xE3\xE4\xE5\xE6\xE7\xE8\xE9\xEA\xEB\xEC\xED\xEE\xEF\xF0\xF1\xF2\xF3\xF4\xF5\xF6\xF8\xF9\xFA\xFB\xFC\xFD\xFE\u0101\u0103\u0105\u0107\u0109\u010B\u010D\u010F\u0111\u0113\u0115\u0117\u0119\u011B\u011D\u011F\u0121\u0123\u0125\u0127\u0129\u012B\u012D\u012F\u0131\u0133\u0135\u0137\u0138\u013A\u013C\u013E\u0140\u0142\u0144\u0146\u0148\u014B\u014D\u014F\u0151\u0153\u0155\u0157\u0159\u015B\u015D\u015F\u0161\u0163\u0165\u0167\u0169\u016B\u016D\u016F\u0171\u0173\u0175\u0177\xFF\u017A\u017C\u017E\u0149\xDF]/,
      peg$c264 = peg$classExpectation([["a", "z"], "\xE0", "\xE1", "\xE2", "\xE3", "\xE4", "\xE5", "\xE6", "\xE7", "\xE8", "\xE9", "\xEA", "\xEB", "\xEC", "\xED", "\xEE", "\xEF", "\xF0", "\xF1", "\xF2", "\xF3", "\xF4", "\xF5", "\xF6", "\xF8", "\xF9", "\xFA", "\xFB", "\xFC", "\xFD", "\xFE", "\u0101", "\u0103", "\u0105", "\u0107", "\u0109", "\u010B", "\u010D", "\u010F", "\u0111", "\u0113", "\u0115", "\u0117", "\u0119", "\u011B", "\u011D", "\u011F", "\u0121", "\u0123", "\u0125", "\u0127", "\u0129", "\u012B", "\u012D", "\u012F", "\u0131", "\u0133", "\u0135", "\u0137", "\u0138", "\u013A", "\u013C", "\u013E", "\u0140", "\u0142", "\u0144", "\u0146", "\u0148", "\u014B", "\u014D", "\u014F", "\u0151", "\u0153", "\u0155", "\u0157", "\u0159", "\u015B", "\u015D", "\u015F", "\u0161", "\u0163", "\u0165", "\u0167", "\u0169", "\u016B", "\u016D", "\u016F", "\u0171", "\u0173", "\u0175", "\u0177", "\xFF", "\u017A", "\u017C", "\u017E", "\u0149", "\xDF"], false, false),
      peg$c265 = function(prefix, name) { return (prefix + '_' + name).toLowerCase() },
      peg$c266 = "'s",
      peg$c267 = peg$literalExpectation("'s", true),
      peg$c268 = "'re",
      peg$c269 = peg$literalExpectation("'re", true),
      peg$c270 = "=",
      peg$c271 = peg$literalExpectation("=", false),
      peg$c272 = "is",
      peg$c273 = peg$literalExpectation("is", true),
      peg$c274 = "was",
      peg$c275 = peg$literalExpectation("was", true),
      peg$c276 = "are",
      peg$c277 = peg$literalExpectation("are", true),
      peg$c278 = "were",
      peg$c279 = peg$literalExpectation("were", true),
      peg$c280 = "isnt",
      peg$c281 = peg$literalExpectation("isnt", true),
      peg$c282 = "isn't",
      peg$c283 = peg$literalExpectation("isn't", true),
      peg$c284 = "aint",
      peg$c285 = peg$literalExpectation("aint", true),
      peg$c286 = "ain't",
      peg$c287 = peg$literalExpectation("ain't", true),
      peg$c288 = "arent",
      peg$c289 = peg$literalExpectation("arent", true),
      peg$c290 = "aren't",
      peg$c291 = peg$literalExpectation("aren't", true),
      peg$c292 = "wasnt",
      peg$c293 = peg$literalExpectation("wasnt", true),
      peg$c294 = "wasn't",
      peg$c295 = peg$literalExpectation("wasn't", true),
      peg$c296 = "werent",
      peg$c297 = peg$literalExpectation("werent", true),
      peg$c298 = "weren't",
      peg$c299 = peg$literalExpectation("weren't", true),
      peg$c300 = "rock",
      peg$c301 = peg$literalExpectation("rock", true),
      peg$c302 = "push",
      peg$c303 = peg$literalExpectation("push", true),
      peg$c304 = "roll",
      peg$c305 = peg$literalExpectation("roll", true),
      peg$c306 = "pop",
      peg$c307 = peg$literalExpectation("pop", true),
      peg$c308 = "into",
      peg$c309 = peg$literalExpectation("into", true),
      peg$c310 = "in",
      peg$c311 = peg$literalExpectation("in", true),
      peg$c312 = function(v) { return { delist: { variable: v } }; },
      peg$c313 = function(d) { return d; },
      peg$c314 = "at",
      peg$c315 = peg$literalExpectation("at", true),
      peg$c316 = function(v, i) { return { lookup: { variable: v, index: i } }; },
      peg$c317 = function(v) { return { lookup: { variable: v } }; },
      peg$c318 = function(i) { return i },
      peg$c319 = function(v, i) { return { variable: v, index: i }; },
      peg$c320 = function(target, e) { return { assign: { target: target, expression: e} }; },
      peg$c321 = "says ",
      peg$c322 = peg$literalExpectation("says ", true),
      peg$c323 = "put",
      peg$c324 = peg$literalExpectation("put", true),
      peg$c325 = function(e, target) { return { assign: { target: target, expression: e} }; },
      peg$c326 = "let",
      peg$c327 = peg$literalExpectation("let", true),
      peg$c328 = "be",
      peg$c329 = peg$literalExpectation("be", true),
      peg$c330 = function(target, o, e) {
            return { assign: {
              target: target,
              expression: { binary: {  op: o, lhs: { lookup: target }, rhs: e } }
            } };
          },
      peg$c331 = function(t, e) { return { assign: { target: t, expression: e} }; },
      peg$c332 = function(e, v) { return { enlist: { variable: v, expression: e } }; },
      peg$c333 = "like",
      peg$c334 = peg$literalExpectation("like", true),
      peg$c335 = function(v, e) { return { enlist: { variable: v, expression: e } }; },
      peg$c336 = "with",
      peg$c337 = peg$literalExpectation("with", true),
      peg$c338 = function(v) { return { enlist: { variable: v } }; },
      peg$c339 = function(e, target) { return { assign: { target: target, expression: e } }; },
      peg$c340 = /^[^\r\n]/,
      peg$c341 = peg$classExpectation(["\r", "\n"], true, false),
      peg$c342 = function(s) { return { string: s} },
      peg$c343 = function(n, d) { return { number: parseFloat(d?n+'.'+d:n)}},
      peg$c344 = function(d) {return d},
      peg$c345 = /^[0-9',;:?!+_\/]/,
      peg$c346 = peg$classExpectation([["0", "9"], "'", ",", ";", ":", "?", "!", "+", "_", "/"], false, false),
      peg$c347 = function(head, tail) { return head + tail },
      peg$c348 = function(d) { return d },
      peg$c349 = /^[A-Za-z\-']/,
      peg$c350 = peg$classExpectation([["A", "Z"], ["a", "z"], "-", "'"], false, false),
      peg$c351 = function(t) { return (t.filter(c => /[A-Za-z\-]/.test(c)).length%10).toString()},
      peg$c352 = function(name) { return isKeyword(name) },
      peg$c353 = function(name) { return name.toLowerCase() },
      peg$c354 = function(noun) { return isKeyword(noun) },
      peg$c355 = function(noun) { return noun },
      peg$c356 = " ",
      peg$c357 = peg$literalExpectation(" ", false),
      peg$c358 = function(head) { return head.replace(/ /g, '_').toLowerCase()  },
      peg$c359 = "build",
      peg$c360 = peg$literalExpectation("build", true),
      peg$c361 = "up",
      peg$c362 = peg$literalExpectation("up", true),
      peg$c363 = function(v, t) { return {
            increment: {
                variable: v,
                  multiple: t.length
              }
          }; },
      peg$c364 = "knock",
      peg$c365 = peg$literalExpectation("knock", true),
      peg$c366 = "down",
      peg$c367 = peg$literalExpectation("down", true),
      peg$c368 = function(v, t) { return {
            decrement: {
                variable: v,
                  multiple: t.length
              }
          }; },
      peg$c369 = "cut",
      peg$c370 = peg$literalExpectation("cut", true),
      peg$c371 = "split",
      peg$c372 = peg$literalExpectation("split", true),
      peg$c373 = "shatter",
      peg$c374 = peg$literalExpectation("shatter", true),
      peg$c375 = function() { return 'split' },
      peg$c376 = "cast",
      peg$c377 = peg$literalExpectation("cast", true),
      peg$c378 = "burn",
      peg$c379 = peg$literalExpectation("burn", true),
      peg$c380 = function() { return 'cast' },
      peg$c381 = "join",
      peg$c382 = peg$literalExpectation("join", true),
      peg$c383 = "unite",
      peg$c384 = peg$literalExpectation("unite", true),
      peg$c385 = function() { return 'join' },
      peg$c386 = "using",
      peg$c387 = peg$literalExpectation("using", true),
      peg$c388 = function(m) { return m },
      peg$c389 = function(op, s, t, m) { return { assign: { target: t, expression: { mutation: { type: op, source: s, modifier: m } } } } ; },
      peg$c390 = function(op, s, m) { return { assign: { target: s, expression: { mutation: { type: op, source: { lookup: s }, modifier: m } } } } ; },
      peg$c391 = "turn",
      peg$c392 = peg$literalExpectation("turn", true),
      peg$c393 = function(v) { return { rounding: { variable: v, direction: 'down'  } }; },
      peg$c394 = function(v) { return { rounding: { variable: v, direction: 'up'  } }; },
      peg$c395 = function(v) { return { rounding: { variable: v, direction: 'up' } }; },
      peg$c396 = "round",
      peg$c397 = peg$literalExpectation("round", true),
      peg$c398 = "around",
      peg$c399 = peg$literalExpectation("around", true),
      peg$c400 = function(v) { return { rounding: { variable: v, direction: 'nearest' } }; },

      peg$currPos          = 0,
      peg$savedPos         = 0,
      peg$posDetailsCache  = [{ line: 1, column: 1 }],
      peg$maxFailPos       = 0,
      peg$maxFailExpected  = [],
      peg$silentFails      = 0,

      peg$resultsCache = {},

      peg$result;

  if ("startRule" in options) {
    if (!(options.startRule in peg$startRuleFunctions)) {
      throw new Error("Can't start parsing from rule \"" + options.startRule + "\".");
    }

    peg$startRuleFunction = peg$startRuleFunctions[options.startRule];
  }

  function text() {
    return input.substring(peg$savedPos, peg$currPos);
  }

  function location() {
    return peg$computeLocation(peg$savedPos, peg$currPos);
  }

  function expected(description, location) {
    location = location !== void 0 ? location : peg$computeLocation(peg$savedPos, peg$currPos)

    throw peg$buildStructuredError(
      [peg$otherExpectation(description)],
      input.substring(peg$savedPos, peg$currPos),
      location
    );
  }

  function error(message, location) {
    location = location !== void 0 ? location : peg$computeLocation(peg$savedPos, peg$currPos)

    throw peg$buildSimpleError(message, location);
  }

  function peg$literalExpectation(text, ignoreCase) {
    return { type: "literal", text: text, ignoreCase: ignoreCase };
  }

  function peg$classExpectation(parts, inverted, ignoreCase) {
    return { type: "class", parts: parts, inverted: inverted, ignoreCase: ignoreCase };
  }

  function peg$anyExpectation() {
    return { type: "any" };
  }

  function peg$endExpectation() {
    return { type: "end" };
  }

  function peg$otherExpectation(description) {
    return { type: "other", description: description };
  }

  function peg$computePosDetails(pos) {
    var details = peg$posDetailsCache[pos], p;

    if (details) {
      return details;
    } else {
      p = pos - 1;
      while (!peg$posDetailsCache[p]) {
        p--;
      }

      details = peg$posDetailsCache[p];
      details = {
        line:   details.line,
        column: details.column
      };

      while (p < pos) {
        if (input.charCodeAt(p) === 10) {
          details.line++;
          details.column = 1;
        } else {
          details.column++;
        }

        p++;
      }

      peg$posDetailsCache[pos] = details;
      return details;
    }
  }

  function peg$computeLocation(startPos, endPos) {
    var startPosDetails = peg$computePosDetails(startPos),
        endPosDetails   = peg$computePosDetails(endPos);

    return {
      start: {
        offset: startPos,
        line:   startPosDetails.line,
        column: startPosDetails.column
      },
      end: {
        offset: endPos,
        line:   endPosDetails.line,
        column: endPosDetails.column
      }
    };
  }

  function peg$fail(expected) {
    if (peg$currPos < peg$maxFailPos) { return; }

    if (peg$currPos > peg$maxFailPos) {
      peg$maxFailPos = peg$currPos;
      peg$maxFailExpected = [];
    }

    peg$maxFailExpected.push(expected);
  }

  function peg$buildSimpleError(message, location) {
    return new peg$SyntaxError(message, null, null, location);
  }

  function peg$buildStructuredError(expected, found, location) {
    return new peg$SyntaxError(
      peg$SyntaxError.buildMessage(expected, found),
      expected,
      found,
      location
    );
  }

  function peg$parseprogram() {
    var s0, s1, s2;

    var key    = peg$currPos * 101 + 0,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$currPos;
    s1 = [];
    s2 = peg$parseline();
    while (s2 !== peg$FAILED) {
      s1.push(s2);
      s2 = peg$parseline();
    }
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$c0(s1);
    }
    s0 = s1;

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parseline() {
    var s0, s1, s2, s3, s4;

    var key    = peg$currPos * 101 + 1,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$currPos;
    s1 = [];
    s2 = peg$parse_();
    while (s2 !== peg$FAILED) {
      s1.push(s2);
      s2 = peg$parse_();
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$parsestatement();
      if (s2 !== peg$FAILED) {
        s3 = [];
        s4 = peg$parseEOL();
        if (s4 !== peg$FAILED) {
          while (s4 !== peg$FAILED) {
            s3.push(s4);
            s4 = peg$parseEOL();
          }
        } else {
          s3 = peg$FAILED;
        }
        if (s3 === peg$FAILED) {
          s3 = peg$parseEOF();
        }
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c1(s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      s1 = peg$parseEOL();
      if (s1 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c2();
      }
      s0 = s1;
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parsewhitespace() {
    var s0;

    var key    = peg$currPos * 101 + 2,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    if (peg$c3.test(input.charAt(peg$currPos))) {
      s0 = input.charAt(peg$currPos);
      peg$currPos++;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c4); }
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parsecomment() {
    var s0, s1, s2, s3;

    var key    = peg$currPos * 101 + 3,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$currPos;
    if (input.charCodeAt(peg$currPos) === 40) {
      s1 = peg$c5;
      peg$currPos++;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c6); }
    }
    if (s1 !== peg$FAILED) {
      s2 = [];
      if (peg$c7.test(input.charAt(peg$currPos))) {
        s3 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s3 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c8); }
      }
      while (s3 !== peg$FAILED) {
        s2.push(s3);
        if (peg$c7.test(input.charAt(peg$currPos))) {
          s3 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c8); }
        }
      }
      if (s2 !== peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 41) {
          s3 = peg$c9;
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c10); }
        }
        if (s3 !== peg$FAILED) {
          s1 = [s1, s2, s3];
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parse_() {
    var s0, s1;

    var key    = peg$currPos * 101 + 4,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = [];
    s1 = peg$parsewhitespace();
    if (s1 === peg$FAILED) {
      s1 = peg$parsecomment();
    }
    if (s1 !== peg$FAILED) {
      while (s1 !== peg$FAILED) {
        s0.push(s1);
        s1 = peg$parsewhitespace();
        if (s1 === peg$FAILED) {
          s1 = peg$parsecomment();
        }
      }
    } else {
      s0 = peg$FAILED;
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parsenoise() {
    var s0;

    var key    = peg$currPos * 101 + 5,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$parse_();
    if (s0 === peg$FAILED) {
      if (peg$c11.test(input.charAt(peg$currPos))) {
        s0 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s0 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c12); }
      }
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parseEOL() {
    var s0, s1, s2, s3;

    var key    = peg$currPos * 101 + 6,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$currPos;
    s1 = [];
    s2 = peg$parsenoise();
    while (s2 !== peg$FAILED) {
      s1.push(s2);
      s2 = peg$parsenoise();
    }
    if (s1 !== peg$FAILED) {
      if (input.charCodeAt(peg$currPos) === 13) {
        s2 = peg$c13;
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c14); }
      }
      if (s2 === peg$FAILED) {
        s2 = null;
      }
      if (s2 !== peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 10) {
          s3 = peg$c15;
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c16); }
        }
        if (s3 !== peg$FAILED) {
          s1 = [s1, s2, s3];
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parseEOF() {
    var s0, s1;

    var key    = peg$currPos * 101 + 7,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$currPos;
    peg$silentFails++;
    if (input.length > peg$currPos) {
      s1 = input.charAt(peg$currPos);
      peg$currPos++;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c17); }
    }
    peg$silentFails--;
    if (s1 === peg$FAILED) {
      s0 = void 0;
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parseignore_rest_of_line() {
    var s0, s1, s2, s3;

    var key    = peg$currPos * 101 + 8,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$currPos;
    s1 = peg$parse_();
    if (s1 !== peg$FAILED) {
      s2 = [];
      if (peg$c18.test(input.charAt(peg$currPos))) {
        s3 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s3 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c19); }
      }
      while (s3 !== peg$FAILED) {
        s2.push(s3);
        if (peg$c18.test(input.charAt(peg$currPos))) {
          s3 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c19); }
        }
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = null;
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parsestatement() {
    var s0, s1, s2;

    var key    = peg$currPos * 101 + 9,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$currPos;
    s1 = [];
    s2 = peg$parse_();
    while (s2 !== peg$FAILED) {
      s1.push(s2);
      s2 = peg$parse_();
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$parsebreak();
      if (s2 === peg$FAILED) {
        s2 = peg$parsecontinue();
        if (s2 === peg$FAILED) {
          s2 = peg$parsefunction();
          if (s2 === peg$FAILED) {
            s2 = peg$parsefunction_call();
            if (s2 === peg$FAILED) {
              s2 = peg$parsefunction_return();
              if (s2 === peg$FAILED) {
                s2 = peg$parseloop();
                if (s2 === peg$FAILED) {
                  s2 = peg$parseconditional();
                  if (s2 === peg$FAILED) {
                    s2 = peg$parseoperation();
                    if (s2 === peg$FAILED) {
                      s2 = peg$parsenor();
                    }
                  }
                }
              }
            }
          }
        }
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c1(s2);
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parsebreak() {
    var s0, s1, s2;

    var key    = peg$currPos * 101 + 10,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 5).toLowerCase() === peg$c20) {
      s1 = input.substr(peg$currPos, 5);
      peg$currPos += 5;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c21); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$parseignore_rest_of_line();
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c22();
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parsecontinue() {
    var s0, s1, s2, s3;

    var key    = peg$currPos * 101 + 11,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$currPos;
    s1 = peg$currPos;
    if (input.substr(peg$currPos, 8).toLowerCase() === peg$c23) {
      s2 = input.substr(peg$currPos, 8);
      peg$currPos += 8;
    } else {
      s2 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c24); }
    }
    if (s2 !== peg$FAILED) {
      s3 = peg$parseignore_rest_of_line();
      if (s3 !== peg$FAILED) {
        s2 = [s2, s3];
        s1 = s2;
      } else {
        peg$currPos = s1;
        s1 = peg$FAILED;
      }
    } else {
      peg$currPos = s1;
      s1 = peg$FAILED;
    }
    if (s1 === peg$FAILED) {
      if (input.substr(peg$currPos, 18).toLowerCase() === peg$c25) {
        s1 = input.substr(peg$currPos, 18);
        peg$currPos += 18;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c26); }
      }
    }
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$c27();
    }
    s0 = s1;

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parsetakes() {
    var s0;

    var key    = peg$currPos * 101 + 12,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    if (input.substr(peg$currPos, 5).toLowerCase() === peg$c28) {
      s0 = input.substr(peg$currPos, 5);
      peg$currPos += 5;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c29); }
    }
    if (s0 === peg$FAILED) {
      if (input.substr(peg$currPos, 5).toLowerCase() === peg$c30) {
        s0 = input.substr(peg$currPos, 5);
        peg$currPos += 5;
      } else {
        s0 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c31); }
      }
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parsefunction() {
    var s0, s1, s2, s3, s4, s5, s6, s7, s8;

    var key    = peg$currPos * 101 + 13,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$currPos;
    s1 = peg$parsevariable();
    if (s1 !== peg$FAILED) {
      s2 = peg$parse_();
      if (s2 !== peg$FAILED) {
        s3 = peg$parsetakes();
        if (s3 !== peg$FAILED) {
          s4 = peg$parse_();
          if (s4 !== peg$FAILED) {
            s5 = peg$parsevariable_list();
            if (s5 !== peg$FAILED) {
              s6 = peg$parseEOL();
              if (s6 !== peg$FAILED) {
                s7 = peg$parseblock();
                if (s7 !== peg$FAILED) {
                  s8 = peg$parseEOL();
                  if (s8 !== peg$FAILED) {
                    peg$savedPos = s0;
                    s1 = peg$c32(s1, s5, s7);
                    s0 = s1;
                  } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parseexpression_list_separator() {
    var s0, s1, s2, s3;

    var key    = peg$currPos * 101 + 14,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$currPos;
    s1 = peg$parse_();
    if (s1 === peg$FAILED) {
      s1 = null;
    }
    if (s1 !== peg$FAILED) {
      if (input.substr(peg$currPos, 5) === peg$c33) {
        s2 = peg$c33;
        peg$currPos += 5;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c34); }
      }
      if (s2 !== peg$FAILED) {
        s3 = peg$parse_();
        if (s3 !== peg$FAILED) {
          s1 = [s1, s2, s3];
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      s1 = peg$parse_();
      if (s1 === peg$FAILED) {
        s1 = null;
      }
      if (s1 !== peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 38) {
          s2 = peg$c35;
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c36); }
        }
        if (s2 === peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 44) {
            s2 = peg$c37;
            peg$currPos++;
          } else {
            s2 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c38); }
          }
          if (s2 === peg$FAILED) {
            if (input.substr(peg$currPos, 3) === peg$c39) {
              s2 = peg$c39;
              peg$currPos += 3;
            } else {
              s2 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c40); }
            }
          }
        }
        if (s2 !== peg$FAILED) {
          s3 = peg$parse_();
          if (s3 === peg$FAILED) {
            s3 = null;
          }
          if (s3 !== peg$FAILED) {
            s1 = [s1, s2, s3];
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parsevariable_list_separator() {
    var s0, s1, s2, s3;

    var key    = peg$currPos * 101 + 15,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$parseexpression_list_separator();
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      s1 = peg$parse_();
      if (s1 !== peg$FAILED) {
        if (input.substr(peg$currPos, 3) === peg$c41) {
          s2 = peg$c41;
          peg$currPos += 3;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c42); }
        }
        if (s2 !== peg$FAILED) {
          s3 = peg$parse_();
          if (s3 !== peg$FAILED) {
            s1 = [s1, s2, s3];
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parsevariable_list() {
    var s0, s1, s2, s3;

    var key    = peg$currPos * 101 + 16,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$currPos;
    s1 = peg$parsevariable();
    if (s1 !== peg$FAILED) {
      s2 = peg$parsevariable_list_separator();
      if (s2 !== peg$FAILED) {
        s3 = peg$parsevariable_list();
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c43(s1, s3);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      s1 = peg$parsevariable();
      if (s1 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c44(s1);
      }
      s0 = s1;
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parsefunction_call() {
    var s0, s1, s2, s3, s4, s5;

    var key    = peg$currPos * 101 + 17,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$currPos;
    s1 = peg$parsevariable();
    if (s1 !== peg$FAILED) {
      s2 = peg$parse_();
      if (s2 !== peg$FAILED) {
        if (input.substr(peg$currPos, 6).toLowerCase() === peg$c45) {
          s3 = input.substr(peg$currPos, 6);
          peg$currPos += 6;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c46); }
        }
        if (s3 !== peg$FAILED) {
          s4 = peg$parse_();
          if (s4 !== peg$FAILED) {
            s5 = peg$parseexpression_list();
            if (s5 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$c47(s1, s5);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parseexpression_list() {
    var s0, s1, s2, s3;

    var key    = peg$currPos * 101 + 18,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$currPos;
    s1 = peg$parsesimple_expression();
    if (s1 !== peg$FAILED) {
      s2 = peg$parseexpression_list_separator();
      if (s2 !== peg$FAILED) {
        s3 = peg$parseexpression_list();
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c43(s1, s3);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      s1 = peg$parsesimple_expression();
      if (s1 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c44(s1);
      }
      s0 = s1;
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parsereturn() {
    var s0;

    var key    = peg$currPos * 101 + 19,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    if (input.substr(peg$currPos, 6).toLowerCase() === peg$c48) {
      s0 = input.substr(peg$currPos, 6);
      peg$currPos += 6;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c49); }
    }
    if (s0 === peg$FAILED) {
      if (input.substr(peg$currPos, 9).toLowerCase() === peg$c50) {
        s0 = input.substr(peg$currPos, 9);
        peg$currPos += 9;
      } else {
        s0 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c51); }
      }
      if (s0 === peg$FAILED) {
        if (input.substr(peg$currPos, 4).toLowerCase() === peg$c52) {
          s0 = input.substr(peg$currPos, 4);
          peg$currPos += 4;
        } else {
          s0 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c53); }
        }
        if (s0 === peg$FAILED) {
          if (input.substr(peg$currPos, 4).toLowerCase() === peg$c54) {
            s0 = input.substr(peg$currPos, 4);
            peg$currPos += 4;
          } else {
            s0 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c55); }
          }
        }
      }
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parsefunction_return() {
    var s0, s1, s2, s3, s4, s5, s6;

    var key    = peg$currPos * 101 + 20,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$currPos;
    s1 = peg$parsereturn();
    if (s1 !== peg$FAILED) {
      s2 = peg$parse_();
      if (s2 !== peg$FAILED) {
        s3 = peg$parsenor();
        if (s3 !== peg$FAILED) {
          s4 = peg$currPos;
          s5 = peg$parse_();
          if (s5 !== peg$FAILED) {
            if (input.substr(peg$currPos, 4).toLowerCase() === peg$c56) {
              s6 = input.substr(peg$currPos, 4);
              peg$currPos += 4;
            } else {
              s6 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c57); }
            }
            if (s6 !== peg$FAILED) {
              s5 = [s5, s6];
              s4 = s5;
            } else {
              peg$currPos = s4;
              s4 = peg$FAILED;
            }
          } else {
            peg$currPos = s4;
            s4 = peg$FAILED;
          }
          if (s4 === peg$FAILED) {
            s4 = null;
          }
          if (s4 !== peg$FAILED) {
            peg$savedPos = s0;
            s1 = peg$c58(s3);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parseoperation() {
    var s0;

    var key    = peg$currPos * 101 + 21,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$parsereadline();
    if (s0 === peg$FAILED) {
      s0 = peg$parseoutput();
      if (s0 === peg$FAILED) {
        s0 = peg$parsecrement();
        if (s0 === peg$FAILED) {
          s0 = peg$parsemutation();
          if (s0 === peg$FAILED) {
            s0 = peg$parseassignment();
            if (s0 === peg$FAILED) {
              s0 = peg$parserounding();
            }
          }
        }
      }
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parsereadline() {
    var s0, s1, s2, s3;

    var key    = peg$currPos * 101 + 22,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 9).toLowerCase() === peg$c59) {
      s1 = input.substr(peg$currPos, 9);
      peg$currPos += 9;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c60); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$parse_();
      if (s2 !== peg$FAILED) {
        s3 = peg$parseassignable();
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c61(s3);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      if (input.substr(peg$currPos, 6).toLowerCase() === peg$c62) {
        s1 = input.substr(peg$currPos, 6);
        peg$currPos += 6;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c63); }
      }
      if (s1 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c64();
      }
      s0 = s1;
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parsecontinuation() {
    var s0, s1, s2, s3;

    var key    = peg$currPos * 101 + 23,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$currPos;
    s1 = peg$parseEOL();
    if (s1 !== peg$FAILED) {
      s2 = [];
      s3 = peg$parse_();
      while (s3 !== peg$FAILED) {
        s2.push(s3);
        s3 = peg$parse_();
      }
      if (s2 !== peg$FAILED) {
        s3 = peg$parsestatement();
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c1(s3);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parseblock() {
    var s0, s1, s2, s3;

    var key    = peg$currPos * 101 + 24,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$currPos;
    s1 = peg$parsestatement();
    if (s1 !== peg$FAILED) {
      s2 = [];
      s3 = peg$parsecontinuation();
      if (s3 !== peg$FAILED) {
        while (s3 !== peg$FAILED) {
          s2.push(s3);
          s3 = peg$parsecontinuation();
        }
      } else {
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c65(s1, s2);
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      s1 = peg$parsestatement();
      if (s1 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c1(s1);
      }
      s0 = s1;
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parseconsequent() {
    var s0, s1, s2;

    var key    = peg$currPos * 101 + 25,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$currPos;
    s1 = peg$parse_();
    if (s1 !== peg$FAILED) {
      s2 = peg$parsestatement();
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c1(s2);
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      s1 = peg$parseEOL();
      if (s1 !== peg$FAILED) {
        s2 = peg$parseblock();
        if (s2 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c1(s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parsealternate() {
    var s0, s1, s2, s3, s4;

    var key    = peg$currPos * 101 + 26,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$currPos;
    s1 = peg$parse_();
    if (s1 !== peg$FAILED) {
      if (input.substr(peg$currPos, 4).toLowerCase() === peg$c66) {
        s2 = input.substr(peg$currPos, 4);
        peg$currPos += 4;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c67); }
      }
      if (s2 !== peg$FAILED) {
        s3 = peg$parse_();
        if (s3 !== peg$FAILED) {
          s4 = peg$parsestatement();
          if (s4 !== peg$FAILED) {
            peg$savedPos = s0;
            s1 = peg$c68(s4);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      s1 = [];
      s2 = peg$parseEOL();
      if (s2 !== peg$FAILED) {
        while (s2 !== peg$FAILED) {
          s1.push(s2);
          s2 = peg$parseEOL();
        }
      } else {
        s1 = peg$FAILED;
      }
      if (s1 !== peg$FAILED) {
        if (input.substr(peg$currPos, 4).toLowerCase() === peg$c66) {
          s2 = input.substr(peg$currPos, 4);
          peg$currPos += 4;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c67); }
        }
        if (s2 !== peg$FAILED) {
          s3 = peg$parse_();
          if (s3 !== peg$FAILED) {
            s4 = peg$parsestatement();
            if (s4 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$c68(s4);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        s1 = [];
        s2 = peg$parseEOL();
        if (s2 !== peg$FAILED) {
          while (s2 !== peg$FAILED) {
            s1.push(s2);
            s2 = peg$parseEOL();
          }
        } else {
          s1 = peg$FAILED;
        }
        if (s1 !== peg$FAILED) {
          if (input.substr(peg$currPos, 4).toLowerCase() === peg$c66) {
            s2 = input.substr(peg$currPos, 4);
            peg$currPos += 4;
          } else {
            s2 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c67); }
          }
          if (s2 !== peg$FAILED) {
            s3 = peg$parseEOL();
            if (s3 !== peg$FAILED) {
              s4 = peg$parseblock();
              if (s4 !== peg$FAILED) {
                peg$savedPos = s0;
                s1 = peg$c68(s4);
                s0 = s1;
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
        if (s0 === peg$FAILED) {
          s0 = peg$currPos;
          s1 = peg$parseEOL();
          if (s1 !== peg$FAILED) {
            peg$savedPos = s0;
            s1 = peg$c2();
          }
          s0 = s1;
        }
      }
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parseconditional() {
    var s0, s1, s2, s3, s4, s5;

    var key    = peg$currPos * 101 + 27,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 2).toLowerCase() === peg$c69) {
      s1 = input.substr(peg$currPos, 2);
      peg$currPos += 2;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c70); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$parse_();
      if (s2 !== peg$FAILED) {
        s3 = peg$parsenor();
        if (s3 !== peg$FAILED) {
          s4 = peg$parseconsequent();
          if (s4 === peg$FAILED) {
            s4 = null;
          }
          if (s4 !== peg$FAILED) {
            s5 = peg$parsealternate();
            if (s5 === peg$FAILED) {
              s5 = null;
            }
            if (s5 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$c71(s3, s4, s5);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parseloopable() {
    var s0, s1, s2, s3;

    var key    = peg$currPos * 101 + 28,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$currPos;
    s1 = peg$parse_();
    if (s1 !== peg$FAILED) {
      s2 = peg$parsestatement();
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c1(s2);
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      s1 = peg$parseEOL();
      if (s1 !== peg$FAILED) {
        s2 = peg$parseblock();
        if (s2 !== peg$FAILED) {
          s3 = peg$parseEOL();
          if (s3 !== peg$FAILED) {
            peg$savedPos = s0;
            s1 = peg$c1(s2);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parseloop() {
    var s0, s1, s2, s3, s4;

    var key    = peg$currPos * 101 + 29,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 5).toLowerCase() === peg$c72) {
      s1 = input.substr(peg$currPos, 5);
      peg$currPos += 5;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c73); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$parse_();
      if (s2 !== peg$FAILED) {
        s3 = peg$parsenor();
        if (s3 !== peg$FAILED) {
          s4 = peg$parseloopable();
          if (s4 !== peg$FAILED) {
            peg$savedPos = s0;
            s1 = peg$c74(s3, s4);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      if (input.substr(peg$currPos, 5).toLowerCase() === peg$c75) {
        s1 = input.substr(peg$currPos, 5);
        peg$currPos += 5;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c76); }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parse_();
        if (s2 !== peg$FAILED) {
          s3 = peg$parsenor();
          if (s3 !== peg$FAILED) {
            s4 = peg$parseloopable();
            if (s4 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$c77(s3, s4);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parseoutput() {
    var s0, s1, s2, s3;

    var key    = peg$currPos * 101 + 30,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 3).toLowerCase() === peg$c78) {
      s1 = input.substr(peg$currPos, 3);
      peg$currPos += 3;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c79); }
    }
    if (s1 === peg$FAILED) {
      if (input.substr(peg$currPos, 5).toLowerCase() === peg$c80) {
        s1 = input.substr(peg$currPos, 5);
        peg$currPos += 5;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c81); }
      }
      if (s1 === peg$FAILED) {
        if (input.substr(peg$currPos, 7).toLowerCase() === peg$c82) {
          s1 = input.substr(peg$currPos, 7);
          peg$currPos += 7;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c83); }
        }
        if (s1 === peg$FAILED) {
          if (input.substr(peg$currPos, 6).toLowerCase() === peg$c84) {
            s1 = input.substr(peg$currPos, 6);
            peg$currPos += 6;
          } else {
            s1 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c85); }
          }
        }
      }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$parse_();
      if (s2 !== peg$FAILED) {
        s3 = peg$parsenor();
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c86(s3);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parsesimple_expression() {
    var s0;

    var key    = peg$currPos * 101 + 31,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$parsefunction_call();
    if (s0 === peg$FAILED) {
      s0 = peg$parseconstant();
      if (s0 === peg$FAILED) {
        s0 = peg$parselookup();
        if (s0 === peg$FAILED) {
          s0 = peg$parseliteral();
          if (s0 === peg$FAILED) {
            s0 = peg$parsepronoun();
          }
        }
      }
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parseliteral() {
    var s0;

    var key    = peg$currPos * 101 + 32,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$parseconstant();
    if (s0 === peg$FAILED) {
      s0 = peg$parsenumber();
      if (s0 === peg$FAILED) {
        s0 = peg$parsestring();
      }
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parseconstant() {
    var s0;

    var key    = peg$currPos * 101 + 33,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$parsenull();
    if (s0 === peg$FAILED) {
      s0 = peg$parsetrue();
      if (s0 === peg$FAILED) {
        s0 = peg$parsefalse();
        if (s0 === peg$FAILED) {
          s0 = peg$parseempty_string();
          if (s0 === peg$FAILED) {
            s0 = peg$parsemysterious();
          }
        }
      }
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parsetrue() {
    var s0, s1, s2, s3;

    var key    = peg$currPos * 101 + 34,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 4).toLowerCase() === peg$c87) {
      s1 = input.substr(peg$currPos, 4);
      peg$currPos += 4;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c88); }
    }
    if (s1 === peg$FAILED) {
      if (input.substr(peg$currPos, 2).toLowerCase() === peg$c89) {
        s1 = input.substr(peg$currPos, 2);
        peg$currPos += 2;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c90); }
      }
      if (s1 === peg$FAILED) {
        if (input.substr(peg$currPos, 5).toLowerCase() === peg$c91) {
          s1 = input.substr(peg$currPos, 5);
          peg$currPos += 5;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c92); }
        }
        if (s1 === peg$FAILED) {
          if (input.substr(peg$currPos, 3).toLowerCase() === peg$c93) {
            s1 = input.substr(peg$currPos, 3);
            peg$currPos += 3;
          } else {
            s1 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c94); }
          }
        }
      }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseletter();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c95();
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parsefalse() {
    var s0, s1, s2, s3;

    var key    = peg$currPos * 101 + 35,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 5).toLowerCase() === peg$c96) {
      s1 = input.substr(peg$currPos, 5);
      peg$currPos += 5;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c97); }
    }
    if (s1 === peg$FAILED) {
      if (input.substr(peg$currPos, 4).toLowerCase() === peg$c98) {
        s1 = input.substr(peg$currPos, 4);
        peg$currPos += 4;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c99); }
      }
      if (s1 === peg$FAILED) {
        if (input.substr(peg$currPos, 5).toLowerCase() === peg$c100) {
          s1 = input.substr(peg$currPos, 5);
          peg$currPos += 5;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c101); }
        }
        if (s1 === peg$FAILED) {
          if (input.substr(peg$currPos, 2).toLowerCase() === peg$c102) {
            s1 = input.substr(peg$currPos, 2);
            peg$currPos += 2;
          } else {
            s1 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c103); }
          }
        }
      }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseletter();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c104();
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parsenull() {
    var s0, s1;

    var key    = peg$currPos * 101 + 36,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 4).toLowerCase() === peg$c105) {
      s1 = input.substr(peg$currPos, 4);
      peg$currPos += 4;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c106); }
    }
    if (s1 === peg$FAILED) {
      if (input.substr(peg$currPos, 7).toLowerCase() === peg$c107) {
        s1 = input.substr(peg$currPos, 7);
        peg$currPos += 7;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c108); }
      }
      if (s1 === peg$FAILED) {
        if (input.substr(peg$currPos, 7).toLowerCase() === peg$c109) {
          s1 = input.substr(peg$currPos, 7);
          peg$currPos += 7;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c110); }
        }
        if (s1 === peg$FAILED) {
          if (input.substr(peg$currPos, 6).toLowerCase() === peg$c111) {
            s1 = input.substr(peg$currPos, 6);
            peg$currPos += 6;
          } else {
            s1 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c112); }
          }
          if (s1 === peg$FAILED) {
            if (input.substr(peg$currPos, 4).toLowerCase() === peg$c113) {
              s1 = input.substr(peg$currPos, 4);
              peg$currPos += 4;
            } else {
              s1 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c114); }
            }
          }
        }
      }
    }
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$c115();
    }
    s0 = s1;

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parseempty_string() {
    var s0, s1;

    var key    = peg$currPos * 101 + 37,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 5).toLowerCase() === peg$c116) {
      s1 = input.substr(peg$currPos, 5);
      peg$currPos += 5;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c117); }
    }
    if (s1 === peg$FAILED) {
      if (input.substr(peg$currPos, 6).toLowerCase() === peg$c118) {
        s1 = input.substr(peg$currPos, 6);
        peg$currPos += 6;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c119); }
      }
      if (s1 === peg$FAILED) {
        if (input.substr(peg$currPos, 7).toLowerCase() === peg$c120) {
          s1 = input.substr(peg$currPos, 7);
          peg$currPos += 7;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c121); }
        }
      }
    }
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$c122();
    }
    s0 = s1;

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parsemysterious() {
    var s0, s1;

    var key    = peg$currPos * 101 + 38,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 10) === peg$c123) {
      s1 = peg$c123;
      peg$currPos += 10;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c124); }
    }
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$c125();
    }
    s0 = s1;

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parsenumber() {
    var s0, s1, s2, s3, s4, s5, s6, s7, s8;

    var key    = peg$currPos * 101 + 39,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$currPos;
    s1 = peg$currPos;
    s2 = peg$currPos;
    if (input.charCodeAt(peg$currPos) === 45) {
      s3 = peg$c126;
      peg$currPos++;
    } else {
      s3 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c127); }
    }
    if (s3 === peg$FAILED) {
      s3 = null;
    }
    if (s3 !== peg$FAILED) {
      s4 = [];
      if (peg$c128.test(input.charAt(peg$currPos))) {
        s5 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s5 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c129); }
      }
      if (s5 !== peg$FAILED) {
        while (s5 !== peg$FAILED) {
          s4.push(s5);
          if (peg$c128.test(input.charAt(peg$currPos))) {
            s5 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s5 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c129); }
          }
        }
      } else {
        s4 = peg$FAILED;
      }
      if (s4 !== peg$FAILED) {
        s5 = peg$currPos;
        if (input.charCodeAt(peg$currPos) === 46) {
          s6 = peg$c130;
          peg$currPos++;
        } else {
          s6 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c131); }
        }
        if (s6 !== peg$FAILED) {
          s7 = [];
          if (peg$c128.test(input.charAt(peg$currPos))) {
            s8 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s8 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c129); }
          }
          if (s8 !== peg$FAILED) {
            while (s8 !== peg$FAILED) {
              s7.push(s8);
              if (peg$c128.test(input.charAt(peg$currPos))) {
                s8 = input.charAt(peg$currPos);
                peg$currPos++;
              } else {
                s8 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$c129); }
              }
            }
          } else {
            s7 = peg$FAILED;
          }
          if (s7 !== peg$FAILED) {
            s6 = [s6, s7];
            s5 = s6;
          } else {
            peg$currPos = s5;
            s5 = peg$FAILED;
          }
        } else {
          peg$currPos = s5;
          s5 = peg$FAILED;
        }
        if (s5 === peg$FAILED) {
          s5 = null;
        }
        if (s5 !== peg$FAILED) {
          s3 = [s3, s4, s5];
          s2 = s3;
        } else {
          peg$currPos = s2;
          s2 = peg$FAILED;
        }
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
    } else {
      peg$currPos = s2;
      s2 = peg$FAILED;
    }
    if (s2 !== peg$FAILED) {
      s1 = input.substring(s1, peg$currPos);
    } else {
      s1 = s2;
    }
    if (s1 !== peg$FAILED) {
      if (input.charCodeAt(peg$currPos) === 46) {
        s2 = peg$c130;
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c131); }
      }
      if (s2 === peg$FAILED) {
        s2 = null;
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c132(s1);
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      s1 = peg$currPos;
      s2 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 46) {
        s3 = peg$c130;
        peg$currPos++;
      } else {
        s3 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c131); }
      }
      if (s3 !== peg$FAILED) {
        s4 = [];
        if (peg$c128.test(input.charAt(peg$currPos))) {
          s5 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s5 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c129); }
        }
        if (s5 !== peg$FAILED) {
          while (s5 !== peg$FAILED) {
            s4.push(s5);
            if (peg$c128.test(input.charAt(peg$currPos))) {
              s5 = input.charAt(peg$currPos);
              peg$currPos++;
            } else {
              s5 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c129); }
            }
          }
        } else {
          s4 = peg$FAILED;
        }
        if (s4 !== peg$FAILED) {
          s3 = [s3, s4];
          s2 = s3;
        } else {
          peg$currPos = s2;
          s2 = peg$FAILED;
        }
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = input.substring(s1, peg$currPos);
      } else {
        s1 = s2;
      }
      if (s1 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c133(s1);
      }
      s0 = s1;
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parsestring() {
    var s0, s1, s2, s3, s4;

    var key    = peg$currPos * 101 + 40,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$currPos;
    if (input.charCodeAt(peg$currPos) === 34) {
      s1 = peg$c134;
      peg$currPos++;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c135); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      s3 = [];
      if (peg$c136.test(input.charAt(peg$currPos))) {
        s4 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s4 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c137); }
      }
      while (s4 !== peg$FAILED) {
        s3.push(s4);
        if (peg$c136.test(input.charAt(peg$currPos))) {
          s4 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s4 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c137); }
        }
      }
      if (s3 !== peg$FAILED) {
        s2 = input.substring(s2, peg$currPos);
      } else {
        s2 = s3;
      }
      if (s2 !== peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 34) {
          s3 = peg$c134;
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c135); }
        }
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c138(s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parsenor() {
    var s0, s1, s2, s3, s4, s5;

    var key    = peg$currPos * 101 + 41,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$currPos;
    s1 = peg$parseor();
    if (s1 !== peg$FAILED) {
      s2 = peg$parse_();
      if (s2 !== peg$FAILED) {
        if (input.substr(peg$currPos, 3) === peg$c139) {
          s3 = peg$c139;
          peg$currPos += 3;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c140); }
        }
        if (s3 !== peg$FAILED) {
          s4 = peg$parse_();
          if (s4 !== peg$FAILED) {
            s5 = peg$parsenor();
            if (s5 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$c141(s1, s5);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$parseor();
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parseor() {
    var s0, s1, s2, s3, s4, s5;

    var key    = peg$currPos * 101 + 42,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$currPos;
    s1 = peg$parseand();
    if (s1 !== peg$FAILED) {
      s2 = peg$parse_();
      if (s2 !== peg$FAILED) {
        if (input.substr(peg$currPos, 2) === peg$c142) {
          s3 = peg$c142;
          peg$currPos += 2;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c143); }
        }
        if (s3 !== peg$FAILED) {
          s4 = peg$parse_();
          if (s4 !== peg$FAILED) {
            s5 = peg$parseor();
            if (s5 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$c144(s1, s5);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$parseand();
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parseand() {
    var s0, s1, s2, s3, s4, s5;

    var key    = peg$currPos * 101 + 43,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$currPos;
    s1 = peg$parseequality_check();
    if (s1 !== peg$FAILED) {
      s2 = peg$parse_();
      if (s2 !== peg$FAILED) {
        if (input.substr(peg$currPos, 3) === peg$c41) {
          s3 = peg$c41;
          peg$currPos += 3;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c42); }
        }
        if (s3 !== peg$FAILED) {
          s4 = peg$parse_();
          if (s4 !== peg$FAILED) {
            s5 = peg$parseand();
            if (s5 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$c145(s1, s5);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$parseequality_check();
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parseeq() {
    var s0, s1;

    var key    = peg$currPos * 101 + 44,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$currPos;
    s1 = peg$parseisnt();
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$c146();
    }
    s0 = s1;
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      s1 = peg$parseis();
      if (s1 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c147();
      }
      s0 = s1;
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parseequality_check() {
    var s0, s1, s2, s3;

    var key    = peg$currPos * 101 + 45,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$currPos;
    s1 = peg$parsenot();
    if (s1 !== peg$FAILED) {
      s2 = peg$parseeq();
      if (s2 !== peg$FAILED) {
        s3 = peg$parseequality_check();
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c148(s1, s2, s3);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$parsenot();
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parsenot() {
    var s0, s1, s2, s3;

    var key    = peg$currPos * 101 + 46,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 3) === peg$c149) {
      s1 = peg$c149;
      peg$currPos += 3;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c150); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$parse_();
      if (s2 !== peg$FAILED) {
        s3 = peg$parsenot();
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c151(s3);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$parsecomparison();
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parsecomparison() {
    var s0, s1, s2, s3;

    var key    = peg$currPos * 101 + 47,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$currPos;
    s1 = peg$parsearithmetic();
    if (s1 !== peg$FAILED) {
      s2 = peg$parsecomparator();
      if (s2 !== peg$FAILED) {
        s3 = peg$parsecomparison();
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c148(s1, s2, s3);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$parsearithmetic();
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parsegreater() {
    var s0;

    var key    = peg$currPos * 101 + 48,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    if (input.substr(peg$currPos, 6).toLowerCase() === peg$c152) {
      s0 = input.substr(peg$currPos, 6);
      peg$currPos += 6;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c153); }
    }
    if (s0 === peg$FAILED) {
      if (input.substr(peg$currPos, 7).toLowerCase() === peg$c154) {
        s0 = input.substr(peg$currPos, 7);
        peg$currPos += 7;
      } else {
        s0 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c155); }
      }
      if (s0 === peg$FAILED) {
        if (input.substr(peg$currPos, 6).toLowerCase() === peg$c156) {
          s0 = input.substr(peg$currPos, 6);
          peg$currPos += 6;
        } else {
          s0 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c157); }
        }
        if (s0 === peg$FAILED) {
          if (input.substr(peg$currPos, 8).toLowerCase() === peg$c158) {
            s0 = input.substr(peg$currPos, 8);
            peg$currPos += 8;
          } else {
            s0 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c159); }
          }
        }
      }
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parsesmaller() {
    var s0;

    var key    = peg$currPos * 101 + 49,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    if (input.substr(peg$currPos, 5).toLowerCase() === peg$c160) {
      s0 = input.substr(peg$currPos, 5);
      peg$currPos += 5;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c161); }
    }
    if (s0 === peg$FAILED) {
      if (input.substr(peg$currPos, 4).toLowerCase() === peg$c162) {
        s0 = input.substr(peg$currPos, 4);
        peg$currPos += 4;
      } else {
        s0 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c163); }
      }
      if (s0 === peg$FAILED) {
        if (input.substr(peg$currPos, 7).toLowerCase() === peg$c164) {
          s0 = input.substr(peg$currPos, 7);
          peg$currPos += 7;
        } else {
          s0 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c165); }
        }
        if (s0 === peg$FAILED) {
          if (input.substr(peg$currPos, 6).toLowerCase() === peg$c166) {
            s0 = input.substr(peg$currPos, 6);
            peg$currPos += 6;
          } else {
            s0 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c167); }
          }
        }
      }
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parsegreat() {
    var s0;

    var key    = peg$currPos * 101 + 50,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    if (input.substr(peg$currPos, 4).toLowerCase() === peg$c168) {
      s0 = input.substr(peg$currPos, 4);
      peg$currPos += 4;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c169); }
    }
    if (s0 === peg$FAILED) {
      if (input.substr(peg$currPos, 5).toLowerCase() === peg$c170) {
        s0 = input.substr(peg$currPos, 5);
        peg$currPos += 5;
      } else {
        s0 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c171); }
      }
      if (s0 === peg$FAILED) {
        if (input.substr(peg$currPos, 3).toLowerCase() === peg$c172) {
          s0 = input.substr(peg$currPos, 3);
          peg$currPos += 3;
        } else {
          s0 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c173); }
        }
        if (s0 === peg$FAILED) {
          if (input.substr(peg$currPos, 6).toLowerCase() === peg$c174) {
            s0 = input.substr(peg$currPos, 6);
            peg$currPos += 6;
          } else {
            s0 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c175); }
          }
        }
      }
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parsesmall() {
    var s0;

    var key    = peg$currPos * 101 + 51,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    if (input.substr(peg$currPos, 3).toLowerCase() === peg$c176) {
      s0 = input.substr(peg$currPos, 3);
      peg$currPos += 3;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c177); }
    }
    if (s0 === peg$FAILED) {
      if (input.substr(peg$currPos, 6).toLowerCase() === peg$c178) {
        s0 = input.substr(peg$currPos, 6);
        peg$currPos += 6;
      } else {
        s0 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c179); }
      }
      if (s0 === peg$FAILED) {
        if (input.substr(peg$currPos, 5).toLowerCase() === peg$c180) {
          s0 = input.substr(peg$currPos, 5);
          peg$currPos += 5;
        } else {
          s0 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c181); }
        }
        if (s0 === peg$FAILED) {
          if (input.substr(peg$currPos, 4).toLowerCase() === peg$c182) {
            s0 = input.substr(peg$currPos, 4);
            peg$currPos += 4;
          } else {
            s0 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c183); }
          }
        }
      }
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parsecomparator() {
    var s0, s1, s2, s3, s4, s5, s6, s7;

    var key    = peg$currPos * 101 + 52,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$currPos;
    s1 = peg$parseis();
    if (s1 !== peg$FAILED) {
      s2 = peg$parsegreater();
      if (s2 !== peg$FAILED) {
        s3 = peg$parse_();
        if (s3 !== peg$FAILED) {
          if (input.substr(peg$currPos, 4).toLowerCase() === peg$c184) {
            s4 = input.substr(peg$currPos, 4);
            peg$currPos += 4;
          } else {
            s4 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c185); }
          }
          if (s4 !== peg$FAILED) {
            s5 = peg$parse_();
            if (s5 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$c186();
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      s1 = peg$parseis();
      if (s1 !== peg$FAILED) {
        s2 = peg$parsesmaller();
        if (s2 !== peg$FAILED) {
          s3 = peg$parse_();
          if (s3 !== peg$FAILED) {
            if (input.substr(peg$currPos, 4).toLowerCase() === peg$c184) {
              s4 = input.substr(peg$currPos, 4);
              peg$currPos += 4;
            } else {
              s4 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c185); }
            }
            if (s4 !== peg$FAILED) {
              s5 = peg$parse_();
              if (s5 !== peg$FAILED) {
                peg$savedPos = s0;
                s1 = peg$c187();
                s0 = s1;
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        s1 = peg$parseis();
        if (s1 !== peg$FAILED) {
          if (input.substr(peg$currPos, 2).toLowerCase() === peg$c188) {
            s2 = input.substr(peg$currPos, 2);
            peg$currPos += 2;
          } else {
            s2 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c189); }
          }
          if (s2 !== peg$FAILED) {
            s3 = peg$parse_();
            if (s3 !== peg$FAILED) {
              s4 = peg$parsegreat();
              if (s4 !== peg$FAILED) {
                s5 = peg$parse_();
                if (s5 !== peg$FAILED) {
                  if (input.substr(peg$currPos, 2).toLowerCase() === peg$c188) {
                    s6 = input.substr(peg$currPos, 2);
                    peg$currPos += 2;
                  } else {
                    s6 = peg$FAILED;
                    if (peg$silentFails === 0) { peg$fail(peg$c189); }
                  }
                  if (s6 !== peg$FAILED) {
                    s7 = peg$parse_();
                    if (s7 !== peg$FAILED) {
                      peg$savedPos = s0;
                      s1 = peg$c190();
                      s0 = s1;
                    } else {
                      peg$currPos = s0;
                      s0 = peg$FAILED;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
        if (s0 === peg$FAILED) {
          s0 = peg$currPos;
          s1 = peg$parseis();
          if (s1 !== peg$FAILED) {
            if (input.substr(peg$currPos, 2).toLowerCase() === peg$c188) {
              s2 = input.substr(peg$currPos, 2);
              peg$currPos += 2;
            } else {
              s2 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c189); }
            }
            if (s2 !== peg$FAILED) {
              s3 = peg$parse_();
              if (s3 !== peg$FAILED) {
                s4 = peg$parsesmall();
                if (s4 !== peg$FAILED) {
                  s5 = peg$parse_();
                  if (s5 !== peg$FAILED) {
                    if (input.substr(peg$currPos, 2).toLowerCase() === peg$c188) {
                      s6 = input.substr(peg$currPos, 2);
                      peg$currPos += 2;
                    } else {
                      s6 = peg$FAILED;
                      if (peg$silentFails === 0) { peg$fail(peg$c189); }
                    }
                    if (s6 !== peg$FAILED) {
                      s7 = peg$parse_();
                      if (s7 !== peg$FAILED) {
                        peg$savedPos = s0;
                        s1 = peg$c191();
                        s0 = s1;
                      } else {
                        peg$currPos = s0;
                        s0 = peg$FAILED;
                      }
                    } else {
                      peg$currPos = s0;
                      s0 = peg$FAILED;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        }
      }
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parsearithmetic() {
    var s0, s1, s2, s3, s4, s5;

    var key    = peg$currPos * 101 + 53,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$currPos;
    s1 = peg$parseproduct();
    if (s1 !== peg$FAILED) {
      s2 = [];
      s3 = peg$currPos;
      s4 = peg$parseadd();
      if (s4 === peg$FAILED) {
        s4 = peg$parsesubtract();
      }
      if (s4 !== peg$FAILED) {
        s5 = peg$parseproduct();
        if (s5 !== peg$FAILED) {
          s4 = [s4, s5];
          s3 = s4;
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      } else {
        peg$currPos = s3;
        s3 = peg$FAILED;
      }
      if (s3 !== peg$FAILED) {
        while (s3 !== peg$FAILED) {
          s2.push(s3);
          s3 = peg$currPos;
          s4 = peg$parseadd();
          if (s4 === peg$FAILED) {
            s4 = peg$parsesubtract();
          }
          if (s4 !== peg$FAILED) {
            s5 = peg$parseproduct();
            if (s5 !== peg$FAILED) {
              s4 = [s4, s5];
              s3 = s4;
            } else {
              peg$currPos = s3;
              s3 = peg$FAILED;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        }
      } else {
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c192(s1, s2);
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$parseproduct();
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parseproduct() {
    var s0, s1, s2, s3, s4, s5;

    var key    = peg$currPos * 101 + 54,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$currPos;
    s1 = peg$parsesimple_expression();
    if (s1 !== peg$FAILED) {
      s2 = [];
      s3 = peg$currPos;
      s4 = peg$parsemultiply();
      if (s4 === peg$FAILED) {
        s4 = peg$parsedivide();
      }
      if (s4 !== peg$FAILED) {
        s5 = peg$parseexpression_list();
        if (s5 !== peg$FAILED) {
          s4 = [s4, s5];
          s3 = s4;
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      } else {
        peg$currPos = s3;
        s3 = peg$FAILED;
      }
      if (s3 !== peg$FAILED) {
        while (s3 !== peg$FAILED) {
          s2.push(s3);
          s3 = peg$currPos;
          s4 = peg$parsemultiply();
          if (s4 === peg$FAILED) {
            s4 = peg$parsedivide();
          }
          if (s4 !== peg$FAILED) {
            s5 = peg$parseexpression_list();
            if (s5 !== peg$FAILED) {
              s4 = [s4, s5];
              s3 = s4;
            } else {
              peg$currPos = s3;
              s3 = peg$FAILED;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        }
      } else {
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c193(s1, s2);
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$parseexpression_list();
      if (s0 === peg$FAILED) {
        s0 = peg$parsesimple_expression();
      }
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parseadd() {
    var s0, s1, s2, s3, s4;

    var key    = peg$currPos * 101 + 55,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$currPos;
    s1 = [];
    s2 = peg$parse_();
    while (s2 !== peg$FAILED) {
      s1.push(s2);
      s2 = peg$parse_();
    }
    if (s1 !== peg$FAILED) {
      if (input.charCodeAt(peg$currPos) === 43) {
        s2 = peg$c194;
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c195); }
      }
      if (s2 === peg$FAILED) {
        if (input.substr(peg$currPos, 5) === peg$c196) {
          s2 = peg$c196;
          peg$currPos += 5;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c197); }
        }
        if (s2 === peg$FAILED) {
          if (input.substr(peg$currPos, 5) === peg$c198) {
            s2 = peg$c198;
            peg$currPos += 5;
          } else {
            s2 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c199); }
          }
        }
      }
      if (s2 !== peg$FAILED) {
        s3 = [];
        s4 = peg$parse_();
        while (s4 !== peg$FAILED) {
          s3.push(s4);
          s4 = peg$parse_();
        }
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c200();
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parsesubtract() {
    var s0, s1, s2, s3, s4;

    var key    = peg$currPos * 101 + 56,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$currPos;
    s1 = [];
    s2 = peg$parse_();
    while (s2 !== peg$FAILED) {
      s1.push(s2);
      s2 = peg$parse_();
    }
    if (s1 !== peg$FAILED) {
      if (input.charCodeAt(peg$currPos) === 45) {
        s2 = peg$c126;
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c127); }
      }
      if (s2 === peg$FAILED) {
        if (input.substr(peg$currPos, 6) === peg$c201) {
          s2 = peg$c201;
          peg$currPos += 6;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c202); }
        }
        if (s2 === peg$FAILED) {
          if (input.substr(peg$currPos, 8) === peg$c203) {
            s2 = peg$c203;
            peg$currPos += 8;
          } else {
            s2 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c204); }
          }
        }
      }
      if (s2 !== peg$FAILED) {
        s3 = [];
        s4 = peg$parse_();
        while (s4 !== peg$FAILED) {
          s3.push(s4);
          s4 = peg$parse_();
        }
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c205();
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parsemultiply() {
    var s0, s1, s2, s3, s4;

    var key    = peg$currPos * 101 + 57,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$currPos;
    s1 = [];
    s2 = peg$parse_();
    while (s2 !== peg$FAILED) {
      s1.push(s2);
      s2 = peg$parse_();
    }
    if (s1 !== peg$FAILED) {
      if (input.charCodeAt(peg$currPos) === 42) {
        s2 = peg$c206;
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c207); }
      }
      if (s2 === peg$FAILED) {
        if (input.substr(peg$currPos, 6) === peg$c208) {
          s2 = peg$c208;
          peg$currPos += 6;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c209); }
        }
        if (s2 === peg$FAILED) {
          if (input.substr(peg$currPos, 3) === peg$c210) {
            s2 = peg$c210;
            peg$currPos += 3;
          } else {
            s2 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c211); }
          }
        }
      }
      if (s2 !== peg$FAILED) {
        s3 = [];
        s4 = peg$parse_();
        while (s4 !== peg$FAILED) {
          s3.push(s4);
          s4 = peg$parse_();
        }
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c212();
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parsedivide() {
    var s0, s1, s2, s3, s4;

    var key    = peg$currPos * 101 + 58,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$currPos;
    s1 = [];
    s2 = peg$parse_();
    while (s2 !== peg$FAILED) {
      s1.push(s2);
      s2 = peg$parse_();
    }
    if (s1 !== peg$FAILED) {
      if (input.charCodeAt(peg$currPos) === 47) {
        s2 = peg$c213;
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c214); }
      }
      if (s2 === peg$FAILED) {
        if (input.substr(peg$currPos, 5) === peg$c215) {
          s2 = peg$c215;
          peg$currPos += 5;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c216); }
        }
        if (s2 === peg$FAILED) {
          if (input.substr(peg$currPos, 8) === peg$c217) {
            s2 = peg$c217;
            peg$currPos += 8;
          } else {
            s2 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c218); }
          }
        }
      }
      if (s2 !== peg$FAILED) {
        s3 = [];
        s4 = peg$parse_();
        while (s4 !== peg$FAILED) {
          s3.push(s4);
          s4 = peg$parse_();
        }
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c219();
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parsecompoundable_operator() {
    var s0;

    var key    = peg$currPos * 101 + 59,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$parseadd();
    if (s0 === peg$FAILED) {
      s0 = peg$parsesubtract();
      if (s0 === peg$FAILED) {
        s0 = peg$parsemultiply();
        if (s0 === peg$FAILED) {
          s0 = peg$parsedivide();
        }
      }
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parsepronoun() {
    var s0, s1, s2, s3;

    var key    = peg$currPos * 101 + 60,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 4).toLowerCase() === peg$c220) {
      s1 = input.substr(peg$currPos, 4);
      peg$currPos += 4;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c221); }
    }
    if (s1 === peg$FAILED) {
      if (input.substr(peg$currPos, 4).toLowerCase() === peg$c222) {
        s1 = input.substr(peg$currPos, 4);
        peg$currPos += 4;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c223); }
      }
      if (s1 === peg$FAILED) {
        if (input.substr(peg$currPos, 3).toLowerCase() === peg$c224) {
          s1 = input.substr(peg$currPos, 3);
          peg$currPos += 3;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c225); }
        }
        if (s1 === peg$FAILED) {
          if (input.substr(peg$currPos, 3).toLowerCase() === peg$c226) {
            s1 = input.substr(peg$currPos, 3);
            peg$currPos += 3;
          } else {
            s1 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c227); }
          }
          if (s1 === peg$FAILED) {
            if (input.substr(peg$currPos, 3).toLowerCase() === peg$c228) {
              s1 = input.substr(peg$currPos, 3);
              peg$currPos += 3;
            } else {
              s1 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c229); }
            }
            if (s1 === peg$FAILED) {
              if (input.substr(peg$currPos, 3).toLowerCase() === peg$c230) {
                s1 = input.substr(peg$currPos, 3);
                peg$currPos += 3;
              } else {
                s1 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$c231); }
              }
              if (s1 === peg$FAILED) {
                if (input.substr(peg$currPos, 3).toLowerCase() === peg$c232) {
                  s1 = input.substr(peg$currPos, 3);
                  peg$currPos += 3;
                } else {
                  s1 = peg$FAILED;
                  if (peg$silentFails === 0) { peg$fail(peg$c233); }
                }
                if (s1 === peg$FAILED) {
                  if (input.substr(peg$currPos, 3).toLowerCase() === peg$c234) {
                    s1 = input.substr(peg$currPos, 3);
                    peg$currPos += 3;
                  } else {
                    s1 = peg$FAILED;
                    if (peg$silentFails === 0) { peg$fail(peg$c235); }
                  }
                  if (s1 === peg$FAILED) {
                    if (input.substr(peg$currPos, 3).toLowerCase() === peg$c236) {
                      s1 = input.substr(peg$currPos, 3);
                      peg$currPos += 3;
                    } else {
                      s1 = peg$FAILED;
                      if (peg$silentFails === 0) { peg$fail(peg$c237); }
                    }
                    if (s1 === peg$FAILED) {
                      if (input.substr(peg$currPos, 3).toLowerCase() === peg$c238) {
                        s1 = input.substr(peg$currPos, 3);
                        peg$currPos += 3;
                      } else {
                        s1 = peg$FAILED;
                        if (peg$silentFails === 0) { peg$fail(peg$c239); }
                      }
                      if (s1 === peg$FAILED) {
                        if (input.substr(peg$currPos, 2).toLowerCase() === peg$c240) {
                          s1 = input.substr(peg$currPos, 2);
                          peg$currPos += 2;
                        } else {
                          s1 = peg$FAILED;
                          if (peg$silentFails === 0) { peg$fail(peg$c241); }
                        }
                        if (s1 === peg$FAILED) {
                          if (input.substr(peg$currPos, 2).toLowerCase() === peg$c242) {
                            s1 = input.substr(peg$currPos, 2);
                            peg$currPos += 2;
                          } else {
                            s1 = peg$FAILED;
                            if (peg$silentFails === 0) { peg$fail(peg$c243); }
                          }
                          if (s1 === peg$FAILED) {
                            if (input.substr(peg$currPos, 2).toLowerCase() === peg$c244) {
                              s1 = input.substr(peg$currPos, 2);
                              peg$currPos += 2;
                            } else {
                              s1 = peg$FAILED;
                              if (peg$silentFails === 0) { peg$fail(peg$c245); }
                            }
                            if (s1 === peg$FAILED) {
                              if (input.substr(peg$currPos, 2).toLowerCase() === peg$c246) {
                                s1 = input.substr(peg$currPos, 2);
                                peg$currPos += 2;
                              } else {
                                s1 = peg$FAILED;
                                if (peg$silentFails === 0) { peg$fail(peg$c247); }
                              }
                              if (s1 === peg$FAILED) {
                                if (input.substr(peg$currPos, 2).toLowerCase() === peg$c248) {
                                  s1 = input.substr(peg$currPos, 2);
                                  peg$currPos += 2;
                                } else {
                                  s1 = peg$FAILED;
                                  if (peg$silentFails === 0) { peg$fail(peg$c249); }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseis();
      if (s3 === peg$FAILED) {
        s3 = peg$parse_();
        if (s3 === peg$FAILED) {
          s3 = peg$parseEOL();
          if (s3 === peg$FAILED) {
            s3 = peg$parseEOF();
          }
        }
      }
      peg$silentFails--;
      if (s3 !== peg$FAILED) {
        peg$currPos = s2;
        s2 = void 0;
      } else {
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c250(s1);
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parsecommon_prefix() {
    var s0;

    var key    = peg$currPos * 101 + 61,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    if (input.substr(peg$currPos, 2).toLowerCase() === peg$c251) {
      s0 = input.substr(peg$currPos, 2);
      peg$currPos += 2;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c252); }
    }
    if (s0 === peg$FAILED) {
      if (input.substr(peg$currPos, 1).toLowerCase() === peg$c253) {
        s0 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s0 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c254); }
      }
      if (s0 === peg$FAILED) {
        if (input.substr(peg$currPos, 3).toLowerCase() === peg$c255) {
          s0 = input.substr(peg$currPos, 3);
          peg$currPos += 3;
        } else {
          s0 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c256); }
        }
        if (s0 === peg$FAILED) {
          if (input.substr(peg$currPos, 2).toLowerCase() === peg$c257) {
            s0 = input.substr(peg$currPos, 2);
            peg$currPos += 2;
          } else {
            s0 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c258); }
          }
          if (s0 === peg$FAILED) {
            if (input.substr(peg$currPos, 4).toLowerCase() === peg$c259) {
              s0 = input.substr(peg$currPos, 4);
              peg$currPos += 4;
            } else {
              s0 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c260); }
            }
          }
        }
      }
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parseuppercase_letter() {
    var s0;

    var key    = peg$currPos * 101 + 62,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    if (peg$c261.test(input.charAt(peg$currPos))) {
      s0 = input.charAt(peg$currPos);
      peg$currPos++;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c262); }
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parselowercase_letter() {
    var s0;

    var key    = peg$currPos * 101 + 63,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    if (peg$c263.test(input.charAt(peg$currPos))) {
      s0 = input.charAt(peg$currPos);
      peg$currPos++;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c264); }
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parseletter() {
    var s0;

    var key    = peg$currPos * 101 + 64,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$parseuppercase_letter();
    if (s0 === peg$FAILED) {
      s0 = peg$parselowercase_letter();
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parsecommon_variable() {
    var s0, s1, s2, s3, s4, s5;

    var key    = peg$currPos * 101 + 65,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$currPos;
    s1 = peg$parsecommon_prefix();
    if (s1 !== peg$FAILED) {
      s2 = peg$parse_();
      if (s2 !== peg$FAILED) {
        s3 = peg$currPos;
        s4 = [];
        s5 = peg$parseletter();
        if (s5 !== peg$FAILED) {
          while (s5 !== peg$FAILED) {
            s4.push(s5);
            s5 = peg$parseletter();
          }
        } else {
          s4 = peg$FAILED;
        }
        if (s4 !== peg$FAILED) {
          s3 = input.substring(s3, peg$currPos);
        } else {
          s3 = s4;
        }
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c265(s1, s3);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parseis() {
    var s0, s1, s2, s3;

    var key    = peg$currPos * 101 + 66,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 2).toLowerCase() === peg$c266) {
      s1 = input.substr(peg$currPos, 2);
      peg$currPos += 2;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c267); }
    }
    if (s1 === peg$FAILED) {
      if (input.substr(peg$currPos, 3).toLowerCase() === peg$c268) {
        s1 = input.substr(peg$currPos, 3);
        peg$currPos += 3;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c269); }
      }
      if (s1 === peg$FAILED) {
        s1 = peg$currPos;
        s2 = peg$parse_();
        if (s2 !== peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 61) {
            s3 = peg$c270;
            peg$currPos++;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c271); }
          }
          if (s3 === peg$FAILED) {
            if (input.substr(peg$currPos, 2).toLowerCase() === peg$c272) {
              s3 = input.substr(peg$currPos, 2);
              peg$currPos += 2;
            } else {
              s3 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c273); }
            }
            if (s3 === peg$FAILED) {
              if (input.substr(peg$currPos, 3).toLowerCase() === peg$c274) {
                s3 = input.substr(peg$currPos, 3);
                peg$currPos += 3;
              } else {
                s3 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$c275); }
              }
              if (s3 === peg$FAILED) {
                if (input.substr(peg$currPos, 3).toLowerCase() === peg$c276) {
                  s3 = input.substr(peg$currPos, 3);
                  peg$currPos += 3;
                } else {
                  s3 = peg$FAILED;
                  if (peg$silentFails === 0) { peg$fail(peg$c277); }
                }
                if (s3 === peg$FAILED) {
                  if (input.substr(peg$currPos, 4).toLowerCase() === peg$c278) {
                    s3 = input.substr(peg$currPos, 4);
                    peg$currPos += 4;
                  } else {
                    s3 = peg$FAILED;
                    if (peg$silentFails === 0) { peg$fail(peg$c279); }
                  }
                }
              }
            }
          }
          if (s3 !== peg$FAILED) {
            s2 = [s2, s3];
            s1 = s2;
          } else {
            peg$currPos = s1;
            s1 = peg$FAILED;
          }
        } else {
          peg$currPos = s1;
          s1 = peg$FAILED;
        }
      }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$parse_();
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parseisnt() {
    var s0, s1, s2, s3;

    var key    = peg$currPos * 101 + 67,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$currPos;
    s1 = peg$parse_();
    if (s1 !== peg$FAILED) {
      if (input.substr(peg$currPos, 4).toLowerCase() === peg$c280) {
        s2 = input.substr(peg$currPos, 4);
        peg$currPos += 4;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c281); }
      }
      if (s2 === peg$FAILED) {
        if (input.substr(peg$currPos, 5).toLowerCase() === peg$c282) {
          s2 = input.substr(peg$currPos, 5);
          peg$currPos += 5;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c283); }
        }
        if (s2 === peg$FAILED) {
          if (input.substr(peg$currPos, 4).toLowerCase() === peg$c284) {
            s2 = input.substr(peg$currPos, 4);
            peg$currPos += 4;
          } else {
            s2 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c285); }
          }
          if (s2 === peg$FAILED) {
            if (input.substr(peg$currPos, 5).toLowerCase() === peg$c286) {
              s2 = input.substr(peg$currPos, 5);
              peg$currPos += 5;
            } else {
              s2 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c287); }
            }
            if (s2 === peg$FAILED) {
              if (input.substr(peg$currPos, 5).toLowerCase() === peg$c288) {
                s2 = input.substr(peg$currPos, 5);
                peg$currPos += 5;
              } else {
                s2 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$c289); }
              }
              if (s2 === peg$FAILED) {
                if (input.substr(peg$currPos, 6).toLowerCase() === peg$c290) {
                  s2 = input.substr(peg$currPos, 6);
                  peg$currPos += 6;
                } else {
                  s2 = peg$FAILED;
                  if (peg$silentFails === 0) { peg$fail(peg$c291); }
                }
                if (s2 === peg$FAILED) {
                  if (input.substr(peg$currPos, 5).toLowerCase() === peg$c292) {
                    s2 = input.substr(peg$currPos, 5);
                    peg$currPos += 5;
                  } else {
                    s2 = peg$FAILED;
                    if (peg$silentFails === 0) { peg$fail(peg$c293); }
                  }
                  if (s2 === peg$FAILED) {
                    if (input.substr(peg$currPos, 6).toLowerCase() === peg$c294) {
                      s2 = input.substr(peg$currPos, 6);
                      peg$currPos += 6;
                    } else {
                      s2 = peg$FAILED;
                      if (peg$silentFails === 0) { peg$fail(peg$c295); }
                    }
                    if (s2 === peg$FAILED) {
                      if (input.substr(peg$currPos, 6).toLowerCase() === peg$c296) {
                        s2 = input.substr(peg$currPos, 6);
                        peg$currPos += 6;
                      } else {
                        s2 = peg$FAILED;
                        if (peg$silentFails === 0) { peg$fail(peg$c297); }
                      }
                      if (s2 === peg$FAILED) {
                        if (input.substr(peg$currPos, 7).toLowerCase() === peg$c298) {
                          s2 = input.substr(peg$currPos, 7);
                          peg$currPos += 7;
                        } else {
                          s2 = peg$FAILED;
                          if (peg$silentFails === 0) { peg$fail(peg$c299); }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
      if (s2 !== peg$FAILED) {
        s3 = peg$parse_();
        if (s3 !== peg$FAILED) {
          s1 = [s1, s2, s3];
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parsepush() {
    var s0;

    var key    = peg$currPos * 101 + 68,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    if (input.substr(peg$currPos, 4).toLowerCase() === peg$c300) {
      s0 = input.substr(peg$currPos, 4);
      peg$currPos += 4;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c301); }
    }
    if (s0 === peg$FAILED) {
      if (input.substr(peg$currPos, 4).toLowerCase() === peg$c302) {
        s0 = input.substr(peg$currPos, 4);
        peg$currPos += 4;
      } else {
        s0 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c303); }
      }
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parsepop() {
    var s0;

    var key    = peg$currPos * 101 + 69,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    if (input.substr(peg$currPos, 4).toLowerCase() === peg$c304) {
      s0 = input.substr(peg$currPos, 4);
      peg$currPos += 4;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c305); }
    }
    if (s0 === peg$FAILED) {
      if (input.substr(peg$currPos, 3).toLowerCase() === peg$c306) {
        s0 = input.substr(peg$currPos, 3);
        peg$currPos += 3;
      } else {
        s0 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c307); }
      }
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parseinto() {
    var s0, s1, s2, s3;

    var key    = peg$currPos * 101 + 70,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$currPos;
    s1 = peg$parse_();
    if (s1 !== peg$FAILED) {
      if (input.substr(peg$currPos, 4).toLowerCase() === peg$c308) {
        s2 = input.substr(peg$currPos, 4);
        peg$currPos += 4;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c309); }
      }
      if (s2 === peg$FAILED) {
        if (input.substr(peg$currPos, 2).toLowerCase() === peg$c310) {
          s2 = input.substr(peg$currPos, 2);
          peg$currPos += 2;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c311); }
        }
      }
      if (s2 !== peg$FAILED) {
        s3 = peg$parse_();
        if (s3 !== peg$FAILED) {
          s1 = [s1, s2, s3];
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parsedelist() {
    var s0, s1, s2, s3;

    var key    = peg$currPos * 101 + 71,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$currPos;
    s1 = peg$parsepop();
    if (s1 !== peg$FAILED) {
      s2 = peg$parse_();
      if (s2 !== peg$FAILED) {
        s3 = peg$parsevariable();
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c312(s3);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parselookup() {
    var s0, s1, s2, s3, s4, s5;

    var key    = peg$currPos * 101 + 72,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$currPos;
    s1 = peg$parsedelist();
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$c313(s1);
    }
    s0 = s1;
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      s1 = peg$parsevariable();
      if (s1 !== peg$FAILED) {
        s2 = peg$parse_();
        if (s2 !== peg$FAILED) {
          if (input.substr(peg$currPos, 2).toLowerCase() === peg$c314) {
            s3 = input.substr(peg$currPos, 2);
            peg$currPos += 2;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c315); }
          }
          if (s3 !== peg$FAILED) {
            s4 = peg$parse_();
            if (s4 !== peg$FAILED) {
              s5 = peg$parsenor();
              if (s5 !== peg$FAILED) {
                peg$savedPos = s0;
                s1 = peg$c316(s1, s5);
                s0 = s1;
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        s1 = peg$parsevariable();
        if (s1 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c317(s1);
        }
        s0 = s1;
      }
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parseindexer() {
    var s0, s1, s2, s3, s4;

    var key    = peg$currPos * 101 + 73,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$currPos;
    s1 = peg$parse_();
    if (s1 !== peg$FAILED) {
      if (input.substr(peg$currPos, 2).toLowerCase() === peg$c314) {
        s2 = input.substr(peg$currPos, 2);
        peg$currPos += 2;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c315); }
      }
      if (s2 !== peg$FAILED) {
        s3 = peg$parse_();
        if (s3 !== peg$FAILED) {
          s4 = peg$parsenor();
          if (s4 !== peg$FAILED) {
            peg$savedPos = s0;
            s1 = peg$c318(s4);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parseassignable() {
    var s0, s1, s2;

    var key    = peg$currPos * 101 + 74,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$currPos;
    s1 = peg$parsevariable();
    if (s1 !== peg$FAILED) {
      s2 = peg$parseindexer();
      if (s2 === peg$FAILED) {
        s2 = null;
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c319(s1, s2);
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parseassignment() {
    var s0, s1, s2, s3, s4, s5, s6, s7;

    var key    = peg$currPos * 101 + 75,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$currPos;
    s1 = peg$parseassignable();
    if (s1 !== peg$FAILED) {
      s2 = peg$parseis();
      if (s2 !== peg$FAILED) {
        s3 = [];
        s4 = peg$parse_();
        while (s4 !== peg$FAILED) {
          s3.push(s4);
          s4 = peg$parse_();
        }
        if (s3 !== peg$FAILED) {
          s4 = peg$parseliteral();
          if (s4 === peg$FAILED) {
            s4 = peg$parsepoetic_number();
          }
          if (s4 !== peg$FAILED) {
            peg$savedPos = s0;
            s1 = peg$c320(s1, s4);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      s1 = peg$parseassignable();
      if (s1 !== peg$FAILED) {
        s2 = peg$parse_();
        if (s2 !== peg$FAILED) {
          if (input.substr(peg$currPos, 5).toLowerCase() === peg$c321) {
            s3 = input.substr(peg$currPos, 5);
            peg$currPos += 5;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c322); }
          }
          if (s3 !== peg$FAILED) {
            s4 = peg$parsepoetic_string();
            if (s4 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$c320(s1, s4);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.substr(peg$currPos, 3).toLowerCase() === peg$c323) {
          s1 = input.substr(peg$currPos, 3);
          peg$currPos += 3;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c324); }
        }
        if (s1 !== peg$FAILED) {
          s2 = peg$parse_();
          if (s2 !== peg$FAILED) {
            s3 = peg$parsenor();
            if (s3 !== peg$FAILED) {
              s4 = peg$parseinto();
              if (s4 !== peg$FAILED) {
                s5 = peg$parseassignable();
                if (s5 !== peg$FAILED) {
                  peg$savedPos = s0;
                  s1 = peg$c325(s3, s5);
                  s0 = s1;
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
        if (s0 === peg$FAILED) {
          s0 = peg$currPos;
          if (input.substr(peg$currPos, 3).toLowerCase() === peg$c326) {
            s1 = input.substr(peg$currPos, 3);
            peg$currPos += 3;
          } else {
            s1 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c327); }
          }
          if (s1 !== peg$FAILED) {
            s2 = peg$parse_();
            if (s2 !== peg$FAILED) {
              s3 = peg$parseassignable();
              if (s3 !== peg$FAILED) {
                s4 = peg$parse_();
                if (s4 !== peg$FAILED) {
                  if (input.substr(peg$currPos, 2).toLowerCase() === peg$c328) {
                    s5 = input.substr(peg$currPos, 2);
                    peg$currPos += 2;
                  } else {
                    s5 = peg$FAILED;
                    if (peg$silentFails === 0) { peg$fail(peg$c329); }
                  }
                  if (s5 !== peg$FAILED) {
                    s6 = peg$parsecompoundable_operator();
                    if (s6 !== peg$FAILED) {
                      s7 = peg$parsenor();
                      if (s7 !== peg$FAILED) {
                        peg$savedPos = s0;
                        s1 = peg$c330(s3, s6, s7);
                        s0 = s1;
                      } else {
                        peg$currPos = s0;
                        s0 = peg$FAILED;
                      }
                    } else {
                      peg$currPos = s0;
                      s0 = peg$FAILED;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
          if (s0 === peg$FAILED) {
            s0 = peg$currPos;
            if (input.substr(peg$currPos, 3).toLowerCase() === peg$c326) {
              s1 = input.substr(peg$currPos, 3);
              peg$currPos += 3;
            } else {
              s1 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c327); }
            }
            if (s1 !== peg$FAILED) {
              s2 = peg$parse_();
              if (s2 !== peg$FAILED) {
                s3 = peg$parseassignable();
                if (s3 !== peg$FAILED) {
                  s4 = peg$parse_();
                  if (s4 !== peg$FAILED) {
                    if (input.substr(peg$currPos, 2).toLowerCase() === peg$c328) {
                      s5 = input.substr(peg$currPos, 2);
                      peg$currPos += 2;
                    } else {
                      s5 = peg$FAILED;
                      if (peg$silentFails === 0) { peg$fail(peg$c329); }
                    }
                    if (s5 !== peg$FAILED) {
                      s6 = peg$parse_();
                      if (s6 !== peg$FAILED) {
                        s7 = peg$parsenor();
                        if (s7 !== peg$FAILED) {
                          peg$savedPos = s0;
                          s1 = peg$c331(s3, s7);
                          s0 = s1;
                        } else {
                          peg$currPos = s0;
                          s0 = peg$FAILED;
                        }
                      } else {
                        peg$currPos = s0;
                        s0 = peg$FAILED;
                      }
                    } else {
                      peg$currPos = s0;
                      s0 = peg$FAILED;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
            if (s0 === peg$FAILED) {
              s0 = peg$currPos;
              s1 = peg$parsepush();
              if (s1 !== peg$FAILED) {
                s2 = peg$parse_();
                if (s2 !== peg$FAILED) {
                  s3 = peg$parsenor();
                  if (s3 !== peg$FAILED) {
                    s4 = peg$parseinto();
                    if (s4 !== peg$FAILED) {
                      s5 = peg$parsevariable();
                      if (s5 !== peg$FAILED) {
                        peg$savedPos = s0;
                        s1 = peg$c332(s3, s5);
                        s0 = s1;
                      } else {
                        peg$currPos = s0;
                        s0 = peg$FAILED;
                      }
                    } else {
                      peg$currPos = s0;
                      s0 = peg$FAILED;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
              if (s0 === peg$FAILED) {
                s0 = peg$currPos;
                s1 = peg$parsepush();
                if (s1 !== peg$FAILED) {
                  s2 = peg$parse_();
                  if (s2 !== peg$FAILED) {
                    s3 = peg$parsevariable();
                    if (s3 !== peg$FAILED) {
                      s4 = peg$parse_();
                      if (s4 !== peg$FAILED) {
                        if (input.substr(peg$currPos, 4).toLowerCase() === peg$c333) {
                          s5 = input.substr(peg$currPos, 4);
                          peg$currPos += 4;
                        } else {
                          s5 = peg$FAILED;
                          if (peg$silentFails === 0) { peg$fail(peg$c334); }
                        }
                        if (s5 !== peg$FAILED) {
                          s6 = peg$parse_();
                          if (s6 !== peg$FAILED) {
                            s7 = peg$parseliteral();
                            if (s7 === peg$FAILED) {
                              s7 = peg$parsepoetic_number();
                            }
                            if (s7 !== peg$FAILED) {
                              peg$savedPos = s0;
                              s1 = peg$c335(s3, s7);
                              s0 = s1;
                            } else {
                              peg$currPos = s0;
                              s0 = peg$FAILED;
                            }
                          } else {
                            peg$currPos = s0;
                            s0 = peg$FAILED;
                          }
                        } else {
                          peg$currPos = s0;
                          s0 = peg$FAILED;
                        }
                      } else {
                        peg$currPos = s0;
                        s0 = peg$FAILED;
                      }
                    } else {
                      peg$currPos = s0;
                      s0 = peg$FAILED;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
                if (s0 === peg$FAILED) {
                  s0 = peg$currPos;
                  s1 = peg$parsepush();
                  if (s1 !== peg$FAILED) {
                    s2 = peg$parse_();
                    if (s2 !== peg$FAILED) {
                      s3 = peg$parsevariable();
                      if (s3 !== peg$FAILED) {
                        s4 = peg$currPos;
                        s5 = peg$parse_();
                        if (s5 !== peg$FAILED) {
                          if (input.substr(peg$currPos, 4).toLowerCase() === peg$c336) {
                            s6 = input.substr(peg$currPos, 4);
                            peg$currPos += 4;
                          } else {
                            s6 = peg$FAILED;
                            if (peg$silentFails === 0) { peg$fail(peg$c337); }
                          }
                          if (s6 !== peg$FAILED) {
                            s5 = [s5, s6];
                            s4 = s5;
                          } else {
                            peg$currPos = s4;
                            s4 = peg$FAILED;
                          }
                        } else {
                          peg$currPos = s4;
                          s4 = peg$FAILED;
                        }
                        if (s4 === peg$FAILED) {
                          s4 = null;
                        }
                        if (s4 !== peg$FAILED) {
                          s5 = peg$parse_();
                          if (s5 !== peg$FAILED) {
                            s6 = peg$parsenor();
                            if (s6 !== peg$FAILED) {
                              peg$savedPos = s0;
                              s1 = peg$c335(s3, s6);
                              s0 = s1;
                            } else {
                              peg$currPos = s0;
                              s0 = peg$FAILED;
                            }
                          } else {
                            peg$currPos = s0;
                            s0 = peg$FAILED;
                          }
                        } else {
                          peg$currPos = s0;
                          s0 = peg$FAILED;
                        }
                      } else {
                        peg$currPos = s0;
                        s0 = peg$FAILED;
                      }
                    } else {
                      peg$currPos = s0;
                      s0 = peg$FAILED;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                  }
                  if (s0 === peg$FAILED) {
                    s0 = peg$currPos;
                    s1 = peg$parsepush();
                    if (s1 !== peg$FAILED) {
                      s2 = peg$parse_();
                      if (s2 !== peg$FAILED) {
                        s3 = peg$parsevariable();
                        if (s3 !== peg$FAILED) {
                          peg$savedPos = s0;
                          s1 = peg$c338(s3);
                          s0 = s1;
                        } else {
                          peg$currPos = s0;
                          s0 = peg$FAILED;
                        }
                      } else {
                        peg$currPos = s0;
                        s0 = peg$FAILED;
                      }
                    } else {
                      peg$currPos = s0;
                      s0 = peg$FAILED;
                    }
                    if (s0 === peg$FAILED) {
                      s0 = peg$currPos;
                      s1 = peg$parsedelist();
                      if (s1 !== peg$FAILED) {
                        s2 = peg$parseinto();
                        if (s2 !== peg$FAILED) {
                          s3 = peg$parseassignable();
                          if (s3 !== peg$FAILED) {
                            peg$savedPos = s0;
                            s1 = peg$c339(s1, s3);
                            s0 = s1;
                          } else {
                            peg$currPos = s0;
                            s0 = peg$FAILED;
                          }
                        } else {
                          peg$currPos = s0;
                          s0 = peg$FAILED;
                        }
                      } else {
                        peg$currPos = s0;
                        s0 = peg$FAILED;
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parsepoetic_string() {
    var s0, s1, s2, s3;

    var key    = peg$currPos * 101 + 76,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$currPos;
    s1 = peg$currPos;
    s2 = [];
    if (peg$c340.test(input.charAt(peg$currPos))) {
      s3 = input.charAt(peg$currPos);
      peg$currPos++;
    } else {
      s3 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c341); }
    }
    while (s3 !== peg$FAILED) {
      s2.push(s3);
      if (peg$c340.test(input.charAt(peg$currPos))) {
        s3 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s3 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c341); }
      }
    }
    if (s2 !== peg$FAILED) {
      s1 = input.substring(s1, peg$currPos);
    } else {
      s1 = s2;
    }
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$c342(s1);
    }
    s0 = s1;

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parsepoetic_number() {
    var s0, s1, s2, s3, s4, s5, s6;

    var key    = peg$currPos * 101 + 77,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$currPos;
    s1 = [];
    s2 = peg$parsepoetic_digit_separator();
    while (s2 !== peg$FAILED) {
      s1.push(s2);
      s2 = peg$parsepoetic_digit_separator();
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$parsepoetic_digits();
      if (s2 !== peg$FAILED) {
        s3 = [];
        s4 = peg$parsepoetic_digit_separator();
        while (s4 !== peg$FAILED) {
          s3.push(s4);
          s4 = peg$parsepoetic_digit_separator();
        }
        if (s3 !== peg$FAILED) {
          s4 = peg$parsepoetic_decimal();
          if (s4 === peg$FAILED) {
            s4 = null;
          }
          if (s4 !== peg$FAILED) {
            s5 = [];
            s6 = peg$parsepoetic_digit_separator();
            while (s6 !== peg$FAILED) {
              s5.push(s6);
              s6 = peg$parsepoetic_digit_separator();
            }
            if (s5 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$c343(s2, s4);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parsepoetic_decimal() {
    var s0, s1, s2, s3, s4, s5;

    var key    = peg$currPos * 101 + 78,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$currPos;
    if (input.charCodeAt(peg$currPos) === 46) {
      s1 = peg$c130;
      peg$currPos++;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c131); }
    }
    if (s1 !== peg$FAILED) {
      s2 = [];
      s3 = peg$parsepoetic_decimal_digit_separator();
      while (s3 !== peg$FAILED) {
        s2.push(s3);
        s3 = peg$parsepoetic_decimal_digit_separator();
      }
      if (s2 !== peg$FAILED) {
        s3 = peg$parsepoetic_decimal_digits();
        if (s3 !== peg$FAILED) {
          s4 = [];
          s5 = peg$parsepoetic_decimal_digit_separator();
          while (s5 !== peg$FAILED) {
            s4.push(s5);
            s5 = peg$parsepoetic_decimal_digit_separator();
          }
          if (s4 !== peg$FAILED) {
            peg$savedPos = s0;
            s1 = peg$c344(s3);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 46) {
        s1 = peg$c130;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c131); }
      }
      if (s1 !== peg$FAILED) {
        s2 = [];
        s3 = peg$parsepoetic_decimal_digit_separator();
        while (s3 !== peg$FAILED) {
          s2.push(s3);
          s3 = peg$parsepoetic_decimal_digit_separator();
        }
        if (s2 !== peg$FAILED) {
          s1 = [s1, s2];
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parsepoetic_digit_separator() {
    var s0;

    var key    = peg$currPos * 101 + 79,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$parse_();
    if (s0 === peg$FAILED) {
      if (peg$c345.test(input.charAt(peg$currPos))) {
        s0 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s0 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c346); }
      }
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parsepoetic_digits() {
    var s0, s1, s2, s3, s4;

    var key    = peg$currPos * 101 + 80,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$currPos;
    s1 = [];
    s2 = peg$parsepoetic_digit_separator();
    while (s2 !== peg$FAILED) {
      s1.push(s2);
      s2 = peg$parsepoetic_digit_separator();
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$parsepoetic_digit();
      if (s2 !== peg$FAILED) {
        s3 = [];
        s4 = peg$parsepoetic_digit_separator();
        if (s4 !== peg$FAILED) {
          while (s4 !== peg$FAILED) {
            s3.push(s4);
            s4 = peg$parsepoetic_digit_separator();
          }
        } else {
          s3 = peg$FAILED;
        }
        if (s3 !== peg$FAILED) {
          s4 = peg$parsepoetic_digits();
          if (s4 !== peg$FAILED) {
            peg$savedPos = s0;
            s1 = peg$c347(s2, s4);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      s1 = peg$parsepoetic_digit();
      if (s1 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c348(s1);
      }
      s0 = s1;
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parsepoetic_decimal_digit_separator() {
    var s0;

    var key    = peg$currPos * 101 + 81,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$parse_();
    if (s0 === peg$FAILED) {
      s0 = peg$parsepoetic_digit_separator();
      if (s0 === peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 46) {
          s0 = peg$c130;
          peg$currPos++;
        } else {
          s0 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c131); }
        }
      }
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parsepoetic_decimal_digits() {
    var s0, s1, s2, s3, s4;

    var key    = peg$currPos * 101 + 82,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$currPos;
    s1 = [];
    s2 = peg$parsepoetic_decimal_digit_separator();
    while (s2 !== peg$FAILED) {
      s1.push(s2);
      s2 = peg$parsepoetic_decimal_digit_separator();
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$parsepoetic_digit();
      if (s2 !== peg$FAILED) {
        s3 = [];
        s4 = peg$parsepoetic_decimal_digit_separator();
        if (s4 !== peg$FAILED) {
          while (s4 !== peg$FAILED) {
            s3.push(s4);
            s4 = peg$parsepoetic_decimal_digit_separator();
          }
        } else {
          s3 = peg$FAILED;
        }
        if (s3 !== peg$FAILED) {
          s4 = peg$parsepoetic_decimal_digits();
          if (s4 !== peg$FAILED) {
            peg$savedPos = s0;
            s1 = peg$c347(s2, s4);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      s1 = peg$parsepoetic_digit();
      if (s1 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c348(s1);
      }
      s0 = s1;
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parsepoetic_digit() {
    var s0, s1, s2;

    var key    = peg$currPos * 101 + 83,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$currPos;
    s1 = [];
    if (peg$c349.test(input.charAt(peg$currPos))) {
      s2 = input.charAt(peg$currPos);
      peg$currPos++;
    } else {
      s2 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c350); }
    }
    if (s2 !== peg$FAILED) {
      while (s2 !== peg$FAILED) {
        s1.push(s2);
        if (peg$c349.test(input.charAt(peg$currPos))) {
          s2 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c350); }
        }
      }
    } else {
      s1 = peg$FAILED;
    }
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$c351(s1);
    }
    s0 = s1;

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parsevariable() {
    var s0;

    var key    = peg$currPos * 101 + 84,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$parsecommon_variable();
    if (s0 === peg$FAILED) {
      s0 = peg$parseproper_variable();
      if (s0 === peg$FAILED) {
        s0 = peg$parsepronoun();
        if (s0 === peg$FAILED) {
          s0 = peg$parsesimple_variable();
        }
      }
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parsesimple_variable() {
    var s0, s1, s2, s3, s4, s5;

    var key    = peg$currPos * 101 + 85,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$currPos;
    s1 = peg$currPos;
    s2 = peg$currPos;
    s3 = peg$parseletter();
    if (s3 !== peg$FAILED) {
      s4 = [];
      s5 = peg$parseletter();
      while (s5 !== peg$FAILED) {
        s4.push(s5);
        s5 = peg$parseletter();
      }
      if (s4 !== peg$FAILED) {
        s3 = [s3, s4];
        s2 = s3;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
    } else {
      peg$currPos = s2;
      s2 = peg$FAILED;
    }
    if (s2 !== peg$FAILED) {
      s1 = input.substring(s1, peg$currPos);
    } else {
      s1 = s2;
    }
    if (s1 !== peg$FAILED) {
      peg$savedPos = peg$currPos;
      s2 = peg$c352(s1);
      if (s2) {
        s2 = peg$FAILED;
      } else {
        s2 = void 0;
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c353(s1);
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parseproper_noun() {
    var s0, s1, s2, s3, s4, s5;

    var key    = peg$currPos * 101 + 86,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$currPos;
    s1 = peg$currPos;
    s2 = peg$currPos;
    s3 = peg$parseuppercase_letter();
    if (s3 !== peg$FAILED) {
      s4 = [];
      s5 = peg$parseletter();
      while (s5 !== peg$FAILED) {
        s4.push(s5);
        s5 = peg$parseletter();
      }
      if (s4 !== peg$FAILED) {
        s3 = [s3, s4];
        s2 = s3;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
    } else {
      peg$currPos = s2;
      s2 = peg$FAILED;
    }
    if (s2 !== peg$FAILED) {
      s1 = input.substring(s1, peg$currPos);
    } else {
      s1 = s2;
    }
    if (s1 !== peg$FAILED) {
      peg$savedPos = peg$currPos;
      s2 = peg$c354(s1);
      if (s2) {
        s2 = peg$FAILED;
      } else {
        s2 = void 0;
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c355(s1);
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parseproper_variable() {
    var s0, s1, s2, s3, s4, s5, s6, s7, s8;

    var key    = peg$currPos * 101 + 87,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$currPos;
    s1 = peg$currPos;
    s2 = peg$currPos;
    s3 = peg$parseproper_noun();
    if (s3 !== peg$FAILED) {
      s4 = [];
      s5 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 32) {
        s6 = peg$c356;
        peg$currPos++;
      } else {
        s6 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c357); }
      }
      if (s6 !== peg$FAILED) {
        s7 = peg$currPos;
        s8 = peg$parseproper_noun();
        if (s8 !== peg$FAILED) {
          s7 = input.substring(s7, peg$currPos);
        } else {
          s7 = s8;
        }
        if (s7 !== peg$FAILED) {
          s6 = [s6, s7];
          s5 = s6;
        } else {
          peg$currPos = s5;
          s5 = peg$FAILED;
        }
      } else {
        peg$currPos = s5;
        s5 = peg$FAILED;
      }
      while (s5 !== peg$FAILED) {
        s4.push(s5);
        s5 = peg$currPos;
        if (input.charCodeAt(peg$currPos) === 32) {
          s6 = peg$c356;
          peg$currPos++;
        } else {
          s6 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c357); }
        }
        if (s6 !== peg$FAILED) {
          s7 = peg$currPos;
          s8 = peg$parseproper_noun();
          if (s8 !== peg$FAILED) {
            s7 = input.substring(s7, peg$currPos);
          } else {
            s7 = s8;
          }
          if (s7 !== peg$FAILED) {
            s6 = [s6, s7];
            s5 = s6;
          } else {
            peg$currPos = s5;
            s5 = peg$FAILED;
          }
        } else {
          peg$currPos = s5;
          s5 = peg$FAILED;
        }
      }
      if (s4 !== peg$FAILED) {
        s3 = [s3, s4];
        s2 = s3;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
    } else {
      peg$currPos = s2;
      s2 = peg$FAILED;
    }
    if (s2 !== peg$FAILED) {
      s1 = input.substring(s1, peg$currPos);
    } else {
      s1 = s2;
    }
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$c358(s1);
    }
    s0 = s1;

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parsecrement() {
    var s0;

    var key    = peg$currPos * 101 + 88,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$parseincrement();
    if (s0 === peg$FAILED) {
      s0 = peg$parsedecrement();
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parseincrement() {
    var s0, s1, s2, s3, s4, s5, s6, s7, s8, s9;

    var key    = peg$currPos * 101 + 89,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 5).toLowerCase() === peg$c359) {
      s1 = input.substr(peg$currPos, 5);
      peg$currPos += 5;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c360); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$parse_();
      if (s2 !== peg$FAILED) {
        s3 = peg$parsevariable();
        if (s3 !== peg$FAILED) {
          s4 = peg$parse_();
          if (s4 !== peg$FAILED) {
            s5 = [];
            s6 = peg$currPos;
            if (input.substr(peg$currPos, 2).toLowerCase() === peg$c361) {
              s7 = input.substr(peg$currPos, 2);
              peg$currPos += 2;
            } else {
              s7 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c362); }
            }
            if (s7 !== peg$FAILED) {
              s8 = [];
              s9 = peg$parsenoise();
              while (s9 !== peg$FAILED) {
                s8.push(s9);
                s9 = peg$parsenoise();
              }
              if (s8 !== peg$FAILED) {
                s7 = [s7, s8];
                s6 = s7;
              } else {
                peg$currPos = s6;
                s6 = peg$FAILED;
              }
            } else {
              peg$currPos = s6;
              s6 = peg$FAILED;
            }
            if (s6 !== peg$FAILED) {
              while (s6 !== peg$FAILED) {
                s5.push(s6);
                s6 = peg$currPos;
                if (input.substr(peg$currPos, 2).toLowerCase() === peg$c361) {
                  s7 = input.substr(peg$currPos, 2);
                  peg$currPos += 2;
                } else {
                  s7 = peg$FAILED;
                  if (peg$silentFails === 0) { peg$fail(peg$c362); }
                }
                if (s7 !== peg$FAILED) {
                  s8 = [];
                  s9 = peg$parsenoise();
                  while (s9 !== peg$FAILED) {
                    s8.push(s9);
                    s9 = peg$parsenoise();
                  }
                  if (s8 !== peg$FAILED) {
                    s7 = [s7, s8];
                    s6 = s7;
                  } else {
                    peg$currPos = s6;
                    s6 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s6;
                  s6 = peg$FAILED;
                }
              }
            } else {
              s5 = peg$FAILED;
            }
            if (s5 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$c363(s3, s5);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parsedecrement() {
    var s0, s1, s2, s3, s4, s5, s6, s7, s8, s9;

    var key    = peg$currPos * 101 + 90,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 5).toLowerCase() === peg$c364) {
      s1 = input.substr(peg$currPos, 5);
      peg$currPos += 5;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c365); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$parse_();
      if (s2 !== peg$FAILED) {
        s3 = peg$parsevariable();
        if (s3 !== peg$FAILED) {
          s4 = peg$parse_();
          if (s4 !== peg$FAILED) {
            s5 = [];
            s6 = peg$currPos;
            if (input.substr(peg$currPos, 4).toLowerCase() === peg$c366) {
              s7 = input.substr(peg$currPos, 4);
              peg$currPos += 4;
            } else {
              s7 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c367); }
            }
            if (s7 !== peg$FAILED) {
              s8 = [];
              s9 = peg$parsenoise();
              while (s9 !== peg$FAILED) {
                s8.push(s9);
                s9 = peg$parsenoise();
              }
              if (s8 !== peg$FAILED) {
                s7 = [s7, s8];
                s6 = s7;
              } else {
                peg$currPos = s6;
                s6 = peg$FAILED;
              }
            } else {
              peg$currPos = s6;
              s6 = peg$FAILED;
            }
            if (s6 !== peg$FAILED) {
              while (s6 !== peg$FAILED) {
                s5.push(s6);
                s6 = peg$currPos;
                if (input.substr(peg$currPos, 4).toLowerCase() === peg$c366) {
                  s7 = input.substr(peg$currPos, 4);
                  peg$currPos += 4;
                } else {
                  s7 = peg$FAILED;
                  if (peg$silentFails === 0) { peg$fail(peg$c367); }
                }
                if (s7 !== peg$FAILED) {
                  s8 = [];
                  s9 = peg$parsenoise();
                  while (s9 !== peg$FAILED) {
                    s8.push(s9);
                    s9 = peg$parsenoise();
                  }
                  if (s8 !== peg$FAILED) {
                    s7 = [s7, s8];
                    s6 = s7;
                  } else {
                    peg$currPos = s6;
                    s6 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s6;
                  s6 = peg$FAILED;
                }
              }
            } else {
              s5 = peg$FAILED;
            }
            if (s5 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$c368(s3, s5);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parsesplit() {
    var s0, s1;

    var key    = peg$currPos * 101 + 91,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 3).toLowerCase() === peg$c369) {
      s1 = input.substr(peg$currPos, 3);
      peg$currPos += 3;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c370); }
    }
    if (s1 === peg$FAILED) {
      if (input.substr(peg$currPos, 5).toLowerCase() === peg$c371) {
        s1 = input.substr(peg$currPos, 5);
        peg$currPos += 5;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c372); }
      }
      if (s1 === peg$FAILED) {
        if (input.substr(peg$currPos, 7).toLowerCase() === peg$c373) {
          s1 = input.substr(peg$currPos, 7);
          peg$currPos += 7;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c374); }
        }
      }
    }
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$c375();
    }
    s0 = s1;

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parsecast() {
    var s0, s1;

    var key    = peg$currPos * 101 + 92,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 4).toLowerCase() === peg$c376) {
      s1 = input.substr(peg$currPos, 4);
      peg$currPos += 4;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c377); }
    }
    if (s1 === peg$FAILED) {
      if (input.substr(peg$currPos, 4).toLowerCase() === peg$c378) {
        s1 = input.substr(peg$currPos, 4);
        peg$currPos += 4;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c379); }
      }
    }
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$c380();
    }
    s0 = s1;

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parsejoin() {
    var s0, s1;

    var key    = peg$currPos * 101 + 93,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 4).toLowerCase() === peg$c381) {
      s1 = input.substr(peg$currPos, 4);
      peg$currPos += 4;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c382); }
    }
    if (s1 === peg$FAILED) {
      if (input.substr(peg$currPos, 5).toLowerCase() === peg$c383) {
        s1 = input.substr(peg$currPos, 5);
        peg$currPos += 5;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c384); }
      }
    }
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$c385();
    }
    s0 = s1;

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parsemutator() {
    var s0;

    var key    = peg$currPos * 101 + 94,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$parsesplit();
    if (s0 === peg$FAILED) {
      s0 = peg$parsecast();
      if (s0 === peg$FAILED) {
        s0 = peg$parsejoin();
      }
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parsemodifier() {
    var s0, s1, s2, s3, s4;

    var key    = peg$currPos * 101 + 95,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$currPos;
    s1 = peg$parse_();
    if (s1 !== peg$FAILED) {
      if (input.substr(peg$currPos, 4).toLowerCase() === peg$c336) {
        s2 = input.substr(peg$currPos, 4);
        peg$currPos += 4;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c337); }
      }
      if (s2 === peg$FAILED) {
        if (input.substr(peg$currPos, 5).toLowerCase() === peg$c386) {
          s2 = input.substr(peg$currPos, 5);
          peg$currPos += 5;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c387); }
        }
      }
      if (s2 !== peg$FAILED) {
        s3 = peg$parse_();
        if (s3 !== peg$FAILED) {
          s4 = peg$parsenor();
          if (s4 !== peg$FAILED) {
            peg$savedPos = s0;
            s1 = peg$c388(s4);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parsemutation() {
    var s0, s1, s2, s3, s4, s5, s6;

    var key    = peg$currPos * 101 + 96,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$currPos;
    s1 = peg$parsemutator();
    if (s1 !== peg$FAILED) {
      s2 = peg$parse_();
      if (s2 !== peg$FAILED) {
        s3 = peg$parsenor();
        if (s3 !== peg$FAILED) {
          s4 = peg$parseinto();
          if (s4 !== peg$FAILED) {
            s5 = peg$parseassignable();
            if (s5 !== peg$FAILED) {
              s6 = peg$parsemodifier();
              if (s6 === peg$FAILED) {
                s6 = null;
              }
              if (s6 !== peg$FAILED) {
                peg$savedPos = s0;
                s1 = peg$c389(s1, s3, s5, s6);
                s0 = s1;
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      s1 = peg$parsemutator();
      if (s1 !== peg$FAILED) {
        s2 = peg$parse_();
        if (s2 !== peg$FAILED) {
          s3 = peg$parseassignable();
          if (s3 !== peg$FAILED) {
            s4 = peg$parsemodifier();
            if (s4 === peg$FAILED) {
              s4 = null;
            }
            if (s4 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$c390(s1, s3, s4);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parserounding() {
    var s0;

    var key    = peg$currPos * 101 + 97,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$parsefloor();
    if (s0 === peg$FAILED) {
      s0 = peg$parseceil();
      if (s0 === peg$FAILED) {
        s0 = peg$parsemath_round();
      }
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parsefloor() {
    var s0, s1, s2, s3, s4, s5;

    var key    = peg$currPos * 101 + 98,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 4).toLowerCase() === peg$c391) {
      s1 = input.substr(peg$currPos, 4);
      peg$currPos += 4;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c392); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$parse_();
      if (s2 !== peg$FAILED) {
        s3 = peg$parsevariable();
        if (s3 !== peg$FAILED) {
          s4 = peg$parse_();
          if (s4 !== peg$FAILED) {
            if (input.substr(peg$currPos, 4).toLowerCase() === peg$c366) {
              s5 = input.substr(peg$currPos, 4);
              peg$currPos += 4;
            } else {
              s5 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c367); }
            }
            if (s5 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$c393(s3);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      if (input.substr(peg$currPos, 4).toLowerCase() === peg$c391) {
        s1 = input.substr(peg$currPos, 4);
        peg$currPos += 4;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c392); }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parse_();
        if (s2 !== peg$FAILED) {
          if (input.substr(peg$currPos, 4).toLowerCase() === peg$c366) {
            s3 = input.substr(peg$currPos, 4);
            peg$currPos += 4;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c367); }
          }
          if (s3 !== peg$FAILED) {
            s4 = peg$parse_();
            if (s4 !== peg$FAILED) {
              s5 = peg$parsevariable();
              if (s5 !== peg$FAILED) {
                peg$savedPos = s0;
                s1 = peg$c393(s5);
                s0 = s1;
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parseceil() {
    var s0, s1, s2, s3, s4, s5;

    var key    = peg$currPos * 101 + 99,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 4).toLowerCase() === peg$c391) {
      s1 = input.substr(peg$currPos, 4);
      peg$currPos += 4;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c392); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$parse_();
      if (s2 !== peg$FAILED) {
        s3 = peg$parsevariable();
        if (s3 !== peg$FAILED) {
          s4 = peg$parse_();
          if (s4 !== peg$FAILED) {
            if (input.substr(peg$currPos, 2).toLowerCase() === peg$c361) {
              s5 = input.substr(peg$currPos, 2);
              peg$currPos += 2;
            } else {
              s5 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c362); }
            }
            if (s5 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$c394(s3);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      if (input.substr(peg$currPos, 4).toLowerCase() === peg$c391) {
        s1 = input.substr(peg$currPos, 4);
        peg$currPos += 4;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c392); }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parse_();
        if (s2 !== peg$FAILED) {
          if (input.substr(peg$currPos, 2).toLowerCase() === peg$c361) {
            s3 = input.substr(peg$currPos, 2);
            peg$currPos += 2;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c362); }
          }
          if (s3 !== peg$FAILED) {
            s4 = peg$parse_();
            if (s4 !== peg$FAILED) {
              s5 = peg$parsevariable();
              if (s5 !== peg$FAILED) {
                peg$savedPos = s0;
                s1 = peg$c395(s5);
                s0 = s1;
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }

  function peg$parsemath_round() {
    var s0, s1, s2, s3, s4, s5;

    var key    = peg$currPos * 101 + 100,
        cached = peg$resultsCache[key];

    if (cached) {
      peg$currPos = cached.nextPos;

      return cached.result;
    }

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 4).toLowerCase() === peg$c391) {
      s1 = input.substr(peg$currPos, 4);
      peg$currPos += 4;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c392); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$parse_();
      if (s2 !== peg$FAILED) {
        s3 = peg$parsevariable();
        if (s3 !== peg$FAILED) {
          s4 = peg$parse_();
          if (s4 !== peg$FAILED) {
            if (input.substr(peg$currPos, 5).toLowerCase() === peg$c396) {
              s5 = input.substr(peg$currPos, 5);
              peg$currPos += 5;
            } else {
              s5 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c397); }
            }
            if (s5 === peg$FAILED) {
              if (input.substr(peg$currPos, 6).toLowerCase() === peg$c398) {
                s5 = input.substr(peg$currPos, 6);
                peg$currPos += 6;
              } else {
                s5 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$c399); }
              }
            }
            if (s5 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$c400(s3);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      if (input.substr(peg$currPos, 4).toLowerCase() === peg$c391) {
        s1 = input.substr(peg$currPos, 4);
        peg$currPos += 4;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c392); }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parse_();
        if (s2 !== peg$FAILED) {
          if (input.substr(peg$currPos, 5).toLowerCase() === peg$c396) {
            s3 = input.substr(peg$currPos, 5);
            peg$currPos += 5;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c397); }
          }
          if (s3 === peg$FAILED) {
            if (input.substr(peg$currPos, 6).toLowerCase() === peg$c398) {
              s3 = input.substr(peg$currPos, 6);
              peg$currPos += 6;
            } else {
              s3 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c399); }
            }
          }
          if (s3 !== peg$FAILED) {
            s4 = peg$parse_();
            if (s4 !== peg$FAILED) {
              s5 = peg$parsevariable();
              if (s5 !== peg$FAILED) {
                peg$savedPos = s0;
                s1 = peg$c400(s5);
                s0 = s1;
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    }

    peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

    return s0;
  }


    /* initialiser code - this is JS that runs before the parser is generated */

    const keywords = new Set([
      // common variable prefixes
      'a', 'an', 'the', 'my', 'your',

      // pronouns
      'it', 'he', 'she', 'him', 'her', 'they', 'them', 'ze', 'hir', 'zie', 'zir', 'xe', 'xem', 've', 'ver',

      // literal values
      'mysterious',
      'null', 'nothing', 'nowhere', 'nobody', 'gone',
      'true', 'right', 'yes', 'ok',
      'false', 'wrong', 'no', 'lies',
      'maybe', 'definitely', // reserved for future use
      'empty', 'silent', 'silence',

      // assignment
      'let', 'be', 'put', 'into', 'in', // expression
      'is', 'are', 'was', 'were', 'says', // poetic

      // operations
      'at', 'rock', 'with', 'roll', 'into', 'push', 'pop', 'like', // arrays
      'cut', 'split', 'shatter', 'join', 'unite', 'cast', 'burn', // strings
      'build', 'up', 'knock', 'down', // increment/decrement
      'plus', 'with', 'minus', 'without', 'times', 'of', 'over', 'between', // arithmetic
      'and', // list arithmetic
      'turn', 'up', 'down', 'round', 'around', // rounding
      'and', 'or', 'nor', 'not', // logical

      // comparison
      'is', "isn't", 'isnt', "ain't", 'aint',
      'arent', "aren't", 'wasnt', "wasn't", 'werent', "weren't",
      'not',
      'than',
      'higher', 'greater', 'bigger', 'stronger',
      'lower', 'less', 'smaller', 'weaker',
      'as',
      'high', 'great', 'big', 'strong',
      'low', 'little', 'small', 'weak',

      // input/output
      'listen', 'to',
      'say', 'shout', 'whisper', 'scream',

      // control flow
      'if', 'else',
      'while', 'until',
      'break', 'continue',
      'break', 'it', 'down',
      'take', 'it', 'to', 'the', 'top',
      'take',

      // functions
      'takes', 'wants',
      'give', 'return', 'send', 'back',
      'taking',
    ])

    function isKeyword(string) {
      return keywords.has(string.toLowerCase());
    }


  peg$result = peg$startRuleFunction();

  if (peg$result !== peg$FAILED && peg$currPos === input.length) {
    return peg$result;
  } else {
    if (peg$result !== peg$FAILED && peg$currPos < input.length) {
      peg$fail(peg$endExpectation());
    }

    throw peg$buildStructuredError(
      peg$maxFailExpected,
      peg$maxFailPos < input.length ? input.charAt(peg$maxFailPos) : null,
      peg$maxFailPos < input.length
        ? peg$computeLocation(peg$maxFailPos, peg$maxFailPos + 1)
        : peg$computeLocation(peg$maxFailPos, peg$maxFailPos)
    );
  }
}

module.exports = {
  SyntaxError: peg$SyntaxError,
  parse:       peg$parse
};

},{}]},{},[2])(2)
});
