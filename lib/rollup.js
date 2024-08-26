const Bundle = require("./bundle")

function rollup(entry, output) {
    const bundle = new Bundle({entry})
    bundle.build(output)
}
module.exports = rollup