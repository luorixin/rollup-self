const walk = require("./ast/walk")

function hasOwnProperty(obj, prop) {
    return Object.hasOwnProperty.call(obj, prop)
}

function replaceIdentify(statement, source, replacements) {
    walk(statement, {
        enter(node) {
            if (node.type === 'Identifier') {
                if (node.name && replacements[node.name]) {
                    source.overwrite(node.start, node.end, replacements[node.name])
                }
            }
        }
    })
}

exports.hasOwnProperty = hasOwnProperty
exports.replaceIdentify = replaceIdentify