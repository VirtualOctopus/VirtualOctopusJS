module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    plugins: [
        '@typescript-eslint',
    ],
    env: {
        'es6': true,
        'node': true,
        'jest': true,
        'browser': true
    },
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/eslint-recommended',
        'plugin:@typescript-eslint/recommended',
    ],
    rules: {
        "semi": [2], // must end with semi
        "no-extra-semi": [0],
        "@typescript-eslint/no-explicit-any": [0],
        "@typescript-eslint/ban-ts-comment": [0]
    }
};