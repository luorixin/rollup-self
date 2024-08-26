const MagicString = require('magic-string')
const { parse } = require('acorn')
const analyse = require('./ast/analyse')
const { hasOwnProperty } = require('./utils')
const SYSTEM_VARS = ['console', 'log']

class Module {
    constructor({code, path, bundle}) {
        this.code = new MagicString(code)
        this.path = path
        this.bundle = bundle
        this.ast = parse(code, {
            ecmaVersion: 8,
            sourceType: 'module'
        })
        this.imports = {}
        this.exports = {}
        // 存放本模块顶级变量的定义语句
        this.definitions = {}
        // 存放变量修改语句
        this.modifications = {}
        // 重命名的变量
        this.cannoicalNames = {}
        analyse(this.ast, this.code, this)
    }
    expandAllStatements() {
        let allStatements = []
        this.ast.body.forEach(statement => {
            if (statement.type === 'ImportDeclaration') return
            // 默认情况下不包括所有的变量声明语句
            if (statement.type === 'VariableDeclaration') return
            let statements = this.expandStatement(statement)
            allStatements.push(...statements)
        })
        return allStatements
    }
    expandStatement(statement) {
        statement._included = true
        let result = []
        // 找到此语句使用的变量，提取出来放到result中
        const _dependsOn = Object.keys(statement._dependsOn)
        _dependsOn.forEach(name => {
            let definitions = this.define(name)
            result.push(...definitions)
        })
        result.push(statement)
        // 还要找到此语句定义的变量，把此变量对应的修改语句包括进来
        const defines = Object.keys(statement._defines)
        defines.forEach(name => {
            const modifications = hasOwnProperty(this.modifications, name) && this.modifications[name]
            if (modifications) {
                modifications.forEach(modification => {
                    if (!modification._included) {
                        let statement = this.expandStatement(modification)
                        result.push(...statement)
                    }
                })
            }
        })
        return result
    }
    define(name) {
        // 区分变量是函数内自己申明还是外部导入
        if (hasOwnProperty(this.imports, name)) {
            // 获取是从哪个模块导入的变量
            const { source, importName } = this.imports[name]
            // soure 当前模块的相对路径，path当前模块的绝对路径
            const importedModule = this.bundle.fetchModule(source, this.path)
            const { localName } = importedModule.exports[importName] // msg.js exports[name]
            return importedModule.define(localName)
        } else {
            // 如果非导入模块，是本地模块
            let statement = this.definitions[name]
            if (statement) {
                if (statement._included) {
                    return []
                } else {
                    return this.expandStatement(statement)
                }
            } else {
                if (SYSTEM_VARS.includes(name)) {
                    return []
                } else {
                    throw new Error(`变量${name}即没有从外部导入，也没有在当前模块内声明`)
                }
            }
        }
    }
    rename(name, replacement) {
        this.cannoicalNames[name] = replacement
    }
    getCanonicalName(name) {
        return this.cannoicalNames[name] || name
    }
}
module.exports = Module