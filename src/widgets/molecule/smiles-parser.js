var _ = require("underscore");


var smilesRe = new RegExp("^[A-Za-z\\[\\]()=#+-]*$");
var atomRe = new RegExp("[CONPSFBI]|\\[");

function ParseError(message) {
    this.message = message;
}

/**
 * Perform a functional update of a possibly nested object.
 *
 * Args:
 *     obj: an object, will not be modified
 *     keyOrKeylist: either a key or list of keys whose values will be updated
 *         in the object.  If a list of keys is provided, this represents a
 *         path to a value inside nested objects.  For example, if keyOrKeylist
 *         == "a", then a new object is returned with obj["a"] updated; if
 *         keyOrKeylist == ["a", "b", "c"], then a new object is returned with
 *         obj["a"]["b"]["c"] updated.  Note that if any of the keys is not
 *         already present, this will insert {} as a default value for that
 *         key.
 *     val: the new value to associate with the key or keypath
 *
 * Return: a new object, which is a shallow copy of the original with the value
 *     at the specified key[path] replaced.
 */
function _mset(obj, keyOrKeylist, val) {
    if (_.isArray(keyOrKeylist)) {
        var k0 = keyOrKeylist[0];
        var rest = _.rest(keyOrKeylist);
        var newObj = _.clone(obj) || {};
        var newVal = val;
        if (rest.length > 0) {
            newVal = _mset(newObj[k0], rest, val);
        }
        newObj[k0] = newVal;
        return newObj;
    }

    var newObj = _.clone(obj);
    newObj[keyOrKeylist] = val;
    return newObj;
}


/**
 * Perform a functional increment of a value in a nested object.
 *
 * Args:
 *     obj: an object; this will not be modified
 *     keylist: a list of keys representing a path into a nested object.  (See
 *         `_mset` for examples.)
 *
 * Return:
 *     an object that is a shallow copy of obj, with the value at the specified
 *     path incremeneted.
 */
function _inc(obj, keylist) {
    var val = _.reduce(keylist, function(acc, elt) {
        return acc[elt];
    }, obj);

    return  _mset(obj, keylist, val + 1);
}


function validate(smiles) {
    return smilesRe.test(smiles);
}


/**
 * Parse a bond modifier character, updating the context object so that the
 * next bond created has this modifier.
 */
function parseBondModifier(smiles, ctx) {
    var firstChar = smiles[0];
    var rest = smiles.slice(1);
    if (firstChar === "=") {
        return parse(rest, _mset(ctx, ["bond", "bondType"], "double"));
    } else if (firstChar === "#") {
        return parse(rest, _mset(ctx, ["bond", "bondType"], "triple"));
    }
    throw new ParseError("Invalid character: " + firstChar);
}


/**
 * Slice the input string, removing a parenthesized expression.
 * (Will handle nested parentheses.)
 *
 * parenStack should be a list containing any open parentheses already
 * encountered.  (Usually, this will be ["("])
 */
function sliceFromMatchingCloseParen(smiles, parenStack) {
    if (parenStack.length === 0) {
        return smiles;
    }

    if (smiles === "") {
        throw new ParseError("Mismatched parentheses");
    }

    var firstChar = smiles[0];
    var rest = smiles.slice(1);

    if (firstChar === "(") {
        return sliceFromMatchingCloseParen(rest, parenStack.concat(firstChar));
    }

    if (firstChar ===  ")") {
        return sliceFromMatchingCloseParen(rest, _.rest(parenStack));
    }

    return sliceFromMatchingCloseParen(rest, parenStack);
}


/**
 * Parse a branch, as indicated by the presence of a parenthesized experession.
 *
 * This returns a list of all branches (including the continuation of the
 * backbone) that should be added to the previous atom's bond list.
 */
function parseParenthesizedExpression(smiles, ctx) {
    var firstChar = smiles[0];
    var rest = smiles.slice(1);
    if (firstChar === "(") {
        var newCtx = _mset(ctx, "parens", ctx.parens + "(");
        // increment the branch index
        newCtx = _inc(ctx, ["idx", ctx.idx.length - 1, 1]);

        var inBranchIdx = -1;
        if (ctx.idx[ctx.idx.length - 1][0] % 2 === 0) {
            // HACK(colin): this is so that we preserve the odd/even series in
            // indices in branches; the layout engine uses this to select
            // angles, and if we don't do this, editing one part of a molecule
            // can cause another to flop around oddly.
            // TODO(colin): this should just start at 0 all the time, and the
            // layout engine should figure out continuity.
            inBranchIdx = 0;
        }
        var parenCtx = _mset(newCtx, "idx", newCtx.idx.concat([[inBranchIdx, 0]]));
        parenCtx = _mset(parenCtx, "parens", parenCtx.parens.concat("("));
        var parenExpr = parse(rest, parenCtx);
        var remainder = parse(sliceFromMatchingCloseParen(rest, ["("]), newCtx);
        return [parenExpr].concat(remainder);
    } else if (firstChar === ")") {
        if (_.last(ctx.parens) !== "(") {
            throw new ParseError("Mismatched parentheses");
        }
        return null;
    } else {
        throw new ParseError("Invalid bare character: " + firstChar);
    }
}


