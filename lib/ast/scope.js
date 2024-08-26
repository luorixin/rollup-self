class Scope {
    constructor(options ={}) {
        this.name = options.name
        this.parent = options.parent
        this.names = options.names || []
        // 表示是不是块作用域 let const
        this.isBlock = !!options.isBlock
    }
    add(name, isBlockDeclaration) {
        // 作用域提升
        if (!isBlockDeclaration && this.isBlock) {
            this.parent.add(name, isBlockDeclaration)
        } else {
            this.names.push(name)
        }
    }
    findDefiningScope(name) {
        if (this.names.includes(name)) {
            return this
        } else if (this.parent) {
            return this.parent.findDefiningScope(name)
        } else {
            return null
        }
    }
}

module.exports = Scope