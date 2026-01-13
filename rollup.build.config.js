import terser from '@rollup/plugin-terser';

export default [
    {
        input: "rollup.build.all.index.js",
        output: [
            {
                file: 'build/performs.module.js',
                format: 'esm',
                banner: '// This is a generated file. Do not edit. \n // Developers: @japopra @evallsg @carolinadcf'
            },
            {
                file: 'build/performs.module.min.js',
                format: 'esm',
                banner: '// This is a generated file. Do not edit. \n // Developers: @japopra @evallsg @carolinadcf',
                plugins: [terser()]
            }
        ]
    },
    {
        input: "rollup.build.nogui.index.js",
        output: [
            {
                file: 'build/performs.nogui.module.js',
                format: 'esm',
                banner: '// This is a generated file. Do not edit. \n // Developers: @japopra @evallsg @carolinadcf'
            },
            {
                file: 'build/performs.nogui.module.min.js',
                format: 'esm',
                banner: '// This is a generated file. Do not edit. \n // Developers: @japopra @evallsg @carolinadcf',
                plugins: [terser()]
            }
        ]
    }
];