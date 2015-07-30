var React = require("react");

var Changeable = require("../mixins/changeable.jsx");
var EditorJsonify = require("../mixins/editor-jsonify.jsx");
var NumberInput = require("../components/number-input.jsx");
var TextInput = require("../components/text-input.jsx");

var draw = require("./molecule/molecule-drawing.js");
var layout = require("./molecule/molecule-layout.js");
var parse = require("./molecule/smiles-parser.js");

var borderSize = 30;

var MoleculeWidget = React.createClass({
    propTypes: {
        smiles: React.PropTypes.string,
        rotationAngle: React.PropTypes.number,
    },

    getDefaultProps: function() {
        return {rotationAngle: 0};
    },

    getInitialState: function() {
        return {parsedSmiles: null};
    },

    simpleValidate: function() {
        return {type: "points", earned: 0, total: 0, message: null};
    },

    getUserInput: function() {
        return [];
    },

    setCanvasBounds: function(canvas, items) {
        var xmax = _.max(items, function(item) {
            if (! item.pos) {
                return -Infinity;
            }
            return item.pos[0];
        }).pos[0];
        var ymax = _.max(items, function(item) {
            if (! item.pos) {
                return -Infinity;
            }
            return item.pos[1];
        }).pos[1];
        var xmin = _.min(items, function(item) {
            if (! item.pos) {
                return Infinity;
            }
            return item.pos[0];
        }).pos[0];
        var ymin = _.min(items, function(item) {
            if (! item.pos) {
                return Infinity;
            }
            return item.pos[1];
        }).pos[1];
        var width = xmax - xmin + 2*borderSize;
        var height = ymax - ymin + 2*borderSize;
        canvas.width = width;
        canvas.height = height;
        return [borderSize - xmin, borderSize - ymin];
    },

    canvasRender: function() {
        if (this.state.parsedSmiles[0] === "error") { return; }
        var items = layout(this.state.parsedSmiles, this.props.rotationAngle);
        var canvas = document.getElementById(this.props.widgetId + "-molecule");
        var translation = this.setCanvasBounds(canvas, items);
        var ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.translate(translation[0], translation[1]);
        draw(ctx, items);
        ctx.restore();
    },

    componentWillReceiveProps: function(nextProps) {
        console.log(nextProps);
        this.setState({
            parsedSmiles: parse(nextProps.smiles),
        });
    },

    componentWillMount: function() {
        this.setState({
            parsedSmiles: parse(this.props.smiles),
        });
    },

    componentDidMount: function() {
        this.canvasRender();
    },

    componentDidUpdate: function() {
        this.canvasRender();
    },

    validate: function(state, rubric) {
        return {
            type: "points",
            earned: 0,
            total: 0,
            message: null
        };
    },

    focus: function() {
        this.refs.canvas.focus();
        return true;
    },

    render: function () {
        // TODO(colin): escape the punctuation in the SMILES alt text for
        // screen readers?
        var content = <canvas className="molecule-canvas" id={this.props.widgetId + "-molecule"} ref="canvas">
            A molecular structure drawing.  SMILES notation:
            {this.props.smiles}.
        </canvas>
        if (this.state.parsedSmiles && this.state.parsedSmiles[0] === "error") {
            content = <div className="error">{this.state.parsedSmiles[1]}</div>;
        }
        return <div className="molecule-canvas">{content}</div>;
    },
});

var MoleculeWidgetEditor = React.createClass({
    propTypes: {
        smiles: React.PropTypes.string,
        rotationAngle: React.PropTypes.number,
    },

    mixins: [Changeable, EditorJsonify],

    updateMolecule: function(newValue) {
        this.change({smiles: newValue});
    },

    updateRotation: function(newValue) {
        this.change({rotationAngle: newValue});
    },

    render: function() {
        return <div>
        <div>
            <label>SMILES:&nbsp;
                <TextInput onChange={this.updateMolecule}
                           value={this.props.smiles} />
            </label>
        </div>
        <div>
            <label>Rotation (deg):&nbsp;
                <NumberInput onChange={this.updateRotation}
                             value={this.props.rotationAngle} />
            </label>
        </div>
        </div>;
    },

});

module.exports = {
    name: "reaction-arrow",
    displayName: "Reaction arrow",
    hidden: false,
    widget: ReactionArrowWidget,
    editor: ReactionArrowWidgetEditor,
}