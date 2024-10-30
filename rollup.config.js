// Example rollup.config.js
export default {
    input: 'src/main.js',
    output: {
        file: 'dist/script.js',
        format: 'iife',
        name: 'TiTo' // Global namespace for our app
    }
};