/**
 * Get the symbol of the next atom in the molecule.
 *
 * Return a 2-element list containing that symbol and the remainder of the
 * molecule.
 */
function readAtomSymbol(smiles, _ctx) {
    var sym = null;
    var rest = null;
    if (smiles[0] === "[") {
        var closingIdx = smiles.indexOf("]");
        if (closingIdx === -1) {
            return ["", smiles];
        }
        sym = smiles.slice(1, closingIdx);
        rest = smiles.slice(closingIdx + 1);
    } else if ((new RegExp("^(Cl|Br)")).test(smiles)) {
        sym = smiles.slice(0, 2);
        rest = smiles.slice(2);
    } else {
        sym = smiles[0];
        rest = smiles.slice(1);
    }

    return [sym, rest];
}


/**
 * Parse the next atom in the molecule, returning an atom object if this is the
 * first atom in the molecule, or a bond object with this atom as the
 * destination of the bond if this is not the first atom.
 */
function parseAtom(smiles, ctx) {
    var symbolInfo = readAtomSymbol(smiles, ctx);
    var atom = symbolInfo[0];
    if (atom === "") {
        return ["error", "Unable to parse bracketed atom."];
    }
    var rest = symbolInfo[1];

    // Atoms are indexed by a list of two-element lists.  In each two-element
    // list, the first element is the atom counter, and the second element is
    // the branch counter.  Branches are 1-indexed so that the main chain of
    // the molecule can be indicated by 0.  Atoms may be either 0- or
    // 1-indexed, defaulting to 1, to maintain a alternating pattern of
    // odd/even indices. So, for example, if an atom has a branch off the main
    // chain, and its atom index is x, then the indices of atoms are:
    //     Atom where branch occurs: [[x, 0]]
    //     First atom in the branch: [[x, 1], [1, 0]]  (assuming x is even)
    //     Next atom in the main chain: [[x + 1, 0]]

    // increment the atom counter and reset the branch counter
    var newCtx = _mset(ctx, ["idx", ctx.idx.length - 1],
                       [1 + ctx.idx[ctx.idx.length - 1][0], 0]);
    var restOfMolecule = parse(
        rest, _mset(newCtx, ["bond", "bondType"], "single"));
    if (! _.isArray(restOfMolecule) && !!restOfMolecule) {
        //TODO(colin): fix this awkwardness.
        restOfMolecule = [restOfMolecule];
    }
    var atomObj = {
        type: "atom",
        symbol: atom,
        bonds: restOfMolecule,
        idx: newCtx.idx,
    };
    if (ctx.bond) {
        return {
            type: "bond",
            bondType: ctx.bond.bondType,
            to: atomObj,
        };
    }
    return atomObj;
}

function isAtomChar(s) {
    return atomRe.test(s);
}

function isModifierChar(s) {
    return s === "=" || s === "#";
}

/**
 * Parse a SMILES string to an internal tree representation.
 *
 * Args:
 *   smiles [string]: a string representing the molecule.
 *
 * Returns: the parse tree (see top-of file docstring for details).
 *
 * Throws:
 *     ParseError: if the input is not valid SMILES or contains features not
 *         yet implemented.
 */
function parse(smiles, ctx) {
    if (!validate(smiles)){
        throw new ParseError("Invalid input.");
    }

    if (!smiles || smiles.length === 0) {
        return null;
    }

    if (isAtomChar(smiles[0])) {
        return parseAtom(smiles, ctx || {idx: [[0, 0]], parens: [], stack: [],
                                         bondModifiers: []});
    } else if (isModifierChar(smiles[0])) {
        return parseBondModifier(smiles, ctx);
    } else {
        // TODO(colin): add additional cases for unimplemented bits of SMILES
        // syntax.
        return parseParenthesizedExpression(smiles, ctx);
    }
}

module.exports = {parse: parse, ParseError: ParseError};