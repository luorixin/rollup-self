const path = require('path')
const fs = require('fs')
const MagicString = require('magic-string')
const Module = require('./module')
const { hasOwnProperty, replaceIdentify } = require('./utils')

class Bundle {
    constructor(options) {
        // 入口绝对路径
        this.entryPath = path.resolve(options.entry.replace(/\.js$/, '')+ '.js')
    }
    build(output) {
        const entryModule = this.fetchModule(this.entryPath)
        this.statements = entryModule.expandAllStatements()
        this.deconflict()
        const { code } = this.generate()
        fs.writeFileSync(output, code)
    }
    deconflict() {
        const defines = {}
        const conflicts = {} //变量名冲突
        this.statements.forEach(statement => {
            Object.keys(statement._defines).forEach(name => {
                if (hasOwnProperty(defines, name)) {
                    conflicts[name] = true
                } else {
                    defines[name] = []
                }
                // 把此变量定义语句对应模块放到数组
                defines[name].push(statement._module)
            })
        })
        Object.keys(conflicts).forEach(name => {
            const modules = defines[name]
            modules.pop() // 保留最后一个模块的变量名
            modules.forEach((module, index) => {
                let replacement = `${name}$${modules.length - index}`
                module.rename(name, replacement)
            })
        })
    }
    generate() {
        let bundle = new MagicString.Bundle()
        this.statements.forEach(statement => {
            let replacements = []
            // 获取变量数组
            Object.keys(statement._dependsOn)
            .concat(Object.keys(statement._defines))
            .forEach(name => {
                const canonicalName = statement._module.getCanonicalName(name)
                if (name !== canonicalName) {
                    replacements[name] = canonicalName
                }
            })
            const source = statement._source.clone()
            if (statement.type === 'ExportNamedDeclaration') {
                // 删除export var name = 'js' 中的'export '
                source.remove(statement.start, statement.declaration.start)
            }
            replaceIdentify(statement, source, replacements)
            bundle.addSource({
                content: source,
                separator: '\n'
            })
        })
        return {code: bundle.toString()}
    }
    /**
     * 创建模块实例
     * @param {*} importee  被引入的模块 ./msg.js
     * @param {*} importer  引入别的模块的模块 main.js
     * @returns 
     */
    fetchModule(importee, importer) {
        let route
        if (!importer) {
            route = importee
        } else {
            if (path.isAbsolute(importee)) {
                route = importee
            } else {
                route = path.resolve(path.dirname(importer), importee.replace(/\.js$/, '')+ '.js')
            }
        }
        if (route) {
            const code = fs.readFileSync(route, 'utf-8')
            const module = new Module({
                code,
                path: route,
                bundle: this
            })
            return module
        }
    }
}
module.exports = Bundle