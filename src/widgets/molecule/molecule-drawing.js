var _ = require("underscore");

var bgColor = 'rgb(255, 255, 255)';
var fgColor = 'rgb(0, 0, 0)';
var fontSizePx = 12;
var font = fontSizePx + "px sans";
var lineWidth = 1;

/**
 * Draw some text into a 2D canvas drawing context.
 *
 * Args:
 *     ctx: the 2D drawing context
 *     item: the rendering instruction for the text.  Must look like: {
 *         type: "text",
 *         pos: [x, y],
 *         value: "some text to draw",
 *     }
 *
 */
function drawText(ctx, item) {
    if (item.value === null) { return; }
    var path = new Path2D();
    ctx.fillStyle = 'rgb(0, 0, 0)';
    ctx.font = font;
    ctx.fillText(item.value, item.pos[0] - fontSizePx/2 + 1, item.pos[1] + fontSizePx/2);
}


/**
 * Draw a double line into a 2D canvas drawing context.
 *
 * Apparently the way you do this is to stroke an extra-wide line in the
 * foreground color and then a smaller line in the background color. 5:3
 * foreground:background width looks reasonable for drawing chemical bonds.
 *
 * Args:
 *     ctx: the 2D drawing context
 *     item: the rendering instruction for the line.  Must look like: {
 *         type: "line:double",
 *         startPos: [x, y],
 *         endPos: [x, y],
 *     }
 */
function drawDoubleLine(ctx, item) {
    var path = new Path2D();
    ctx.lineWidth = 5*lineWidth;
    ctx.strokeStyle = fgColor;
    path.moveTo(item.startPos[0], item.startPos[1]);
    path.lineTo(item.endPos[0], item.endPos[1]);
    ctx.stroke(path);
    path = new Path2D();
    ctx.lineWidth = 3*lineWidth;
    ctx.strokeStyle = bgColor;
    path.moveTo(item.startPos[0], item.startPos[1]);
    path.lineTo(item.endPos[0], item.endPos[1]);
    ctx.stroke(path);
}


/**
 * Draw a triple line into a 2D canvas drawing context.
 *
 * Following the strategy for the double line, we stroke a very wide
 * foreground-color line, then a medium background-color line, then a narrow
 * foreground-color line.
 *
 * Args:
 *     ctx: the 2D drawing context
 *     item: the rendering instruction for the line.  Must look like: {
 *         type: "line:triple",
 *         startPos: [x, y],
 *         endPos: [x, y],
 *     }
 */
function drawTripleLine(ctx, item) {
    var path = new Path2D();
    ctx.lineWidth = 7*lineWidth;
    ctx.strokeStyle = 'rgb(0, 0, 0)';
    path.moveTo(item.startPos[0], item.startPos[1]);
    path.lineTo(item.endPos[0], item.endPos[1]);
    ctx.stroke(path);
    path = new Path2D();
    ctx.lineWidth = 5*lineWidth;
    ctx.strokeStyle = 'rgb(255, 255, 255)';
    path.moveTo(item.startPos[0], item.startPos[1]);
    path.lineTo(item.endPos[0], item.endPos[1]);
    ctx.stroke(path);
    drawLine(ctx, item);
}

/**
 * Draw a single line into a 2D canvas drawing context
 *
 * Args:
 *     ctx: the 2D drawing context
 *     item: the rendering instruction for the line.  Must look like: {
 *         type: "line:single",
 *         startPos: [x, y],
 *         endPos: [x, y],
 *     }
 */
function drawLine(ctx, item) {
    var path = new Path2D();
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = 'rgb(0, 0, 0)';
    path.moveTo(item.startPos[0], item.startPos[1]);
    path.lineTo(item.endPos[0], item.endPos[1]);
    ctx.stroke(path);
}


/**
 * Lookup table that maps drawing instruction types to the functions that
 * render them.
 */
var drawingFuncs = {
    text: drawText,
    "line:single": drawLine,
    "line:double": drawDoubleLine,
    "line:triple": drawTripleLine,
};

/**
 * Draw a single rendering instruction into a 2D canvas drawing context.
 */
function drawItem(ctx) {
    return function(item) { drawingFuncs[item.type](ctx, item) };
}

/**
 * Lookup table for drawing priorities.
 *
 * Types with lower priorities are drawn first.
 */
var ordering = {
    "line:single": 0,
    "line:double": 0,
    "line:triple": 0,
    text: 1,
};

/**
 * Sorting comparison function that orders rendering instructions according to
 * their type's priority.
 */
function compareElements(item0, item1) {
    return ordering[item0.type] - ordering[item1.type];
}

/**
 * Draw an array of rendering instructions into a 2D canvas drawing context.
 */
function draw(ctx, items) {
    _.each(items.sort(compareElements), drawItem(ctx));
}

module.exports = draw;
