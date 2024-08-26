const walk = require('./walk')
const Scope = require('./scope')
const { hasOwnProperty } = require('../utils')

function analyse(ast, code, module) {
    // 开启第一轮循环，找出本模块导入导出了哪些模块
    ast.body.forEach((statement) => {
        Object.defineProperties(statement, {
            _included: { value: false, writable: true }, // 表示这条语句默认不包含在输出结果里
            _module: { value: module }, // 指向自己模块
            // 这个语句对应自己的源码
            _source: { value: code.snip(statement.start, statement.end) },
            _dependsOn: { value: {} }, // 依赖的变量
            _defines: { value: {} }, // 存放本语句定义了哪些变量
            _modifies: {value: {}} // 存放本语句修改了哪些变量
        })
        // 找出导入了哪些变量
        if(statement.type === 'ImportDeclaration') {
            // 获取导入模块的相对路径
            let source = statement.source.value
            statement.specifiers.forEach(specifier => {
                let importName = specifier.imported.name
                let localName = specifier.local.name
                // 当前模块导入的变量名localname来自sorce模块导出的importname
                module.imports[localName] = {source, importName}
            })
        } else if (statement.type === 'ExportNamedDeclaration') {
            const declaration = statement.declaration
            if (declaration && declaration.type === 'VariableDeclaration') {
                const declarations = declaration.declarations
                declarations.forEach(variableDeclarator => { // var a=1,b=2,c=3
                    const localName = variableDeclarator.id.name
                    const exportName = localName
                    module['exports'][exportName] = { localName }
                })
            }
        }
    })
    // 开启第二轮循环，创建作用域链，知道哪些没用到
    // 还得分辨是否局部或者全局变量
    let currentScope = new Scope({name: '模块内顶级作用域'})
    ast.body.forEach(statement => {
        function addToScope(name, isBlockDeclaration) {
            currentScope.add(name, isBlockDeclaration)
            if (!currentScope.parent || (currentScope.isBlock && !isBlockDeclaration)) { // 顶级作用域
                // 表示此语句定义了一个顶级变量
                statement._defines[name] = true
                // 此顶级变量的定义语句
                module.definitions[name] = statement
            }
        }
        function checkForReads(node) {
            if (node.type === 'Identifier') {
                statement._dependsOn[node.name] = true
            }
        }
        function checkForWrites(node) {
            function addNode(node) {
                const { name } = node // name, age
                statement._modifies[name] = true
                if (!hasOwnProperty(module.modifications, name)) {
                    module.modifications[name] = []
                }
                // 存放此变量对应的所有修改语句
                module.modifications[name].push(statement)
            }
            if (node.type === 'AssignmentExpression') {
                addNode(node.left, true)
            } else if (node.type === 'UpdateExpression') {
                addNode(node.argument, true)
            }
        }
        walk(statement, {
            enter(node){
                checkForReads(node)
                checkForWrites(node)
                let newScope
                switch (node.type) {
                    case 'FunctionDeclaration':
                    case 'ArrowFunctionDeclaration':
                        addToScope(node.id.name) // 吧函数名添加到当前的作用域中
                        const names = node.params.map(param => param.name)
                        newScope = new Scope({
                            name: node.id.name,
                            parent: currentScope,
                            names,
                            isBlock: false // 函数创建的不是一个块级作用域
                        })
                        break;
                    case 'VariableDeclaration':
                        node.declarations.forEach(declaration => {
                            if (node.kind === 'let' || node.kind === 'const') {
                                addToScope(declaration.id.name, true)
                            } else {
                                addToScope(declaration.id.name)
                            }
                        })
                        break;
                    case 'BlockStatement':
                        newScope = new Scope({
                            parent: currentScope,
                            isBlock: true
                        })
                        break;
                    default:
                        break;
                }
                if (newScope) {
                    Object.defineProperty(node, '_scope', {value: newScope})
                    currentScope = newScope
                }
            },
            leave(node) {
                if (Object.hasOwnProperty(node, '_scope')) {
                    currentScope = currentScope.parent
                }
            }
        })
    })
}

module.exports = analyse