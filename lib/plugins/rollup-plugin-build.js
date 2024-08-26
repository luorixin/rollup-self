function build() {
    return {
        name: 'build',
        options() {
            console.log('options')
        },
        buildStart() {
            console.log('buildStart')
        },
        async resolveId(source, importer) {

        },
        async load(id) {

        },
        async shouldTransformCachedModule({code, id}) {

        },
        async transform(code, id) {

        },
        buildEnd() {
            console.log('buildEnd')
        },
    }
}

export default build